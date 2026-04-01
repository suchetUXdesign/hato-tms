import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@hato-tms/db";
import { authMiddleware, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// All routes require ADMIN
router.use(authMiddleware, requireRole("ADMIN"));

// ---- Schemas ----

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["ADMIN", "EDITOR", "TRANSLATOR", "VIEWER"]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "EDITOR", "TRANSLATOR", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

// ---- GET / — List all users ----
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, role } = req.query;

      const where: any = {};

      if (search && typeof search === "string") {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      if (role && typeof role === "string") {
        where.role = role;
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });

      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /invite — Create / invite a new user ----
router.post(
  "/invite",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = inviteSchema.parse(req.body);

      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
      });
      if (existing) {
        throw new AppError("A user with this email already exists", 409);
      }

      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          name: body.name,
          role: body.role as any,
          apiToken: crypto.randomBytes(32).toString("hex"),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

// ---- PUT /:id — Update user role / status / name ----
router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = updateUserSchema.parse(req.body);

      // Prevent admin from demoting themselves
      if (id === req.user!.id && body.role && body.role !== "ADMIN") {
        throw new AppError("You cannot demote yourself from ADMIN", 400);
      }

      // Prevent admin from deactivating themselves
      if (id === req.user!.id && body.isActive === false) {
        throw new AppError("You cannot deactivate your own account", 400);
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.role !== undefined && { role: body.role as any }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

// ---- DELETE /:id — Deactivate user (soft delete) ----
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (id === req.user!.id) {
        throw new AppError("You cannot deactivate your own account", 400);
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      res.json({ data: user, message: "User deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
