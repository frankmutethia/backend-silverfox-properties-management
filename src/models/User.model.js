import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { cleanJson, imageSchema } from "./plugins.js";

export const RESET_TOKEN_MINUTES = 60;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, "Password is required"], minlength: 10, select: false },
    // Public contact details shown on the website; separate from the sign-in email.
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 255, default: "" },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    photo: { type: imageSchema(), default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true, toJSON: cleanJson(["password", "passwordChangedAt", "passwordResetToken", "passwordResetExpires"]) }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// `pv` ties the token to the current password: changing or resetting it invalidates older tokens.
userSchema.methods.passwordVersion = function () {
  return this.passwordChangedAt ? this.passwordChangedAt.getTime() : 0;
};

userSchema.methods.generateAccessToken = function (expiresIn = "1d") {
  return jwt.sign({ id: this._id, pv: this.passwordVersion() }, env.accessTokenSecret, { expiresIn });
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  return resetToken;
};

userSchema.methods.clearPasswordReset = function () {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
};

export const User = mongoose.model("User", userSchema);
