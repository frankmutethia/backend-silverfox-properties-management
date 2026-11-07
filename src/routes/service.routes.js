import { Router } from "express";
import {
  getPublishedServices,
  getCategories,
  updateCategory,
  getAllServices,
  getServiceById,
  createService,
  reorderServices,
  updateService,
  togglePublish,
  deleteService,
} from "../controllers/service.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createServiceSchema,
  updateServiceSchema,
  reorderServicesSchema,
  updateServiceCategorySchema,
} from "../validators/service.schema.js";

const router = Router();

router.get("/", getPublishedServices);
router.get("/categories", getCategories);

router.patch("/categories/:number", requireAuth, validate(updateServiceCategorySchema), updateCategory);
router.get("/admin/all", requireAuth, getAllServices);
router.get("/admin/:id", requireAuth, getServiceById);
router.post("/", requireAuth, validate(createServiceSchema), createService);
router.patch("/reorder", requireAuth, validate(reorderServicesSchema), reorderServices);
router.patch("/:id", requireAuth, validate(updateServiceSchema), updateService);
router.patch("/:id/publish", requireAuth, togglePublish);
router.delete("/:id", requireAuth, deleteService);

export default router;
