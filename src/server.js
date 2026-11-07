import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { bootstrap } from "./services/bootstrap.service.js";
import { verifySmtpConnection } from "./services/email.service.js";

const start = async () => {
  await connectDB();
  await bootstrap();

  const server = app.listen(env.port, () => {
    console.log(`Silverfox API running on port ${env.port} [${env.nodeEnv}]`);
    console.log(`CORS origins: ${env.corsOrigin.join(", ")}`);
    console.log(`Cloudinary cloud: ${env.cloudinary.cloudName} (folder "${env.cloudinary.folder}")`);

    if (!env.smtp.isConfigured) {
      console.log("[email] SMTP not configured — password reset emails will not be sent in production");
    } else {
      verifySmtpConnection().then(({ ok, reason }) =>
        console.log(ok ? "[email] SMTP connection verified" : `[email] SMTP connection FAILED — ${reason}`)
      );
    }
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
};

start();
