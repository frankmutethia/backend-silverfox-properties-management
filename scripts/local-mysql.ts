import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDB } from "mysql-memory-server";

// mysql-memory-server downloads MySQL (~1 GB extracted) into os.tmpdir(); keep it on this drive.
export async function startLocalMySql() {
  const cache = fileURLToPath(new URL("../.mysql-cache", import.meta.url));
  mkdirSync(cache, { recursive: true });
  process.env.TEMP = cache;
  process.env.TMP = cache;
  process.env.TMPDIR = cache;
  const db = await createDB({ version: "8.4.x", logLevel: "WARN" });
  return { db, url: `mysql://${db.username}@127.0.0.1:${db.port}/${db.dbName}` };
}
