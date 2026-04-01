import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@hato-tms/db";
import { buildFullKey, AuditAction } from "@hato-tms/shared";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditService";
import * as cache from "../services/cacheService";

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

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [crs, total] = await Promise.all([
      prisma.changeRequest.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          reviewers: {
            include: { user: { select: { id: true, name: true } } },
          },
          _count: { select: { items: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: size,
      }),
      prisma.changeRequest.count({ where }),
    ]);

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
    const keys = await prisma.translationKey.findMany({
      where: { id: { in: keyIds }, deletedAt: null },
      include: {
        values: { orderBy: { version: "desc" } },
        namespace: { select: { path: true } },
      },
    });
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

    const cr = await prisma.changeRequest.create({
      data: {
        title: body.title,
        status: "PENDING",
        authorId: req.user!.id,
        items: { create: itemsData },
        reviewers: {
          create: body.reviewerIds.map((userId) => ({ userId })),
        },
      },
      include: {
        author: { select: { name: true } },
        items: {
          include: {
            key: {
              include: { namespace: { select: { path: true } } },
            },
          },
        },
        reviewers: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
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
    const cr = await prisma.changeRequest.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            key: {
              include: { namespace: { select: { path: true } } },
            },
          },
        },
        reviewers: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

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

      const cr = await prisma.changeRequest.findUnique({
        where: { id: crId },
        include: { reviewers: true },
      });

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
        reviewer = await prisma.cRReviewer.create({
          data: {
            changeRequestId: crId,
            userId: req.user!.id,
            approved: false,
          },
        });
      }

      if (body.action === "approve") {
        await prisma.cRReviewer.update({
          where: { id: reviewer.id },
          data: { approved: true },
        });

        // Any single approval (admin or assigned reviewer) approves the CR
        await prisma.changeRequest.update({
          where: { id: crId },
          data: { status: "APPROVED" },
        });

        await logAudit(
          AuditAction.CR_APPROVED,
          "ChangeRequest",
          crId,
          req.user!.id
        );
      } else if (body.action === "reject") {
        await prisma.changeRequest.update({
          where: { id: crId },
          data: { status: "REJECTED" },
        });

        await logAudit(
          AuditAction.CR_REJECTED,
          "ChangeRequest",
          crId,
          req.user!.id
        );
      }
      // "request-changes" keeps status as PENDING

      const updated = await prisma.changeRequest.findUnique({
        where: { id: crId },
        include: {
          reviewers: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });

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

      const cr = await prisma.changeRequest.findUnique({
        where: { id: crId },
        include: {
          items: {
            include: {
              key: { include: { values: { orderBy: { version: "desc" } } } },
            },
          },
        },
      });

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

        await prisma.translationValue.create({
          data: {
            keyId: item.keyId,
            locale: item.locale,
            value: item.newValue,
            version: nextVersion,
            updatedById: req.user!.id,
          },
        });

        // Update key status
        const allValues = await prisma.translationValue.findMany({
          where: { keyId: item.keyId },
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

        await prisma.translationKey.update({
          where: { id: item.keyId },
          data: { status: hasTH && hasEN ? "TRANSLATED" : "PENDING" },
        });
      }

      // Mark CR as PUBLISHED
      await prisma.changeRequest.update({
        where: { id: crId },
        data: { status: "PUBLISHED" },
      });

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
