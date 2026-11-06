import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { count, eq } from "drizzle-orm";
import { config } from "../config.js";
import { hashPassword } from "../lib/crypto.js";
import { storeImage } from "../lib/media.js";
import { db } from "./client.js";
import { blogs, properties, propertyImages, serviceCategories, services, users } from "./schema.js";
import { seedArticles, seedProperties, seedServiceCategories } from "./seed-data.js";

const assetsDir = new URL("../../seed-assets/", import.meta.url);

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function createAdmin(email: string, password: string, displayName: string) {
  if (password.length < 10) throw new Error("Admin password must be at least 10 characters.");
  const normalized = email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (existing) return { created: false as const, id: existing.id };
  const now = new Date();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: normalized,
    passwordHash: await hashPassword(password),
    displayName,
    createdAt: now,
    updatedAt: now,
  });
  return { created: true as const, id };
}

async function ensureFirstAdmin() {
  const [row] = await db.select({ n: count() }).from(users);
  if ((row?.n ?? 0) > 0 || !config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) return;
  await createAdmin(config.ADMIN_EMAIL, config.ADMIN_PASSWORD, config.ADMIN_NAME);
  console.info(`Created the first admin account for ${config.ADMIN_EMAIL}.`);
}

export async function seedContent() {
  const [row] = await db.select({ n: count() }).from(serviceCategories);
  if ((row?.n ?? 0) > 0) return false;

  const uploaded = new Map<string, string>();
  const image = async (file: string) => {
    const cached = uploaded.get(file);
    if (cached) return cached;
    const record = await storeImage(await readFile(fileURLToPath(new URL(file, assetsDir))), null);
    uploaded.set(file, record.id);
    return record.id;
  };

  const now = Date.now();
  // Earlier entries get later publish dates so the public order matches the current website.
  const publishedAt = (index: number) => new Date(now - index * 1000);

  await db.transaction(async (tx) => {
    for (const [index, category] of seedServiceCategories.entries()) {
      const categoryId = randomUUID();
      await tx.insert(serviceCategories).values({
        id: categoryId,
        number: category.number,
        title: category.title,
        description: category.description,
        sortOrder: index,
        updatedAt: new Date(now),
      });
      for (const [position, service] of category.services.entries()) {
        await tx.insert(services).values({
          id: randomUUID(),
          categoryId,
          title: service.title,
          descriptionHtml: `<p>${escapeHtml(service.copy)}</p>`,
          icon: service.icon,
          sortOrder: index * 100 + position,
          status: "published",
          publishedAt: new Date(now),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
      }
    }
  });

  for (const [index, property] of seedProperties.entries()) {
    const id = randomUUID();
    const mediaId = await image(property.image.file);
    await db.insert(properties).values({
      id,
      slug: property.slug,
      reference: property.reference,
      name: property.name,
      category: null,
      type: property.type,
      location: null,
      neighbourhood: null,
      description: property.description,
      amenities: [],
      status: "published",
      publishedAt: publishedAt(index),
      createdAt: new Date(now),
      updatedAt: new Date(now - index * 1000),
    });
    await db.insert(propertyImages).values({
      id: randomUUID(),
      propertyId: id,
      mediaId,
      alt: property.image.alt,
      position: property.image.position,
      sortOrder: 0,
    });
  }

  for (const [index, article] of seedArticles.entries()) {
    await db.insert(blogs).values({
      id: randomUUID(),
      slug: article.slug,
      title: article.title,
      category: article.category,
      excerpt: article.excerpt,
      coverMediaId: await image(article.image.file),
      coverAlt: article.image.alt,
      bodyHtml: article.sections
        .map((section) => `<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>`)
        .join(""),
      status: "published",
      publishedAt: publishedAt(index),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
  }
  return true;
}

export async function bootstrap() {
  await ensureFirstAdmin();
  if (await seedContent()) console.info("Loaded the existing website content into the database.");
}
