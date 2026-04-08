import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth";
import * as coverageService from "../services/coverageService";

const router = Router();

router.use(authMiddleware);

// ---- GET / — Coverage stats per namespace ----
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const namespaces = await coverageService.getNamespacesWithKeys();

    const stats = namespaces.map((ns) => {
      const totalKeys = ns.keys.length;
      let translatedTH = 0;
      let translatedEN = 0;
      let pending = 0;

      for (const key of ns.keys) {
        // Get latest value per locale
        const latestByLocale: Record<string, string> = {};
        for (const v of key.values) {
          if (!latestByLocale[v.locale]) {
            latestByLocale[v.locale] = v.value;
          }
        }

        const hasTH = !!latestByLocale["TH"];
        const hasEN = !!latestByLocale["EN"];

        if (hasTH) translatedTH++;
        if (hasEN) translatedEN++;
        if (!hasTH || !hasEN) pending++;
      }

      return {
        namespacePath: ns.path,
        totalKeys,
        translatedTH,
        translatedEN,
        pending,
        coverageTH: totalKeys > 0 ? Math.round((translatedTH / totalKeys) * 100) : 100,
        coverageEN: totalKeys > 0 ? Math.round((translatedEN / totalKeys) * 100) : 100,
      };
    });

    // Overall totals
    const overall = stats.reduce(
      (acc, s) => ({
        totalKeys: acc.totalKeys + s.totalKeys,
        translatedTH: acc.translatedTH + s.translatedTH,
        translatedEN: acc.translatedEN + s.translatedEN,
        pending: acc.pending + s.pending,
      }),
      { totalKeys: 0, translatedTH: 0, translatedEN: 0, pending: 0 }
    );

    res.json({
      namespaces: stats,
      overall: {
        ...overall,
        coverageTH:
          overall.totalKeys > 0
            ? Math.round((overall.translatedTH / overall.totalKeys) * 100)
            : 100,
        coverageEN:
          overall.totalKeys > 0
            ? Math.round((overall.translatedEN / overall.totalKeys) * 100)
            : 100,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /missing — Missing key report ----
router.get(
  "/missing",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { namespace, locale } = req.query as {
        namespace?: string;
        locale?: string;
      };

      const keys = await coverageService.getMissingKeys({ namespace, locale });

      const missing: Array<{
        id: string;
        fullKey: string;
        namespacePath: string;
        keyName: string;
        missingLocales: string[];
        thValue: string;
        enValue: string;
      }> = [];

      for (const key of keys) {
        const latestByLocale: Record<string, string> = {};
        for (const v of key.values) {
          if (!latestByLocale[v.locale]) {
            latestByLocale[v.locale] = v.value;
          }
        }

        const hasTH = !!latestByLocale["TH"];
        const hasEN = !!latestByLocale["EN"];

        // Filter by requested locale
        const isMissing =
          locale === "TH"
            ? !hasTH
            : locale === "EN"
              ? !hasEN
              : !hasTH || !hasEN;

        if (isMissing) {
          const missingLocales: string[] = [];
          if (!hasTH) missingLocales.push("TH");
          if (!hasEN) missingLocales.push("EN");

          missing.push({
            id: key.id,
            fullKey: `${key.namespace.path}.${key.keyName}`,
            namespacePath: key.namespace.path,
            keyName: key.keyName,
            missingLocales,
            thValue: latestByLocale["TH"] ?? "",
            enValue: latestByLocale["EN"] ?? "",
          });
        }
      }

      res.json({
        data: missing,
        total: missing.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
