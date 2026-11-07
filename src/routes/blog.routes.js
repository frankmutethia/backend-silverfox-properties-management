import { Router } from "express";
import {
  getPublishedPosts,
  getPostBySlug,
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  togglePublish,
  deletePost,
} from "../controllers/blog.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createBlogSchema, updateBlogSchema } from "../validators/blog.schema.js";

const router = Router();

router.get("/", getPublishedPosts);
router.get("/slug/:slug", getPostBySlug);

router.get("/admin/all", requireAuth, getAllPosts);
router.get("/admin/:id", requireAuth, getPostById);
router.post("/", requireAuth, validate(createBlogSchema), createPost);
router.patch("/:id", requireAuth, validate(updateBlogSchema), updatePost);
router.patch("/:id/publish", requireAuth, togglePublish);
router.delete("/:id", requireAuth, deletePost);

export default router;
