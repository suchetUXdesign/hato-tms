import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authMiddleware, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import * as userService from "../services/userService";

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

      const users = await userService.listUsers({
        search: typeof search === "string" ? search : undefined,
        role: typeof role === "string" ? role : undefined,
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
      const existing = await userService.getUserByEmail(body.email.toLowerCase());
      if (existing) {
        throw new AppError("A user with this email already exists", 409);
      }

      const user = await userService.createUser({
        email: body.email.toLowerCase(),
        name: body.name,
        role: body.role,
        apiToken: crypto.randomBytes(32).toString("hex"),
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

      const user = await userService.updateUser(id, {
        name: body.name,
        role: body.role,
        isActive: body.isActive,
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

      const user = await userService.deactivateUser(id);

      res.json({ data: user, message: "User deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
