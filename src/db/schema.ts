import {
  customType,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

// Hostinger runs MariaDB, whose JSON type is LONGTEXT and is not parsed by the driver.
const jsonText = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "text",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => JSON.parse(value) as T,
  })(name);

const mediumText = customType<{ data: string }>({ dataType: () => "mediumtext" });

const id = () => varchar("id", { length: 36 }).primaryKey();
const timestamps = {
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
};
const publication = {
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
  publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
};

export const media = mysqlTable("media", {
  id: id(),
  filename: varchar("filename", { length: 255 }).notNull().unique(),
  mime: varchar("mime", { length: 32 }).notNull(),
  size: int("size").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 36 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
});

export const users = mysqlTable("users", {
  id: id(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull().default(""),
  phone: varchar("phone", { length: 30 }).notNull().default(""),
  photoMediaId: varchar("photo_media_id", { length: 36 }).references(() => media.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    usedAt: datetime("used_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (table) => [index("reset_tokens_user_idx").on(table.userId)],
);

export const properties = mysqlTable(
  "properties",
  {
    id: id(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 150 }).notNull(),
    category: mysqlEnum("category", ["sale", "rent", "managed"]),
    type: mysqlEnum("type", ["Apartment", "House"]).notNull(),
    location: varchar("location", { length: 200 }),
    neighbourhood: text("neighbourhood"),
    description: text("description").notNull(),
    priceAmount: decimal("price_amount", { precision: 14, scale: 2 }),
    priceCurrency: varchar("price_currency", { length: 3 }),
    pricePeriod: varchar("price_period", { length: 10 }),
    bedrooms: int("bedrooms"),
    bathrooms: int("bathrooms"),
    areaSqm: decimal("area_sqm", { precision: 10, scale: 2 }),
    amenities: jsonText<string[]>("amenities").notNull(),
    ...publication,
    createdBy: varchar("created_by", { length: 36 }),
    ...timestamps,
  },
  (table) => [index("properties_status_idx").on(table.status)],
);

export const propertyImages = mysqlTable(
  "property_images",
  {
    id: id(),
    propertyId: varchar("property_id", { length: 36 })
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    mediaId: varchar("media_id", { length: 36 })
      .notNull()
      .references(() => media.id),
    alt: varchar("alt", { length: 150 }).notNull(),
    position: varchar("position", { length: 40 }),
    sortOrder: int("sort_order").notNull(),
  },
  (table) => [index("property_images_property_idx").on(table.propertyId)],
);

export const serviceCategories = mysqlTable("service_categories", {
  id: id(),
  number: varchar("number", { length: 2 }).notNull().unique(),
  title: varchar("title", { length: 150 }).notNull(),
  description: text("description").notNull(),
  sortOrder: int("sort_order").notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
});

export const services = mysqlTable(
  "services",
  {
    id: id(),
    categoryId: varchar("category_id", { length: 36 })
      .notNull()
      .references(() => serviceCategories.id),
    title: varchar("title", { length: 150 }).notNull(),
    descriptionHtml: mediumText("description_html").notNull(),
    icon: varchar("icon", { length: 40 }),
    imageMediaId: varchar("image_media_id", { length: 36 }).references(() => media.id, {
      onDelete: "set null",
    }),
    imageAlt: varchar("image_alt", { length: 150 }),
    sortOrder: int("sort_order").notNull(),
    ...publication,
    ...timestamps,
  },
  (table) => [index("services_category_idx").on(table.categoryId)],
);

export const blogs = mysqlTable(
  "blogs",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    category: varchar("category", { length: 80 }),
    excerpt: varchar("excerpt", { length: 400 }).notNull(),
    coverMediaId: varchar("cover_media_id", { length: 36 }).references(() => media.id, {
      onDelete: "set null",
    }),
    coverAlt: varchar("cover_alt", { length: 150 }),
    bodyHtml: mediumText("body_html").notNull(),
    authorId: varchar("author_id", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
    }),
    ...publication,
    ...timestamps,
  },
  (table) => [index("blogs_status_idx").on(table.status)],
);

export const testimonials = mysqlTable(
  "testimonials",
  {
    id: id(),
    name: varchar("name", { length: 100 }).notNull(),
    feedback: text("feedback").notNull(),
    rating: int("rating").notNull(),
    status: mysqlEnum("status", ["pending", "draft", "published"]).notNull(),
    source: mysqlEnum("source", ["visitor", "admin"]).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
    ...timestamps,
  },
  (table) => [index("testimonials_status_idx").on(table.status)],
);
