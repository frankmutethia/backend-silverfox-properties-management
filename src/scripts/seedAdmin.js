// Creates a staff account. Usage:
//   npm run seed                                   (uses SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME)
//   npm run seed -- --email you@example.com --name "Your Name"   (password from NEW_ADMIN_PASSWORD or a prompt)
import { createInterface } from "readline/promises";
import { parseArgs } from "util";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { createAdmin } from "../services/bootstrap.service.js";

const run = async () => {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  const email = values.email || env.seedAdmin.email;
  const name = values.name || env.seedAdmin.name;
  if (!email) throw new Error("Pass --email <address> or set SEED_ADMIN_EMAIL.");

  let password = values.email ? process.env.NEW_ADMIN_PASSWORD : env.seedAdmin.password;
  if (!password) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    password = await prompt.question("Password (min 10 characters): ");
    prompt.close();
  }

  await connectDB();
  const { created } = await createAdmin({ email, password, name });
  console.log(created ? `Created staff account ${email}. Sign in and change the password.` : `${email} already exists; nothing changed.`);
};

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
