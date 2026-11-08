import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN, guest, signedIn, useTestApp } from "./helpers.js";

useTestApp();

const API = "/api/v1";
const NEW_ADMIN = {
  name: "Sam Second",
  email: "Sam@Silverfox.test",
  password: "another-strong-pass",
  confirmPassword: "another-strong-pass",
};

test("user management requires sign-in", async () => {
  await guest().get(`${API}/users`).expect(401);
  await guest().post(`${API}/users`).send(NEW_ADMIN).expect(401);
});

test("lists staff accounts without secrets", async () => {
  const agent = await signedIn();
  const res = await agent.get(`${API}/users`).expect(200);
  assert.equal(res.body.data.users.length, 1);
  assert.equal(res.body.data.users[0].email, ADMIN.email);
  assert.equal(res.body.data.users[0].password, undefined);
  assert.equal(res.body.data.pagination.total, 1);
});

test("creates another admin who can sign in with the chosen password", async () => {
  const agent = await signedIn();
  const res = await agent.post(`${API}/users`).send(NEW_ADMIN).expect(201);
  const user = res.body.data.user;
  assert.equal(user.email, "sam@silverfox.test");
  assert.equal(user.name, "Sam Second");
  assert.equal(user.isActive, true);
  assert.equal(user.password, undefined);

  const list = await agent.get(`${API}/users`).expect(200);
  assert.deepEqual(
    list.body.data.users.map((u) => u.email),
    [ADMIN.email, "sam@silverfox.test"]
  );

  const login = await guest()
    .post(`${API}/auth/login`)
    .send({ email: "sam@silverfox.test", password: NEW_ADMIN.password })
    .expect(200);
  assert.equal(login.body.data.user.name, "Sam Second");
});

test("refuses a duplicate email with a field-level 409", async () => {
  const agent = await signedIn();
  const res = await agent.post(`${API}/users`).send({ ...NEW_ADMIN, email: ADMIN.email.toUpperCase() }).expect(409);
  assert.equal(res.body.message, "An account with this email already exists");
  assert.deepEqual(res.body.errors, ["email: An account with this email already exists"]);
});

test("validates name, email and password", async () => {
  const agent = await signedIn();
  const short = await agent.post(`${API}/users`).send({ ...NEW_ADMIN, password: "short", confirmPassword: "short" }).expect(400);
  assert.ok(short.body.errors.some((e) => e.startsWith("password:")));

  const mismatch = await agent.post(`${API}/users`).send({ ...NEW_ADMIN, confirmPassword: "something-else-123" }).expect(400);
  assert.deepEqual(mismatch.body.errors, ["confirmPassword: Passwords do not match"]);

  const bad = await agent.post(`${API}/users`).send({ ...NEW_ADMIN, name: " ", email: "nope" }).expect(400);
  assert.ok(bad.body.errors.some((e) => e.startsWith("name:")));
  assert.ok(bad.body.errors.some((e) => e.startsWith("email:")));
});
