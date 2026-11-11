import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";
import { Blog } from "../models/Blog.model.js";
import { seedArticles } from "../data/seedData.js";
import { escapeHtml } from "../utils/sanitize.js";
import { uploadToCloudinary } from "./upload.service.js";

const assetsDir = new URL("../../seed-assets/", import.meta.url);

export const createAdmin = async ({ email, password, name }) => {
  if (!password || password.length < 10) throw new Error("Admin password must be at least 10 characters.");
  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) return { created: false, user: existing };
  const user = await User.create({ email, password, name });
  return { created: true, user };
};

// Creates the first staff account from SEED_ADMIN_* when the database has none.
export const ensureFirstAdmin = async () => {
  const { email, password, name } = env.seedAdmin;
  if (!email || !password || (await User.estimatedDocumentCount()) > 0) return;
  await createAdmin({ email, password, name });
  console.log(`Created the first admin account for ${email}. Remove SEED_ADMIN_PASSWORD from the environment.`);
};

const uploadSeedImage = async (file, subfolder) => {
  const result = await uploadToCloudinary(await readFile(fileURLToPath(new URL(file, assetsDir))), subfolder);
  return { url: result.secure_url, publicId: result.public_id };
};

// Loads the starter journal articles into a database with no articles. Returns true if it seeded.
// Services and properties are never seeded: staff create them in the workspace.
export const seedContent = async () => {
  if ((await Blog.estimatedDocumentCount()) > 0) return false;

  // Upload every photo first so a Cloudinary failure leaves the database untouched (retried next start).
  // One at a time, so a failure stops at the first image instead of leaving several orphans in Cloudinary.
  const articleImages = [];
  for (const a of seedArticles) articleImages.push(await uploadSeedImage(a.image.file, "blog"));

  const now = Date.now();
  // Earlier entries get later publish dates so the public order matches the seed order.
  const publishedAt = (index) => new Date(now - index * 1000);

  await Blog.insertMany(
    seedArticles.map((article, index) => ({
      title: article.title,
      slug: article.slug,
      category: article.category,
      excerpt: article.excerpt,
      coverImage: { ...articleImages[index], alt: article.image.alt },
      content: article.sections
        .map((section) => `<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>`)
        .join(""),
      status: "published",
      publishedAt: publishedAt(index),
    }))
  );
  return true;
};

export const bootstrap = async () => {
  await ensureFirstAdmin();
  if (!env.seedContent) return;
  try {
    if (await seedContent()) console.log("Loaded the starter journal articles into the database.");
  } catch (err) {
    console.error(`Seeding website content failed (will retry on next start): ${err.message}`);
  }
};
