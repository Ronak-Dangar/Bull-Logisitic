import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── POST: Subscribe ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}

// ─── DELETE: Unsubscribe ──────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint } = body;

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
