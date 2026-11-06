import { z } from "zod";

export const statusInput = z.enum(["draft", "published"]);
export type Status = z.output<typeof statusInput>;

export function publicationFields(status: Status, publishedAt: Date | null = null) {
  return { status, publishedAt: status === "published" ? (publishedAt ?? new Date()) : publishedAt };
}

export const statusFilter = z.enum(["draft", "published"]).optional();
