import { prisma } from "@hato-tms/db";

// ============================================================
// List
// ============================================================

export interface ListChangeRequestsParams {
  status?: string;
  skip: number;
  take: number;
}

export async function listChangeRequests(params: ListChangeRequestsParams) {
  const where: any = {};
  if (params.status) {
    where.status = params.status;
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
      skip: params.skip,
      take: params.take,
    }),
    prisma.changeRequest.count({ where }),
  ]);

  return { crs, total };
}

// ============================================================
// Validate Keys for CR Creation
// ============================================================

export async function validateKeyIds(keyIds: string[]) {
  return prisma.translationKey.findMany({
    where: { id: { in: keyIds }, deletedAt: null },
    include: {
      values: { orderBy: { version: "desc" } },
      namespace: { select: { path: true } },
    },
  });
}

// ============================================================
// Create
// ============================================================

export interface CreateChangeRequestItemData {
  keyId: string;
  locale: "TH" | "EN";
  oldValue: string | null;
  newValue: string;
  comment: string | null;
}

export interface CreateChangeRequestData {
  title: string;
  authorId: string;
  items: CreateChangeRequestItemData[];
  reviewerIds: string[];
}

export async function createChangeRequest(data: CreateChangeRequestData) {
  return prisma.changeRequest.create({
    data: {
      title: data.title,
      status: "PENDING",
      authorId: data.authorId,
      items: { create: data.items },
      reviewers: {
        create: data.reviewerIds.map((userId) => ({ userId })),
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
}

// ============================================================
// Single Lookups
// ============================================================

/** Full include — used by GET /:id */
export async function getChangeRequestById(id: string) {
  return prisma.changeRequest.findUnique({
    where: { id },
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
}

/** With reviewers only — used by PUT /:id/review */
export async function getChangeRequestWithReviewers(id: string) {
  return prisma.changeRequest.findUnique({
    where: { id },
    include: { reviewers: true },
  });
}

/** Reload after review action — used by PUT /:id/review response */
export async function reloadChangeRequestWithReviewers(id: string) {
  return prisma.changeRequest.findUnique({
    where: { id },
    include: {
      reviewers: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

/** With items + key + values — used by PUT /:id/publish */
export async function getChangeRequestForPublish(id: string) {
  return prisma.changeRequest.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          key: { include: { values: { orderBy: { version: "desc" } } } },
        },
      },
    },
  });
}

// ============================================================
// Reviewers
// ============================================================

export async function createReviewer(changeRequestId: string, userId: string) {
  return prisma.cRReviewer.create({
    data: {
      changeRequestId,
      userId,
      approved: false,
    },
  });
}

export async function approveReviewer(reviewerId: string) {
  await prisma.cRReviewer.update({
    where: { id: reviewerId },
    data: { approved: true },
  });
}

// ============================================================
// Status Updates
// ============================================================

export async function setChangeRequestStatus(id: string, status: string) {
  await prisma.changeRequest.update({
    where: { id },
    data: { status: status as any },
  });
}

export async function markChangeRequestPublished(id: string) {
  await prisma.changeRequest.update({
    where: { id },
    data: { status: "PUBLISHED" },
  });
}
