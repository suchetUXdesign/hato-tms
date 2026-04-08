import { prisma } from "@hato-tms/db";

// ============================================================
// List
// ============================================================

export async function listNamespaces() {
  return prisma.namespace.findMany({
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
}

// ============================================================
// Single Lookups
// ============================================================

export async function getNamespaceById(id: string) {
  return prisma.namespace.findUnique({ where: { id } });
}

export async function getNamespaceByPath(path: string) {
  return prisma.namespace.findUnique({ where: { path } });
}

// ============================================================
// Create
// ============================================================

export interface CreateNamespaceData {
  path: string;
  description?: string | null;
  platforms: string[];
}

export async function createNamespace(data: CreateNamespaceData) {
  return prisma.namespace.create({
    data: {
      path: data.path,
      description: data.description ?? null,
      platforms: data.platforms as any,
    },
  });
}

// ============================================================
// Update
// ============================================================

export interface UpdateNamespaceData {
  path?: string;
  description?: string;
  platforms?: string[];
}

export async function updateNamespace(id: string, data: UpdateNamespaceData) {
  const update: any = {};
  if (data.path !== undefined) update.path = data.path;
  if (data.description !== undefined) update.description = data.description;
  if (data.platforms !== undefined) update.platforms = data.platforms;

  return prisma.namespace.update({
    where: { id },
    data: update,
    include: {
      _count: {
        select: { keys: { where: { deletedAt: null } } },
      },
    },
  });
}

// ============================================================
// Keys in Namespace
// ============================================================

export async function getKeysInNamespace(namespaceId: string) {
  return prisma.translationKey.findMany({
    where: { namespaceId, deletedAt: null },
    include: {
      values: { orderBy: { version: "desc" } },
    },
    orderBy: { keyName: "asc" },
  });
}
