import { Blog } from "../models/Blog.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findOr404 } from "../utils/documents.js";
import { paginationMeta, parsePagination, searchRegex } from "../utils/pagination.js";
import { plainText } from "../utils/sanitize.js";
import { uniqueSlug } from "../utils/slug.js";
import { deleteFromCloudinary, deleteRemovedImages } from "../services/upload.service.js";

const excerptFrom = (html, excerpt) => {
  if (excerpt) return excerpt;
  const text = plainText(html);
  return text.length <= 200 ? text : `${text.slice(0, 197).replace(/\s+\S*$/, "")}…`;
};

const resolveSlug = async (requested, title, excludeId) => {
  if (!requested) return uniqueSlug(Blog, title, excludeId);
  const filter = { slug: requested };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Blog.exists(filter)) throw new ApiError(409, "This URL is already used by another article");
  return requested;
};

const list = async (filter, query, { sort, defaultLimit, authorFields }) => {
  const pagination = parsePagination(query, { defaultLimit });
  const [posts, total] = await Promise.all([
    Blog.find(filter)
      .select("-content")
      .populate("author", authorFields)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Blog.countDocuments(filter),
  ]);
  return { posts, pagination: paginationMeta(pagination, total) };
};

const searchFilter = (query) => {
  const filter = {};
  if (query.category) filter.category = String(query.category);
  if (query.search) {
    const pattern = searchRegex(query.search);
    filter.$or = [{ title: pattern }, { excerpt: pattern }];
  }
  return filter;
};

// ---------- Public ----------
export const getPublishedPosts = asyncHandler(async (req, res) => {
  const data = await list({ ...searchFilter(req.query), status: "published" }, req.query, {
    sort: { publishedAt: -1, _id: -1 },
    defaultLimit: 12,
    authorFields: "name",
  });
  return res.status(200).json(new ApiResponse(200, data));
});

export const getPostBySlug = asyncHandler(async (req, res) => {
  const post = await Blog.findOne({ slug: String(req.params.slug), status: "published" }).populate("author", "name");
  if (!post) throw new ApiError(404, "Article not found");
  return res.status(200).json(new ApiResponse(200, { post }));
});

// ---------- Staff ----------
export const getAllPosts = asyncHandler(async (req, res) => {
  const filter = searchFilter(req.query);
  if (["draft", "published"].includes(req.query.status)) filter.status = req.query.status;
  const data = await list(filter, req.query, { sort: { updatedAt: -1, _id: -1 }, defaultLimit: 20, authorFields: "name email" });
  return res.status(200).json(new ApiResponse(200, data));
});

export const getPostById = asyncHandler(async (req, res) => {
  const post = await findOr404(Blog, req.params.id, "Article");
  await post.populate("author", "name email");
  return res.status(200).json(new ApiResponse(200, { post }));
});

export const createPost = asyncHandler(async (req, res) => {
  const input = req.body;
  const post = await Blog.create({
    ...input,
    slug: await resolveSlug(input.slug, input.title),
    category: input.category || null,
    excerpt: excerptFrom(input.content, input.excerpt),
    author: req.user._id,
  });
  await post.populate("author", "name email");
  return res.status(201).json(new ApiResponse(201, { post }, "Article created"));
});

export const updatePost = asyncHandler(async (req, res) => {
  const post = await findOr404(Blog, req.params.id, "Article");
  const { slug, excerpt, category, ...updates } = req.body;
  const previousCover = post.coverImage?.toObject?.() ?? null;

  Object.assign(post, updates);
  if (slug !== undefined) post.slug = await resolveSlug(slug, post.title, post._id);
  if (category !== undefined) post.category = category || null;
  if (excerpt !== undefined || updates.content !== undefined) {
    post.excerpt = excerptFrom(post.content, excerpt === undefined ? null : excerpt);
  }
  await post.save();

  if (updates.coverImage !== undefined) await deleteRemovedImages([previousCover], [post.coverImage]);
  await post.populate("author", "name email");
  return res.status(200).json(new ApiResponse(200, { post }, "Article updated"));
});

export const togglePublish = asyncHandler(async (req, res) => {
  const post = await findOr404(Blog, req.params.id, "Article");
  post.status = post.status === "published" ? "draft" : "published";
  await post.save();
  return res
    .status(200)
    .json(new ApiResponse(200, { post }, `Article ${post.status === "published" ? "published" : "moved to draft"}`));
});

export const deletePost = asyncHandler(async (req, res) => {
  const post = await findOr404(Blog, req.params.id, "Article");
  await post.deleteOne();
  await deleteFromCloudinary(post.coverImage?.publicId);
  return res.status(200).json(new ApiResponse(200, {}, "Article deleted"));
});
