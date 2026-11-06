import type { NextFunction, Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { config } from "../config.js";
import { HttpError } from "../lib/http.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defence: state-changing requests must come from an allowed browser origin.
// Session cookies are SameSite=Lax, so this blocks same-site subdomain abuse too.
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  if (safeMethods.has(req.method)) return next();
  const origin = req.get("origin") ?? originOf(req.get("referer"));
  if (!origin || !config.CORS_ORIGINS.includes(origin)) {
    throw new HttpError(403, "Request origin is not allowed.");
  }
  next();
}

function originOf(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

const limiter = (limit: number, windowMs: number, message: string, key?: (req: Request) => string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test" && process.env.ENABLE_RATE_LIMITS !== "true",
    ...(key ? { keyGenerator: key } : {}),
    handler: (_req, res) => {
      res.status(429).json({ message });
    },
  });

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");

export const loginLimiter = limiter(5, 60_000, "Too many sign-in attempts. Try again in a minute.", (req) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${ipKey(req)}|${email}`;
});

export const passwordResetLimiter = limiter(5, 15 * 60_000, "Too many requests. Try again later.");

export const testimonialLimiter = limiter(5, 60 * 60_000, "Too many submissions. Try again later.");
