import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authMiddleware, generateToken, generateRefreshToken, verifyRefreshToken } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import * as authService from "../services/authService";

const router = Router();

// ---- Schemas ----

const loginSchema = z.object({
  email: z.string().email(),
});

// ---- POST /login ----
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = loginSchema.parse(req.body);

      const user = await authService.getUserByEmail(email);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const token = generateToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id, user.email);

      res.json({
        token,
        refreshToken,
        expiresIn: 8 * 60 * 60, // 8 hours in seconds
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /refresh ----
router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
      }

      const payload = verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await authService.getUserActiveById(payload.userId);
      if (!user || !user.isActive) {
        throw new AppError("User not found or deactivated", 401);
      }

      const newAccessToken = generateToken(user.id, user.email);
      const newRefreshToken = generateRefreshToken(user.id, user.email);

      res.json({
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 8 * 60 * 60,
      });
    } catch (err: any) {
      // Convert jwt errors to 401
      if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
        return next(new AppError("Invalid or expired refresh token", 401));
      }
      next(err);
    }
  }
);

// ---- GET /me ----
router.get(
  "/me",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let user = await authService.getUserById(req.user!.id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Auto-generate API token if the user doesn't have one yet
      if (!user.apiToken) {
        const newToken = crypto.randomBytes(32).toString("hex");
        user = await authService.setApiToken(req.user!.id, newToken);
      }

      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /token ----
router.post(
  "/token",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiToken = crypto.randomBytes(32).toString("hex");

      await authService.updateApiToken(req.user!.id, apiToken);

      res.status(201).json({ apiToken });
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /token/regenerate ----
router.post(
  "/token/regenerate",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiToken = crypto.randomBytes(32).toString("hex");

      await authService.updateApiToken(req.user!.id, apiToken);

      res.json({ apiToken });
    } catch (err) {
      next(err);
    }
  }
);

// ---- GET /users — List all users (for reviewer picker etc.) ----
router.get(
  "/users",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await authService.listAllUsers();
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
