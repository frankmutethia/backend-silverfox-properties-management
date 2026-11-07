import { Router } from "express";
import {
  getPublishedTestimonials,
  submitTestimonial,
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  togglePublish,
  deleteTestimonial,
} from "../controllers/testimonial.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { testimonialSubmitLimiter } from "../middlewares/rateLimit.middleware.js";
import {
  submitTestimonialSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
} from "../validators/testimonial.schema.js";

const router = Router();

router.get("/", getPublishedTestimonials);
router.post("/submit", testimonialSubmitLimiter, validate(submitTestimonialSchema), submitTestimonial);

router.get("/admin/all", requireAuth, getAllTestimonials);
router.get("/admin/:id", requireAuth, getTestimonialById);
router.post("/", requireAuth, validate(createTestimonialSchema), createTestimonial);
router.patch("/:id", requireAuth, validate(updateTestimonialSchema), updateTestimonial);
router.patch("/:id/publish", requireAuth, togglePublish);
router.delete("/:id", requireAuth, deleteTestimonial);

export default router;
