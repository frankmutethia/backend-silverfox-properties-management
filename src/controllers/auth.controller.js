import crypto from "crypto";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { ACCESS_COOKIE } from "../middlewares/auth.middleware.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
import { deleteRemovedImages } from "../services/upload.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION = { short: { expiresIn: "1d", maxAge: DAY_MS }, long: { expiresIn: "30d", maxAge: 30 * DAY_MS } };

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "none" : "lax",
  path: "/",
  ...(maxAge ? { maxAge } : {}),
});

const setSessionCookie = (res, user, remember) => {
  const session = remember ? SESSION.long : SESSION.short;
  res.cookie(ACCESS_COOKIE, user.generateAccessToken(session.expiresIn), cookieOptions(session.maxAge));
};

const RESET_MESSAGE = "If an account with that email exists, password reset instructions have been sent.";

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (!user.isActive) throw new ApiError(403, "This account has been deactivated");

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  setSessionCookie(res, user, remember);
  return res.status(200).json(new ApiResponse(200, { user }, "Logged in successfully"));
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions());
  return res.status(200).json(new ApiResponse(200, {}, "Logged out successfully"));
});

export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, { user: req.user }));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const previousPhoto = user.photo;
  Object.assign(user, req.body);
  await user.save();
  if (req.body.photo !== undefined) await deleteRemovedImages([previousPhoto], [user.photo]);
  return res.status(200).json(new ApiResponse(200, { user }, "Profile updated"));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const data = {};

  if (user && user.isActive) {
    const token = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${env.frontendUrl}/staff/reset-password?token=${token}`;
    const result = await sendPasswordResetEmail(user.email, user.name, resetUrl);
    // Without SMTP outside production, return the link so it can be tested.
    if (result.devMode) data.resetUrl = resetUrl;
  }

  return res.status(200).json(new ApiResponse(200, data, RESET_MESSAGE));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash("sha256").update(req.body.token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  if (!user.isActive) throw new ApiError(403, "This account has been deactivated");

  user.password = req.body.newPassword;
  user.clearPasswordReset();
  await user.save(); // also signs out every existing session

  return res.status(200).json(new ApiResponse(200, {}, "Password reset successfully. You can now log in."));
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");

  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw new ApiError(400, "Current password is incorrect");
  }
  if (await user.comparePassword(req.body.newPassword)) {
    throw new ApiError(400, "New password must be different from your current password");
  }

  user.password = req.body.newPassword;
  user.clearPasswordReset();
  await user.save(); // signs out other sessions

  setSessionCookie(res, user, false); // keep this browser signed in
  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});
