import { z } from "zod";
import { email, image } from "./common.schema.js";

const newPassword = z.string().min(10, "Password must be at least 10 characters").max(200);
const matching = (schema) =>
  schema.refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(200),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = matching(
  z.object({ token: z.string().min(1).max(200), newPassword, confirmPassword: z.string() })
);

export const changePasswordSchema = matching(
  z.object({ currentPassword: z.string().min(1, "Current password is required").max(200), newPassword, confirmPassword: z.string() })
);

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    contactEmail: z.union([z.literal(""), email]),
    phone: z.string().trim().max(30),
    photo: image("Describe the photo").partial({ alt: true }).nullable(),
  })
  .partial();
