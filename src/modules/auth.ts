import { and, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { passwordResetTokens, users } from "../db/schema.js";
import { dummyPasswordHash, hashPassword, randomToken, sha256, verifyPassword } from "../lib/crypto.js";
import { HttpError, parse, validationError } from "../lib/http.js";
import { passwordResetMail, sendMail } from "../lib/mailer.js";
import { loadMedia, mediaUrl } from "../lib/media.js";
import { endOtherSessions, endSession, startSession, type SessionUser } from "../lib/session.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/security.js";

const RESET_LIFETIME_MS = 60 * 60 * 1000;

const email = z.string().trim().toLowerCase().email().max(255);
const newPassword = z.string().min(10, "Use at least 10 characters.").max(200);
const passwordsMatch = (value: { password: string; passwordConfirmation: string }) =>
  value.password === value.passwordConfirmation;
const mismatch = { path: ["passwordConfirmation"], message: "Passwords do not match." };
const resetSchema = z
  .object({ token: z.string().min(1).max(200), email, password: newPassword, passwordConfirmation: z.string() })
  .refine(passwordsMatch, mismatch);
const changeSchema = z
  .object({ currentPassword: z.string().min(1).max(200), password: newPassword, passwordConfirmation: z.string() })
  .refine(passwordsMatch, mismatch);

export async function serializeUser(user: SessionUser) {
  const photo = (await loadMedia([user.photoMediaId])).get(user.photoMediaId ?? "");
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    contactEmail: user.contactEmail,
    phone: user.phone,
    photo: photo ? { id: photo.id, src: mediaUrl(photo.filename) } : null,
  };
}

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (req, res) => {
  const input = parse(
    z.object({ email, password: z.string().min(1).max(200), remember: z.boolean().optional() }),
    req.body,
  );
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !valid) throw new HttpError(401, "The email or password is incorrect.");
  await startSession(res, user.id, input.remember ?? false);
  res.json({ user: await serializeUser(user) });
});

authRouter.post("/logout", async (req, res) => {
  await endSession(res, req.sessionId);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await serializeUser(currentUser(req)) });
});

authRouter.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  const input = parse(z.object({ email }), req.body);
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (user) {
    const token = randomToken();
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await db.insert(passwordResetTokens).values({
      id: sha256(token),
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + RESET_LIFETIME_MS),
    });
    const link = `${config.FRONTEND_URL}/staff/reset-password?${new URLSearchParams({ token, email: user.email })}`;
    await sendMail(passwordResetMail(user.email, user.displayName, link));
  }
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});

authRouter.post("/reset-password", passwordResetLimiter, async (req, res) => {
  const input = parse(resetSchema, req.body);
  const [row] = await db
    .select({ token: passwordResetTokens, user: users })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(eq(passwordResetTokens.id, sha256(input.token)))
    .limit(1);
  if (!row || row.user.email !== input.email || row.token.usedAt || row.token.expiresAt <= new Date()) {
    throw validationError("token", "This reset link is invalid or has expired. Request a new one.");
  }
  const now = new Date();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.password), updatedAt: now })
    .where(eq(users.id, row.user.id));
  await db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, row.token.id));
  await endOtherSessions(row.user.id);
  res.json({ message: "Your password has been reset. You can now sign in." });
});

authRouter.put("/password", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const input = parse(changeSchema, req.body);
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw validationError("currentPassword", "Your current password is incorrect.");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.password), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await endOtherSessions(user.id, req.sessionId);
  res.json({ message: "Your password has been updated." });
});
