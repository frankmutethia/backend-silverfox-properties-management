import { Service, ServiceCategory, SERVICE_CATEGORY_NUMBERS } from "../models/Service.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findOr404 } from "../utils/documents.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { deleteFromCloudinary, deleteRemovedImages } from "../services/upload.service.js";

const categories = () => ServiceCategory.find().sort({ sortOrder: 1 });

// ---------- Public ----------
// Published services grouped under their categories, in display order.
export const getPublishedServices = asyncHandler(async (req, res) => {
  const [groups, services] = await Promise.all([
    categories(),
    Service.find({ status: "published" }).sort({ sortOrder: 1, _id: 1 }),
  ]);
  const titles = new Map(groups.map((group) => [group.number, group.title]));
  const normalized = services.map((service) => ({
    ...service.toJSON(),
    category: titles.get(service.category) ?? service.category,
  }));
  const data = groups.map((category) => ({
    ...category.toJSON(),
    services: normalized.filter((service) => service.category === category.title),
  }));
  const knownCategories = new Set(groups.map((group) => group.number));
  const customCategories = [...new Set(services
    .map((service) => service.category)
    .filter((category) => category && !knownCategories.has(category)))]
    .map((category, index) => ({
      number: category,
      title: category,
      description: "",
      sortOrder: groups.length + index,
      services: normalized.filter((service) => service.category === category),
    }));

  return res.status(200).json(new ApiResponse(200, {
    categories: [...data, ...customCategories],
    services: normalized,
  }));
});

export const getCategories = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, { categories: await categories() }));
});

// ---------- Staff ----------
export const updateCategory = asyncHandler(async (req, res) => {
  if (!SERVICE_CATEGORY_NUMBERS.includes(req.params.number)) throw new ApiError(404, "Service category not found");
  const category = await ServiceCategory.findOneAndUpdate({ number: req.params.number }, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!category) throw new ApiError(404, "Service category not found");
  return res.status(200).json(new ApiResponse(200, { category }, "Service category updated"));
});

export const getAllServices = asyncHandler(async (req, res) => {
  const filter = {};
  if (typeof req.query.category === "string") filter.category = req.query.category;
  if (["draft", "published"].includes(req.query.status)) filter.status = req.query.status;
  const pagination = parsePagination(req.query, { defaultLimit: 50 });
  const [services, total] = await Promise.all([
    Service.find(filter).sort({ sortOrder: 1, _id: 1 }).skip(pagination.skip).limit(pagination.limit),
    Service.countDocuments(filter),
  ]);
  return res.status(200).json(new ApiResponse(200, { services, pagination: paginationMeta(pagination, total) }));
});

export const getServiceById = asyncHandler(async (req, res) => {
  const service = await findOr404(Service, req.params.id, "Service");
  return res.status(200).json(new ApiResponse(200, { service }));
});

export const createService = asyncHandler(async (req, res) => {
  const [last] = await Service.find().sort({ sortOrder: -1 }).limit(1).select("sortOrder");
  const service = await Service.create({ ...req.body, icon: req.body.icon || null, sortOrder: (last?.sortOrder ?? -1) + 1 });
  return res.status(201).json(new ApiResponse(201, { service }, "Service created"));
});

export const reorderServices = asyncHandler(async (req, res) => {
  const ids = [...new Set(req.body.ids)];
  if ((await Service.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw new ApiError(400, "One or more services were not found");
  }
  await Service.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: index } } } }))
  );
  return res.status(200).json(new ApiResponse(200, {}, "Services reordered"));
});

export const updateService = asyncHandler(async (req, res) => {
  const service = await findOr404(Service, req.params.id, "Service");
  const previousImage = service.image?.toObject?.() ?? null;
  Object.assign(service, req.body);
  if (req.body.icon !== undefined) service.icon = req.body.icon || null;
  await service.save();
  if (req.body.image !== undefined) await deleteRemovedImages([previousImage], [service.image]);
  return res.status(200).json(new ApiResponse(200, { service }, "Service updated"));
});

export const togglePublish = asyncHandler(async (req, res) => {
  const service = await findOr404(Service, req.params.id, "Service");
  service.status = service.status === "published" ? "draft" : "published";
  await service.save();
  return res
    .status(200)
    .json(new ApiResponse(200, { service }, `Service ${service.status === "published" ? "published" : "moved to draft"}`));
});

export const deleteService = asyncHandler(async (req, res) => {
  const service = await findOr404(Service, req.params.id, "Service");
  await service.deleteOne();
  await deleteFromCloudinary(service.image?.publicId);
  return res.status(200).json(new ApiResponse(200, {}, "Service deleted"));
});
