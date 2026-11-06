import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, like, ne, or, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { media, properties, propertyImages } from "../db/schema.js";
import { idParam, notFound, parse, slugParam, validationError } from "../lib/http.js";
import { assertMediaExist, mediaUrl } from "../lib/media.js";
import { likePattern, offset, pageMeta, pageQuery } from "../lib/paginate.js";
import { publicationFields, statusFilter, statusInput } from "../lib/publication.js";
import { uniqueSlug } from "../lib/slug.js";
import { currentUser } from "../middleware/auth.js";

type PropertyRow = typeof properties.$inferSelect;
type Category = NonNullable<PropertyRow["category"]>;
type Price = { amount: number; currency: string; period: "" | "month" | "year" };

const nullableCount = z.number().int().nonnegative().max(1000).nullable();
const fields = {
  name: z.string().trim().min(1).max(150),
  reference: z.string().trim().min(1).max(40),
  slug: z
    .string()
    .trim()
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
  category: z.enum(["sale", "rent", "managed"]),
  type: z.enum(["Apartment", "House"]),
  location: z.string().trim().min(1).max(200),
  neighbourhood: z.string().trim().max(2000).nullable(),
  description: z.string().trim().min(1).max(5000),
  price: z
    .object({
      amount: z.number().finite().nonnegative().max(1_000_000_000_000),
      currency: z.string().trim().toUpperCase().length(3).default("KES"),
      period: z.enum(["", "month", "year"]).default(""),
    })
    .nullable(),
  bedrooms: nullableCount,
  bathrooms: nullableCount,
  areaSqm: z.number().finite().nonnegative().max(10_000_000).nullable(),
  amenities: z.array(z.string().trim().min(1).max(80)).max(40),
  images: z
    .array(
      z.object({
        mediaId: z.string().min(1).max(36),
        alt: z.string().trim().min(1, "Describe every photo.").max(150),
        position: z
          .string()
          .trim()
          .max(40)
          .regex(/^[a-z0-9.%\s-]*$/i)
          .nullable()
          .optional(),
      }),
    )
    .max(5, "Add up to five photos."),
};

const createSchema = z.object({
  ...fields,
  slug: fields.slug.optional(),
  neighbourhood: fields.neighbourhood.default(null),
  price: fields.price.default(null),
  bedrooms: nullableCount.default(null),
  bathrooms: nullableCount.default(null),
  areaSqm: fields.areaSqm.default(null),
  amenities: fields.amenities.default([]),
  images: fields.images.default([]),
  status: statusInput.default("draft"),
});
const updateSchema = z.object(fields).partial();
type ImageInput = z.output<typeof fields.images>;

function normalizePrice(category: Category | null, price: Price | null): Price | null {
  if (category === "managed" || !price) return null;
  if (category === "sale") return { ...price, period: "" };
  if (category === "rent" && price.period === "") throw validationError("price.period", "Choose a rental period.");
  return price;
}

const priceColumns = (price: Price | null) => ({
  priceAmount: price ? price.amount.toFixed(2) : null,
  priceCurrency: price?.currency ?? null,
  pricePeriod: price?.period ?? null,
});

async function assertUniqueReference(reference: string, excludeId?: string) {
  const conditions: SQL[] = [eq(properties.reference, reference)];
  if (excludeId) conditions.push(ne(properties.id, excludeId));
  const [taken] = await db.select({ id: properties.id }).from(properties).where(and(...conditions)).limit(1);
  if (taken) throw validationError("reference", "This reference is already in use.");
}

async function resolveSlug(requested: string | undefined, name: string, excludeId?: string) {
  if (!requested) return uniqueSlug(properties, properties, name, excludeId);
  const conditions: SQL[] = [eq(properties.slug, requested)];
  if (excludeId) conditions.push(ne(properties.id, excludeId));
  const [taken] = await db.select({ id: properties.id }).from(properties).where(and(...conditions)).limit(1);
  if (taken) throw validationError("slug", "This URL is already used by another property.");
  return requested;
}

async function imagesFor(propertyIds: string[]) {
  const map = new Map<string, { mediaId: string; src: string; alt: string; position: string | null }[]>();
  if (!propertyIds.length) return map;
  const rows = await db
    .select({ image: propertyImages, filename: media.filename })
    .from(propertyImages)
    .innerJoin(media, eq(media.id, propertyImages.mediaId))
    .where(inArray(propertyImages.propertyId, propertyIds))
    .orderBy(asc(propertyImages.sortOrder));
  for (const { image, filename } of rows) {
    const list = map.get(image.propertyId) ?? [];
    list.push({ mediaId: image.mediaId, src: mediaUrl(filename), alt: image.alt, position: image.position });
    map.set(image.propertyId, list);
  }
  return map;
}

function basePropertyFields(row: PropertyRow) {
  return {
    slug: row.slug,
    reference: row.reference,
    name: row.name,
    category: row.category,
    type: row.type,
    location: row.location,
    neighbourhood: row.neighbourhood,
    description: row.description,
    price:
      row.priceAmount === null
        ? null
        : { amount: Number(row.priceAmount), currency: row.priceCurrency ?? "KES", period: row.pricePeriod ?? "" },
    areaSqm: row.areaSqm === null ? null : Number(row.areaSqm),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    amenities: row.amenities,
    publishedAt: row.publishedAt,
  };
}

async function serializePublic(rows: PropertyRow[]) {
  const images = await imagesFor(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...basePropertyFields(row),
    images: (images.get(row.id) ?? []).map(({ src, alt, position }) => (position ? { src, alt, position } : { src, alt })),
  }));
}

export async function serializeAdminProperties(rows: PropertyRow[]) {
  const images = await imagesFor(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    ...basePropertyFields(row),
    status: row.status,
    images: images.get(row.id) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function findProperty(id: string) {
  const [row] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (!row) throw notFound("Property");
  return row;
}

async function adminProperty(id: string) {
  const [result] = await serializeAdminProperties([await findProperty(id)]);
  return result;
}

const imageRows = (propertyId: string, images: ImageInput) =>
  images.map((image, index) => ({
    id: randomUUID(),
    propertyId,
    mediaId: image.mediaId,
    alt: image.alt,
    position: image.position ?? null,
    sortOrder: index,
  }));

const requirePhotos = (images: unknown[]) => {
  if (!images.length) throw validationError("images", "Add at least one photo before publishing.");
};

const listFilters = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(["Apartment", "House"]).optional(),
  category: z.enum(["sale", "rent", "managed", "unconfirmed"]).optional(),
  location: z.string().trim().max(100).optional(),
});

function filterConditions(filters: z.output<typeof listFilters>) {
  const conditions: SQL[] = [];
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(
      or(like(properties.name, pattern), like(properties.location, pattern), like(properties.reference, pattern))!,
    );
  }
  if (filters.type) conditions.push(eq(properties.type, filters.type));
  if (filters.category === "unconfirmed") conditions.push(isNull(properties.category));
  else if (filters.category) conditions.push(eq(properties.category, filters.category));
  if (filters.location) conditions.push(like(properties.location, likePattern(filters.location)));
  return conditions;
}

// ---------- Public ----------
export const publicPropertiesRouter = Router();

publicPropertiesRouter.get("/", async (req, res) => {
  const query = parse(listFilters.merge(pageQuery.extend({ perPage: pageQuery.shape.perPage.default(50) })), req.query);
  const where = and(eq(properties.status, "published"), ...filterConditions(query));
  const [total] = await db.select({ n: count() }).from(properties).where(where);
  const rows = await db
    .select()
    .from(properties)
    .where(where)
    .orderBy(desc(properties.publishedAt))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: await serializePublic(rows), meta: pageMeta(total?.n ?? 0, query) });
});

publicPropertiesRouter.get("/:slug", async (req, res) => {
  const { slug } = parse(slugParam, req.params);
  const [row] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.slug, slug), eq(properties.status, "published")))
    .limit(1);
  if (!row) throw notFound("Property");
  const [data] = await serializePublic([row]);
  res.json({ data });
});

// ---------- Admin ----------
export const adminPropertiesRouter = Router();

adminPropertiesRouter.get("/", async (req, res) => {
  const query = parse(listFilters.merge(pageQuery).extend({ status: statusFilter }), req.query);
  const conditions = filterConditions(query);
  if (query.status) conditions.push(eq(properties.status, query.status));
  const where = conditions.length ? and(...conditions) : undefined;
  const [total] = await db.select({ n: count() }).from(properties).where(where);
  const rows = await db
    .select()
    .from(properties)
    .where(where)
    .orderBy(desc(properties.updatedAt))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: await serializeAdminProperties(rows), meta: pageMeta(total?.n ?? 0, query) });
});

adminPropertiesRouter.post("/", async (req, res) => {
  const input = parse(createSchema, req.body);
  await assertUniqueReference(input.reference);
  await assertMediaExist(
    input.images.map((image) => image.mediaId),
    "images",
  );
  if (input.status === "published") requirePhotos(input.images);
  const id = randomUUID();
  const now = new Date();
  const slug = await resolveSlug(input.slug, input.name);
  await db.transaction(async (tx) => {
    await tx.insert(properties).values({
      id,
      slug,
      reference: input.reference,
      name: input.name,
      category: input.category,
      type: input.type,
      location: input.location,
      neighbourhood: input.neighbourhood || null,
      description: input.description,
      ...priceColumns(normalizePrice(input.category, input.price)),
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      areaSqm: input.areaSqm === null ? null : input.areaSqm.toFixed(2),
      amenities: input.amenities,
      ...publicationFields(input.status),
      createdBy: currentUser(req).id,
      createdAt: now,
      updatedAt: now,
    });
    if (input.images.length) await tx.insert(propertyImages).values(imageRows(id, input.images));
  });
  res.status(201).json({ data: await adminProperty(id) });
});

adminPropertiesRouter.get("/:id", async (req, res) => {
  res.json({ data: await adminProperty(parse(idParam, req.params).id) });
});

adminPropertiesRouter.patch("/:id", async (req, res) => {
  const existing = await findProperty(parse(idParam, req.params).id);
  const input = parse(updateSchema, req.body);
  if (input.reference !== undefined && input.reference !== existing.reference) {
    await assertUniqueReference(input.reference, existing.id);
  }
  if (input.images) {
    await assertMediaExist(
      input.images.map((image) => image.mediaId),
      "images",
    );
    if (existing.status === "published") requirePhotos(input.images);
  }
  const slug = input.slug !== undefined ? await resolveSlug(input.slug, existing.name, existing.id) : existing.slug;
  const category = input.category ?? existing.category;
  const currentPrice = basePropertyFields(existing).price as Price | null;
  const price =
    input.price !== undefined || input.category !== undefined
      ? normalizePrice(category, input.price === undefined ? currentPrice : input.price)
      : undefined;

  const { images, price: _price, slug: _slug, areaSqm, neighbourhood, ...rest } = input;
  await db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({
        ...rest,
        slug,
        ...(price !== undefined ? priceColumns(price) : {}),
        ...(areaSqm !== undefined ? { areaSqm: areaSqm === null ? null : areaSqm.toFixed(2) } : {}),
        ...(neighbourhood !== undefined ? { neighbourhood: neighbourhood || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, existing.id));
    if (images) {
      await tx.delete(propertyImages).where(eq(propertyImages.propertyId, existing.id));
      if (images.length) await tx.insert(propertyImages).values(imageRows(existing.id, images));
    }
  });
  res.json({ data: await adminProperty(existing.id) });
});

adminPropertiesRouter.post("/:id/publish", async (req, res) => {
  const existing = await findProperty(parse(idParam, req.params).id);
  requirePhotos((await imagesFor([existing.id])).get(existing.id) ?? []);
  await db
    .update(properties)
    .set({ ...publicationFields("published", existing.publishedAt), updatedAt: new Date() })
    .where(eq(properties.id, existing.id));
  res.json({ data: await adminProperty(existing.id) });
});

adminPropertiesRouter.post("/:id/unpublish", async (req, res) => {
  const existing = await findProperty(parse(idParam, req.params).id);
  await db
    .update(properties)
    .set({ ...publicationFields("draft", existing.publishedAt), updatedAt: new Date() })
    .where(eq(properties.id, existing.id));
  res.json({ data: await adminProperty(existing.id) });
});

adminPropertiesRouter.delete("/:id", async (req, res) => {
  const existing = await findProperty(parse(idParam, req.params).id);
  await db.delete(properties).where(eq(properties.id, existing.id));
  res.status(204).end();
});
