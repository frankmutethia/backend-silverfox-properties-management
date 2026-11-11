import { Router } from "express";
import authRoutes from "./auth.routes.js";
import mediaRoutes from "./media.routes.js";
import propertyRoutes from "./property.routes.js";
import serviceRoutes from "./service.routes.js";
import blogRoutes from "./blog.routes.js";
import testimonialRoutes from "./testimonial.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import userRoutes from "./user.routes.js";
import enquiryRoutes from "./enquiry.routes.js";

const router = Router();

router.get("/health", (req, res) =>
  res.status(200).json({ success: true, message: "API is running", timestamp: new Date() })
);

router.use("/auth", authRoutes);
router.use("/media", mediaRoutes);
router.use("/properties", propertyRoutes);
router.use("/services", serviceRoutes);
router.use("/blog", blogRoutes);
router.use("/testimonials", testimonialRoutes);
router.use("/admin", dashboardRoutes);
router.use("/users", userRoutes);
router.use("/enquiries", enquiryRoutes);

export default router;
