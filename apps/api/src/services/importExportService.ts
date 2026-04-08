import { prisma } from "@hato-tms/db";

// ============================================================
// Import helpers
// ============================================================

export async function getNamespaceByPath(path: string) {
  return prisma.namespace.findUnique({ where: { path } });
}

export async function createNamespace(path: string) {
  return prisma.namespace.create({ data: { path } });
}

export async function getKeysForImport(namespaceId: string) {
  return prisma.translationKey.findMany({
    where: { namespaceId, deletedAt: null },
    include: { values: { orderBy: { version: "desc" } } },
  });
}

export interface CreateImportKeyData {
  namespaceId: string;
  keyName: string;
  status: string;
  createdById: string;
  values: Array<{ locale: "TH" | "EN"; value: string; version: number }>;
}

export async function createImportKey(data: CreateImportKeyData) {
  return prisma.translationKey.create({
    data: {
      namespaceId: data.namespaceId,
      keyName: data.keyName,
      status: data.status as any,
      createdById: data.createdById,
      values: { create: data.values },
    },
  });
}

export interface CreateImportValueData {
  keyId: string;
  locale: "TH" | "EN";
  value: string;
  version: number;
  updatedById: string;
}

export async function createImportValue(data: CreateImportValueData) {
  return prisma.translationValue.create({ data });
}

// ============================================================
// Export helpers
// ============================================================

export interface ExportKeysParams {
  namespacePaths?: string[];
}

export async function getKeysForExport(params: ExportKeysParams) {
  const where: any = { deletedAt: null };
  if (params.namespacePaths && params.namespacePaths.length > 0) {
    where.namespace = { path: { in: params.namespacePaths } };
  }

  return prisma.translationKey.findMany({
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
}
