import { Router } from "express";
import {
  login,
  logout,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginLimiter, passwordResetLimiter } from "../middlewares/rateLimit.middleware.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "../validators/auth.schema.js";

const router = Router();

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", requireAuth, getMe);
router.patch("/profile", requireAuth, validate(updateProfileSchema), updateProfile);
router.post("/forgot-password", passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", passwordResetLimiter, validate(resetPasswordSchema), resetPassword);
router.patch("/change-password", requireAuth, validate(changePasswordSchema), changePassword);

export default router;
