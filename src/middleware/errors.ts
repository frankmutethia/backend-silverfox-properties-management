import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http.js";
import { multerError } from "../lib/media.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Not found." });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "body";
      (errors[key] ??= []).push(issue.message);
    }
    res.status(422).json({ message: "The given data was invalid.", errors });
    return;
  }
  const upload = multerError(error);
  const known = upload ?? (error instanceof HttpError ? error : null);
  if (known) {
    res.status(known.status).json(known.errors ? { message: known.message, errors: known.errors } : { message: known.message });
    return;
  }
  const status = (error as { status?: number; type?: string }).status;
  if (status === 400 || status === 413) {
    res.status(status).json({ message: status === 413 ? "Request body is too large." : "Malformed request body." });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
}
