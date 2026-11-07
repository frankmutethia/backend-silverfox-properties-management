import mongoose from "mongoose";
import { cleanJson, stampPublishedAt } from "./plugins.js";

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 100 },
    comment: { type: String, required: [true, "Comment is required"], trim: true, maxlength: 2000 },
    rating: { type: Number, required: [true, "Rating is required"], min: 1, max: 5 },
    // Website submissions start as "pending" until staff review them.
    status: { type: String, enum: ["pending", "draft", "published"], default: "draft", index: true },
    source: { type: String, enum: ["public", "admin"], default: "public" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
  },
  { timestamps: true, toJSON: cleanJson() }
);

testimonialSchema.pre("save", stampPublishedAt);

testimonialSchema.index({ status: 1, publishedAt: -1 });
testimonialSchema.index({ status: 1, createdAt: -1 });

export const Testimonial = mongoose.model("Testimonial", testimonialSchema);
