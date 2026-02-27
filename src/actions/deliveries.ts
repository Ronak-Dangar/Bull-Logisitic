"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { DeliveryStatus } from "@prisma/client";
import { sendPushToUser } from "@/lib/webpush";

// ─── Get Deliveries ─────────────────────────────────────

export async function getDeliveries(filters?: { status?: string }) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const where: any = {};
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  return prisma.deliveryDetail.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      masterRequest: {
        select: {
          id: true,
          commodity: true,
          totalEstWeight: true,
          deliveryLocation: true,
          pickupDate: true,
          status: true,
          cm: { select: { name: true } },
          childPickups: {
            orderBy: { stopSequence: "asc" as const },
            select: {
              id: true,
              stopSequence: true,
              pickupLocType: true,
              villageName: true,
              estWeight: true,
              actualWeight: true,
              estBags: true,
              actualBags: true,
              center: { select: { centerName: true } },
            },
          },
          _count: { select: { childPickups: true, messages: true } },
        },
      },
      factory: { select: { factoryName: true, location: true } },
      createdBy: { select: { name: true } },
    },
  });
}

// ─── Get single delivery ────────────────────────────────

export async function getDeliveryById(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.deliveryDetail.findUnique({
    where: { id },
    include: {
      masterRequest: {
        include: {
          cm: { select: { name: true, phone: true } },
          childPickups: {
            orderBy: { stopSequence: "asc" },
            include: { center: { select: { centerName: true } } },
          },
        },
      },
      factory: { select: { factoryName: true, location: true } },
      createdBy: { select: { name: true } },
    },
  });
}

// ─── Create Delivery (triggers pickup status to PROCESSED) ──

export async function createDelivery(data: {
  masterReqId: string;
  factoryId: string;
  vehicleNumber: string;
  driverName?: string;
  driverContact?: string;
  transporterName?: string;
  transpContact?: string;
  expDeliveryDt?: string;
  ratePerTon?: number;
  advancePaid?: number;
  miscAmount?: number;
  totalBags?: number;
  invoiceNo?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  // Get total weight & factory info
  const masterReq = await prisma.masterRequest.findUnique({
    where: { id: data.masterReqId },
  });

  const factory = await prisma.factory.findUnique({
    where: { id: data.factoryId },
  });

  const totalWeight = masterReq?.totalEstWeight || 0;
  const idealPayment = data.ratePerTon ? data.ratePerTon * totalWeight : null;

  const result = await prisma.deliveryDetail.create({
    data: {
      masterReqId: data.masterReqId,
      factoryId: data.factoryId,
      vehicleNumber: data.vehicleNumber,
      driverName: data.driverName || "",
      driverContact: data.driverContact || "",
      transporterName: data.transporterName || null,
      transpContact: data.transpContact || null,
      deliveryLoc: factory?.factoryName || "",
      expDeliveryDt: data.expDeliveryDt ? new Date(data.expDeliveryDt) : null,
      ratePerTon: data.ratePerTon || null,
      totalWeightFinal: totalWeight,
      idealPayment,
      advancePaid: data.advancePaid || null,
      miscAmount: data.miscAmount || null,
      totalBags: data.totalBags || null,
      invoiceNo: data.invoiceNo || null,
      createdById: user.id,
    },
  });

  // Mark pickup request as PROCESSED with approval
  await prisma.masterRequest.update({
    where: { id: data.masterReqId },
    data: {
      status: "PROCESSED",
      shipmentId: result.id,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });

  await logActivity(user.id, "CREATE", "DeliveryDetail", result.id, null, {
    vehicleNumber: data.vehicleNumber,
    driverName: data.driverName,
    masterReqId: data.masterReqId,
    factoryId: data.factoryId,
  });

  return result;
}

// ─── Update Delivery ────────────────────────────────────

export async function updateDelivery(
  id: string,
  data: {
    vehicleNumber?: string;
    driverName?: string;
    driverContact?: string;
    transporterName?: string;
    transpContact?: string;
    expDeliveryDt?: string;
    actualDeliveryDt?: string;
    unloadingDt?: string;
    ratePerTon?: number;
    totalWeightFinal?: number;
    miscAmount?: number;
    waitingCharges?: number;
    advancePaid?: number;
    actuallyPaid?: number;
    invoiceNo?: string;
    totalBags?: number;
    status?: DeliveryStatus;
  }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const existing = await prisma.deliveryDetail.findUnique({ where: { id } });
  if (!existing) throw new Error("Delivery not found");

  // Auto-calculate ideal payment
  const ratePerTon = data.ratePerTon ?? existing.ratePerTon;
  const totalWeight = data.totalWeightFinal ?? existing.totalWeightFinal;
  const idealPayment = ratePerTon && totalWeight ? ratePerTon * totalWeight : existing.idealPayment;

  const updateData: any = { idealPayment };

  if (data.vehicleNumber !== undefined) updateData.vehicleNumber = data.vehicleNumber;
  if (data.driverName !== undefined) updateData.driverName = data.driverName;
  if (data.driverContact !== undefined) updateData.driverContact = data.driverContact;
  if (data.transporterName !== undefined) updateData.transporterName = data.transporterName;
  if (data.transpContact !== undefined) updateData.transpContact = data.transpContact;
  if (data.expDeliveryDt !== undefined) updateData.expDeliveryDt = new Date(data.expDeliveryDt);
  if (data.actualDeliveryDt !== undefined) updateData.actualDeliveryDt = new Date(data.actualDeliveryDt);
  if (data.unloadingDt !== undefined) updateData.unloadingDt = new Date(data.unloadingDt);
  if (data.ratePerTon !== undefined) updateData.ratePerTon = data.ratePerTon;
  if (data.totalWeightFinal !== undefined) updateData.totalWeightFinal = data.totalWeightFinal;
  if (data.miscAmount !== undefined) updateData.miscAmount = data.miscAmount;
  // Waiting charges are a deduction, ensure they are stored absolutely or parsed correctly
  if (data.waitingCharges !== undefined) updateData.waitingCharges = Math.abs(data.waitingCharges);

  if (data.advancePaid !== undefined) updateData.advancePaid = data.advancePaid;
  if (data.actuallyPaid !== undefined) updateData.actuallyPaid = data.actuallyPaid;
  if (data.invoiceNo !== undefined) updateData.invoiceNo = data.invoiceNo;
  if (data.totalBags !== undefined) updateData.totalBags = data.totalBags;
  if (data.status !== undefined) updateData.status = data.status;

  const updated = await prisma.deliveryDetail.update({
    where: { id },
    data: updateData,
  });

  // Build dynamic old vs new values for audit log
  const oldValuesLog: any = {};
  const newValuesLog: any = {};
  
  Object.keys(updateData).forEach((key) => {
    // only log actual changes
    if (existing[key as keyof typeof existing] !== updateData[key]) {
      oldValuesLog[key] = existing[key as keyof typeof existing];
      newValuesLog[key] = updateData[key];
    }
  });

  if (Object.keys(newValuesLog).length > 0) {
    await logActivity(user.id, "UPDATE", "DeliveryDetail", id, oldValuesLog, newValuesLog);
  }

  return updated;
}

// ─── Update Delivery Status ─────────────────────────────

export async function updateDeliveryStatus(id: string, newStatus: DeliveryStatus) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const existing = await prisma.deliveryDetail.findUnique({ where: { id } });
  if (!existing) throw new Error("Delivery not found");

  const updateData: any = { status: newStatus };

  if (newStatus === "COMPLETED" && !existing.actualDeliveryDt) {
    updateData.actualDeliveryDt = new Date();
  }
  if (newStatus === "UNLOADING" && !existing.unloadingDt) {
    updateData.unloadingDt = new Date();
  }

  const updated = await prisma.deliveryDetail.update({
    where: { id },
    data: updateData,
  });

  await logActivity(user.id, "STATUS_CHANGE", "DeliveryDetail", id, {
    status: existing.status,
  }, {
    status: newStatus,
  });

  // Notify the CM who owns this delivery's request
  const masterReq = await prisma.masterRequest.findUnique({
    where: { id: existing.masterReqId },
    select: { cmId: true, commodity: true },
  });
  if (masterReq) {
    sendPushToUser(masterReq.cmId, {
      title: "🚛 Delivery Status Update",
      body: `Your ${masterReq.commodity} delivery is now: ${newStatus.replace(/_/g, " ")}`,
      url: "/deliveries",
    }).catch(console.error);
  }

  return updated;
}
