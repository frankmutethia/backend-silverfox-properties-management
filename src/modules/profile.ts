import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { parse, validationError } from "../lib/http.js";
import { assertMediaExist, imageUpload, mediaUrl, storeImage } from "../lib/media.js";
import { currentUser } from "../middleware/auth.js";
import { serializeUser } from "./auth.js";

export const profileRouter = Router();

profileRouter.get("/profile", async (req, res) => {
  res.json({ data: await serializeUser(currentUser(req)) });
});

profileRouter.patch("/profile", async (req, res) => {
  const user = currentUser(req);
  const input = parse(
    z
      .object({
        displayName: z.string().trim().min(1).max(100),
        contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(255)]),
        phone: z.string().trim().max(30),
        photoMediaId: z.string().max(36).nullable(),
      })
      .partial(),
    req.body,
  );
  if (input.photoMediaId) await assertMediaExist([input.photoMediaId], "photoMediaId");
  await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  res.json({ data: await serializeUser(updated ?? user) });
});

// Uploads an image and returns its id for use in property, service, blog and profile forms.
export const mediaRouter = Router();

mediaRouter.post("/media", imageUpload, async (req, res) => {
  if (!req.file) throw validationError("file", "Choose an image to upload.");
  const record = await storeImage(req.file.buffer, currentUser(req).id);
  res.status(201).json({ data: { id: record.id, src: mediaUrl(record.filename), mime: record.mime, size: record.size } });
});
