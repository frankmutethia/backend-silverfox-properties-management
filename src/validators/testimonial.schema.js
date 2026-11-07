import { z } from "zod";

const rating = z.coerce
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be at least 1 star")
  .max(5, "Rating cannot exceed 5 stars");

const fields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  comment: z.string().trim().min(10, "Comment must be at least 10 characters").max(2000),
  rating,
};

// `website` is a hidden honeypot field: real visitors leave it empty.
export const submitTestimonialSchema = z.object({ ...fields, website: z.string().max(200).optional() });

export const createTestimonialSchema = z.object({
  ...fields,
  status: z.enum(["draft", "published"]).default("draft"),
});

export const updateTestimonialSchema = z
  .object({ ...fields, status: z.enum(["pending", "draft", "published"]) })
  .partial();
