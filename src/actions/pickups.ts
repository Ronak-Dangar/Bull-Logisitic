"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { RequestStatus } from "@prisma/client";
import { sendPushToRoles, sendPushToUser } from "@/lib/webpush";

// ─── Permission helper ───────────────────────────────────

async function getUserCenterIds(userId: string): Promise<string[]> {
  const mappings = await prisma.userCenterMapping.findMany({
    where: { userId },
    select: { centerId: true },
  });
  return mappings.map((m) => m.centerId);
}

// ─── Helper: Is pickup in an approved / in-progress state? ───
// If yes, CM modifications require urgent LM approval first.

function requiresUrgentApproval(status: RequestStatus): boolean {
  return status === "FINDING_VEHICLE" || status === "PROCESSED";
}

// ─── Helper: Notify all LMs of a CM activity ────────────────

async function notifyLMsOfCMActivity(
  cmName: string,
  action: string,
  details: string,
  masterReqId: string,
  excludeUserId?: string
) {
  sendPushToRoles(
    ["LM", "ADMIN"],
    {
      title: `📋 Pickup Updated by CM`,
      body: `${cmName} ${action} — ${details}`,
      url: `/pickups`,
    },
    excludeUserId
  ).catch(console.error);
}

// ─── Get Pickups (with CM permission gate) ───────────────

export async function getPickups(filters?: {
  status?: string;
  search?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const where: any = {};

  // CM permission gate: only see requests with their centers
  if (user.role === "CM") {
    where.cmId = user.id;
  }

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { commodity: { contains: filters.search, mode: "insensitive" } },
      { deliveryLocation: { contains: filters.search, mode: "insensitive" } },
      { cm: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return prisma.masterRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      cm: { select: { name: true, phone: true } },
      approvedBy: { select: { name: true } },
      factory: { select: { factoryName: true, location: true } },
      childPickups: {
        orderBy: { stopSequence: "asc" },
        include: { center: { select: { centerName: true } } },
      },
      deliveryDetail: {
        select: {
          id: true,
          status: true,
          factory: { select: { factoryName: true } },
        },
      },
      urgentApprovals: {
        where: { status: "PENDING" },
        select: { id: true, changeType: true, createdAt: true },
      },
      _count: { select: { childPickups: true, messages: true } },
    },
  });
}

// ─── Get single pickup ──────────────────────────────────

export async function getPickupById(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.masterRequest.findUnique({
    where: { id },
    include: {
      cm: { select: { name: true, phone: true } },
      approvedBy: { select: { name: true } },
      factory: { select: { factoryName: true, location: true } },
      childPickups: {
        orderBy: { stopSequence: "asc" },
        include: { center: { select: { centerName: true } } },
      },
      deliveryDetail: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { name: true, role: true } } },
      },
    },
  });
}

// ─── Create Master Request ──────────────────────────────

export async function createMasterRequest(data: {
  commodity: string;
  factoryId: string;
  pickupDate: string;
  note?: string;
  children: {
    pickupLocType: string;
    centerId?: string;
    villageName?: string;
    supervisorName?: string;
    estWeight: number;
    estBags: number;
    stopSequence: number;
  }[];
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const totalEstWeight = data.children.reduce((sum, c) => sum + (c.estWeight || 0), 0);
  const totalEstBags = data.children.reduce((sum, c) => sum + (c.estBags || 0), 0);

  // Get factory name for deliveryLocation
  let factory = null;
  if (data.factoryId) {
    factory = await prisma.factory.findUnique({ where: { id: data.factoryId } });
  }

  const result = await prisma.masterRequest.create({
    data: {
      cmId: user.id,
      commodity: data.commodity,
      totalEstWeight,
      totalEstBags,
      factoryId: data.factoryId || null,
      deliveryLocation: factory?.factoryName || "",
      pickupDate: new Date(data.pickupDate),
      note: data.note || null,
      childPickups: {
        create: data.children.map((c) => ({
          pickupLocType: c.pickupLocType as any,
          centerId: c.pickupLocType === "CENTER" ? c.centerId : null,
          villageName: c.pickupLocType === "BFH" ? c.villageName : null,
          supervisorName: c.supervisorName || null,
          estWeight: c.estWeight,
          estBags: c.estBags || 0,
          stopSequence: c.stopSequence,
        })),
      },
    },
    include: { childPickups: true },
  });

  await logActivity(user.id, "CREATE", "MasterRequest", result.id, null, {
    commodity: data.commodity,
    totalEstWeight,
    totalEstBags,
    factoryId: data.factoryId,
    childCount: data.children.length,
  });

  // Notify LM and ADMIN about new pickup request
  sendPushToRoles(["LM", "ADMIN"], {
    title: "📦 New Pickup Request",
    body: `${user.name} submitted a new ${data.commodity} pickup request with ${data.children.length} stop(s)`,
    url: "/pickups",
  }, user.id).catch(console.error);

  return result;
}

// ─── Update Child Pickup (with weight roll-up) ──────────

export async function updateChildPickup(
  childId: string,
  data: { estWeight?: number; estBags?: number; actualWeight?: number; actualBags?: number; supervisorName?: string; loadingStatus?: string; centerId?: string; villageName?: string }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const existing = await prisma.childPickup.findUnique({
    where: { id: childId },
    include: { parent: { select: { status: true, cmId: true } } },
  });
  if (!existing) throw new Error("Child pickup not found");

  const isCM = user.role === "CM";
  const parentStatus = existing.parent?.status as RequestStatus;

  // If CM is modifying an already-approved request → create urgent approval
  if (isCM && requiresUrgentApproval(parentStatus)) {
    const approval = await prisma.urgentApproval.create({
      data: {
        masterReqId: existing.parentId,
        requestedById: user.id,
        changeType: "UPDATE_STOP",
        pendingData: {
          type: "updateChildPickup",
          childId,
          changes: data,
        } as any,
      },
    });

    await logActivity(user.id, "URGENT_APPROVAL_REQUESTED", "ChildPickup", childId, null, {
      pendingChanges: data,
      approvalId: approval.id,
    });

    // Notify LMs of urgent approval needed
    sendPushToRoles(["LM", "ADMIN"], {
      title: "🚨 URGENT: Approval Required",
      body: `${user.name} modified a stop on an approved pickup — approval needed!`,
      url: `/pickups`,
    }, user.id).catch(console.error);

    return { urgentApproval: true, approvalId: approval.id };
  }

  // Normal update (non-approved request, or LM/Admin editing)
  const updated = await prisma.childPickup.update({
    where: { id: childId },
    data: {
      ...(data.estWeight !== undefined && { estWeight: data.estWeight }),
      ...(data.estBags !== undefined && { estBags: data.estBags }),
      ...(data.actualWeight !== undefined && { actualWeight: data.actualWeight }),
      ...(data.actualBags !== undefined && { actualBags: data.actualBags }),
      ...(data.supervisorName !== undefined && { supervisorName: data.supervisorName }),
      ...(data.loadingStatus !== undefined && { loadingStatus: data.loadingStatus as any }),
      ...(data.centerId !== undefined && { centerId: data.centerId }),
      ...(data.villageName !== undefined && { villageName: data.villageName }),
    },
  });

  // Weight & Bags roll-up
  if (data.estWeight !== undefined || data.actualWeight !== undefined || data.estBags !== undefined || data.actualBags !== undefined) {
    const masterWithChildren = await prisma.masterRequest.findUnique({
      where: { id: existing.parentId },
      include: { childPickups: { select: { actualWeight: true, estWeight: true, actualBags: true, estBags: true } } },
    });

    if (masterWithChildren) {
      const finalWeight = masterWithChildren.childPickups.reduce(
        (sum: number, c: any) => sum + (c.actualWeight || c.estWeight || 0),
        0
      );
      const finalBags = masterWithChildren.childPickups.reduce(
        (sum: number, c: any) => sum + (c.actualBags || c.estBags || 0),
        0
      );

      await prisma.masterRequest.update({
        where: { id: existing.parentId },
        data: { totalEstWeight: finalWeight, totalEstBags: finalBags },
      });

      // Update Delivery financials if they exist
      const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId: existing.parentId } });
      if (delivery) {
        const totalWeightInTons = finalWeight ? finalWeight / 1000 : 0;
        const idealPayment = delivery.ratePerTon ? delivery.ratePerTon * totalWeightInTons : delivery.idealPayment;
        await prisma.deliveryDetail.update({
          where: { id: delivery.id },
          data: { totalWeightFinal: finalWeight, totalBags: finalBags, idealPayment },
        });
      }
    }
  }

  await logActivity(user.id, "UPDATE", "ChildPickup", childId, {
    estWeight: existing.estWeight,
    estBags: existing.estBags,
    actualWeight: existing.actualWeight,
    actualBags: existing.actualBags,
    loadingStatus: existing.loadingStatus,
  }, {
    estWeight: updated.estWeight,
    estBags: updated.estBags,
    actualWeight: updated.actualWeight,
    actualBags: updated.actualBags,
    loadingStatus: updated.loadingStatus,
  });

  // If CM made the change → notify LMs
  if (isCM) {
    const changedFields = Object.keys(data).join(", ");
    notifyLMsOfCMActivity(
      user.name,
      "updated a stop",
      `Changed: ${changedFields}`,
      existing.parentId,
      user.id
    );
  }

  return updated;
}

// ─── Update Request Status ──────────────────────────────

export async function updateRequestStatus(requestId: string, newStatus: RequestStatus) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const existing = await prisma.masterRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new Error("Request not found");

  const updateData: any = { status: newStatus };

  // If status is PROCESSED, record approval
  if (newStatus === "PROCESSED" && !existing.approvedById) {
    updateData.approvedById = user.id;
    updateData.approvedAt = new Date();
  }

  const updated = await prisma.masterRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  await logActivity(user.id, "STATUS_CHANGE", "MasterRequest", requestId, {
    status: existing.status,
  }, {
    status: newStatus,
  });

  // Notify the CM about their request status change
  let notifTitle = "📋 Pickup Request Updated";
  let notifBody = `Your pickup request is now: ${newStatus.replace(/_/g, " ")}`;

  if (newStatus === "UNABLE_TO_FIND") {
    notifTitle = "🚨 Vehicle Not Found";
    notifBody = "We're unable to find a vehicle for your pickup. Please try finding one yourself and keep us updated.";
  }

  sendPushToUser(existing.cmId, {
    title: notifTitle,
    body: notifBody,
    url: "/pickups",
  }).catch(console.error);

  // If CM triggered a status change → also notify LMs
  if (user.role === "CM") {
    notifyLMsOfCMActivity(
      user.name,
      `changed request status to ${newStatus.replace(/_/g, " ")}`,
      `Request ID: ${requestId}`,
      requestId,
      user.id
    );
  }

  return updated;
}

// ─── Get Centers for current user ───────────────────────

export async function getUserCenters() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  if (user.role === "ADMIN" || user.role === "LM") {
    return prisma.center.findMany({ orderBy: { centerName: "asc" } });
  }

  const centerIds = await getUserCenterIds(user.id);
  return prisma.center.findMany({
    where: { id: { in: centerIds } },
    orderBy: { centerName: "asc" },
  });
}

// ─── Get Factories ──────────────────────────────────────

export async function getFactories() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return prisma.factory.findMany({ orderBy: { factoryName: "asc" } });
}

// ─── Add Child Pickup (to existing MasterRequest) ───────

export async function addChildPickup(data: {
  masterReqId: string;
  pickupLocType: "CENTER" | "BFH";
  centerId?: string;
  villageName?: string;
  estWeight: number;
  estBags: number;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const masterReq = await prisma.masterRequest.findUnique({
    where: { id: data.masterReqId },
    include: { childPickups: true },
  });
  if (!masterReq) throw new Error("Request not found");

  const isCM = user.role === "CM";

  // If CM is adding a stop to an already-approved request → route through urgent approval
  if (isCM && requiresUrgentApproval(masterReq.status)) {
    const nextStopSequence = masterReq.childPickups.length + 1;

    const approval = await prisma.urgentApproval.create({
      data: {
        masterReqId: data.masterReqId,
        requestedById: user.id,
        changeType: "ADD_STOP",
        pendingData: {
          type: "addChildPickup",
          stopData: { ...data, stopSequence: nextStopSequence },
        } as any,
      },
    });

    await logActivity(user.id, "URGENT_APPROVAL_REQUESTED", "MasterRequest", data.masterReqId, null, {
      changeType: "ADD_STOP",
      pendingData: data,
      approvalId: approval.id,
    });

    // Push to LMs
    sendPushToRoles(["LM", "ADMIN"], {
      title: "🚨 URGENT: New Stop Needs Approval",
      body: `${user.name} wants to add a new stop to an approved pickup request — review required!`,
      url: `/pickups`,
    }, user.id).catch(console.error);

    return { urgentApproval: true, approvalId: approval.id };
  }

  // Normal path: non-approved request or LM/Admin adding a stop
  const nextStopSequence = masterReq.childPickups.length + 1;

  const newChild = await prisma.childPickup.create({
    data: {
      parentId: data.masterReqId,
      pickupLocType: data.pickupLocType as any,
      centerId: data.centerId,
      villageName: data.villageName,
      estWeight: data.estWeight,
      estBags: data.estBags,
      stopSequence: nextStopSequence,
    },
  });

  // Update total weight & bags on master request
  const oldWeight = masterReq.totalEstWeight;
  const newWeight = masterReq.totalEstWeight + data.estWeight;
  const oldBags = masterReq.totalEstBags;
  const newBags = masterReq.totalEstBags + data.estBags;

  await prisma.masterRequest.update({
    where: { id: data.masterReqId },
    data: { totalEstWeight: newWeight, totalEstBags: newBags },
  });

  await logActivity(user.id, "UPDATE", "MasterRequest", masterReq.id, {
    totalEstWeight: oldWeight,
    totalEstBags: oldBags,
  }, {
    totalEstWeight: newWeight,
    totalEstBags: newBags,
    addedChild: true,
  });

  await logActivity(user.id, "CREATE", "ChildPickup", newChild.id, null, newChild);

  // If CM added the stop → notify LMs
  if (isCM) {
    const locationLabel = data.pickupLocType === "BFH"
      ? `BFH / ${data.villageName || "village"}`
      : `Center stop`;
    notifyLMsOfCMActivity(
      user.name,
      "added a new stop",
      `${locationLabel}, Est. weight: ${data.estWeight}kg`,
      data.masterReqId,
      user.id
    );
  }

  return { success: true };
}

// ─── Remove Child Pickup ─────────────────────────────────

export async function removeChildPickup(childId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const existing = await prisma.childPickup.findUnique({
    where: { id: childId },
    include: {
      parent: {
        include: { childPickups: { select: { id: true } } },
      },
    },
  });
  if (!existing) throw new Error("Child pickup not found");

  if (existing.parent.childPickups.length <= 1) {
    throw new Error("Cannot remove the last stop from a pickup request");
  }

  const isCM = user.role === "CM";
  const parentStatus = existing.parent.status as RequestStatus;

  if (isCM && requiresUrgentApproval(parentStatus)) {
    const approval = await prisma.urgentApproval.create({
      data: {
        masterReqId: existing.parentId,
        requestedById: user.id,
        changeType: "DELETE_STOP",
        pendingData: {
          type: "removeChildPickup",
          childId,
          snapshot: {
            pickupLocType: existing.pickupLocType,
            centerId: existing.centerId,
            villageName: existing.villageName,
            estWeight: existing.estWeight,
            estBags: existing.estBags,
            stopSequence: existing.stopSequence,
          },
        } as any,
      },
    });

    sendPushToRoles(["LM", "ADMIN"], {
      title: "🚨 URGENT: Approval Required",
      body: `${user.name} wants to remove a stop from an approved pickup — review required!`,
      url: `/pickups`,
    }, user.id).catch(console.error);

    return { urgentApproval: true, approvalId: approval.id };
  }

  // Normal delete
  await prisma.childPickup.delete({ where: { id: childId } });

  // Recalculate totals
  const masterWithChildren = await prisma.masterRequest.findUnique({
    where: { id: existing.parentId },
    include: { childPickups: { select: { actualWeight: true, estWeight: true, actualBags: true, estBags: true } } },
  });
  if (masterWithChildren) {
    const finalWeight = masterWithChildren.childPickups.reduce((sum: number, c: any) => sum + (c.actualWeight || c.estWeight || 0), 0);
    const finalBags = masterWithChildren.childPickups.reduce((sum: number, c: any) => sum + (c.actualBags || c.estBags || 0), 0);
    await prisma.masterRequest.update({ where: { id: existing.parentId }, data: { totalEstWeight: finalWeight, totalEstBags: finalBags } });
    const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId: existing.parentId } });
    if (delivery) {
      const totalWeightInTons = finalWeight ? finalWeight / 1000 : 0;
      const idealPayment = delivery.ratePerTon ? delivery.ratePerTon * totalWeightInTons : delivery.idealPayment;
      await prisma.deliveryDetail.update({ where: { id: delivery.id }, data: { totalWeightFinal: finalWeight, totalBags: finalBags, idealPayment } });
    }
  }

  await logActivity(user.id, "DELETE", "ChildPickup", childId, { stopSequence: existing.stopSequence, estWeight: existing.estWeight }, null);
  return { success: true };
}

// ─── Update Master Request Factory (Drop Location) ───────

export async function updateMasterRequestFactory(masterReqId: string, newFactoryId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  const existing = await prisma.masterRequest.findUnique({
    where: { id: masterReqId },
    include: { factory: { select: { factoryName: true } } },
  });
  if (!existing) throw new Error("Request not found");

  const newFactory = await prisma.factory.findUnique({ where: { id: newFactoryId } });
  if (!newFactory) throw new Error("Factory not found");

  const isCM = user.role === "CM";
  const status = existing.status as RequestStatus;

  if (isCM && requiresUrgentApproval(status)) {
    const approval = await prisma.urgentApproval.create({
      data: {
        masterReqId,
        requestedById: user.id,
        changeType: "UPDATE_FACTORY",
        pendingData: {
          type: "updateMasterRequestFactory",
          newFactoryId,
          newFactoryName: newFactory.factoryName,
          oldFactoryId: existing.factoryId,
          oldFactoryName: existing.factory?.factoryName,
        } as any,
      },
    });

    sendPushToRoles(["LM", "ADMIN"], {
      title: "🚨 URGENT: Approval Required",
      body: `${user.name} wants to change the drop location on an approved pickup — review required!`,
      url: `/pickups`,
    }, user.id).catch(console.error);

    return { urgentApproval: true, approvalId: approval.id };
  }

  // Normal update
  await prisma.masterRequest.update({
    where: { id: masterReqId },
    data: { factoryId: newFactoryId, deliveryLocation: newFactory.factoryName },
  });
  const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId } });
  if (delivery) {
    await prisma.deliveryDetail.update({ where: { id: delivery.id }, data: { deliveryLoc: newFactory.factoryName } });
  }

  await logActivity(user.id, "UPDATE", "MasterRequest", masterReqId,
    { factoryId: existing.factoryId, deliveryLocation: existing.factory?.factoryName },
    { factoryId: newFactoryId, deliveryLocation: newFactory.factoryName }
  );
  return { success: true };
}

// ─── Get Pending Urgent Approvals ────────────────────────

export async function getPendingUrgentApprovals() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  // Only LM and ADMIN can view urgent approvals
  if (user.role === "CM") return [];

  return prisma.urgentApproval.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      masterRequest: {
        select: {
          id: true,
          commodity: true,
          status: true,
          cm: { select: { name: true } },
          factory: { select: { factoryName: true } },
        },
      },
      requestedBy: { select: { name: true, phone: true } },
    },
  });
}

// ─── Resolve Urgent Approval (Approve or Deny) ───────────

export async function resolveUrgentApproval(approvalId: string, approve: boolean) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = session.user as any;

  if (user.role === "CM") throw new Error("Only LM or Admin can resolve urgent approvals");

  const approval = await prisma.urgentApproval.findUnique({
    where: { id: approvalId },
    include: {
      masterRequest: { include: { childPickups: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  if (!approval) throw new Error("Urgent approval not found");
  if (approval.status !== "PENDING") throw new Error("This approval has already been resolved");

  // Update the approval record
  await prisma.urgentApproval.update({
    where: { id: approvalId },
    data: {
      status: approve ? "APPROVED" : "DENIED",
      resolvedById: user.id,
      resolvedAt: new Date(),
    },
  });

  if (approve) {
    // Replay the pending action to the database
    const pendingData = approval.pendingData as any;

    if (pendingData.type === "addChildPickup") {
      const stopData = pendingData.stopData;
      await prisma.childPickup.create({
        data: {
          parentId: stopData.masterReqId,
          pickupLocType: (stopData.pickupLocType === "COLLECTION_CENTER" ? "CENTER" : stopData.pickupLocType) as any,
          centerId: stopData.centerId || null,
          villageName: stopData.villageName || null,
          estWeight: stopData.estWeight,
          estBags: stopData.estBags || 0,
          stopSequence: stopData.stopSequence,
        },
      });

      // Update master request totals
      const master = approval.masterRequest;
      const finalWeight = master.totalEstWeight + stopData.estWeight;
      const finalBags = master.totalEstBags + (stopData.estBags || 0);

      await prisma.masterRequest.update({
        where: { id: master.id },
        data: {
          totalEstWeight: finalWeight,
          totalEstBags: finalBags,
        },
      });

      // Update delivery financials
      const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId: master.id } });
      if (delivery) {
        const totalWeightInTons = finalWeight ? finalWeight / 1000 : 0;
        const idealPayment = delivery.ratePerTon ? delivery.ratePerTon * totalWeightInTons : delivery.idealPayment;
        await prisma.deliveryDetail.update({
          where: { id: delivery.id },
          data: { totalWeightFinal: finalWeight, totalBags: finalBags, idealPayment },
        });
      }
    } else if (pendingData.type === "updateChildPickup") {
      const { childId, changes } = pendingData;
      await prisma.childPickup.update({
        where: { id: childId },
        data: {
          ...(changes.estWeight !== undefined && { estWeight: changes.estWeight }),
          ...(changes.estBags !== undefined && { estBags: changes.estBags }),
          ...(changes.actualWeight !== undefined && { actualWeight: changes.actualWeight }),
          ...(changes.actualBags !== undefined && { actualBags: changes.actualBags }),
          ...(changes.supervisorName !== undefined && { supervisorName: changes.supervisorName }),
          ...(changes.loadingStatus !== undefined && { loadingStatus: changes.loadingStatus as any }),
          ...(changes.centerId !== undefined && { centerId: changes.centerId }),
          ...(changes.villageName !== undefined && { villageName: changes.villageName }),
        },
      });

      // Recalculate totals and update master request / delivery
      const masterWithChildren = await prisma.masterRequest.findUnique({
        where: { id: approval.masterReqId },
        include: { childPickups: { select: { actualWeight: true, estWeight: true, actualBags: true, estBags: true } } },
      });

      if (masterWithChildren) {
        const finalWeight = masterWithChildren.childPickups.reduce(
          (sum: number, c: any) => sum + (c.actualWeight || c.estWeight || 0),
          0
        );
        const finalBags = masterWithChildren.childPickups.reduce(
          (sum: number, c: any) => sum + (c.actualBags || c.estBags || 0),
          0
        );

        await prisma.masterRequest.update({
          where: { id: masterWithChildren.id },
          data: { totalEstWeight: finalWeight, totalEstBags: finalBags },
        });

        // Update delivery financials if they exist
        const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId: masterWithChildren.id } });
        if (delivery) {
          const totalWeightInTons = finalWeight ? finalWeight / 1000 : 0;
          const idealPayment = delivery.ratePerTon ? delivery.ratePerTon * totalWeightInTons : delivery.idealPayment;
          await prisma.deliveryDetail.update({
            where: { id: delivery.id },
            data: { totalWeightFinal: finalWeight, totalBags: finalBags, idealPayment },
          });
        }
      }
    } else if (pendingData.type === "removeChildPickup") {
      const { childId } = pendingData;
      const child = await prisma.childPickup.findUnique({ where: { id: childId } });
      if (child) {
        await prisma.childPickup.delete({ where: { id: childId } });
        const masterWithChildren = await prisma.masterRequest.findUnique({
          where: { id: approval.masterReqId },
          include: { childPickups: { select: { actualWeight: true, estWeight: true, actualBags: true, estBags: true } } },
        });
        if (masterWithChildren) {
          const finalWeight = masterWithChildren.childPickups.reduce((sum: number, c: any) => sum + (c.actualWeight || c.estWeight || 0), 0);
          const finalBags = masterWithChildren.childPickups.reduce((sum: number, c: any) => sum + (c.actualBags || c.estBags || 0), 0);
          await prisma.masterRequest.update({ where: { id: approval.masterReqId }, data: { totalEstWeight: finalWeight, totalEstBags: finalBags } });
          const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId: approval.masterReqId } });
          if (delivery) {
            const totalWeightInTons = finalWeight ? finalWeight / 1000 : 0;
            const idealPayment = delivery.ratePerTon ? delivery.ratePerTon * totalWeightInTons : delivery.idealPayment;
            await prisma.deliveryDetail.update({ where: { id: delivery.id }, data: { totalWeightFinal: finalWeight, totalBags: finalBags, idealPayment } });
          }
        }
      }
    } else if (pendingData.type === "updateMasterRequestFactory") {
      const { newFactoryId, newFactoryName } = pendingData;
      await prisma.masterRequest.update({
        where: { id: approval.masterReqId },
        data: { factoryId: newFactoryId, deliveryLocation: newFactoryName },
      });
      const delivery = await prisma.deliveryDetail.findUnique({ where: { masterReqId: approval.masterReqId } });
      if (delivery) {
        await prisma.deliveryDetail.update({ where: { id: delivery.id }, data: { deliveryLoc: newFactoryName } });
      }
    }

    await logActivity(user.id, "URGENT_APPROVAL_APPROVED", "UrgentApproval", approvalId, null, {
      changeType: approval.changeType,
      requestedBy: approval.requestedBy.name,
    });

    // Notify CM that their change was approved
    sendPushToUser(approval.requestedBy.id, {
      title: "✅ Change Approved!",
      body: `Your modification to the pickup request was approved by ${user.name}`,
      url: "/pickups",
    }).catch(console.error);
  } else {
    await logActivity(user.id, "URGENT_APPROVAL_DENIED", "UrgentApproval", approvalId, null, {
      changeType: approval.changeType,
      requestedBy: approval.requestedBy.name,
    });

    // Notify CM that their change was denied
    sendPushToUser(approval.requestedBy.id, {
      title: "❌ Change Denied",
      body: `Your modification to the pickup request was denied by ${user.name}`,
      url: "/pickups",
    }).catch(console.error);
  }

  return { success: true, approved: approve };
}
