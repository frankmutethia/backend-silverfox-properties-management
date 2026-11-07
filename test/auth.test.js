import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { ADMIN, ctx, guest, signedIn, upload, useTestApp } from "./helpers.js";

useTestApp();

const API = "/api/v1";

test("health check responds", async () => {
  const res = await guest().get(`${API}/health`).expect(200);
  assert.equal(res.body.success, true);
});

test("signs in with a session cookie and returns the user without secrets", async () => {
  const agent = guest();
  const res = await agent.post(`${API}/auth/login`).send({ email: "ADMIN@silverfox.test", password: ADMIN.password }).expect(200);
  assert.match(res.headers["set-cookie"][0], /^accessToken=.+HttpOnly/);
  assert.equal(res.body.data.user.email, ADMIN.email);
  assert.equal(res.body.data.user.name, ADMIN.name);
  assert.equal(res.body.data.user.password, undefined);

  const me = await agent.get(`${API}/auth/me`).expect(200);
  assert.equal(me.body.data.user.email, ADMIN.email);

  await agent.post(`${API}/auth/logout`).expect(200);
  await agent.get(`${API}/auth/me`).expect(401);
});

test("rejects wrong passwords and unknown emails with the same message", async () => {
  const wrong = await guest().post(`${API}/auth/login`).send({ email: ADMIN.email, password: "nope-nope-nope" }).expect(401);
  const unknown = await guest().post(`${API}/auth/login`).send({ email: "x@y.test", password: "nope-nope-nope" }).expect(401);
  assert.equal(wrong.body.message, unknown.body.message);
  assert.equal(wrong.body.success, false);
});

test("validates input with a readable message", async () => {
  const res = await guest().post(`${API}/auth/login`).send({ email: "not-an-email" }).expect(400);
  assert.match(res.body.message, /email/);
  assert.ok(Array.isArray(res.body.errors));
});

test("accepts a Bearer token for API clients", async () => {
  const { User } = await import("../src/models/User.model.js");
  const user = await User.findOne({ email: ADMIN.email });
  await request(ctx.app).get(`${API}/auth/me`).set("Authorization", `Bearer ${user.generateAccessToken()}`).expect(200);
});

test("refuses state-changing requests from untrusted origins", async () => {
  const res = await request(ctx.app)
    .post(`${API}/auth/login`)
    .set("Origin", "https://evil.test")
    .send({ email: ADMIN.email, password: ADMIN.password })
    .expect(403);
  assert.equal(res.body.message, "Request origin is not allowed");
});

test("staff routes require sign-in", async () => {
  await guest().get(`${API}/admin/dashboard`).expect(401);
  await guest().get(`${API}/properties/admin/all`).expect(401);
  await guest().post(`${API}/media`).expect(401);
});

test("resets a password with a single-use link and signs out old sessions", async () => {
  const oldSession = await signedIn();
  const forgot = await guest().post(`${API}/auth/forgot-password`).send({ email: ADMIN.email }).expect(200);
  const resetUrl = forgot.body.data.resetUrl;
  assert.match(resetUrl, /^https:\/\/site\.test\/staff\/reset-password\?token=/);
  const token = new URL(resetUrl).searchParams.get("token");

  // Unknown emails get the same response and no link.
  const unknown = await guest().post(`${API}/auth/forgot-password`).send({ email: "x@y.test" }).expect(200);
  assert.equal(unknown.body.message, forgot.body.message);
  assert.equal(unknown.body.data.resetUrl, undefined);

  await guest()
    .post(`${API}/auth/reset-password`)
    .send({ token, newPassword: "brand-new-password", confirmPassword: "different-password" })
    .expect(400);
  await guest()
    .post(`${API}/auth/reset-password`)
    .send({ token, newPassword: "brand-new-password", confirmPassword: "brand-new-password" })
    .expect(200);
  await guest()
    .post(`${API}/auth/reset-password`)
    .send({ token, newPassword: "another-password-1", confirmPassword: "another-password-1" })
    .expect(400);

  await oldSession.get(`${API}/auth/me`).expect(401);
  await guest().post(`${API}/auth/login`).send({ email: ADMIN.email, password: "brand-new-password" }).expect(200);
});

test("changing the password keeps this session and ends the others", async () => {
  const current = await signedIn();
  const other = await signedIn();
  await current
    .patch(`${API}/auth/change-password`)
    .send({ currentPassword: "wrong-password", newPassword: "brand-new-password", confirmPassword: "brand-new-password" })
    .expect(400);
  await current
    .patch(`${API}/auth/change-password`)
    .send({ currentPassword: ADMIN.password, newPassword: "brand-new-password", confirmPassword: "brand-new-password" })
    .expect(200);
  await current.get(`${API}/auth/me`).expect(200);
  await other.get(`${API}/auth/me`).expect(401);
});

test("updates the profile including the photo", async () => {
  const agent = await signedIn();
  const photo = await upload(agent, "profile");
  const res = await agent
    .patch(`${API}/auth/profile`)
    .send({ name: "Jane Doe", contactEmail: "Jane@Silverfox.test", phone: "+254 700 000000", photo })
    .expect(200);
  assert.equal(res.body.data.user.name, "Jane Doe");
  assert.equal(res.body.data.user.contactEmail, "jane@silverfox.test");
  assert.equal(res.body.data.user.photo.url, photo.url);
  assert.equal(res.body.data.user.email, ADMIN.email);
});

test("media upload accepts real images only", async () => {
  const agent = await signedIn();
  const image = await upload(agent);
  assert.match(image.url, /^https:\/\//);
  assert.ok(image.publicId);
  const fake = await agent.post(`${API}/media`).attach("image", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" }).expect(400);
  assert.match(fake.body.message, /JPEG, PNG or WebP/);
  await agent.post(`${API}/media`).expect(400);
});
