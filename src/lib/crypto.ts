import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "../config.js";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const params = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: params.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;
// Compared against when an email is unknown so login timing does not reveal accounts.
export const dummyPasswordHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));

export const randomToken = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const hmac = (value: string) => createHmac("sha256", config.APP_SECRET).update(value).digest("hex");
