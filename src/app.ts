import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { loadSession, requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { requireTrustedOrigin } from "./middleware/security.js";
import { authRouter } from "./modules/auth.js";
import { adminBlogsRouter, publicBlogsRouter } from "./modules/blogs.js";
import { dashboardRouter } from "./modules/dashboard.js";
import { mediaRouter, profileRouter } from "./modules/profile.js";
import { adminPropertiesRouter, publicPropertiesRouter } from "./modules/properties.js";
import { adminServicesRouter, publicServicesRouter } from "./modules/services.js";
import { adminTestimonialsRouter, publicTestimonialsRouter } from "./modules/testimonials.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", config.TRUST_PROXY);
  app.disable("x-powered-by");

  // Images are embedded by the website on another subdomain, so allow cross-origin loading.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(
    "/uploads",
    express.static(config.UPLOAD_DIR, { maxAge: "30d", immutable: true, index: false, fallthrough: true }),
  );

  const api = Router();
  api.use(express.json({ limit: "1mb" }));
  api.use(cookieParser());
  api.use(requireTrustedOrigin);
  api.use(loadSession);

  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  api.use("/auth", authRouter);
  api.use("/properties", publicPropertiesRouter);
  api.use("/services", publicServicesRouter);
  api.use("/blogs", publicBlogsRouter);
  api.use("/testimonials", publicTestimonialsRouter);

  const admin = Router();
  admin.use(requireAuth);
  admin.use(profileRouter);
  admin.use(mediaRouter);
  admin.use(dashboardRouter);
  admin.use("/properties", adminPropertiesRouter);
  admin.use("/services", adminServicesRouter);
  admin.use("/blogs", adminBlogsRouter);
  admin.use("/testimonials", adminTestimonialsRouter);
  api.use("/admin", admin);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
