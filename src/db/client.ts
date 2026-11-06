import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { config } from "../config.js";
import * as schema from "./schema.js";

export const pool = mysql.createPool({
  uri: config.DATABASE_URL,
  timezone: "Z",
  charset: "utf8mb4",
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema, mode: "default" });
export type Db = typeof db;

export async function runMigrations() {
  const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
  await migrate(db, { migrationsFolder });
}
