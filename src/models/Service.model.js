import mongoose from "mongoose";
import { cleanJson, imageSchema, publicationFields, stampPublishedAt } from "./plugins.js";

export const SERVICE_CATEGORY_NUMBERS = ["01", "02"];

const serviceCategorySchema = new mongoose.Schema(
  {
    number: { type: String, enum: SERVICE_CATEGORY_NUMBERS, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: cleanJson() }
);

export const ServiceCategory = mongoose.model("ServiceCategory", serviceCategorySchema);

const serviceSchema = new mongoose.Schema(
  {
    // Category number ("01" purchase, "02" management).
    category: { type: String, enum: SERVICE_CATEGORY_NUMBERS, required: true, index: true },
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 150 },
    description: { type: String, required: [true, "Description is required"] },
    // lucide-react icon name, e.g. "KeyRound".
    icon: { type: String, trim: true, maxlength: 40, default: null },
    image: { type: imageSchema(), default: null },
    sortOrder: { type: Number, default: 0, index: true },
    ...publicationFields,
  },
  { timestamps: true, toJSON: cleanJson() }
);

serviceSchema.pre("save", stampPublishedAt);

export const Service = mongoose.model("Service", serviceSchema);
