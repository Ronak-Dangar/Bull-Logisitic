import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendPushToUser } from "@/lib/webpush";

// GET /api/push/test — sends a test notification to the currently logged-in user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  try {
    await sendPushToUser(user.id, {
      title: "🔔 Test Notification",
      body: `Hello ${user.name}! Push notifications are working.`,
      url: "/",
    });
    return NextResponse.json({ ok: true, message: "Test notification sent" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
