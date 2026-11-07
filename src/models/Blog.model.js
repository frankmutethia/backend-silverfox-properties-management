import mongoose from "mongoose";
import { cleanJson, imageSchema, publicationFields, stampPublishedAt } from "./plugins.js";

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true },
    category: { type: String, trim: true, maxlength: 80, default: null },
    excerpt: { type: String, required: true, trim: true, maxlength: 400 },
    // Sanitized HTML from the editor.
    content: { type: String, required: [true, "Article body is required"] },
    coverImage: { type: imageSchema(), default: null },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ...publicationFields,
  },
  { timestamps: true, toJSON: cleanJson() }
);

blogSchema.pre("save", stampPublishedAt);
blogSchema.index({ status: 1, publishedAt: -1 });

export const Blog = mongoose.model("Blog", blogSchema);
