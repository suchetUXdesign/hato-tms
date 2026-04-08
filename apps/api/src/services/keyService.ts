import { prisma } from "@hato-tms/db";

// ============================================================
// List / Search
// ============================================================

export interface ListKeysParams {
  query?: string;
  namespace?: string;
  status?: string;
  platform?: string;
  tags?: string;
  skip: number;
  take: number;
  orderBy: Record<string, string>;
}

export async function listKeys(params: ListKeysParams) {
  const where: any = {
    deletedAt: null,
  };

  if (params.query) {
    where.OR = [
      { keyName: { contains: params.query, mode: "insensitive" } },
      { description: { contains: params.query, mode: "insensitive" } },
      {
        values: {
          some: { value: { contains: params.query, mode: "insensitive" } },
        },
      },
      {
        namespace: {
          path: { contains: params.query, mode: "insensitive" },
        },
      },
    ];
  }

  if (params.namespace) {
    where.namespace = { path: { startsWith: params.namespace } };
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.platform) {
    where.platforms = { has: params.platform };
  }

  if (params.tags) {
    const tagList = typeof params.tags === "string" ? params.tags.split(",") : [];
    if (tagList.length > 0) {
      where.tags = { hasSome: tagList };
    }
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
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    }),
    prisma.translationKey.count({ where }),
  ]);

  return { keys, total };
}

// ============================================================
// Single Key Lookups
// ============================================================

/** Full include — used by GET /:id */
export async function getKeyById(id: string) {
  return prisma.translationKey.findUnique({
    where: { id },
    include: {
      namespace: { select: { id: true, path: true, description: true } },
      values: {
        orderBy: { version: "desc" },
        include: { updatedBy: { select: { id: true, name: true, email: true } } },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/** Minimal fetch — used for existence checks in PUT /:id and DELETE /:id */
export async function getKeyForCheck(id: string) {
  return prisma.translationKey.findUnique({
    where: { id },
  });
}

/** With values ordered by version — used by PUT /:id/save and PUT /:id/values */
export async function getKeyWithValues(id: string) {
  return prisma.translationKey.findUnique({
    where: { id },
    include: { values: { orderBy: { version: "desc" } } },
  });
}

// ============================================================
// Namespace
// ============================================================

export async function findNamespaceByPath(path: string) {
  return prisma.namespace.findUnique({ where: { path } });
}

export async function createNamespace(path: string, platforms: string[] = []) {
  return prisma.namespace.create({
    data: { path, platforms: platforms as any },
  });
}

// ============================================================
// Key Creation
// ============================================================

/** Duplicate check — used by POST / */
export async function findExistingKey(namespaceId: string, keyName: string) {
  return prisma.translationKey.findFirst({
    where: { namespaceId, keyName, deletedAt: null },
  });
}

export interface CreateKeyData {
  namespaceId: string;
  keyName: string;
  description?: string | null;
  tags: string[];
  platforms: string[];
  status: string;
  createdById: string;
  thValue: string;
  enValue: string;
}

export async function createKeyWithValues(data: CreateKeyData) {
  return prisma.translationKey.create({
    data: {
      namespaceId: data.namespaceId,
      keyName: data.keyName,
      description: data.description ?? null,
      tags: data.tags,
      platforms: data.platforms as any,
      status: data.status as any,
      createdById: data.createdById,
      values: {
        create: [
          { locale: "TH", value: data.thValue, version: 1 },
          { locale: "EN", value: data.enValue, version: 1 },
        ],
      },
    },
    include: {
      namespace: { select: { path: true } },
      values: true,
    },
  });
}

// ============================================================
// Duplicate Detection
// ============================================================

export async function findSimilarKeys(keyName: string) {
  return prisma.translationKey.findMany({
    where: {
      deletedAt: null,
      keyName: { contains: keyName, mode: "insensitive" },
    },
    include: {
      namespace: { select: { path: true } },
    },
    take: 20,
  });
}

// ============================================================
// Key Updates
// ============================================================

export interface UpdateKeyMetadataData {
  description?: string;
  tags?: string[];
  platforms?: string[];
}

export async function updateKeyMetadata(id: string, data: UpdateKeyMetadataData) {
  const update: any = {};
  if (data.description !== undefined) update.description = data.description;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.platforms !== undefined) update.platforms = data.platforms;

  return prisma.translationKey.update({
    where: { id },
    data: update,
    include: {
      namespace: { select: { path: true } },
      values: { orderBy: { version: "desc" } },
    },
  });
}

export async function updateKeyTags(id: string, tags: string[]) {
  await prisma.translationKey.update({
    where: { id },
    data: { tags },
  });
}

export async function setKeyStatus(id: string, status: string) {
  await prisma.translationKey.update({
    where: { id },
    data: { status: status as any },
  });
}

// ============================================================
// Translation Values
// ============================================================

export interface CreateTranslationValueData {
  keyId: string;
  locale: "TH" | "EN";
  value: string;
  version: number;
  updatedById: string;
}

export async function createTranslationValue(data: CreateTranslationValueData) {
  return prisma.translationValue.create({ data });
}

export async function getAllKeyValues(keyId: string) {
  return prisma.translationValue.findMany({
    where: { keyId },
    orderBy: { version: "desc" },
  });
}

// ============================================================
// History
// ============================================================

export async function getKeyHistory(keyId: string) {
  return prisma.auditLog.findMany({
    where: {
      entityType: "TranslationKey",
      entityId: keyId,
      action: { in: ["key.updated", "key.created"] },
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ============================================================
// Soft Delete
// ============================================================

export async function softDeleteKey(id: string) {
  await prisma.translationKey.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ============================================================
// Bulk Operations
// ============================================================

export async function findKeysByIds(ids: string[]) {
  return prisma.translationKey.findMany({
    where: { id: { in: ids }, deletedAt: null },
  });
}

export async function bulkTagKeys(keyIds: string[], tags: string[]) {
  await prisma.$transaction(
    keyIds.map((id) =>
      prisma.translationKey.update({
        where: { id },
        data: { tags: { push: tags } },
      })
    )
  );
}

export async function bulkMoveKeys(keyIds: string[], namespaceId: string) {
  await prisma.translationKey.updateMany({
    where: { id: { in: keyIds } },
    data: { namespaceId },
  });
}

export async function bulkSoftDeleteKeys(keyIds: string[]) {
  await prisma.translationKey.updateMany({
    where: { id: { in: keyIds } },
    data: { deletedAt: new Date() },
  });
}
