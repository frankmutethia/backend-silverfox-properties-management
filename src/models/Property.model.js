import mongoose from "mongoose";
import { cleanJson, imageSchema, publicationFields, stampPublishedAt } from "./plugins.js";

export const PROPERTY_CATEGORIES = ["sale", "rent", "managed"];
export const PROPERTY_TYPES = ["Apartment", "House"];

const priceSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "KES", uppercase: true, trim: true },
    // "" for sale prices, "month" or "year" for rentals.
    period: { type: String, enum: ["", "month", "year"], default: "" },
  },
  { _id: false }
);

const propertySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true },
    reference: { type: String, required: [true, "Reference is required"], trim: true, unique: true, maxlength: 40 },
    // null = not yet confirmed (shown as "unconfirmed" on the dashboard).
    category: { type: String, enum: [...PROPERTY_CATEGORIES, null], default: null },
    type: { type: String, enum: PROPERTY_TYPES, required: [true, "Type is required"] },
    location: { type: String, trim: true, maxlength: 200, default: null },
    neighbourhood: { type: String, trim: true, maxlength: 2000, default: null },
    description: { type: String, required: [true, "Description is required"], trim: true, maxlength: 5000 },
    price: { type: priceSchema, default: null },
    bedrooms: { type: Number, min: 0, default: null },
    bathrooms: { type: Number, min: 0, default: null },
    areaSqm: { type: Number, min: 0, default: null },
    amenities: { type: [String], default: [] },
    // Ordered photo list; the first is the cover. `position` is a CSS object-position hint.
    images: { type: [imageSchema({ position: { type: String, trim: true, maxlength: 40, default: null } })], default: [] },
    ...publicationFields,
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: cleanJson() }
);

propertySchema.pre("save", stampPublishedAt);
propertySchema.index({ status: 1, publishedAt: -1 });

export const Property = mongoose.model("Property", propertySchema);
