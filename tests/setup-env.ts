import { fileURLToPath } from "node:url";
import { inject } from "vitest";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: inject("databaseUrl"),
  APP_SECRET: "test-secret-test-secret-test-secret-123",
  PUBLIC_URL: "http://api.test",
  FRONTEND_URL: "http://site.test",
  CORS_ORIGINS: "http://site.test",
  UPLOAD_DIR: fileURLToPath(new URL("../.mysql-cache/test-uploads", import.meta.url)),
});
