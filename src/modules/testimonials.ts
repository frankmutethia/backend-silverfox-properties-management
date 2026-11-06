import { randomUUID } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { testimonials } from "../db/schema.js";
import { hmac } from "../lib/crypto.js";
import { idParam, notFound, parse } from "../lib/http.js";
import { offset, pageMeta, pageQuery } from "../lib/paginate.js";
import { testimonialLimiter } from "../middleware/security.js";

type TestimonialRow = typeof testimonials.$inferSelect;

const feedbackFields = {
  name: z.string().trim().min(1).max(100),
  feedback: z.string().trim().min(1).max(2000),
  rating: z.number().int().min(1).max(5),
};

const publicShape = (row: TestimonialRow) => ({
  id: row.id,
  name: row.name,
  feedback: row.feedback,
  rating: row.rating,
  publishedAt: row.publishedAt,
});

const adminShape = (row: TestimonialRow) => ({
  ...publicShape(row),
  status: row.status,
  source: row.source,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

async function findTestimonial(id: string) {
  const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
  if (!row) throw notFound("Testimonial");
  return row;
}

async function update(id: string, values: Partial<typeof testimonials.$inferInsert>) {
  await db
    .update(testimonials)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(testimonials.id, id));
  return adminShape(await findTestimonial(id));
}

// ---------- Public ----------
export const publicTestimonialsRouter = Router();

publicTestimonialsRouter.get("/", async (req, res) => {
  const query = parse(pageQuery.extend({ perPage: pageQuery.shape.perPage.default(12) }), req.query);
  const where = eq(testimonials.status, "published");
  const [total] = await db.select({ n: count() }).from(testimonials).where(where);
  const rows = await db
    .select()
    .from(testimonials)
    .where(where)
    .orderBy(desc(testimonials.publishedAt))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: rows.map(publicShape), meta: pageMeta(total?.n ?? 0, query) });
});

const accepted = { message: "Thank you. Your feedback will appear once our team has reviewed it." };

publicTestimonialsRouter.post("/", testimonialLimiter, async (req, res) => {
  const input = parse(z.object({ ...feedbackFields, website: z.string().max(200).optional() }), req.body);
  // Honeypot: real visitors never see the "website" field, so silently drop bot submissions.
  if (input.website) {
    res.status(201).json(accepted);
    return;
  }
  const now = new Date();
  await db.insert(testimonials).values({
    id: randomUUID(),
    name: input.name,
    feedback: input.feedback,
    rating: input.rating,
    status: "pending",
    source: "visitor",
    ipHash: req.ip ? hmac(req.ip) : null,
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json(accepted);
});

// ---------- Admin ----------
export const adminTestimonialsRouter = Router();

adminTestimonialsRouter.get("/", async (req, res) => {
  const query = parse(pageQuery.extend({ status: z.enum(["pending", "draft", "published"]).optional() }), req.query);
  const where = query.status ? eq(testimonials.status, query.status) : undefined;
  const [total] = await db.select({ n: count() }).from(testimonials).where(where);
  const rows = await db
    .select()
    .from(testimonials)
    .where(where)
    .orderBy(desc(testimonials.createdAt))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: rows.map(adminShape), meta: pageMeta(total?.n ?? 0, query) });
});

adminTestimonialsRouter.post("/", async (req, res) => {
  const input = parse(z.object({ ...feedbackFields, status: z.enum(["draft", "published"]).default("draft") }), req.body);
  const id = randomUUID();
  const now = new Date();
  await db.insert(testimonials).values({
    id,
    name: input.name,
    feedback: input.feedback,
    rating: input.rating,
    status: input.status,
    source: "admin",
    publishedAt: input.status === "published" ? now : null,
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ data: adminShape(await findTestimonial(id)) });
});

adminTestimonialsRouter.get("/:id", async (req, res) => {
  res.json({ data: adminShape(await findTestimonial(parse(idParam, req.params).id)) });
});

adminTestimonialsRouter.patch("/:id", async (req, res) => {
  const existing = await findTestimonial(parse(idParam, req.params).id);
  const input = parse(z.object(feedbackFields).partial(), req.body);
  res.json({ data: await update(existing.id, input) });
});

adminTestimonialsRouter.post("/:id/publish", async (req, res) => {
  const existing = await findTestimonial(parse(idParam, req.params).id);
  res.json({ data: await update(existing.id, { status: "published", publishedAt: existing.publishedAt ?? new Date() }) });
});

adminTestimonialsRouter.post("/:id/unpublish", async (req, res) => {
  const existing = await findTestimonial(parse(idParam, req.params).id);
  res.json({ data: await update(existing.id, { status: "draft" }) });
});

adminTestimonialsRouter.delete("/:id", async (req, res) => {
  const existing = await findTestimonial(parse(idParam, req.params).id);
  await db.delete(testimonials).where(eq(testimonials.id, existing.id));
  res.status(204).end();
});
