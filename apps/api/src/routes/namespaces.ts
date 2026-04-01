import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@hato-tms/db";
import { validateNamespacePath, buildFullKey, AuditAction } from "@hato-tms/shared";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditService";

const router = Router();

router.use(authMiddleware);

// ---- Schemas ----

const createNamespaceSchema = z.object({
  path: z.string().min(1),
  description: z.string().optional(),
  platforms: z
    .array(z.enum(["HS", "HH", "LIFF", "MERCHANT", "FLEX", "COMMON"]))
    .default([]),
});

const updateNamespaceSchema = z.object({
  path: z.string().optional(),
  description: z.string().optional(),
  platforms: z
    .array(z.enum(["HS", "HH", "LIFF", "MERCHANT", "FLEX", "COMMON"]))
    .optional(),
});

// ---- GET / — List all namespaces with key counts ----
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const namespaces = await prisma.namespace.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            keys: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { path: "asc" },
    });

    res.json({
      data: namespaces.map((ns) => ({
        id: ns.id,
        path: ns.path,
        description: ns.description,
        platforms: ns.platforms,
        keyCount: ns._count.keys,
        createdAt: ns.createdAt.toISOString(),
        updatedAt: ns.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---- POST / — Create namespace ----
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createNamespaceSchema.parse(req.body);

    if (!validateNamespacePath(body.path)) {
      throw new AppError(
        "Invalid namespace path. Must be dot-separated lowercase segments.",
        400
      );
    }

    // Check for existing
    const existing = await prisma.namespace.findUnique({
      where: { path: body.path },
    });
    if (existing) {
      throw new AppError("Namespace already exists", 409);
    }

    const ns = await prisma.namespace.create({
      data: {
        path: body.path,
        description: body.description ?? null,
        platforms: body.platforms,
      },
    });

    await logAudit(
      AuditAction.NAMESPACE_CREATED,
      "Namespace",
      ns.id,
      req.user!.id,
      { path: body.path }
    );

    res.status(201).json({
      id: ns.id,
      path: ns.path,
      description: ns.description,
      platforms: ns.platforms,
      keyCount: 0,
      createdAt: ns.createdAt.toISOString(),
      updatedAt: ns.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- PUT /:id — Update namespace ----
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateNamespaceSchema.parse(req.body);
    const nsId = req.params.id;

    const existing = await prisma.namespace.findUnique({
      where: { id: nsId },
    });
    if (!existing) {
      throw new AppError("Namespace not found", 404);
    }

    if (body.path && body.path !== existing.path) {
      if (!validateNamespacePath(body.path)) {
        throw new AppError("Invalid namespace path format", 400);
      }

      // Check for conflict
      const conflict = await prisma.namespace.findUnique({
        where: { path: body.path },
      });
      if (conflict) {
        throw new AppError("A namespace with this path already exists", 409);
      }
    }

    const data: any = {};
    if (body.path !== undefined) data.path = body.path;
    if (body.description !== undefined) data.description = body.description;
    if (body.platforms !== undefined) data.platforms = body.platforms;

    const updated = await prisma.namespace.update({
      where: { id: nsId },
      data,
      include: {
        _count: {
          select: { keys: { where: { deletedAt: null } } },
        },
      },
    });

    await logAudit(
      AuditAction.NAMESPACE_UPDATED,
      "Namespace",
      nsId,
      req.user!.id,
      { before: { path: existing.path }, after: { path: updated.path } }
    );

    res.json({
      id: updated.id,
      path: updated.path,
      description: updated.description,
      platforms: updated.platforms,
      keyCount: updated._count.keys,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /:id/keys — Get all keys in a namespace ----
router.get(
  "/:id/keys",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const nsId = req.params.id;

      const ns = await prisma.namespace.findUnique({
        where: { id: nsId },
      });
      if (!ns) {
        throw new AppError("Namespace not found", 404);
      }

      const keys = await prisma.translationKey.findMany({
        where: { namespaceId: nsId, deletedAt: null },
        include: {
          values: { orderBy: { version: "desc" } },
        },
        orderBy: { keyName: "asc" },
      });

      const data = keys.map((key) => {
        const latestValues: Record<string, (typeof key.values)[0]> = {};
        for (const v of key.values) {
          if (
            !latestValues[v.locale] ||
            v.version > latestValues[v.locale].version
          ) {
            latestValues[v.locale] = v;
          }
        }

        return {
          id: key.id,
          keyName: key.keyName,
          fullKey: buildFullKey(ns.path, key.keyName),
          description: key.description,
          tags: key.tags,
          status: key.status,
          platforms: key.platforms,
          values: Object.values(latestValues).map((v) => ({
            id: v.id,
            locale: v.locale,
            value: v.value,
            version: v.version,
            updatedAt: v.updatedAt.toISOString(),
          })),
          createdAt: key.createdAt.toISOString(),
          updatedAt: key.updatedAt.toISOString(),
        };
      });

      res.json({ namespacePath: ns.path, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
