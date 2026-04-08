import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
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
import * as keyService from "../services/keyService";

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

    const { keys, total } = await keyService.listKeys({
      query,
      namespace,
      status,
      platform,
      tags,
      skip,
      take: size,
      orderBy,
    });

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
    let ns = await keyService.findNamespaceByPath(body.namespacePath);
    if (!ns) {
      ns = await keyService.createNamespace(body.namespacePath, body.platforms);
    }

    // Check for duplicate key in same namespace
    const existing = await keyService.findExistingKey(ns.id, body.keyName);
    if (existing) {
      throw new AppError(
        "A key with this name already exists in this namespace.",
        409
      );
    }

    // Determine initial status
    const status = body.thValue && body.enValue ? "TRANSLATED" : "PENDING";

    // Create key + values
    const key = await keyService.createKeyWithValues({
      namespaceId: ns.id,
      keyName: body.keyName,
      description: body.description ?? null,
      tags: body.tags,
      platforms: body.platforms,
      status,
      createdById: req.user!.id,
      thValue: body.thValue,
      enValue: body.enValue,
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

      const similar = await keyService.findSimilarKeys(keyName);

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
    const key = await keyService.getKeyById(req.params.id);

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

    const existing = await keyService.getKeyForCheck(keyId);
    if (!existing || existing.deletedAt) {
      throw new AppError("Key not found", 404);
    }

    const updated = await keyService.updateKeyMetadata(keyId, {
      description: body.description,
      tags: body.tags,
      platforms: body.platforms,
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
      const key = await keyService.getKeyWithValues(keyId);
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

          const newVal = await keyService.createTranslationValue({
            keyId,
            locale,
            value: change.to,
            version: nextVersion,
            updatedById: req.user!.id,
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
        await keyService.updateKeyTags(keyId, tagsChange.to);
      }

      // Update key status based on values
      const allValues = await keyService.getAllKeyValues(keyId);
      const latestByLocale: Record<string, string> = {};
      for (const v of allValues) {
        if (!latestByLocale[v.locale]) {
          latestByLocale[v.locale] = v.value;
        }
      }
      const hasTH = !!latestByLocale["TH"];
      const hasEN = !!latestByLocale["EN"];
      const newStatus = hasTH && hasEN ? "TRANSLATED" : "PENDING";

      await keyService.setKeyStatus(keyId, newStatus);

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

      const logs = await keyService.getKeyHistory(keyId);

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

      const key = await keyService.getKeyWithValues(keyId);
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
        const newVal = await keyService.createTranslationValue({
          keyId,
          locale: upd.locale,
          value: upd.value,
          version: nextVersion,
          updatedById: req.user!.id,
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
      const allValues = await keyService.getAllKeyValues(keyId);

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

      await keyService.setKeyStatus(keyId, newStatus);

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

      const key = await keyService.getKeyForCheck(keyId);
      if (!key || key.deletedAt) {
        throw new AppError("Key not found", 404);
      }

      await keyService.softDeleteKey(keyId);

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
      const keys = await keyService.findKeysByIds(keyIds);
      if (keys.length !== keyIds.length) {
        throw new AppError("Some keys not found", 404);
      }

      switch (operation) {
        case "tag": {
          if (!body.tags || body.tags.length === 0) {
            throw new AppError("tags required for tag operation", 400);
          }
          await keyService.bulkTagKeys(keyIds, body.tags);
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
          let targetNs = await keyService.findNamespaceByPath(body.targetNamespacePath);
          if (!targetNs) {
            targetNs = await keyService.createNamespace(body.targetNamespacePath);
          }

          await keyService.bulkMoveKeys(keyIds, targetNs.id);

          res.json({
            message: `${keyIds.length} keys moved to ${body.targetNamespacePath}`,
          });
          break;
        }

        case "delete": {
          await keyService.bulkSoftDeleteKeys(keyIds);

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
