import { z } from "zod";
import { image, status } from "./common.schema.js";
import { imagesIn, plainText, sanitizeArticle } from "../utils/sanitize.js";

const MAX_INLINE_IMAGES = 5;

const content = z
  .string()
  .max(500_000)
  .transform(sanitizeArticle)
  .superRefine((html, ctx) => {
    const length = plainText(html).length;
    if (length === 0 || length > 50_000) {
      ctx.addIssue({ code: "custom", message: "Write an article of up to 50,000 characters" });
    }
    const images = imagesIn(html);
    if (images.length > MAX_INLINE_IMAGES) {
      ctx.addIssue({ code: "custom", message: "Add up to five images in the article" });
    }
    if (images.some((img) => !img.alt.trim())) {
      ctx.addIssue({ code: "custom", message: "Add alternative text to every image" });
    }
  });

const fields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  category: z.string().trim().max(80).nullable(),
  // Leave blank to generate it from the article body.
  excerpt: z.string().trim().max(400).nullable(),
  coverImage: image("Describe the cover image").nullable(),
  content,
  status,
};

export const createBlogSchema = z.object({
  ...fields,
  slug: fields.slug.optional(),
  category: fields.category.default(null),
  excerpt: fields.excerpt.default(null),
  coverImage: fields.coverImage.default(null),
  status: status.default("draft"),
});

export const updateBlogSchema = z.object(fields).partial();
