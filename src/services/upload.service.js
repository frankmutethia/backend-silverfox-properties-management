import crypto from "crypto";
import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const signatures = [
  (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, // JPEG
  (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), // PNG
  (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP", // WebP
];

// Checks the file bytes, not just the declared type, so renamed non-images are rejected.
export const isSupportedImage = (buffer) => signatures.some((test) => test(buffer));

export const uploadToCloudinary = (buffer, subfolder) => {
  if (!isSupportedImage(buffer)) {
    return Promise.reject(new ApiError(400, "Upload a JPEG, PNG or WebP image"));
  }

  const folder = `${env.cloudinary.folder}/${subfolder}`;

  // Tests never reach Cloudinary.
  if (env.isTest) {
    const publicId = `${folder}/${crypto.randomUUID()}`;
    return Promise.resolve({ secure_url: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`, public_id: publicId });
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 2000, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error.message || error);
          return reject(new ApiError(502, `Image upload failed: ${error.message || "unknown error"}`));
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId || env.isTest) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete failed:", err.message);
  }
};

// Deletes Cloudinary files that were attached before an update but are no longer used.
export const deleteRemovedImages = async (before = [], after = []) => {
  const kept = new Set(after.filter(Boolean).map((img) => img.publicId).filter(Boolean));
  const removed = before.filter(Boolean).map((img) => img.publicId).filter((id) => id && !kept.has(id));
  await Promise.all(removed.map(deleteFromCloudinary));
};
