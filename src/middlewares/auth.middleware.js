import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "accessToken";

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE] || req.header("Authorization")?.replace("Bearer ", "");
  if (!token) throw new ApiError(401, "Not authenticated");

  const decoded = jwt.verify(token, env.accessTokenSecret);
  const user = await User.findById(decoded.id);

  if (!user) throw new ApiError(401, "User no longer exists");
  if (!user.isActive) throw new ApiError(403, "This account has been deactivated");
  // Tokens issued before a password change or reset are no longer valid.
  if ((decoded.pv ?? 0) !== user.passwordVersion()) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  req.user = user;
  next();
});
