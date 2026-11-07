import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/dashboard", requireAuth, getDashboard);

export default router;
