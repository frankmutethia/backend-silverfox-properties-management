import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { createAdmin } from "../db/bootstrap.js";
import { pool, runMigrations } from "../db/client.js";

// Usage: npm run create-admin -- --email staff@example.com --name "Jane Doe"
// The password is read from NEW_ADMIN_PASSWORD or prompted for.
async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string", default: "Administrator" } },
  });
  if (!values.email) throw new Error("Pass --email <address>.");
  let password = process.env.NEW_ADMIN_PASSWORD;
  if (!password) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    password = await prompt.question("Password (min 10 characters): ");
    prompt.close();
  }
  await runMigrations();
  const result = await createAdmin(values.email, password, values.name ?? "Administrator");
  console.info(result.created ? `Created admin ${values.email}.` : `${values.email} already exists; nothing changed.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void pool.end());
