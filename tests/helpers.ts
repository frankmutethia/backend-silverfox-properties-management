import { sql } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createAdmin, seedContent } from "../src/db/bootstrap.js";
import { db, runMigrations } from "../src/db/client.js";
import { outbox } from "../src/lib/mailer.js";

export const ORIGIN = "http://site.test";
export const ADMIN = { email: "admin@silverfox.test", password: "correct-horse-battery", name: "Jane Admin" };

export const app = createApp();

const tables = [
  "sessions",
  "password_reset_tokens",
  "property_images",
  "properties",
  "services",
  "service_categories",
  "blogs",
  "testimonials",
  "users",
  "media",
];

let migrated = false;

export async function resetDb({ seed = false } = {}) {
  if (!migrated) {
    await runMigrations();
    migrated = true;
  }
  await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 0"));
  for (const table of tables) await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
  await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 1"));
  outbox.length = 0;
  await createAdmin(ADMIN.email, ADMIN.password, ADMIN.name);
  if (seed) await seedContent();
}

export const guest = () => request.agent(app).set("Origin", ORIGIN);

export async function signedIn() {
  const agent = guest();
  const res = await agent.post("/api/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

// Smallest valid PNG (1x1 transparent pixel).
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function upload(agent: ReturnType<typeof guest>, bytes = PNG, name = "photo.png") {
  const res = await agent.post("/api/admin/media").attach("file", bytes, name);
  if (res.status !== 201) throw new Error(`Upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; src: string };
}
