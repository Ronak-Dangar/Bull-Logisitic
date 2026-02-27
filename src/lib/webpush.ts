import webpush from "web-push";
import { prisma } from "./prisma";

// Configure VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Send a push notification to ALL subscriptions of a specific user.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...payload, icon: payload.icon ?? "/logo.png" })
      )
    )
  );

  // Clean up stale subscriptions (410 Gone / 404 Not Found)
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const err = result.reason as any;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await prisma.pushSubscription
          .delete({ where: { endpoint: subscriptions[i].endpoint } })
          .catch(() => {});
      }
    }
  }
}

/**
 * Send a push notification to ALL subscriptions of users matching given roles.
 */
export async function sendPushToRoles(
  roles: ("ADMIN" | "LM" | "CM")[],
  payload: PushPayload,
  excludeUserId?: string
) {
  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  await Promise.allSettled(users.map((u) => sendPushToUser(u.id, payload)));
}
