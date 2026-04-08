import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { buildFullKey, AuditAction } from "@hato-tms/shared";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditService";
import * as cache from "../services/cacheService";
import * as changeRequestService from "../services/changeRequestService";
import * as keyService from "../services/keyService";

const router = Router();

router.use(authMiddleware);

// ---- Schemas ----

const createCRSchema = z.object({
  title: z.string().min(1).max(200),
  items: z
    .array(
      z.object({
        keyId: z.string().min(1),
        locale: z.enum(["TH", "EN"]),
        newValue: z.string(),
        comment: z.string().optional(),
      })
    )
    .min(1),
  reviewerIds: z.array(z.string()).default([]),
});

const reviewSchema = z.object({
  action: z.enum(["approve", "request-changes", "reject"]),
  comment: z.string().optional(),
});

// ---- GET / — List change requests ----
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = "1", pageSize = "20" } = req.query as Record<
      string,
      string | undefined
    >;

    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(pageSize || "20", 10)));
    const skip = (pageNum - 1) * size;

    const { crs, total } = await changeRequestService.listChangeRequests({
      status,
      skip,
      take: size,
    });

    res.json({
      data: crs.map((cr) => ({
        id: cr.id,
        title: cr.title,
        status: cr.status,
        authorId: cr.authorId,
        authorName: cr.author.name,
        reviewers: cr.reviewers.map((r) => ({
          userId: r.userId,
          name: r.user.name,
          approved: r.approved,
        })),
        itemCount: cr._count.items,
        createdAt: cr.createdAt.toISOString(),
        updatedAt: cr.updatedAt.toISOString(),
      })),
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (err) {
    next(err);
  }
});

// ---- POST / — Create change request ----
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createCRSchema.parse(req.body);

    // Validate all referenced keys exist
    const keyIds = [...new Set(body.items.map((i) => i.keyId))];
    const keys = await changeRequestService.validateKeyIds(keyIds);
    if (keys.length !== keyIds.length) {
      throw new AppError("Some referenced keys not found", 404);
    }

    const keyMap = new Map(keys.map((k) => [k.id, k]));

    // Build items with old values
    const itemsData = body.items.map((item) => {
      const key = keyMap.get(item.keyId)!;
      const currentVal = key.values.find((v) => v.locale === item.locale);
      return {
        keyId: item.keyId,
        locale: item.locale as "TH" | "EN",
        oldValue: currentVal?.value ?? null,
        newValue: item.newValue,
        comment: item.comment ?? null,
      };
    });

    const cr = await changeRequestService.createChangeRequest({
      title: body.title,
      authorId: req.user!.id,
      items: itemsData,
      reviewerIds: body.reviewerIds,
    });

    await logAudit(
      AuditAction.CR_CREATED,
      "ChangeRequest",
      cr.id,
      req.user!.id,
      { title: body.title, itemCount: body.items.length }
    );

    res.status(201).json({
      id: cr.id,
      title: cr.title,
      status: cr.status,
      authorId: cr.authorId,
      authorName: cr.author.name,
      items: cr.items.map((item) => ({
        id: item.id,
        keyId: item.keyId,
        fullKey: buildFullKey(item.key.namespace.path, item.key.keyName),
        locale: item.locale,
        oldValue: item.oldValue,
        newValue: item.newValue,
        comment: item.comment,
      })),
      reviewers: cr.reviewers.map((r) => ({
        userId: r.userId,
        name: r.user.name,
        approved: r.approved,
      })),
      createdAt: cr.createdAt.toISOString(),
      updatedAt: cr.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /:id — Get single CR with items and diff ----
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cr = await changeRequestService.getChangeRequestById(req.params.id);

    if (!cr) {
      throw new AppError("Change request not found", 404);
    }

    res.json({
      id: cr.id,
      title: cr.title,
      status: cr.status,
      authorId: cr.authorId,
      author: cr.author,
      items: cr.items.map((item) => ({
        id: item.id,
        keyId: item.keyId,
        fullKey: buildFullKey(item.key.namespace.path, item.key.keyName),
        locale: item.locale,
        oldValue: item.oldValue,
        newValue: item.newValue,
        comment: item.comment,
      })),
      reviewers: cr.reviewers.map((r) => ({
        userId: r.userId,
        name: r.user.name,
        approved: r.approved,
      })),
      createdAt: cr.createdAt.toISOString(),
      updatedAt: cr.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- PUT /:id/review — Review a CR ----
router.put(
  "/:id/review",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = reviewSchema.parse(req.body);
      const crId = req.params.id;

      const cr = await changeRequestService.getChangeRequestWithReviewers(crId);

      if (!cr) {
        throw new AppError("Change request not found", 404);
      }

      if (cr.status !== "PENDING") {
        throw new AppError(
          `Cannot review a change request with status '${cr.status}'`,
          400
        );
      }

      // Block self-approval (EC-08)
      if (cr.authorId === req.user!.id && body.action === "approve") {
        throw new AppError("Cannot approve your own change request", 403);
      }

      // Find or create reviewer record
      let reviewer = cr.reviewers.find((r) => r.userId === req.user!.id);
      if (!reviewer) {
        reviewer = await changeRequestService.createReviewer(crId, req.user!.id);
      }

      if (body.action === "approve") {
        await changeRequestService.approveReviewer(reviewer.id);

        // Any single approval (admin or assigned reviewer) approves the CR
        await changeRequestService.setChangeRequestStatus(crId, "APPROVED");

        await logAudit(
          AuditAction.CR_APPROVED,
          "ChangeRequest",
          crId,
          req.user!.id
        );
      } else if (body.action === "reject") {
        await changeRequestService.setChangeRequestStatus(crId, "REJECTED");

        await logAudit(
          AuditAction.CR_REJECTED,
          "ChangeRequest",
          crId,
          req.user!.id
        );
      }
      // "request-changes" keeps status as PENDING

      const updated = await changeRequestService.reloadChangeRequestWithReviewers(crId);

      res.json({
        id: updated!.id,
        status: updated!.status,
        reviewers: updated!.reviewers.map((r) => ({
          userId: r.userId,
          name: r.user.name,
          approved: r.approved,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- PUT /:id/publish — Publish approved CR ----
router.put(
  "/:id/publish",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const crId = req.params.id;

      const cr = await changeRequestService.getChangeRequestForPublish(crId);

      if (!cr) {
        throw new AppError("Change request not found", 404);
      }

      if (cr.status !== "APPROVED") {
        throw new AppError(
          "Only approved change requests can be published",
          400
        );
      }

      // Apply all items
      for (const item of cr.items) {
        const currentVal = item.key.values.find(
          (v) => v.locale === item.locale
        );
        const nextVersion = currentVal ? currentVal.version + 1 : 1;

        await keyService.createTranslationValue({
          keyId: item.keyId,
          locale: item.locale,
          value: item.newValue,
          version: nextVersion,
          updatedById: req.user!.id,
        });

        // Update key status
        const allValues = await keyService.getAllKeyValues(item.keyId);
        const latestByLocale: Record<string, string> = {};
        for (const v of allValues) {
          if (!latestByLocale[v.locale]) {
            latestByLocale[v.locale] = v.value;
          }
        }
        const hasTH = !!latestByLocale["TH"];
        const hasEN = !!latestByLocale["EN"];

        await keyService.setKeyStatus(
          item.keyId,
          hasTH && hasEN ? "TRANSLATED" : "PENDING"
        );
      }

      // Mark CR as PUBLISHED
      await changeRequestService.markChangeRequestPublished(crId);

      await logAudit(
        AuditAction.CR_PUBLISHED,
        "ChangeRequest",
        crId,
        req.user!.id,
        { itemCount: cr.items.length }
      );

      await cache.invalidatePattern("keys:*");
      await cache.invalidatePattern("coverage:*");

      res.json({
        message: "Change request published successfully",
        id: crId,
        appliedItems: cr.items.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
