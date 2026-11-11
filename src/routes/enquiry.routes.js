import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { findOr404 } from "../utils/documents.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { sendEnquiryNotificationEmail } from "../services/email.service.js";

export const Enquiry = mongoose.model("Enquiry", new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  message: { type: String, required: true, maxlength: 5000 },
  emailStatus: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
}, { timestamps: true }));

async function notify(enquiry) {
  try {
    await sendEnquiryNotificationEmail(enquiry);
    enquiry.emailStatus = "sent";
  } catch {
    enquiry.emailStatus = "failed";
  }
  await enquiry.save();
}

function notifyInBackground(enquiry) {
  void notify(enquiry).catch((error) => {
    console.error(`[email] Could not update enquiry ${enquiry._id}: ${error.message}`);
  });
}

const router = Router();
router.post("/", rateLimit({ windowMs: 3600000, limit: 5, standardHeaders: true, legacyHeaders: false }), validate(z.object({
  name: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(5000),
})), asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.create({ name: req.body.name, message: req.body.message });
  res.status(201).json(new ApiResponse(201, {}, "Your enquiry has been received. Thank you."));
  notifyInBackground(enquiry);
}));
router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const page = parsePagination(req.query, { defaultLimit: 20 });
  const [enquiries, total] = await Promise.all([
    Enquiry.find().sort({ createdAt: -1, _id: -1 }).skip(page.skip).limit(page.limit),
    Enquiry.countDocuments(),
  ]);
  res.json(new ApiResponse(200, { enquiries, pagination: paginationMeta(page, total) }));
}));
router.post("/:id/retry-email", requireAuth, asyncHandler(async (req, res) => {
  const enquiry = await findOr404(Enquiry, req.params.id, "Enquiry");
  if (enquiry.emailStatus !== "sent") await notify(enquiry);
  res.json(new ApiResponse(200, { enquiry }));
}));
export default router;
