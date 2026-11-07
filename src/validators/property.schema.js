import { z } from "zod";
import { image, status } from "./common.schema.js";
import { PROPERTY_CATEGORIES, PROPERTY_TYPES } from "../models/Property.model.js";

const count = z.number().int().nonnegative().max(1000).nullable();

const fields = {
  name: z.string().trim().min(1, "Name is required").max(150),
  reference: z.string().trim().min(1, "Reference is required").max(40),
  slug: z
    .string()
    .trim()
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  category: z.enum(PROPERTY_CATEGORIES),
  type: z.enum(PROPERTY_TYPES),
  location: z.string().trim().min(1, "Location is required").max(200),
  neighbourhood: z.string().trim().max(2000).nullable(),
  description: z.string().trim().min(1, "Description is required").max(5000),
  price: z
    .object({
      amount: z.number().finite().nonnegative().max(1_000_000_000_000),
      currency: z.string().trim().toUpperCase().length(3).default("KES"),
      period: z.enum(["", "month", "year"]).default(""),
    })
    .nullable(),
  bedrooms: count,
  bathrooms: count,
  areaSqm: z.number().finite().nonnegative().max(10_000_000).nullable(),
  amenities: z.array(z.string().trim().min(1).max(80)).max(40),
  images: z
    .array(
      image("Describe every photo").extend({
        position: z.string().trim().max(40).regex(/^[a-z0-9.%\s-]*$/i, "Invalid image position").nullable().optional(),
      })
    )
    .max(5, "Add up to five photos"),
  status,
};

export const createPropertySchema = z.object({
  ...fields,
  slug: fields.slug.optional(),
  neighbourhood: fields.neighbourhood.default(null),
  price: fields.price.default(null),
  bedrooms: count.default(null),
  bathrooms: count.default(null),
  areaSqm: fields.areaSqm.default(null),
  amenities: fields.amenities.default([]),
  images: fields.images.default([]),
  status: status.default("draft"),
});

export const updatePropertySchema = z.object(fields).partial();
