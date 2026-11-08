import { Router } from "express";
import { createUser, listUsers } from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createUserSchema } from "../validators/user.schema.js";

const router = Router();

router.get("/", requireAuth, listUsers);
router.post("/", requireAuth, validate(createUserSchema), createUser);

export default router;
