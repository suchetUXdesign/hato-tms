import { Request, Response, NextFunction } from "express";
import { Prisma } from "@hato-tms/db";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Error]", err);

  // AppError — known operational error
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: { message: err.message },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const body: ErrorResponse = {
      error: {
        message: "Validation error",
        code: "VALIDATION_ERROR",
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Prisma: unique constraint violation
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const target = (err.meta?.target as string[]) || [];
    const body: ErrorResponse = {
      error: {
        message: `A record with this ${target.join(", ")} already exists.`,
        code: "DUPLICATE",
      },
    };
    res.status(409).json(body);
    return;
  }

  // Prisma: record not found
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    const body: ErrorResponse = {
      error: {
        message: "Record not found.",
        code: "NOT_FOUND",
      },
    };
    res.status(404).json(body);
    return;
  }

  // Prisma: foreign key constraint
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2003"
  ) {
    const body: ErrorResponse = {
      error: {
        message: "Related record not found.",
        code: "FOREIGN_KEY_ERROR",
      },
    };
    res.status(400).json(body);
    return;
  }

  // Unknown error
  const body: ErrorResponse = {
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message || "Internal server error",
    },
  };
  res.status(500).json(body);
}
