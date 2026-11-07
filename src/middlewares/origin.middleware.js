import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defence for the cookie session: browsers always send Origin on cross-site
// POST/PATCH/DELETE, so refuse state-changing requests from origins we don't trust.
// Requests with no Origin (Postman, curl, server-to-server) are allowed through.
export const rejectUntrustedOrigin = (req, res, next) => {
  if (safeMethods.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !env.corsOrigin.includes(origin.replace(/\/$/, ""))) {
    return next(new ApiError(403, "Request origin is not allowed"));
  }
  next();
};
