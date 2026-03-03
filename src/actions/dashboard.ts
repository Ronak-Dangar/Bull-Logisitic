"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function getDashboardKPIs() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [totalRequests, inTransit, completedToday, overToNext] = await Promise.all([
    prisma.masterRequest.count(),
    prisma.deliveryDetail.count({ where: { status: "IN_TRANSIT" } }),
    prisma.deliveryDetail.count({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: todayStart },
      },
    }),
    prisma.masterRequest.count({ where: { status: "OVER_TO_NEXT" } }),
  ]);

  return {
    totalRequests,
    inTransit,
    completedToday,
    overToNext,
  };
}

export async function getStatusDistribution() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const statuses = await prisma.masterRequest.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return statuses.map((s: any) => ({
    name: s.status.replace(/_/g, " "),
    value: s._count.status,
  }));
}

export async function getRecentActivity(limit = 20) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, role: true } } },
  });
}

export async function getRecentRequests(limit = 5) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.masterRequest.findMany({
    where: {
      status: { not: "PROCESSED" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      cm: { select: { name: true } },
      _count: { select: { childPickups: true } },
    },
  });
}

export async function undoActivity(logId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const log = await prisma.activityLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("Activity not found");

  const ageMs = Date.now() - new Date(log.createdAt).getTime();
  if (ageMs > 60000) throw new Error("Undo time window expired (1 min)");

  if (!log.oldValue || typeof log.oldValue !== "object") {
    throw new Error("Cannot undo this action (missing previous state)");
  }

  const { entityId, entityType, oldValue } = log;

  // Perform dynamic update using Prisma generic operations
  // Note: Only UPDATE or STATUS_CHANGE are typically safe to undo this way
  if (log.action === "UPDATE" || log.action === "STATUS_CHANGE") {
    // Note: this assumes oldValue contains valid Prisma data fields
    const dataToRestore = oldValue as Record<string, any>;
    
    // We conditionally try to update based on entityType
    switch (entityType) {
      case "DeliveryDetail":
        await prisma.deliveryDetail.update({ where: { id: entityId }, data: dataToRestore });
        break;
      case "MasterRequest":
        await prisma.masterRequest.update({ where: { id: entityId }, data: dataToRestore });
        break;
      case "ChildPickup":
        await prisma.childPickup.update({ where: { id: entityId }, data: dataToRestore });
        break;
      default:
        throw new Error(`Undo not supported for ${entityType}`);
    }
  } else if (log.action === "CREATE") {
     switch (entityType) {
      case "DeliveryDetail":
        await prisma.deliveryDetail.delete({ where: { id: entityId } });
        break;
      case "MasterRequest":
        await prisma.masterRequest.delete({ where: { id: entityId } });
        break;
      default:
        throw new Error(`Undo not supported for Create ${entityType}`);
    }
  }

  // Delete the original log and log an UNDO activity, or just delete it
  await prisma.activityLog.delete({ where: { id: logId } });

  return { success: true };
}
