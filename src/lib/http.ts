import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found.`);

export function validationError(field: string, message: string) {
  return new HttpError(422, "The given data was invalid.", { [field]: [message] });
}

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  return schema.parse(input ?? {});
}

export const idParam = z.object({ id: z.string().min(1).max(64) });
export const slugParam = z.object({ slug: z.string().min(1).max(200) });
