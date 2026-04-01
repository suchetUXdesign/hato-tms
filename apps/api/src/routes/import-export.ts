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

router.use(authMiddleware);

// ---- Schemas ----

const importJsonSchema = z.object({
  namespacePath: z.string().min(1),
  data: z.record(z.unknown()),
  confirm: z.boolean().default(false),
  locale: z.enum(["TH", "EN"]).optional(),
});

const importCsvSchema = z.object({
  namespacePath: z.string().min(1),
  data: z.string().min(1),
  confirm: z.boolean().default(false),
});

// ---- Helpers ----

/**
 * Flatten a nested JSON object into dot-separated key-value pairs.
 * { menu: { title: "Hello" } } => { "menu.title": "Hello" }
 */
function flattenJson(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value ?? "");
    }
  }
  return result;
}

/**
 * Unflatten dot-separated keys into a nested object.
 * { "menu.title": "Hello" } => { menu: { title: "Hello" } }
 */
function unflattenJson(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Sort keys for deterministic output
  const sortedKeys = Object.keys(flat).sort();
  for (const key of sortedKeys) {
    const parts = key.split(".");
    let current: any = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = flat[key];
  }
  return result;
}

function parseCsv(csvString: string): Array<Record<string, string>> {
  const lines = csvString.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }
  return rows;
}

// ---- POST /import/json — Import JSON ----
router.post(
  "/import/json",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = importJsonSchema.parse(req.body);

      if (!validateNamespacePath(body.namespacePath)) {
        throw new AppError("Invalid namespace path", 400);
      }

      // Flatten the incoming JSON
      const flat = flattenJson(body.data);

      // Get or create namespace
      let ns = await prisma.namespace.findUnique({
        where: { path: body.namespacePath },
      });

      // Get existing keys in this namespace
      const existingKeys = ns
        ? await prisma.translationKey.findMany({
            where: { namespaceId: ns.id, deletedAt: null },
            include: { values: { orderBy: { version: "desc" } } },
          })
        : [];

      const existingMap = new Map<string, (typeof existingKeys)[0]>();
      for (const k of existingKeys) {
        existingMap.set(k.keyName, k);
      }

      // Compute diff
      const added: Array<{ key: string; value: string }> = [];
      const modified: Array<{
        key: string;
        locale: string;
        oldValue: string;
        newValue: string;
      }> = [];

      const locale = body.locale || "TH";

      for (const [keyName, value] of Object.entries(flat)) {
        const existing = existingMap.get(keyName);
        if (!existing) {
          added.push({ key: keyName, value });
        } else {
          // Find latest value for this locale
          const currentVal = existing.values.find(
            (v) => v.locale === locale
          );
          if (currentVal && currentVal.value !== value) {
            modified.push({
              key: keyName,
              locale,
              oldValue: currentVal.value,
              newValue: value,
            });
          } else if (!currentVal) {
            modified.push({
              key: keyName,
              locale,
              oldValue: "",
              newValue: value,
            });
          }
        }
      }

      // Never auto-delete: list keys only in DB for awareness
      const incomingKeyNames = new Set(Object.keys(flat));
      const removed = existingKeys
        .filter((k) => !incomingKeyNames.has(k.keyName))
        .map((k) => ({
          key: k.keyName,
          note: "Present in DB but not in import file. Not deleted automatically.",
        }));

      // Preview mode
      if (!body.confirm) {
        res.json({
          preview: true,
          added,
          modified,
          removed,
          totalIncoming: Object.keys(flat).length,
          totalExisting: existingKeys.length,
        });
        return;
      }

      // Apply changes
      if (!ns) {
        ns = await prisma.namespace.create({
          data: { path: body.namespacePath },
        });
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of added) {
        if (!validateKeyName(item.key)) continue; // skip invalid key names

        await prisma.translationKey.create({
          data: {
            namespaceId: ns.id,
            keyName: item.key,
            status: "PENDING",
            createdById: req.user!.id,
            values: {
              create: [{ locale, value: item.value, version: 1 }],
            },
          },
        });
        createdCount++;
      }

      for (const item of modified) {
        const existing = existingMap.get(item.key)!;
        const currentVal = existing.values.find(
          (v) => v.locale === locale
        );
        const nextVersion = currentVal ? currentVal.version + 1 : 1;

        await prisma.translationValue.create({
          data: {
            keyId: existing.id,
            locale,
            value: item.newValue,
            version: nextVersion,
            updatedById: req.user!.id,
          },
        });
        updatedCount++;
      }

      await logAudit(
        AuditAction.IMPORT_COMPLETED,
        "Namespace",
        ns.id,
        req.user!.id,
        { format: "json", created: createdCount, updated: updatedCount }
      );

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");

      res.json({
        preview: false,
        created: createdCount,
        updated: updatedCount,
        skippedDeletions: removed.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /import/csv — Import CSV ----
router.post(
  "/import/csv",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = importCsvSchema.parse(req.body);

      if (!validateNamespacePath(body.namespacePath)) {
        throw new AppError("Invalid namespace path", 400);
      }

      const rows = parseCsv(body.data);
      if (rows.length === 0) {
        throw new AppError("CSV file is empty or has no data rows", 400);
      }

      // Expect columns: key, th, en (or key, TH, EN)
      const firstRow = rows[0];
      const keyCol =
        "key" in firstRow ? "key" : "Key" in firstRow ? "Key" : null;
      const thCol =
        "th" in firstRow
          ? "th"
          : "TH" in firstRow
            ? "TH"
            : "Thai" in firstRow
              ? "Thai"
              : null;
      const enCol =
        "en" in firstRow
          ? "en"
          : "EN" in firstRow
            ? "EN"
            : "English" in firstRow
              ? "English"
              : null;

      if (!keyCol) {
        throw new AppError(
          "CSV must have a 'key' column",
          400
        );
      }

      // Get or create namespace
      let ns = await prisma.namespace.findUnique({
        where: { path: body.namespacePath },
      });

      const existingKeys = ns
        ? await prisma.translationKey.findMany({
            where: { namespaceId: ns.id, deletedAt: null },
            include: { values: { orderBy: { version: "desc" } } },
          })
        : [];

      const existingMap = new Map<string, (typeof existingKeys)[0]>();
      for (const k of existingKeys) {
        existingMap.set(k.keyName, k);
      }

      // Compute diff
      const added: Array<{ key: string; th: string; en: string }> = [];
      const modified: Array<{
        key: string;
        locale: string;
        oldValue: string;
        newValue: string;
      }> = [];

      for (const row of rows) {
        const keyName = row[keyCol!];
        if (!keyName) continue;

        const thValue = thCol ? row[thCol] || "" : "";
        const enValue = enCol ? row[enCol] || "" : "";

        const existing = existingMap.get(keyName);
        if (!existing) {
          added.push({ key: keyName, th: thValue, en: enValue });
        } else {
          // Check TH
          if (thCol) {
            const curTH = existing.values.find((v) => v.locale === "TH");
            if (thValue && (!curTH || curTH.value !== thValue)) {
              modified.push({
                key: keyName,
                locale: "TH",
                oldValue: curTH?.value ?? "",
                newValue: thValue,
              });
            }
          }
          // Check EN
          if (enCol) {
            const curEN = existing.values.find((v) => v.locale === "EN");
            if (enValue && (!curEN || curEN.value !== enValue)) {
              modified.push({
                key: keyName,
                locale: "EN",
                oldValue: curEN?.value ?? "",
                newValue: enValue,
              });
            }
          }
        }
      }

      const incomingKeyNames = new Set(rows.map((r) => r[keyCol!]).filter(Boolean));
      const removed = existingKeys
        .filter((k) => !incomingKeyNames.has(k.keyName))
        .map((k) => ({ key: k.keyName }));

      // Preview mode
      if (!body.confirm) {
        res.json({
          preview: true,
          added,
          modified,
          removed,
          totalIncoming: rows.length,
          totalExisting: existingKeys.length,
        });
        return;
      }

      // Apply changes
      if (!ns) {
        ns = await prisma.namespace.create({
          data: { path: body.namespacePath },
        });
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of added) {
        if (!validateKeyName(item.key)) continue;

        const status = item.th && item.en ? "TRANSLATED" : "PENDING";
        const valuesToCreate = [];
        if (item.th) valuesToCreate.push({ locale: "TH" as const, value: item.th, version: 1 });
        if (item.en) valuesToCreate.push({ locale: "EN" as const, value: item.en, version: 1 });

        await prisma.translationKey.create({
          data: {
            namespaceId: ns.id,
            keyName: item.key,
            status,
            createdById: req.user!.id,
            values: { create: valuesToCreate },
          },
        });
        createdCount++;
      }

      for (const item of modified) {
        const existing = existingMap.get(item.key)!;
        const currentVal = existing.values.find(
          (v) => v.locale === item.locale
        );
        const nextVersion = currentVal ? currentVal.version + 1 : 1;

        await prisma.translationValue.create({
          data: {
            keyId: existing.id,
            locale: item.locale as "TH" | "EN",
            value: item.newValue,
            version: nextVersion,
            updatedById: req.user!.id,
          },
        });
        updatedCount++;
      }

      await logAudit(
        AuditAction.IMPORT_COMPLETED,
        "Namespace",
        ns.id,
        req.user!.id,
        { format: "csv", created: createdCount, updated: updatedCount }
      );

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");

      res.json({
        preview: false,
        created: createdCount,
        updated: updatedCount,
        skippedDeletions: removed.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- GET /export/json — Export as JSON ----
router.get(
  "/export/json",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        namespaces: nsParam,
        format = "nested",
        locale,
      } = req.query as {
        namespaces?: string;
        format?: string;
        locale?: string;
      };

      const where: any = { deletedAt: null };
      if (nsParam) {
        const nsPaths = nsParam.split(",").map((s) => s.trim());
        where.namespace = { path: { in: nsPaths } };
      }

      const keys = await prisma.translationKey.findMany({
        where,
        include: {
          namespace: { select: { path: true } },
          values: { orderBy: { version: "desc" } },
        },
        orderBy: [
          { namespace: { path: "asc" } },
          { keyName: "asc" },
        ],
      });

      // Build flat map per locale
      const locales = locale
        ? [locale.toUpperCase()]
        : ["TH", "EN"];

      const result: Record<string, Record<string, string>> = {};

      for (const loc of locales) {
        const flat: Record<string, string> = {};

        for (const key of keys) {
          const fullKey = buildFullKey(key.namespace.path, key.keyName);
          // Get latest value for this locale
          const val = key.values.find((v) => v.locale === loc);
          flat[fullKey] = val?.value ?? "";
        }

        // Deterministic sort
        const sorted: Record<string, string> = {};
        for (const k of Object.keys(flat).sort()) {
          sorted[k] = flat[k];
        }

        if (format === "nested") {
          result[loc] = sorted; // Will unflatten below
        } else {
          result[loc] = sorted;
        }
      }

      // If single locale, return directly; otherwise wrap in locale keys
      let output: unknown;
      if (locales.length === 1) {
        const loc = locales[0];
        output =
          format === "nested"
            ? unflattenJson(result[loc])
            : result[loc];
      } else {
        output = {} as Record<string, unknown>;
        for (const loc of locales) {
          (output as any)[loc] =
            format === "nested"
              ? unflattenJson(result[loc])
              : result[loc];
        }
      }

      await logAudit(
        AuditAction.EXPORT_COMPLETED,
        "Export",
        "json",
        req.user!.id,
        { format, locales, keyCount: keys.length }
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="translations-${locale || "all"}.json"`
      );
      res.json(output);
    } catch (err) {
      next(err);
    }
  }
);

// ---- GET /export/csv — Export as CSV ----
router.get(
  "/export/csv",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { namespaces: nsParam } = req.query as {
        namespaces?: string;
      };

      const where: any = { deletedAt: null };
      if (nsParam) {
        const nsPaths = nsParam.split(",").map((s) => s.trim());
        where.namespace = { path: { in: nsPaths } };
      }

      const keys = await prisma.translationKey.findMany({
        where,
        include: {
          namespace: { select: { path: true } },
          values: { orderBy: { version: "desc" } },
        },
        orderBy: [
          { namespace: { path: "asc" } },
          { keyName: "asc" },
        ],
      });

      // Build CSV
      const lines: string[] = ['"key","TH","EN","description"'];

      for (const key of keys) {
        const fullKey = buildFullKey(key.namespace.path, key.keyName);
        const thVal = key.values.find((v) => v.locale === "TH");
        const enVal = key.values.find((v) => v.locale === "EN");

        const escape = (s: string) =>
          '"' + s.replace(/"/g, '""') + '"';

        lines.push(
          [
            escape(fullKey),
            escape(thVal?.value ?? ""),
            escape(enVal?.value ?? ""),
            escape(key.description ?? ""),
          ].join(",")
        );
      }

      await logAudit(
        AuditAction.EXPORT_COMPLETED,
        "Export",
        "csv",
        req.user!.id,
        { keyCount: keys.length }
      );

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="translations.csv"'
      );
      res.send(lines.join("\n"));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
