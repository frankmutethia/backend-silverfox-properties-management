import { beforeEach, describe, expect, it } from "vitest";
import { outbox } from "../src/lib/mailer.js";
import { ADMIN, guest, resetDb, signedIn } from "./helpers.js";

beforeEach(() => resetDb());

const resetLink = () => {
  const mail = outbox.at(-1);
  const url = new URL(/http:\/\/site\.test\/staff\/reset-password\?\S+/.exec(mail?.text ?? "")?.[0] ?? "");
  return { token: url.searchParams.get("token") ?? "", email: url.searchParams.get("email") ?? "" };
};

describe("authentication", () => {
  it("rejects unknown accounts and wrong passwords with the same message", async () => {
    const wrong = await guest().post("/api/auth/login").send({ email: ADMIN.email, password: "nope-nope-nope" });
    const unknown = await guest().post("/api/auth/login").send({ email: "who@x.test", password: "nope-nope-nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it("signs in with a session cookie, returns the user, and logs out", async () => {
    const agent = guest();
    const login = await agent.post("/api/auth/login").send({ email: "ADMIN@silverfox.test ", password: ADMIN.password });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ email: ADMIN.email, displayName: ADMIN.name });
    expect(login.body.user.passwordHash).toBeUndefined();
    const cookie = String(login.headers["set-cookie"]);
    expect(cookie).toMatch(/sf_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    expect((await agent.get("/api/auth/me")).status).toBe(200);
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("rate-limits repeated failed sign-ins", async () => {
    process.env.ENABLE_RATE_LIMITS = "true";
    try {
      const attempt = () =>
        guest().post("/api/auth/login").send({ email: "limit@silverfox.test", password: "wrong-password" });
      for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(429);
    } finally {
      delete process.env.ENABLE_RATE_LIMITS;
    }
  });

  it("blocks admin routes without a session", async () => {
    const res = await guest().get("/api/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("rejects state-changing requests from untrusted origins", async () => {
    const agent = await signedIn();
    const res = await agent.post("/api/admin/testimonials").set("Origin", "https://evil.test").send({});
    expect(res.status).toBe(403);
  });

  it("does not reveal whether an email exists when requesting a reset", async () => {
    const known = await guest().post("/api/auth/forgot-password").send({ email: ADMIN.email });
    const unknown = await guest().post("/api/auth/forgot-password").send({ email: "who@x.test" });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(outbox).toHaveLength(1);
  });

  it("resets a password once with a valid link and signs out other sessions", async () => {
    const existing = await signedIn();
    await guest().post("/api/auth/forgot-password").send({ email: ADMIN.email });
    const { token, email } = resetLink();
    const body = { token, email, password: "a-brand-new-password", passwordConfirmation: "a-brand-new-password" };

    expect((await guest().post("/api/auth/reset-password").send(body)).status).toBe(200);
    expect((await existing.get("/api/auth/me")).status).toBe(401);
    expect((await guest().post("/api/auth/reset-password").send(body)).status).toBe(422);
    const login = await guest().post("/api/auth/login").send({ email, password: body.password });
    expect(login.status).toBe(200);
  });

  it("validates reset password strength and confirmation", async () => {
    await guest().post("/api/auth/forgot-password").send({ email: ADMIN.email });
    const { token, email } = resetLink();
    const short = await guest()
      .post("/api/auth/reset-password")
      .send({ token, email, password: "short", passwordConfirmation: "short" });
    expect(short.status).toBe(422);
    expect(short.body.errors.password).toBeDefined();
    const mismatch = await guest()
      .post("/api/auth/reset-password")
      .send({ token, email, password: "long-enough-pass", passwordConfirmation: "different-pass" });
    expect(mismatch.body.errors.passwordConfirmation).toBeDefined();
  });

  it("changes the password when the current one is correct", async () => {
    const agent = await signedIn();
    const other = await signedIn();
    const wrong = await agent
      .put("/api/auth/password")
      .send({ currentPassword: "wrong-password", password: "another-good-pass", passwordConfirmation: "another-good-pass" });
    expect(wrong.status).toBe(422);
    const ok = await agent
      .put("/api/auth/password")
      .send({ currentPassword: ADMIN.password, password: "another-good-pass", passwordConfirmation: "another-good-pass" });
    expect(ok.status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
    expect((await other.get("/api/auth/me")).status).toBe(401);
  });
});
