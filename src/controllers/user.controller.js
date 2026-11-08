import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

const DUPLICATE = "An account with this email already exists";

// Every staff account, oldest first. Passwords and reset tokens are never included.
export const listUsers = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: 50 });
  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: 1, _id: 1 }).skip(pagination.skip).limit(pagination.limit),
    User.countDocuments(),
  ]);
  return res.status(200).json(new ApiResponse(200, { users, pagination: paginationMeta(pagination, total) }));
});

// Creates another admin with the password chosen by the signed-in staff member.
// They can sign in straight away and change the password from their profile.
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, DUPLICATE, [`email: ${DUPLICATE}`]);
  try {
    const user = await User.create({ name, email, password });
    return res.status(201).json(new ApiResponse(201, { user }, "Admin account created"));
  } catch (err) {
    // Two requests for the same email at once: the unique index catches the second.
    if (err?.code === 11000) throw new ApiError(409, DUPLICATE, [`email: ${DUPLICATE}`]);
    throw err;
  }
});
