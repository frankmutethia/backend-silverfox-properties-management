import { Testimonial } from "../models/Testimonial.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findOr404 } from "../utils/documents.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { sendTestimonialNotificationEmail } from "../services/email.service.js";

const SUBMITTED = "Thank you! Your testimonial has been submitted and will appear once our team has reviewed it.";
const PUBLIC_FIELDS = "name comment rating publishedAt";

// ---------- Public ----------
export const getPublishedTestimonials = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: 12 });
  const filter = { status: "published" };
  const [testimonials, total] = await Promise.all([
    Testimonial.find(filter).select(PUBLIC_FIELDS).sort({ publishedAt: -1, _id: -1 }).skip(pagination.skip).limit(pagination.limit),
    Testimonial.countDocuments(filter),
  ]);
  return res.status(200).json(new ApiResponse(200, { testimonials, pagination: paginationMeta(pagination, total) }));
});

export const submitTestimonial = asyncHandler(async (req, res) => {
  const { website, ...input } = req.body;
  // Honeypot filled in: a bot. Pretend it worked and store nothing.
  if (website) return res.status(201).json(new ApiResponse(201, {}, SUBMITTED));

  const testimonial = await Testimonial.create({ ...input, status: "pending", source: "public" });
  sendTestimonialNotificationEmail(testimonial).catch((err) =>
    console.error("Testimonial notification email failed:", err.message)
  );
  return res.status(201).json(new ApiResponse(201, {}, SUBMITTED));
});

// ---------- Staff ----------
export const getAllTestimonials = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (["pending", "draft", "published"].includes(req.query.status)) filter.status = req.query.status;
  const [testimonials, total] = await Promise.all([
    Testimonial.find(filter).populate("author", "name email").sort({ createdAt: -1, _id: -1 }).skip(pagination.skip).limit(pagination.limit),
    Testimonial.countDocuments(filter),
  ]);
  return res.status(200).json(new ApiResponse(200, { testimonials, pagination: paginationMeta(pagination, total) }));
});

export const getTestimonialById = asyncHandler(async (req, res) => {
  const testimonial = await findOr404(Testimonial, req.params.id, "Testimonial");
  await testimonial.populate("author", "name email");
  return res.status(200).json(new ApiResponse(200, { testimonial }));
});

export const createTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.create({ ...req.body, source: "admin", author: req.user._id });
  return res.status(201).json(new ApiResponse(201, { testimonial }, "Testimonial created"));
});

export const updateTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await findOr404(Testimonial, req.params.id, "Testimonial");
  Object.assign(testimonial, req.body);
  await testimonial.save();
  return res.status(200).json(new ApiResponse(200, { testimonial }, "Testimonial updated"));
});

// pending/draft → published; published → draft.
export const togglePublish = asyncHandler(async (req, res) => {
  const testimonial = await findOr404(Testimonial, req.params.id, "Testimonial");
  testimonial.status = testimonial.status === "published" ? "draft" : "published";
  await testimonial.save();
  return res
    .status(200)
    .json(new ApiResponse(200, { testimonial }, `Testimonial ${testimonial.status === "published" ? "published" : "moved to draft"}`));
});

// Also used to reject a pending submission.
export const deleteTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await findOr404(Testimonial, req.params.id, "Testimonial");
  await testimonial.deleteOne();
  return res.status(200).json(new ApiResponse(200, {}, "Testimonial deleted"));
});
