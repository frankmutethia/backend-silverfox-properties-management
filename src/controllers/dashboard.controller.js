import { Property } from "../models/Property.model.js";
import { Service } from "../models/Service.model.js";
import { Blog } from "../models/Blog.model.js";
import { Testimonial } from "../models/Testimonial.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const countBy = async (Model, field) => {
  const rows = await Model.aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((row) => [row._id ?? "unconfirmed", row.n]));
};

const statusCounts = (counts) => ({ published: counts.published ?? 0, draft: counts.draft ?? 0 });

export const getDashboard = asyncHandler(async (req, res) => {
  const [propertyStatus, propertyTypes, propertyCategories, serviceStatus, blogStatus, testimonialStatus] =
    await Promise.all([
      countBy(Property, "status"),
      countBy(Property, "type"),
      countBy(Property, "category"),
      countBy(Service, "status"),
      countBy(Blog, "status"),
      countBy(Testimonial, "status"),
    ]);

  const [recentProperties, recentPosts, pendingTestimonials] = await Promise.all([
    Property.find().sort({ updatedAt: -1 }).limit(5).select("name slug reference status images updatedAt"),
    Blog.find().sort({ updatedAt: -1 }).limit(5).select("title slug status updatedAt"),
    Testimonial.find({ status: "pending" }).sort({ createdAt: -1 }).limit(5).select("name rating comment createdAt"),
  ]);

  const properties = statusCounts(propertyStatus);
  const data = {
    properties: {
      total: properties.published + properties.draft,
      ...properties,
      apartments: propertyTypes.Apartment ?? 0,
      houses: propertyTypes.House ?? 0,
      byCategory: {
        sale: propertyCategories.sale ?? 0,
        rent: propertyCategories.rent ?? 0,
        managed: propertyCategories.managed ?? 0,
        unconfirmed: propertyCategories.unconfirmed ?? 0,
      },
    },
    services: statusCounts(serviceStatus),
    blog: statusCounts(blogStatus),
    testimonials: {
      pending: testimonialStatus.pending ?? 0,
      draft: testimonialStatus.draft ?? 0,
      published: testimonialStatus.published ?? 0,
    },
    recent: { properties: recentProperties, posts: recentPosts, pendingTestimonials },
  };

  return res.status(200).json(new ApiResponse(200, data, "Dashboard summary loaded"));
});
