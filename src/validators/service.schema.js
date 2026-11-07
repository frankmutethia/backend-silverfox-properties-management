import { z } from "zod";
import { image, objectId, status } from "./common.schema.js";
import { SERVICE_CATEGORY_NUMBERS } from "../models/Service.model.js";
import { plainText, sanitizeRichText } from "../utils/sanitize.js";

const description = z
  .string()
  .max(200_000)
  .transform(sanitizeRichText)
  .refine((html) => {
    const length = plainText(html).length;
    return length > 0 && length <= 10_000;
  }, "Enter a description of up to 10,000 characters");

const fields = {
  category: z.enum(SERVICE_CATEGORY_NUMBERS, { message: "Choose a valid service category" }),
  title: z.string().trim().min(1, "Title is required").max(150),
  description,
  icon: z.string().trim().max(40).regex(/^[A-Za-z0-9]*$/, "Use a lucide icon name, e.g. KeyRound").nullable(),
  image: image().nullable(),
  status,
};

export const createServiceSchema = z.object({
  ...fields,
  icon: fields.icon.default(null),
  image: fields.image.default(null),
  status: status.default("draft"),
});

export const updateServiceSchema = z.object(fields).partial();

export const reorderServicesSchema = z.object({ ids: z.array(objectId).min(1).max(500) });

export const updateServiceCategorySchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(1000),
  })
  .partial();
