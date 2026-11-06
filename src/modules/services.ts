import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { serviceCategories, services } from "../db/schema.js";
import { idParam, notFound, parse, validationError } from "../lib/http.js";
import { assertMediaExist, loadMedia, mediaUrl } from "../lib/media.js";
import { offset, pageMeta, pageQuery } from "../lib/paginate.js";
import { publicationFields, statusFilter, statusInput } from "../lib/publication.js";
import { plainText, sanitizeRichText } from "../lib/sanitize.js";

type ServiceRow = typeof services.$inferSelect;
type CategoryRow = typeof serviceCategories.$inferSelect;

const categoryNumber = z.enum(["01", "02"]);
const description = z
  .string()
  .max(200_000)
  .transform(sanitizeRichText)
  .refine((html) => {
    const length = plainText(html).length;
    return length > 0 && length <= 10_000;
  }, "Enter a description of up to 10,000 characters.");
const image = z
  .object({ mediaId: z.string().min(1).max(36), alt: z.string().trim().min(1, "Describe the image.").max(150) })
  .nullable();
const fields = {
  category: categoryNumber,
  title: z.string().trim().min(1).max(150),
  description,
  icon: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9]*$/)
    .nullable(),
  image,
};

async function categoriesByNumber() {
  const rows = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder));
  return { rows, byNumber: new Map(rows.map((row) => [row.number, row])), byId: new Map(rows.map((row) => [row.id, row])) };
}

async function categoryFor(number: string) {
  const [row] = await db.select().from(serviceCategories).where(eq(serviceCategories.number, number)).limit(1);
  if (!row) throw validationError("category", "Choose a valid service category.");
  return row;
}

async function serialize(rows: ServiceRow[], admin: boolean) {
  const [{ byId }, images] = await Promise.all([categoriesByNumber(), loadMedia(rows.map((row) => row.imageMediaId))]);
  return rows.map((row) => {
    const file = row.imageMediaId ? images.get(row.imageMediaId) : undefined;
    const base = {
      id: row.id,
      category: byId.get(row.categoryId)?.number ?? null,
      title: row.title,
      description: row.descriptionHtml,
      icon: row.icon,
      image: file ? { src: mediaUrl(file.filename), alt: row.imageAlt ?? "" } : null,
    };
    if (!admin) return base;
    return {
      ...base,
      image: file ? { mediaId: file.id, src: mediaUrl(file.filename), alt: row.imageAlt ?? "" } : null,
      sortOrder: row.sortOrder,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function findService(id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!row) throw notFound("Service");
  return row;
}

async function adminService(id: string) {
  const [result] = await serialize([await findService(id)], true);
  return result;
}

const serializeCategory = (row: CategoryRow) => ({ number: row.number, title: row.title, description: row.description });

// ---------- Public ----------
export const publicServicesRouter = Router();

publicServicesRouter.get("/", async (_req, res) => {
  const { rows: categories } = await categoriesByNumber();
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.status, "published"))
    .orderBy(asc(services.sortOrder));
  const items = await serialize(rows, false);
  res.json({
    data: categories.map((category) => ({
      ...serializeCategory(category),
      services: items.filter((item) => item.category === category.number),
    })),
  });
});

// ---------- Admin ----------
export const adminServicesRouter = Router();

adminServicesRouter.get("/categories", async (_req, res) => {
  const { rows } = await categoriesByNumber();
  res.json({ data: rows.map(serializeCategory) });
});

adminServicesRouter.patch("/categories/:number", async (req, res) => {
  const number = parse(z.object({ number: categoryNumber }), req.params).number;
  const input = parse(
    z.object({ title: z.string().trim().min(1).max(150), description: z.string().trim().min(1).max(1000) }).partial(),
    req.body,
  );
  const category = await categoryFor(number);
  await db
    .update(serviceCategories)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(serviceCategories.id, category.id));
  res.json({ data: serializeCategory({ ...category, ...input }) });
});

adminServicesRouter.patch("/reorder", async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.string().min(1).max(36)).min(1).max(500) }), req.body);
  const found = await db.select({ id: services.id }).from(services).where(inArray(services.id, ids));
  if (found.length !== new Set(ids).size) throw validationError("ids", "One or more services were not found.");
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(services).set({ sortOrder: index }).where(eq(services.id, id));
    }
  });
  res.status(204).end();
});

adminServicesRouter.get("/", async (req, res) => {
  const query = parse(pageQuery.extend({ category: categoryNumber.optional(), status: statusFilter, perPage: pageQuery.shape.perPage.default(50) }), req.query);
  const conditions = [];
  if (query.category) conditions.push(eq(services.categoryId, (await categoryFor(query.category)).id));
  if (query.status) conditions.push(eq(services.status, query.status));
  const where = conditions.length ? and(...conditions) : undefined;
  const [total] = await db.select({ n: count() }).from(services).where(where);
  const rows = await db
    .select()
    .from(services)
    .where(where)
    .orderBy(asc(services.sortOrder))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: await serialize(rows, true), meta: pageMeta(total?.n ?? 0, query) });
});

adminServicesRouter.post("/", async (req, res) => {
  const input = parse(
    z.object({ ...fields, icon: fields.icon.default(null), image: image.default(null), status: statusInput.default("draft") }),
    req.body,
  );
  const category = await categoryFor(input.category);
  if (input.image) await assertMediaExist([input.image.mediaId], "image");
  const [last] = await db.select({ value: max(services.sortOrder) }).from(services);
  const id = randomUUID();
  const now = new Date();
  await db.insert(services).values({
    id,
    categoryId: category.id,
    title: input.title,
    descriptionHtml: input.description,
    icon: input.icon || null,
    imageMediaId: input.image?.mediaId ?? null,
    imageAlt: input.image?.alt ?? null,
    sortOrder: (last?.value ?? -1) + 1,
    ...publicationFields(input.status),
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ data: await adminService(id) });
});

adminServicesRouter.get("/:id", async (req, res) => {
  res.json({ data: await adminService(parse(idParam, req.params).id) });
});

adminServicesRouter.patch("/:id", async (req, res) => {
  const existing = await findService(parse(idParam, req.params).id);
  const input = parse(z.object(fields).partial(), req.body);
  if (input.image) await assertMediaExist([input.image.mediaId], "image");
  await db
    .update(services)
    .set({
      ...(input.category ? { categoryId: (await categoryFor(input.category)).id } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { descriptionHtml: input.description } : {}),
      ...(input.icon !== undefined ? { icon: input.icon || null } : {}),
      ...(input.image !== undefined
        ? { imageMediaId: input.image?.mediaId ?? null, imageAlt: input.image?.alt ?? null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(services.id, existing.id));
  res.json({ data: await adminService(existing.id) });
});

for (const [action, status] of [
  ["publish", "published"],
  ["unpublish", "draft"],
] as const) {
  adminServicesRouter.post(`/:id/${action}`, async (req, res) => {
    const existing = await findService(parse(idParam, req.params).id);
    await db
      .update(services)
      .set({ ...publicationFields(status, existing.publishedAt), updatedAt: new Date() })
      .where(eq(services.id, existing.id));
    res.json({ data: await adminService(existing.id) });
  });
}

adminServicesRouter.delete("/:id", async (req, res) => {
  const existing = await findService(parse(idParam, req.params).id);
  await db.delete(services).where(eq(services.id, existing.id));
  res.status(204).end();
});
