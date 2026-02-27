"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendPushToUser } from "@/lib/webpush";

export async function getMessages(masterReqId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.requestMessage.findMany({
    where: { masterReqId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true, role: true } } },
  });
}

export async function sendMessage(masterReqId: string, messageBody: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const message = await prisma.requestMessage.create({
    data: { masterReqId, senderId: user.id, messageBody },
    include: { sender: { select: { name: true, role: true } } },
  });

  // Get request participants to notify (CM + anyone who messaged before, except sender)
  const masterReq = await prisma.masterRequest.findUnique({
    where: { id: masterReqId },
    select: { cmId: true, commodity: true },
  });
  if (masterReq) {
    // Always notify the CM (unless they sent the message)
    if (masterReq.cmId !== user.id) {
      sendPushToUser(masterReq.cmId, {
        title: `💬 New Message from ${user.name}`,
        body: messageBody.length > 60 ? messageBody.slice(0, 57) + "..." : messageBody,
        url: "/pickups",
      }).catch(console.error);
    }
  }

  return message;
}

export async function getMessageRequests() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const where: any = {};
  if (user.role === "CM") {
    where.cmId = user.id;
  }

  return prisma.masterRequest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      commodity: true,
      deliveryLocation: true,
      status: true,
      cm: { select: { name: true } },
      _count: { select: { messages: true } },
    },
  });
}
