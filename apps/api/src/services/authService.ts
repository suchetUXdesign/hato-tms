import { prisma } from "@hato-tms/db";

// ============================================================
// User Lookups
// ============================================================

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, apiToken: true, createdAt: true },
  });
}

export async function getUserActiveById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isActive: true },
  });
}

// ============================================================
// API Token
// ============================================================

export async function setApiToken(id: string, apiToken: string) {
  return prisma.user.update({
    where: { id },
    data: { apiToken },
    select: { id: true, email: true, name: true, role: true, apiToken: true, createdAt: true },
  });
}

export async function updateApiToken(id: string, apiToken: string) {
  await prisma.user.update({
    where: { id },
    data: { apiToken },
  });
}

// ============================================================
// User List (reviewer picker)
// ============================================================

export async function listAllUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}
