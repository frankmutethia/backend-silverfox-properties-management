import { and, eq, ne, type SQL } from "drizzle-orm";
import type { MySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import { db } from "../db/client.js";

export function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/, "");
  return slug || "item";
}

export async function uniqueSlug(
  table: MySqlTable,
  columns: { slug: MySqlColumn; id: MySqlColumn },
  source: string,
  excludeId?: string,
) {
  const base = slugify(source);
  for (let attempt = 1; ; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const conditions: SQL[] = [eq(columns.slug, candidate)];
    if (excludeId) conditions.push(ne(columns.id, excludeId));
    const [existing] = await db
      .select({ id: columns.id })
      .from(table)
      .where(and(...conditions))
      .limit(1);
    if (!existing) return candidate;
  }
}
