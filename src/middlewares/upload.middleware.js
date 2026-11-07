import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new ApiError(400, "Only JPEG, PNG and WebP images are allowed"), false);
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});
