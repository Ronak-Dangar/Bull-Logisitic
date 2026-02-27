import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const factory = await prisma.factory.create({
    data: { factoryName: data.factoryName, location: data.location || null },
  });

  await logActivity((session.user as any).id, "CREATE", "Factory", factory.id, null, { factoryName: data.factoryName });
  return NextResponse.json(factory);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.factory.delete({ where: { id } });
  await logActivity((session.user as any).id, "DELETE", "Factory", id, null, null);
  return NextResponse.json({ success: true });
}
