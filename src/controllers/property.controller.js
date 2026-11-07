import { Property } from "../models/Property.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findOr404 } from "../utils/documents.js";
import { paginationMeta, parsePagination, searchRegex } from "../utils/pagination.js";
import { uniqueSlug } from "../utils/slug.js";
import { deleteFromCloudinary, deleteRemovedImages } from "../services/upload.service.js";

const CATEGORY_FILTERS = ["sale", "rent", "managed", "unconfirmed"];

const buildFilter = (query) => {
  const filter = {};
  if (query.search) {
    const pattern = searchRegex(query.search);
    filter.$or = [{ name: pattern }, { location: pattern }, { reference: pattern }];
  }
  if (["Apartment", "House"].includes(query.type)) filter.type = query.type;
  if (CATEGORY_FILTERS.includes(query.category)) {
    filter.category = query.category === "unconfirmed" ? null : query.category;
  }
  if (query.location) filter.location = searchRegex(query.location);
  return filter;
};

// managed → no price; sale → no period; rent → period required.
const normalizePrice = (category, price) => {
  if (category === "managed" || !price) return null;
  if (category === "sale") return { ...price, period: "" };
  if (category === "rent" && !price.period) throw new ApiError(400, "price.period: Choose a rental period");
  return price;
};

const requirePhotos = (property) => {
  if (property.status === "published" && property.images.length === 0) {
    throw new ApiError(400, "Add at least one photo before publishing");
  }
};

const resolveSlug = async (requested, name, excludeId) => {
  if (!requested) return uniqueSlug(Property, name, excludeId);
  const filter = { slug: requested };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Property.exists(filter)) throw new ApiError(409, "This URL is already used by another property");
  return requested;
};

const list = async (filter, query, { sort, defaultLimit, select }) => {
  const pagination = parsePagination(query, { defaultLimit });
  const [properties, total] = await Promise.all([
    Property.find(filter).select(select).sort(sort).skip(pagination.skip).limit(pagination.limit),
    Property.countDocuments(filter),
  ]);
  return { properties, pagination: paginationMeta(pagination, total) };
};

// ---------- Public ----------
export const getPublishedProperties = asyncHandler(async (req, res) => {
  const data = await list({ ...buildFilter(req.query), status: "published" }, req.query, {
    sort: { publishedAt: -1, _id: -1 },
    defaultLimit: 50,
    select: "-author",
  });
  return res.status(200).json(new ApiResponse(200, data));
});

export const getPropertyBySlug = asyncHandler(async (req, res) => {
  const property = await Property.findOne({ slug: String(req.params.slug), status: "published" }).select("-author");
  if (!property) throw new ApiError(404, "Property not found");
  return res.status(200).json(new ApiResponse(200, { property }));
});

// ---------- Staff ----------
export const getAllProperties = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  if (["draft", "published"].includes(req.query.status)) filter.status = req.query.status;
  const data = await list(filter, req.query, { sort: { updatedAt: -1, _id: -1 }, defaultLimit: 20 });
  return res.status(200).json(new ApiResponse(200, data));
});

export const getPropertyById = asyncHandler(async (req, res) => {
  const property = await findOr404(Property, req.params.id, "Property");
  return res.status(200).json(new ApiResponse(200, { property }));
});

export const createProperty = asyncHandler(async (req, res) => {
  const input = req.body;
  const property = new Property({
    ...input,
    slug: await resolveSlug(input.slug, input.name),
    price: normalizePrice(input.category, input.price),
    neighbourhood: input.neighbourhood || null,
    author: req.user._id,
  });
  requirePhotos(property);
  await property.save();
  return res.status(201).json(new ApiResponse(201, { property }, "Property created"));
});

export const updateProperty = asyncHandler(async (req, res) => {
  const property = await findOr404(Property, req.params.id, "Property");
  const { slug, price, neighbourhood, ...updates } = req.body;
  const previousImages = property.images.map((img) => img.toObject());

  Object.assign(property, updates);
  if (slug !== undefined) property.slug = await resolveSlug(slug, property.name, property._id);
  if (neighbourhood !== undefined) property.neighbourhood = neighbourhood || null;
  if (price !== undefined || updates.category !== undefined) {
    const current = price === undefined ? property.price?.toObject?.() ?? property.price : price;
    property.price = normalizePrice(property.category, current);
  }
  requirePhotos(property);
  await property.save();

  if (updates.images) await deleteRemovedImages(previousImages, property.images);
  return res.status(200).json(new ApiResponse(200, { property }, "Property updated"));
});

export const togglePublish = asyncHandler(async (req, res) => {
  const property = await findOr404(Property, req.params.id, "Property");
  property.status = property.status === "published" ? "draft" : "published";
  requirePhotos(property);
  await property.save();
  return res
    .status(200)
    .json(new ApiResponse(200, { property }, `Property ${property.status === "published" ? "published" : "moved to draft"}`));
});

export const deleteProperty = asyncHandler(async (req, res) => {
  const property = await findOr404(Property, req.params.id, "Property");
  await property.deleteOne();
  await Promise.all(property.images.map((img) => deleteFromCloudinary(img.publicId)));
  return res.status(200).json(new ApiResponse(200, {}, "Property deleted"));
});
