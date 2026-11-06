import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";
import { findSession, SESSION_COOKIE, type SessionUser } from "../lib/session.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
    sessionId?: string;
  }
}

export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE];
  const session = await findSession(token);
  if (session) {
    req.user = session.user;
    req.sessionId = session.id;
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, "Sign in to continue.");
  next();
}

export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, "Sign in to continue.");
  return req.user;
}
