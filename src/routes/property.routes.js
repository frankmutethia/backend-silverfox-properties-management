import { Router } from "express";
import {
  getPublishedProperties,
  getPropertyBySlug,
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  togglePublish,
  deleteProperty,
} from "../controllers/property.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createPropertySchema, updatePropertySchema } from "../validators/property.schema.js";

const router = Router();

router.get("/", getPublishedProperties);
router.get("/slug/:slug", getPropertyBySlug);

router.get("/admin/all", requireAuth, getAllProperties);
router.get("/admin/:id", requireAuth, getPropertyById);
router.post("/", requireAuth, validate(createPropertySchema), createProperty);
router.patch("/:id", requireAuth, validate(updatePropertySchema), updateProperty);
router.patch("/:id/publish", requireAuth, togglePublish);
router.delete("/:id", requireAuth, deleteProperty);

export default router;
