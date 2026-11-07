import { z } from "zod";

export const status = z.enum(["draft", "published"]);

const httpsUrl = z
  .string()
  .trim()
  .url("Image URL must be valid")
  .max(500)
  .refine((value) => value.startsWith("https://"), "Image URL must start with https://");

// An image previously uploaded with POST /api/v1/media (or any https URL).
export const image = (altMessage = "Describe the image") =>
  z.object({
    url: httpsUrl,
    publicId: z.string().trim().max(255).optional(),
    alt: z.string().trim().min(1, altMessage).max(150),
  });

export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID format");
