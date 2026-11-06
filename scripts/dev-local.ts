import { startLocalMySql } from "./local-mysql.js";

// Runs the API against a throwaway MySQL server seeded with the website content.
// Data is lost when the process stops. Use `npm run dev` with a real DATABASE_URL to keep data.
const { url } = await startLocalMySql();
process.env.DATABASE_URL = url;
process.env.APP_SECRET ??= "local-development-secret-not-for-production";
process.env.ADMIN_EMAIL ??= "admin@silverfox.local";
process.env.ADMIN_PASSWORD ??= "silverfox-admin";
console.info(`Local MySQL ready. Staff sign-in: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
await import("../src/server.js");
