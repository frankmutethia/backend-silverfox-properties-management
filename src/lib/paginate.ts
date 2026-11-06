import { z } from "zod";

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type PageQuery = z.output<typeof pageQuery>;

export function pageMeta(total: number, { page, perPage }: PageQuery) {
  return { total, page, perPage, lastPage: Math.max(1, Math.ceil(total / perPage)) };
}

export const offset = ({ page, perPage }: PageQuery) => (page - 1) * perPage;

export const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
