import multer from "multer";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue ?? {})[0] ?? "value";
      error = new ApiError(409, `That ${field} is already in use`);
    } else if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      error = new ApiError(400, messages[0] || "Validation failed", messages);
    } else if (error.name === "CastError") {
      error = new ApiError(400, "Invalid ID format");
    } else if (error.name === "JsonWebTokenError") {
      error = new ApiError(401, "Invalid token");
    } else if (error.name === "TokenExpiredError") {
      error = new ApiError(401, "Session expired, please log in again");
    } else if (error instanceof multer.MulterError) {
      error = new ApiError(400, error.code === "LIMIT_FILE_SIZE" ? "Images must be 5 MB or smaller" : "Invalid upload");
    } else if (error.type === "entity.parse.failed") {
      error = new ApiError(400, "Malformed JSON body");
    } else if (error.type === "entity.too.large") {
      error = new ApiError(413, "Request body is too large");
    } else {
      console.error(err);
      error = new ApiError(500, env.isProd ? "Internal server error" : error.message || "Internal server error");
    }
  }

  res.set("Cache-Control", "no-store");
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors,
    ...(env.isProd || env.isTest ? {} : { stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
