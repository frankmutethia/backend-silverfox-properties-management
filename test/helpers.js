import { before, after, beforeEach } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:27017/placeholder",
  ACCESS_TOKEN_SECRET: "test-secret-test-secret-test-secret-123",
  CORS_ORIGIN: "https://site.test",
  FRONTEND_URL: "https://site.test",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
});

export const ORIGIN = "https://site.test";
export const ADMIN = { email: "admin@silverfox.test", password: "correct-horse-battery", name: "Jane Admin" };

// Smallest valid PNG (1x1 transparent pixel).
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

export const ctx = {};

// Registers hooks for a test file: in-memory MongoDB, fresh data before every test.
export const useTestApp = ({ seed = false } = {}) => {
  let mongo;
  before(async () => {
    // Keep the throwaway database next to the project rather than in the system temp folder.
    const dbPath = fileURLToPath(new URL(`../.mongo-test/${process.pid}`, import.meta.url));
    await mkdir(dbPath, { recursive: true });
    mongo = await MongoMemoryServer.create({ instance: { dbPath } });
    await mongoose.connect(mongo.getUri());
    ctx.app = (await import("../src/app.js")).default;
    ctx.bootstrap = await import("../src/services/bootstrap.service.js");
  });
  after(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
    await rm(fileURLToPath(new URL(`../.mongo-test/${process.pid}`, import.meta.url)), { recursive: true, force: true });
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
    await ctx.bootstrap.createAdmin(ADMIN);
    if (seed) await ctx.bootstrap.seedContent();
  });
};

export const guest = () => request.agent(ctx.app).set("Origin", ORIGIN);

export const signedIn = async () => {
  const agent = guest();
  const res = await agent.post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
};

export const upload = async (agent, folder = "properties") => {
  const res = await agent.post(`/api/v1/media?folder=${folder}`).attach("image", PNG, "photo.png");
  if (res.status !== 201) throw new Error(`Upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.image;
};
