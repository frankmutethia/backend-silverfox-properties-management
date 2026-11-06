import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, like, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { blogs, users } from "../db/schema.js";
import { idParam, notFound, parse, slugParam, validationError } from "../lib/http.js";
import { assertMediaExist, loadMedia, mediaUrl } from "../lib/media.js";
import { likePattern, offset, pageMeta, pageQuery } from "../lib/paginate.js";
import { publicationFields, statusFilter, statusInput } from "../lib/publication.js";
import { imagesIn, plainText, sanitizeArticle } from "../lib/sanitize.js";
import { uniqueSlug } from "../lib/slug.js";
import { currentUser } from "../middleware/auth.js";

type BlogRow = typeof blogs.$inferSelect;

const MAX_INLINE_IMAGES = 5;
const body = z
  .string()
  .max(500_000)
  .transform(sanitizeArticle)
  .superRefine((html, ctx) => {
    const length = plainText(html).length;
    if (length === 0 || length > 50_000) ctx.addIssue({ code: "custom", message: "Write an article of up to 50,000 characters." });
    const images = imagesIn(html);
    if (images.length > MAX_INLINE_IMAGES) ctx.addIssue({ code: "custom", message: "Add up to five images in the article." });
    if (images.some((image) => !image.alt.trim())) ctx.addIssue({ code: "custom", message: "Add alternative text to every image." });
  });
const fields = {
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
  category: z.string().trim().max(80).nullable(),
  excerpt: z.string().trim().max(400).nullable(),
  cover: z
    .object({ mediaId: z.string().min(1).max(36), alt: z.string().trim().min(1, "Describe the cover image.").max(150) })
    .nullable(),
  body,
};

const excerptFrom = (html: string, excerpt: string | null | undefined) => {
  if (excerpt) return excerpt;
  const text = plainText(html);
  return text.length <= 200 ? text : `${text.slice(0, 197).replace(/\s+\S*$/, "")}…`;
};

async function resolveSlug(requested: string | undefined, title: string, excludeId?: string) {
  if (!requested) return uniqueSlug(blogs, blogs, title, excludeId);
  const [taken] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.slug, requested)).limit(1);
  if (taken && taken.id !== excludeId) throw validationError("slug", "This URL is already used by another article.");
  return requested;
}

async function serialize(rows: BlogRow[], mode: "card" | "public" | "admin") {
  const [covers, authors] = await Promise.all([
    loadMedia(rows.map((row) => row.coverMediaId)),
    rows.some((row) => row.authorId)
      ? db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, rows.flatMap((row) => (row.authorId ? [row.authorId] : []))))
      : Promise.resolve([]),
  ]);
  const authorNames = new Map(authors.map((author) => [author.id, author.displayName]));
  return rows.map((row) => {
    const file = row.coverMediaId ? covers.get(row.coverMediaId) : undefined;
    const card = {
      slug: row.slug,
      title: row.title,
      category: row.category,
      excerpt: row.excerpt,
      cover: file ? { src: mediaUrl(file.filename), alt: row.coverAlt ?? "" } : null,
      publishedAt: row.publishedAt,
    };
    if (mode === "card") return card;
    const full = { ...card, body: row.bodyHtml, author: row.authorId ? (authorNames.get(row.authorId) ?? null) : null };
    if (mode === "public") return full;
    return {
      id: row.id,
      ...full,
      cover: file ? { mediaId: file.id, src: mediaUrl(file.filename), alt: row.coverAlt ?? "" } : null,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function findBlog(id: string) {
  const [row] = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
  if (!row) throw notFound("Article");
  return row;
}

async function adminBlog(id: string) {
  const [result] = await serialize([await findBlog(id)], "admin");
  return result;
}

// ---------- Public ----------
export const publicBlogsRouter = Router();

publicBlogsRouter.get("/", async (req, res) => {
  const query = parse(pageQuery.extend({ perPage: pageQuery.shape.perPage.default(12) }), req.query);
  const where = eq(blogs.status, "published");
  const [total] = await db.select({ n: count() }).from(blogs).where(where);
  const rows = await db
    .select()
    .from(blogs)
    .where(where)
    .orderBy(desc(blogs.publishedAt))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: await serialize(rows, "card"), meta: pageMeta(total?.n ?? 0, query) });
});

publicBlogsRouter.get("/:slug", async (req, res) => {
  const { slug } = parse(slugParam, req.params);
  const [row] = await db
    .select()
    .from(blogs)
    .where(and(eq(blogs.slug, slug), eq(blogs.status, "published")))
    .limit(1);
  if (!row) throw notFound("Article");
  const [data] = await serialize([row], "public");
  res.json({ data });
});

// ---------- Admin ----------
export const adminBlogsRouter = Router();

adminBlogsRouter.get("/", async (req, res) => {
  const query = parse(pageQuery.extend({ status: statusFilter, q: z.string().trim().max(100).optional() }), req.query);
  const conditions: SQL[] = [];
  if (query.status) conditions.push(eq(blogs.status, query.status));
  if (query.q) conditions.push(like(blogs.title, likePattern(query.q)));
  const where = conditions.length ? and(...conditions) : undefined;
  const [total] = await db.select({ n: count() }).from(blogs).where(where);
  const rows = await db
    .select()
    .from(blogs)
    .where(where)
    .orderBy(desc(blogs.updatedAt))
    .limit(query.perPage)
    .offset(offset(query));
  res.json({ data: await serialize(rows, "admin"), meta: pageMeta(total?.n ?? 0, query) });
});

adminBlogsRouter.post("/", async (req, res) => {
  const input = parse(
    z.object({
      ...fields,
      slug: fields.slug.optional(),
      category: fields.category.default(null),
      excerpt: fields.excerpt.default(null),
      cover: fields.cover.default(null),
      status: statusInput.default("draft"),
    }),
    req.body,
  );
  if (input.cover) await assertMediaExist([input.cover.mediaId], "cover");
  const id = randomUUID();
  const now = new Date();
  await db.insert(blogs).values({
    id,
    slug: await resolveSlug(input.slug, input.title),
    title: input.title,
    category: input.category || null,
    excerpt: excerptFrom(input.body, input.excerpt),
    coverMediaId: input.cover?.mediaId ?? null,
    coverAlt: input.cover?.alt ?? null,
    bodyHtml: input.body,
    authorId: currentUser(req).id,
    ...publicationFields(input.status),
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ data: await adminBlog(id) });
});

adminBlogsRouter.get("/:id", async (req, res) => {
  res.json({ data: await adminBlog(parse(idParam, req.params).id) });
});

adminBlogsRouter.patch("/:id", async (req, res) => {
  const existing = await findBlog(parse(idParam, req.params).id);
  const input = parse(z.object(fields).partial(), req.body);
  if (input.cover) await assertMediaExist([input.cover.mediaId], "cover");
  const bodyHtml = input.body ?? existing.bodyHtml;
  await db
    .update(blogs)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: await resolveSlug(input.slug, existing.title, existing.id) } : {}),
      ...(input.category !== undefined ? { category: input.category || null } : {}),
      ...(input.body !== undefined ? { bodyHtml } : {}),
      ...(input.excerpt !== undefined || input.body !== undefined
        ? { excerpt: excerptFrom(bodyHtml, input.excerpt === undefined ? null : input.excerpt) }
        : {}),
      ...(input.cover !== undefined
        ? { coverMediaId: input.cover?.mediaId ?? null, coverAlt: input.cover?.alt ?? null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(blogs.id, existing.id));
  res.json({ data: await adminBlog(existing.id) });
});

for (const [action, status] of [
  ["publish", "published"],
  ["unpublish", "draft"],
] as const) {
  adminBlogsRouter.post(`/:id/${action}`, async (req, res) => {
    const existing = await findBlog(parse(idParam, req.params).id);
    await db
      .update(blogs)
      .set({ ...publicationFields(status, existing.publishedAt), updatedAt: new Date() })
      .where(eq(blogs.id, existing.id));
    res.json({ data: await adminBlog(existing.id) });
  });
}

adminBlogsRouter.delete("/:id", async (req, res) => {
  const existing = await findBlog(parse(idParam, req.params).id);
  await db.delete(blogs).where(eq(blogs.id, existing.id));
  res.status(204).end();
});
