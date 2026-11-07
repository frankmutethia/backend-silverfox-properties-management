import { Router } from "express";
import { uploadImage } from "../controllers/media.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

router.post("/", requireAuth, upload.single("image"), uploadImage);

export default router;
