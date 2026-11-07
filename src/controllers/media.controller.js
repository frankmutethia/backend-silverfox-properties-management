import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../services/upload.service.js";

const FOLDERS = ["properties", "services", "blog", "profile"];

// Uploads one image to Cloudinary. Attach the returned { url, publicId } (plus alt text)
// to a property, service, article or profile.
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Choose an image to upload (form field \"image\")");
  const folder = FOLDERS.includes(req.query.folder) ? req.query.folder : "uploads";
  const result = await uploadToCloudinary(req.file.buffer, folder);
  return res
    .status(201)
    .json(new ApiResponse(201, { image: { url: result.secure_url, publicId: result.public_id } }, "Image uploaded"));
});
