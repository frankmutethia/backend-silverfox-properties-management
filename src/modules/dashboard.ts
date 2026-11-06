import { count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/client.js";
import { blogs, properties, services, testimonials } from "../db/schema.js";
import { serializeAdminProperties } from "./properties.js";

const tally = <K extends string>(rows: { key: K | null; n: number }[]) =>
  Object.fromEntries(rows.map((row) => [row.key ?? "unconfirmed", Number(row.n)])) as Record<string, number>;

const statusCounts = (record: Record<string, number>) => ({
  published: record.published ?? 0,
  draft: record.draft ?? 0,
});

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", async (_req, res) => {
  const [propertyStatus, propertyTypes, propertyCategories, serviceStatus, blogStatus, testimonialStatus] =
    await Promise.all([
      db.select({ key: properties.status, n: count() }).from(properties).groupBy(properties.status),
      db.select({ key: properties.type, n: count() }).from(properties).groupBy(properties.type),
      db.select({ key: properties.category, n: count() }).from(properties).groupBy(properties.category),
      db.select({ key: services.status, n: count() }).from(services).groupBy(services.status),
      db.select({ key: blogs.status, n: count() }).from(blogs).groupBy(blogs.status),
      db.select({ key: testimonials.status, n: count() }).from(testimonials).groupBy(testimonials.status),
    ]);
  const [recentProperties, recentBlogs, pendingTestimonials] = await Promise.all([
    db.select().from(properties).orderBy(desc(properties.updatedAt)).limit(5),
    db
      .select({ id: blogs.id, title: blogs.title, slug: blogs.slug, status: blogs.status, updatedAt: blogs.updatedAt })
      .from(blogs)
      .orderBy(desc(blogs.updatedAt))
      .limit(5),
    db
      .select({
        id: testimonials.id,
        name: testimonials.name,
        rating: testimonials.rating,
        feedback: testimonials.feedback,
        createdAt: testimonials.createdAt,
      })
      .from(testimonials)
      .where(eq(testimonials.status, "pending"))
      .orderBy(desc(testimonials.createdAt))
      .limit(5),
  ]);

  const propertyStatusCounts = statusCounts(tally(propertyStatus));
  const types = tally(propertyTypes);
  const categories = tally(propertyCategories);
  const testimonialCounts = tally(testimonialStatus);
  res.json({
    data: {
      properties: {
        total: propertyStatusCounts.published + propertyStatusCounts.draft,
        ...propertyStatusCounts,
        apartments: types.Apartment ?? 0,
        houses: types.House ?? 0,
        byCategory: {
          sale: categories.sale ?? 0,
          rent: categories.rent ?? 0,
          managed: categories.managed ?? 0,
          unconfirmed: categories.unconfirmed ?? 0,
        },
      },
      services: statusCounts(tally(serviceStatus)),
      blogs: statusCounts(tally(blogStatus)),
      testimonials: {
        pending: testimonialCounts.pending ?? 0,
        draft: testimonialCounts.draft ?? 0,
        published: testimonialCounts.published ?? 0,
      },
      recent: {
        properties: await serializeAdminProperties(recentProperties),
        blogs: recentBlogs,
        pendingTestimonials,
      },
    },
  });
});
