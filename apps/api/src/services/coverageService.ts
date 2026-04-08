import { prisma } from "@hato-tms/db";

// ============================================================
// Coverage stats
// ============================================================

export async function getNamespacesWithKeys() {
  return prisma.namespace.findMany({
    where: { isActive: true },
    include: {
      keys: {
        where: { deletedAt: null },
        include: {
          values: { orderBy: { version: "desc" } },
        },
      },
    },
    orderBy: { path: "asc" },
  });
}

// ============================================================
// Missing keys report
// ============================================================

export interface MissingKeysParams {
  namespace?: string;
  locale?: string;
}

export async function getMissingKeys(params: MissingKeysParams) {
  const where: any = { deletedAt: null };
  if (params.namespace) {
    where.namespace = { path: { startsWith: params.namespace } };
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
