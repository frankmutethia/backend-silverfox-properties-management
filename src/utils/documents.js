import { ApiError } from "./ApiError.js";
import { isObjectId } from "./pagination.js";

export const findOr404 = async (Model, id, label, select) => {
  const doc = isObjectId(id) ? await Model.findById(id).select(select ?? "") : null;
  if (!doc) throw new ApiError(404, `${label} not found`);
  return doc;
};
