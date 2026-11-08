import { z } from "zod";
import { email } from "./common.schema.js";

// A signed-in staff member creates another admin and sets their first password.
export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email,
    password: z.string().min(10, "Password must be at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
