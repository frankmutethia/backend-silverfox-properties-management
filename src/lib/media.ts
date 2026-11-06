import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inArray } from "drizzle-orm";
import multer from "multer";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { media } from "../db/schema.js";
import { HttpError, validationError } from "./http.js";

export const MAX_IMAGE_BYTES = 600 * 1024;

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10 },
}).single("file");

const signatures: { mime: string; ext: string; test: (bytes: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export function detectImage(bytes: Buffer) {
  return signatures.find((signature) => signature.test(bytes)) ?? null;
}

export const mediaUrl = (filename: string) => `${config.PUBLIC_URL}/uploads/${filename}`;

export async function storeImage(bytes: Buffer, uploadedBy: string | null) {
  const kind = detectImage(bytes);
  if (!kind) throw validationError("file", "Upload a JPG, PNG or WebP image.");
  const id = randomUUID();
  const filename = `${id}.${kind.ext}`;
  await mkdir(config.UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(config.UPLOAD_DIR, filename), bytes);
  const record = { id, filename, mime: kind.mime, size: bytes.length, uploadedBy, createdAt: new Date() };
  await db.insert(media).values(record);
  return record;
}

export async function loadMedia(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return new Map<string, typeof media.$inferSelect>();
  const rows = await db.select().from(media).where(inArray(media.id, wanted));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function assertMediaExist(ids: string[], field: string) {
  const found = await loadMedia(ids);
  const missing = ids.find((id) => !found.has(id));
  if (missing) throw validationError(field, "Image not found. Upload it again.");
}

export function multerError(error: unknown) {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Images must be 600 KB or smaller." : "Invalid upload.";
    return new HttpError(422, message, { file: [message] });
  }
  return null;
}
