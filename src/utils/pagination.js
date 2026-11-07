import { ApiError } from "./ApiError.js";

export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? defaultLimit);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "page must be a positive integer");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new ApiError(400, `limit must be a positive integer no greater than ${maxLimit}`);
  }

  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

// Escapes user input for use inside a case-insensitive $regex search.
export const searchRegex = (value) => ({
  $regex: String(value).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  $options: "i",
});

export const isObjectId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
