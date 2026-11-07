import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const limiter = ({ windowMs, max, message, ...rest }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest && process.env.ENABLE_RATE_LIMITS !== "true",
    ...(message ? { message: { success: false, message } } : {}),
    ...rest,
  });

export const apiLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 300 });

export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Try again in 15 minutes.",
  skipSuccessfulRequests: true,
});

export const passwordResetLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset attempts. Try again in 15 minutes.",
});

export const testimonialSubmitLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many testimonial submissions. Try again in an hour.",
});
