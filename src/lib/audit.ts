"use server";

import { prisma } from "@/lib/prisma";

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null
) {
  try {
    // Validate userId exists before insert to avoid FK errors
    if (!userId) {
      console.warn("[audit] logActivity skipped — no userId provided");
      return;
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      console.warn(`[audit] logActivity skipped — userId "${userId}" not found in users table`);
      return;
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ? (oldValue as any) : undefined,
        newValue: newValue ? (newValue as any) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] logActivity failed:", err);
    // Never crash the caller — activity logging is non-critical
  }
}
