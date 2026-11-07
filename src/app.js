import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { rejectUntrustedOrigin } from "./middlewares/origin.middleware.js";
import { env } from "./config/env.js";

const app = express();

// Hostinger runs the app behind one proxy; needed for correct client IPs in rate limiting.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (env.corsOrigin.includes(normalized)) return callback(null, normalized);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(rejectUntrustedOrigin);

app.use("/api/v1", apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
