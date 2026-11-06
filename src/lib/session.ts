import { and, eq, lt, ne } from "drizzle-orm";
import type { CookieOptions, Response } from "express";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { randomToken, sha256 } from "./crypto.js";

export const SESSION_COOKIE = "sf_session";
const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;
const LONG_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = typeof users.$inferSelect;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

export async function startSession(res: Response, userId: string, remember: boolean) {
  const token = randomToken();
  const now = new Date();
  const lifetime = remember ? LONG_SESSION_MS : SHORT_SESSION_MS;
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + lifetime),
  });
  res.cookie(SESSION_COOKIE, token, remember ? { ...cookieOptions(), maxAge: lifetime } : cookieOptions());
}

export async function findSession(token: string | undefined) {
  if (!token) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row || row.expiresAt <= new Date()) return null;
  return { id, user: row.user };
}

export async function endSession(res: Response, sessionId: string | undefined) {
  if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function endOtherSessions(userId: string, keepSessionId?: string) {
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}
