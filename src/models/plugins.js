import mongoose from "mongoose";

// Shared image shape: Cloudinary URL + public id (used to delete the file later) + alt text.
export const imageSchema = (extra = {}) =>
  new mongoose.Schema(
    {
      url: { type: String, required: true, trim: true },
      publicId: { type: String, trim: true },
      alt: { type: String, trim: true, maxlength: 150, default: "" },
      ...extra,
    },
    { _id: false }
  );

// Hide internal fields from every JSON response.
export const cleanJson = (hidden = []) => ({
  versionKey: false,
  transform: (_doc, ret) => {
    for (const key of hidden) delete ret[key];
    return ret;
  },
});

export const publicationFields = {
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  publishedAt: Date,
};

// First publish stamps publishedAt; later edits and unpublish/republish keep the original date.
export function stampPublishedAt() {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
}
