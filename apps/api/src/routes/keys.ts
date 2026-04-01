import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@hato-tms/db";
import {
  validateKeyName,
  validateNamespacePath,
  buildFullKey,
  AuditAction,
} from "@hato-tms/shared";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditService";
import * as cache from "../services/cacheService";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// ---- Schemas ----

const createKeySchema = z.object({
  namespacePath: z.string().min(1),
  keyName: z.string().min(1),
  thValue: z.string().default(""),
  enValue: z.string().default(""),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  platforms: z
    .array(z.enum(["HS", "HH", "LIFF", "MERCHANT", "FLEX", "COMMON"]))
    .default([]),
});

const updateKeySchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  platforms: z
    .array(z.enum(["HS", "HH", "LIFF", "MERCHANT", "FLEX", "COMMON"]))
    .optional(),
});

const updateValuesSchema = z.array(
  z.object({
    locale: z.enum(["TH", "EN"]),
    value: z.string(),
  })
);

const bulkSchema = z.object({
  operation: z.enum(["tag", "move", "delete"]),
  keyIds: z.array(z.string().min(1)).min(1),
  // For tag operation
  tags: z.array(z.string()).optional(),
  // For move operation
  targetNamespacePath: z.string().optional(),
});

// ---- GET / — List/search keys ----
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      query,
      namespace,
      status,
      platform,
      tags,
      page = "1",
      pageSize = "50",
      sortBy = "updated",
      sortOrder = "desc",
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(pageSize || "50", 10)));
    const skip = (pageNum - 1) * size;

    // Build where clause
    const where: any = {
      deletedAt: null, // exclude soft-deleted
    };

    if (query) {
      where.OR = [
        { keyName: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        {
          values: {
            some: { value: { contains: query, mode: "insensitive" } },
          },
        },
        {
          namespace: {
            path: { contains: query, mode: "insensitive" },
          },
        },
      ];
    }

    if (namespace) {
      where.namespace = { path: { startsWith: namespace } };
    }

    if (status) {
      where.status = status;
    }

    if (platform) {
      where.platforms = { has: platform };
    }

    if (tags) {
      const tagList = typeof tags === "string" ? tags.split(",") : [];
      if (tagList.length > 0) {
        where.tags = { hasSome: tagList };
      }
    }

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case "key":
        orderBy = { keyName: sortOrder === "asc" ? "asc" : "desc" };
        break;
      case "created":
        orderBy = { createdAt: sortOrder === "asc" ? "asc" : "desc" };
        break;
      case "updated":
      default:
        orderBy = { updatedAt: sortOrder === "asc" ? "asc" : "desc" };
        break;
    }

    const [keys, total] = await Promise.all([
      prisma.translationKey.findMany({
        where,
        include: {
          namespace: { select: { path: true } },
          values: {
            where: {
              // Get latest version per locale
            },
            orderBy: { version: "desc" },
          },
          createdBy: { select: { name: true } },
        },
        orderBy,
        skip,
        take: size,
      }),
      prisma.translationKey.count({ where }),
    ]);

    // Deduplicate values to latest version per locale
    const data = keys.map((key) => {
      const latestValues: Record<string, (typeof key.values)[0]> = {};
      for (const v of key.values) {
        if (!latestValues[v.locale] || v.version > latestValues[v.locale].version) {
          latestValues[v.locale] = v;
        }
      }

      return {
        id: key.id,
        namespaceId: key.namespaceId,
        namespacePath: key.namespace.path,
        keyName: key.keyName,
        fullKey: buildFullKey(key.namespace.path, key.keyName),
        description: key.description,
        tags: key.tags,
        status: key.status,
        platforms: key.platforms,
        values: Object.values(latestValues).map((v) => ({
          id: v.id,
          locale: v.locale,
          value: v.value,
          version: v.version,
          updatedBy: v.updatedById,
          updatedAt: v.updatedAt.toISOString(),
        })),
        createdBy: key.createdBy?.name ?? null,
        createdAt: key.createdAt.toISOString(),
        updatedAt: key.updatedAt.toISOString(),
      };
    });

    res.json({
      data,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (err) {
    next(err);
  }
});

// ---- POST / — Create key ----
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createKeySchema.parse(req.body);

    // Validate key name format
    if (!validateKeyName(body.keyName)) {
      throw new AppError(
        "Invalid key name. Must be camelCase starting with lowercase letter.",
        400
      );
    }

    // Validate namespace path format
    if (!validateNamespacePath(body.namespacePath)) {
      throw new AppError(
        "Invalid namespace path. Must be dot-separated lowercase segments (e.g. liff.dinein.menu).",
        400
      );
    }

    // Auto-create namespace if needed
    let ns = await prisma.namespace.findUnique({
      where: { path: body.namespacePath },
    });
    if (!ns) {
      ns = await prisma.namespace.create({
        data: {
          path: body.namespacePath,
          platforms: body.platforms,
        },
      });
    }

    // Check for duplicate key in same namespace
    const existing = await prisma.translationKey.findFirst({
      where: {
        namespaceId: ns.id,
        keyName: body.keyName,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new AppError(
        "A key with this name already exists in this namespace.",
        409
      );
    }

    // Determine initial status
    const status =
      body.thValue && body.enValue ? "TRANSLATED" : "PENDING";

    // Create key + values in transaction
    const key = await prisma.translationKey.create({
      data: {
        namespaceId: ns.id,
        keyName: body.keyName,
        description: body.description ?? null,
        tags: body.tags,
        platforms: body.platforms,
        status,
        createdById: req.user!.id,
        values: {
          create: [
            { locale: "TH", value: body.thValue, version: 1 },
            { locale: "EN", value: body.enValue, version: 1 },
          ],
        },
      },
      include: {
        namespace: { select: { path: true } },
        values: true,
      },
    });

    await logAudit(
      AuditAction.KEY_CREATED,
      "TranslationKey",
      key.id,
      req.user!.id,
      { keyName: body.keyName, namespace: body.namespacePath }
    );

    await cache.invalidatePattern("keys:*");
    await cache.invalidatePattern("coverage:*");

    res.status(201).json({
      id: key.id,
      namespaceId: key.namespaceId,
      namespacePath: key.namespace.path,
      keyName: key.keyName,
      fullKey: buildFullKey(key.namespace.path, key.keyName),
      description: key.description,
      tags: key.tags,
      status: key.status,
      platforms: key.platforms,
      values: key.values.map((v) => ({
        id: v.id,
        locale: v.locale,
        value: v.value,
        version: v.version,
        updatedBy: v.updatedById,
        updatedAt: v.updatedAt.toISOString(),
      })),
      createdBy: req.user!.name,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /duplicates — Duplicate detection ----
router.get(
  "/duplicates",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { keyName } = req.query as { keyName?: string };
      if (!keyName) {
        throw new AppError("keyName query param is required", 400);
      }

      // Find keys with similar names (contains match)
      const similar = await prisma.translationKey.findMany({
        where: {
          deletedAt: null,
          keyName: { contains: keyName, mode: "insensitive" },
        },
        include: {
          namespace: { select: { path: true } },
        },
        take: 20,
      });

      res.json({
        candidates: similar.map((k) => ({
          id: k.id,
          fullKey: buildFullKey(k.namespace.path, k.keyName),
          keyName: k.keyName,
          namespacePath: k.namespace.path,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- GET /:id — Get single key ----
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = await prisma.translationKey.findUnique({
      where: { id: req.params.id },
      include: {
        namespace: { select: { id: true, path: true, description: true } },
        values: {
          orderBy: { version: "desc" },
          include: { updatedBy: { select: { id: true, name: true, email: true } } },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!key || key.deletedAt) {
      throw new AppError("Key not found", 404);
    }

    // Deduplicate to latest version per locale
    const latestValues: Record<string, (typeof key.values)[0]> = {};
    for (const v of key.values) {
      if (!latestValues[v.locale] || v.version > latestValues[v.locale].version) {
        latestValues[v.locale] = v;
      }
    }

    res.json({
      id: key.id,
      namespaceId: key.namespaceId,
      namespacePath: key.namespace.path,
      namespace: key.namespace,
      keyName: key.keyName,
      fullKey: buildFullKey(key.namespace.path, key.keyName),
      description: key.description,
      tags: key.tags,
      status: key.status,
      platforms: key.platforms,
      values: Object.values(latestValues).map((v: any) => ({
        id: v.id,
        locale: v.locale,
        value: v.value,
        version: v.version,
        updatedBy: v.updatedBy?.name ?? v.updatedById ?? null,
        updatedByEmail: v.updatedBy?.email ?? null,
        updatedAt: v.updatedAt.toISOString(),
      })),
      allVersions: key.values.map((v: any) => ({
        id: v.id,
        locale: v.locale,
        value: v.value,
        version: v.version,
        updatedBy: v.updatedBy?.name ?? v.updatedById ?? null,
        updatedByEmail: v.updatedBy?.email ?? null,
        updatedAt: v.updatedAt.toISOString(),
      })),
      createdBy: key.createdBy?.name ?? null,
      createdByEmail: key.createdBy?.email ?? null,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- PUT /:id — Update key metadata ----
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateKeySchema.parse(req.body);
    const keyId = req.params.id;

    const existing = await prisma.translationKey.findUnique({
      where: { id: keyId },
    });
    if (!existing || existing.deletedAt) {
      throw new AppError("Key not found", 404);
    }

    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.platforms !== undefined) data.platforms = body.platforms;

    const updated = await prisma.translationKey.update({
      where: { id: keyId },
      data,
      include: {
        namespace: { select: { path: true } },
        values: { orderBy: { version: "desc" } },
      },
    });

    await logAudit(
      AuditAction.KEY_UPDATED,
      "TranslationKey",
      keyId,
      req.user!.id,
      { before: existing, after: body }
    );

    await cache.invalidatePattern("keys:*");

    res.json({
      id: updated.id,
      namespaceId: updated.namespaceId,
      namespacePath: updated.namespace.path,
      keyName: updated.keyName,
      fullKey: buildFullKey(updated.namespace.path, updated.keyName),
      description: updated.description,
      tags: updated.tags,
      status: updated.status,
      platforms: updated.platforms,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- PUT /:id/save — Single save for entire key detail ----
router.put(
  "/:id/save",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyId = req.params.id;

      const saveSchema = z.object({
        th: z.string().optional(),
        en: z.string().optional(),
        tags: z.array(z.string()).optional(),
      });

      const body = saveSchema.parse(req.body);

      // Load current key with latest values
      const key = await prisma.translationKey.findUnique({
        where: { id: keyId },
        include: { values: { orderBy: { version: "desc" } } },
      });
      if (!key || key.deletedAt) {
        throw new AppError("Key not found", 404);
      }

      // Get current latest values per locale
      const currentTH = key.values.find((v) => v.locale === "TH");
      const currentEN = key.values.find((v) => v.locale === "EN");
      const currentTags = key.tags;

      // Compute field-level diffs
      const changes: { fieldPath: string; from: any; to: any }[] = [];

      // TH value diff
      if (body.th !== undefined && body.th !== (currentTH?.value ?? "")) {
        changes.push({
          fieldPath: "th",
          from: currentTH?.value ?? "",
          to: body.th,
        });
      }

      // EN value diff
      if (body.en !== undefined && body.en !== (currentEN?.value ?? "")) {
        changes.push({
          fieldPath: "en",
          from: currentEN?.value ?? "",
          to: body.en,
        });
      }

      // Tags diff (case-insensitive dedup, sort for comparison)
      if (body.tags !== undefined) {
        const normalizedNewTags = [...new Set(body.tags.map((t) => t.trim()).filter(Boolean))];
        const sortedOld = [...currentTags].sort();
        const sortedNew = [...normalizedNewTags].sort();
        if (JSON.stringify(sortedOld) !== JSON.stringify(sortedNew)) {
          changes.push({
            fieldPath: "tags",
            from: currentTags,
            to: normalizedNewTags,
          });
        }
      }

      if (changes.length === 0) {
        return res.json({ message: "no_changes", changes: [] });
      }

      // Apply changes
      const valueResults = [];

      for (const change of changes) {
        if (change.fieldPath === "th" || change.fieldPath === "en") {
          const locale = change.fieldPath.toUpperCase() as "TH" | "EN";
          const current = locale === "TH" ? currentTH : currentEN;
          const nextVersion = current ? current.version + 1 : 1;

          const newVal = await prisma.translationValue.create({
            data: {
              keyId,
              locale,
              value: change.to,
              version: nextVersion,
              updatedById: req.user!.id,
            },
          });

          valueResults.push({
            id: newVal.id,
            locale: newVal.locale,
            value: newVal.value,
            version: newVal.version,
            updatedAt: newVal.updatedAt.toISOString(),
          });
        }
      }

      // Update tags if changed
      const tagsChange = changes.find((c) => c.fieldPath === "tags");
      if (tagsChange) {
        await prisma.translationKey.update({
          where: { id: keyId },
          data: { tags: tagsChange.to },
        });
      }

      // Update key status based on values
      const allValues = await prisma.translationValue.findMany({
        where: { keyId },
        orderBy: { version: "desc" },
      });
      const latestByLocale: Record<string, string> = {};
      for (const v of allValues) {
        if (!latestByLocale[v.locale]) {
          latestByLocale[v.locale] = v.value;
        }
      }
      const hasTH = !!latestByLocale["TH"];
      const hasEN = !!latestByLocale["EN"];
      const newStatus = hasTH && hasEN ? "TRANSLATED" : "PENDING";

      await prisma.translationKey.update({
        where: { id: keyId },
        data: { status: newStatus },
      });

      // Store structured diff in audit log
      await logAudit(
        AuditAction.KEY_UPDATED,
        "TranslationKey",
        keyId,
        req.user!.id,
        { changes }
      );

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");

      res.json({ status: newStatus, changes, values: valueResults });
    } catch (err) {
      next(err);
    }
  }
);

// ---- GET /:id/history — Get edit history with field-level diffs ----
router.get(
  "/:id/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyId = req.params.id;

      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: "TranslationKey",
          entityId: keyId,
          action: { in: ["key.updated", "key.created"] },
        },
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const history = logs.map((log) => ({
        id: log.id,
        action: log.action,
        changedAt: log.createdAt.toISOString(),
        changedBy: log.actor.name,
        changedByEmail: log.actor.email,
        changes: (log.diff as any)?.changes ?? [],
      }));

      res.json({ history });
    } catch (err) {
      next(err);
    }
  }
);

// ---- PUT /:id/values — Update translation values ----
router.put(
  "/:id/values",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updates = updateValuesSchema.parse(req.body);
      const keyId = req.params.id;

      const key = await prisma.translationKey.findUnique({
        where: { id: keyId },
        include: { values: { orderBy: { version: "desc" } } },
      });
      if (!key || key.deletedAt) {
        throw new AppError("Key not found", 404);
      }

      const results = [];

      for (const upd of updates) {
        // Find current latest version for this locale
        const current = key.values.find((v) => v.locale === upd.locale);
        const nextVersion = current ? current.version + 1 : 1;
        const oldValue = current?.value ?? null;

        // Create new version
        const newVal = await prisma.translationValue.create({
          data: {
            keyId,
            locale: upd.locale,
            value: upd.value,
            version: nextVersion,
            updatedById: req.user!.id,
          },
        });

        results.push({
          id: newVal.id,
          locale: newVal.locale,
          value: newVal.value,
          version: newVal.version,
          oldValue,
          updatedAt: newVal.updatedAt.toISOString(),
        });

        await logAudit(
          AuditAction.VALUE_UPDATED,
          "TranslationValue",
          newVal.id,
          req.user!.id,
          {
            keyId,
            locale: upd.locale,
            oldValue,
            newValue: upd.value,
            version: nextVersion,
          }
        );
      }

      // Update key status based on values
      const allValues = await prisma.translationValue.findMany({
        where: { keyId },
        orderBy: { version: "desc" },
      });

      // Get latest per locale
      const latestByLocale: Record<string, string> = {};
      for (const v of allValues) {
        if (!latestByLocale[v.locale]) {
          latestByLocale[v.locale] = v.value;
        }
      }

      const hasTH = !!latestByLocale["TH"];
      const hasEN = !!latestByLocale["EN"];
      const newStatus = hasTH && hasEN ? "TRANSLATED" : "PENDING";

      await prisma.translationKey.update({
        where: { id: keyId },
        data: { status: newStatus },
      });

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");

      res.json({ values: results, status: newStatus });
    } catch (err) {
      next(err);
    }
  }
);

// ---- DELETE /:id — Soft delete ----
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyId = req.params.id;

      const key = await prisma.translationKey.findUnique({
        where: { id: keyId },
      });
      if (!key || key.deletedAt) {
        throw new AppError("Key not found", 404);
      }

      await prisma.translationKey.update({
        where: { id: keyId },
        data: { deletedAt: new Date() },
      });

      await logAudit(
        AuditAction.KEY_DELETED,
        "TranslationKey",
        keyId,
        req.user!.id
      );

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");

      res.json({ message: "Key soft-deleted", id: keyId });
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /bulk — Bulk operations ----
router.post(
  "/bulk",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = bulkSchema.parse(req.body);
      const { operation, keyIds } = body;

      // Verify all keys exist
      const keys = await prisma.translationKey.findMany({
        where: { id: { in: keyIds }, deletedAt: null },
      });
      if (keys.length !== keyIds.length) {
        throw new AppError("Some keys not found", 404);
      }

      switch (operation) {
        case "tag": {
          if (!body.tags || body.tags.length === 0) {
            throw new AppError("tags required for tag operation", 400);
          }
          await prisma.$transaction(
            keyIds.map((id) =>
              prisma.translationKey.update({
                where: { id },
                data: {
                  tags: {
                    push: body.tags!,
                  },
                },
              })
            )
          );
          res.json({ message: `Tags applied to ${keyIds.length} keys` });
          break;
        }

        case "move": {
          if (!body.targetNamespacePath) {
            throw new AppError(
              "targetNamespacePath required for move operation",
              400
            );
          }
          if (!validateNamespacePath(body.targetNamespacePath)) {
            throw new AppError("Invalid target namespace path", 400);
          }

          // Auto-create target namespace
          let targetNs = await prisma.namespace.findUnique({
            where: { path: body.targetNamespacePath },
          });
          if (!targetNs) {
            targetNs = await prisma.namespace.create({
              data: { path: body.targetNamespacePath },
            });
          }

          await prisma.translationKey.updateMany({
            where: { id: { in: keyIds } },
            data: { namespaceId: targetNs.id },
          });

          res.json({
            message: `${keyIds.length} keys moved to ${body.targetNamespacePath}`,
          });
          break;
        }

        case "delete": {
          await prisma.translationKey.updateMany({
            where: { id: { in: keyIds } },
            data: { deletedAt: new Date() },
          });

          for (const id of keyIds) {
            await logAudit(
              AuditAction.KEY_DELETED,
              "TranslationKey",
              id,
              req.user!.id
            );
          }

          res.json({ message: `${keyIds.length} keys soft-deleted` });
          break;
        }
      }

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");
    } catch (err) {
      next(err);
    }
  }
);

export default router;
