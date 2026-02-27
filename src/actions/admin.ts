"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import bcrypt from "bcryptjs";

// ─── Get All Users ───────────────────────────────────────

export async function getUsers() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, phone: true, role: true, createdAt: true },
  });
}

// ─── Create User ─────────────────────────────────────────

export async function createUser(data: { name: string; phone: string; password: string; role: string }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const hash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: { name: data.name, phone: data.phone, passwordHash: hash, role: data.role as any },
  });

  await logActivity((session.user as any).id, "CREATE", "User", user.id, null, { name: data.name, phone: data.phone, role: data.role });
  return user;
}

// ─── Update User ─────────────────────────────────────────

export async function updateUser(id: string, data: { name?: string; phone?: string; role?: string }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("User not found");

  const updated = await prisma.user.update({ where: { id }, data: data as any });

  await logActivity((session.user as any).id, "UPDATE", "User", id, { name: existing.name, role: existing.role }, { name: updated.name, role: updated.role });
  return updated;
}

// ─── Reset Password ──────────────────────────────────────

export async function resetPassword(id: string, newPassword: string) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash: hash } });

  await logActivity((session.user as any).id, "PASSWORD_RESET", "User", id, null, null);
}

// ─── Get All Centers ─────────────────────────────────────

export async function getCenters() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return prisma.center.findMany({ orderBy: { centerName: "asc" } });
}

// ─── Create Center ───────────────────────────────────────

export async function createCenter(data: { centerName: string; locationType: string; address?: string }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const center = await prisma.center.create({ data: data as any });
  await logActivity((session.user as any).id, "CREATE", "Center", center.id, null, { centerName: data.centerName });
  return center;
}

// ─── Update Center ───────────────────────────────────────

export async function updateCenter(id: string, data: { centerName?: string; locationType?: string; address?: string }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const updated = await prisma.center.update({ where: { id }, data: data as any });
  await logActivity((session.user as any).id, "UPDATE", "Center", id, null, { centerName: updated.centerName });
  return updated;
}

// ─── Delete Center ───────────────────────────────────────

export async function deleteCenter(id: string) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.center.delete({ where: { id } });
  await logActivity((session.user as any).id, "DELETE", "Center", id, null, null);
}

// ─── User-Center Mapping ────────────────────────────────

export async function getMappings() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  return prisma.userCenterMapping.findMany({
    include: {
      user: { select: { id: true, name: true, phone: true, role: true } },
      center: { select: { id: true, centerName: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
}

export async function addMapping(userId: string, centerId: string) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const mapping = await prisma.userCenterMapping.create({ data: { userId, centerId } });
  await logActivity((session.user as any).id, "MAP", "UserCenterMapping", mapping.id, null, { userId, centerId });
  return mapping;
}

export async function removeMapping(id: string) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.userCenterMapping.delete({ where: { id } });
  await logActivity((session.user as any).id, "UNMAP", "UserCenterMapping", id, null, null);
}

// ─── Activity Logs ───────────────────────────────────────

export async function getActivityLogs(limit = 100) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, role: true } } },
  });
}

// ─── Entity Activity Logs (for inline display) ──────────

export async function getEntityActivityLogs(entityType: string, entityId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.activityLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, role: true } } },
  });
}
