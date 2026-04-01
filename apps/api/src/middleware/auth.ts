import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@hato-tms/db";
import { AppError } from "./errorHandler";

const JWT_SECRET = process.env.JWT_SECRET || "hato-tms-dev-secret";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function resolveUser(req: Request): Promise<AuthUser | null> {
  // 1. Check X-API-Token header (CLI / programmatic access)
  const apiToken = req.headers["x-api-token"] as string | undefined;
  if (apiToken) {
    const user = await prisma.user.findUnique({
      where: { apiToken },
      select: { id: true, email: true, name: true, role: true },
    });
    return user;
  }

  // 2. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, role: true },
      });
      return user;
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }
  }

  return null;
}

/**
 * Requires authentication. Returns 401 if no valid credentials.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await resolveUser(req);
    if (!user) {
      throw new AppError("Authentication required", 401);
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — attaches user if present, but does not fail.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await resolveUser(req);
    if (user) {
      req.user = user;
    }
    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
}

/**
 * Require specific roles. Returns 403 if user's role is not in the allowed list.
 * Must be used AFTER authMiddleware.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You don't have permission to perform this action", 403)
      );
    }
    next();
  };
}

/**
 * Generate an access token (short-lived).
 */
export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: "access" }, JWT_SECRET, { expiresIn: "8h" });
}

/**
 * Generate a refresh token (long-lived).
 */
export function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: "refresh" }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify a refresh token and return its payload.
 * Throws if the token is invalid or not a refresh token.
 */
export function verifyRefreshToken(token: string): { userId: string; email: string } {
  const payload = jwt.verify(token, JWT_SECRET) as {
    userId: string;
    email: string;
    type?: string;
  };
  if (payload.type !== "refresh") {
    throw new AppError("Invalid refresh token", 401);
  }
  return { userId: payload.userId, email: payload.email };
}
