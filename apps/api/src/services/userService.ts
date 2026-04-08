import { prisma } from "@hato-tms/db";

// ============================================================
// List
// ============================================================

export interface ListUsersParams {
  search?: string;
  role?: string;
}

export async function listUsers(params: ListUsersParams) {
  const where: any = {};

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.role) {
    where.role = params.role;
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

// ============================================================
// Single Lookup
// ============================================================

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

// ============================================================
// Create
// ============================================================

export interface CreateUserData {
  email: string;
  name: string;
  role: string;
  apiToken: string;
}

export async function createUser(data: CreateUserData) {
  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role as any,
      apiToken: data.apiToken,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

// ============================================================
// Update
// ============================================================

export interface UpdateUserData {
  name?: string;
  role?: string;
  isActive?: boolean;
}

export async function updateUser(id: string, data: UpdateUserData) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role as any }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ============================================================
// Deactivate
// ============================================================

export async function deactivateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });
}
