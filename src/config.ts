import path from "node:path";
import { z } from "zod";

const list = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: list,
  COOKIE_DOMAIN: z.string().optional(),
  UPLOAD_DIR: z.string().default("uploads"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  RUN_MIGRATIONS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Silverfox Property Management <no-reply@silverfoxpropertymanagement.com>"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().default("Administrator"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
}

const env = parsed.data;
const frontend = env.FRONTEND_URL.replace(/\/+$/, "");

export const config = {
  ...env,
  isProduction: env.NODE_ENV === "production",
  PUBLIC_URL: env.PUBLIC_URL.replace(/\/+$/, ""),
  FRONTEND_URL: frontend,
  CORS_ORIGINS: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : [frontend],
  UPLOAD_DIR: path.resolve(env.UPLOAD_DIR),
};
