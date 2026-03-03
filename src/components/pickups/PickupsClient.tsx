"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, ChevronDown, MapPin, User2, Weight,
  Calendar, Package, Truck, CheckCircle, MessageSquare, Home, StickyNote, ScrollText, ChevronRight, AlertTriangle, Trash2
} from "lucide-react";
import { formatWeight, formatDate, getStatusColor, cn, timeSince } from "@/lib/utils";
import { CreatePickupModal } from "./CreatePickupModal";
import { CreateDeliveryModal } from "../deliveries/CreateDeliveryModal";
import { AddStopModal } from "./AddStopModal";
import { ChatPopup } from "../shared/ChatPopup";
import { UrgentApprovalPopup } from "./UrgentApprovalPopup";
import { updateRequestStatus, updateChildPickup } from "@/actions/pickups";
import { getEntityActivityLogs } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogDiff } from "../shared/LogDiff";

// Inline editable weight component
function EditableWeight({ child }: { child: any }) {
  const router = useRouter();
  const [val, setVal] = useState(child.actualWeight || child.estWeight || "");
  const [loading, setLoading] = useState(false);

  const handleBlur = async () => {
    const num = Number(val);
    if (isNaN(num) || num === child.actualWeight) return;
    setLoading(true);
    try {
      await updateChildPickup(child.id, { actualWeight: num });
      router.refresh();
    } catch (e) {
      console.error(e);
      setVal(child.actualWeight || child.estWeight); // revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 text-right">
      <input
        type="number"
        step="0.1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        disabled={loading}
        className="w-20 px-2 py-1 text-right bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-gray-900 dark:text-white transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-gray-500">kg</span>
    </div>
  );
}

function EditableBags({ child }: { child: any }) {
  const router = useRouter();
  const [val, setVal] = useState(child.actualBags || child.estBags || "");
  const [loading, setLoading] = useState(false);

  const handleBlur = async () => {
    const num = Number(val);
    if (isNaN(num) || num === child.actualBags) return;
    setLoading(true);
    try {
      await updateChildPickup(child.id, { actualBags: num });
      router.refresh();
    } catch (e) {
      console.error(e);
      setVal(child.actualBags || child.estBags); // revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 text-right">
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        disabled={loading}
        className="w-16 px-2 py-1 text-right bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-gray-900 dark:text-white transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-gray-500">bags</span>
    </div>
  );
}

function getPickupPointLabel(stop: any) {
  if (!stop) return "—";
  if (stop.pickupLocType === "BFH") {
    return stop.villageName || stop.center?.centerName || "BFH";
  }
  return stop.center?.centerName || "Center";
}

function getPickupRouteLabel(req: any) {
  const stops = [...(req.childPickups || [])].sort((a: any, b: any) => (a.stopSequence || 0) - (b.stopSequence || 0));
  if (stops.length === 0) return req.factory?.factoryName || req.deliveryLocation || "—";

  const fromLabel = getPickupPointLabel(stops[0]);
  const toLabel = req.deliveryDetail?.factory?.factoryName
    || req.factory?.factoryName
    || req.deliveryLocation
    || getPickupPointLabel(stops[stops.length - 1])
    || fromLabel;

  return `${fromLabel} → ${toLabel}`;
}

interface PickupsClientProps {
  pickups: any[];
  centers: any[];
  factories: any[];
  urgentApprovals?: any[];
}

export function PickupsClient({ pickups: initialPickups, centers, factories, urgentApprovals = [] }: PickupsClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isCM = (session?.user as any)?.role === "CM";
  const isLM = (session?.user as any)?.role === "LM" || (session?.user as any)?.role === "ADMIN";
  const [pickups, setPickups] = useState(initialPickups);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelivery, setShowDelivery] = useState<string | null>(null);
  const [addingStopTo, setAddingStopTo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [chatReqId, setChatReqId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<Record<string, any[]>>({});
  const [showActivity, setShowActivity] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  // Urgent approval popup: show one at a time for LMs
  const [approvalQueue, setApprovalQueue] = useState<any[]>(urgentApprovals);
  const [dismissedApprovals, setDismissedApprovals] = useState<Set<string>>(new Set());

  const activeApproval = approvalQueue.find((a) => !dismissedApprovals.has(a.id)) ?? null;

  const handleDismissApproval = (id: string) => {
    setDismissedApprovals((prev) => new Set([...prev, id]));
  };

  const handleApprovalResolved = (id: string) => {
    setApprovalQueue((prev) => prev.filter((a) => a.id !== id));
  };

  // Sync from server when props change (e.g. after creation)
  useEffect(() => { setPickups(initialPickups); }, [initialPickups]);

  const statuses = ["ALL", "SUBMITTED", "FINDING_VEHICLE", "UNABLE_TO_FIND", "PROCESSED", "OVER_TO_NEXT", "REJECTED"];

  const filtered = pickups.filter((p: any) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        p.commodity?.toLowerCase().includes(s) ||
        p.deliveryLocation?.toLowerCase().includes(s) ||
        p.cm?.name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    // Optimistic update
    setPickups((prev) => prev.map((p: any) => p.id === requestId ? { ...p, status: newStatus } : p));
    await updateRequestStatus(requestId, newStatus as any);
    router.refresh();
  };

  const toggleActivity = async (entityId: string) => {
    if (showActivity === entityId) {
      setShowActivity(null);
      return;
    }
    setShowActivity(entityId);
    if (!activityLogs[entityId]) {
      try {
        const logs = await getEntityActivityLogs("MasterRequest", entityId);
        setActivityLogs((prev) => ({ ...prev, [entityId]: JSON.parse(JSON.stringify(logs)) }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Massive Create Button */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2 group border border-emerald-400/20"
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-white" />
        </div>
        <div className="text-center">
          <span className="block text-lg font-bold tracking-tight">Create New Request</span>
          <span className="text-xs text-emerald-100 font-medium opacity-90">Tap here to add a new pickup lead</span>
        </div>
      </button>

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Comm. Manager name, commodity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-icon"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto min-w-[150px]"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</p>

      {/* Request cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((req: any, index: number) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="card-hover overflow-hidden"
            >
              {/* Header row - click anywhere to expand, but it's a div now to avoid nested buttons */}
              <div
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                className="w-full p-4 flex items-center gap-4 text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <User2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white truncate max-w-full">
                      {getPickupRouteLabel(req)}
                    </span>
                    <span className={`badge text-[10px] ${getStatusColor(req.status)}`}>
                      {req.status.replace(/_/g, " ")}
                    </span>
                    {(req.status === "FINDING_VEHICLE" || req.status === "UNABLE_TO_FIND") && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">
                        since {timeSince(req.updatedAt)}
                      </span>
                    )}
                    {/* Urgent approval badge */}
                    {(req.urgentApprovals?.length > 0) && (
                      <span className="flex items-center gap-1 badge bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 text-[10px] animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {req.urgentApprovals.length} Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" />{req.commodity}</span>
                    <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{formatWeight(req.totalEstWeight)} | {req.totalEstBags} Bags</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(req.pickupDate)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req._count?.childPickups} stops</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Chat popup trigger */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setChatReqId(req.id); }}
                    className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Messages"
                  >
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    {(req._count?.messages || 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {req._count.messages}
                      </span>
                    )}
                  </button>
                  <ChevronDown className={cn(
                    "w-5 h-5 text-gray-400 transition-transform duration-200",
                    expandedId === req.id && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {expandedId === req.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                      {/* Meta info */}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span><strong>Factory:</strong> {req.factory?.factoryName || req.deliveryLocation}</span>
                        {req.approvedBy && (
                          <span><strong>Approved by:</strong> {req.approvedBy.name} on {formatDate(req.approvedAt)}</span>
                        )}
                      </div>
                      {req.note && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
                          <StickyNote className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{req.note}</span>
                        </div>
                      )}

                      {/* CM Specific Alerts */}
                      {isCM && req.status === "UNABLE_TO_FIND" && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>We are unable to find a vehicle. If you want, you can try finding one too! Keep us updated via chat.</span>
                        </div>
                      )}

                      {/* Status actions — LM/Admin only */}
                      <div className="flex gap-2 flex-wrap">
                        {!isCM && req.status === "SUBMITTED" && (
                          <button onClick={() => handleStatusChange(req.id, "FINDING_VEHICLE")} className="btn-secondary text-xs">
                            <Truck className="w-3.5 h-3.5" /> Find Vehicle
                          </button>
                        )}
                        {!isCM && (req.status === "SUBMITTED" || req.status === "FINDING_VEHICLE" || req.status === "OVER_TO_NEXT") && (
                          <button onClick={() => handleStatusChange(req.id, "REJECTED")} className="btn-secondary text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 className="w-3.5 h-3.5" /> Reject Request
                          </button>
                        )}
                        {!isCM && req.status === "FINDING_VEHICLE" && (
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setShowDelivery(req.id)} className="btn-primary text-xs">
                              <CheckCircle className="w-3.5 h-3.5" /> Create Delivery & Process
                            </button>
                            <button onClick={() => handleStatusChange(req.id, "UNABLE_TO_FIND")} className="btn-secondary text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> Unable to find
                            </button>
                            <button onClick={() => handleStatusChange(req.id, "OVER_TO_NEXT")} className="btn-secondary text-xs">
                              <Calendar className="w-3.5 h-3.5" /> Over to Next Day
                            </button>
                          </div>
                        )}
                        {!isCM && req.status === "UNABLE_TO_FIND" && (
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setShowDelivery(req.id)} className="btn-primary text-xs">
                              <CheckCircle className="w-3.5 h-3.5" /> Create Delivery & Process
                            </button>
                            <button onClick={() => handleStatusChange(req.id, "OVER_TO_NEXT")} className="btn-secondary text-xs">
                              <Calendar className="w-3.5 h-3.5" /> Over to Next Day
                            </button>
                          </div>
                        )}
                        {!isCM && req.status === "OVER_TO_NEXT" && (
                          <button onClick={() => handleStatusChange(req.id, "FINDING_VEHICLE")} className="btn-secondary text-xs">
                            <Truck className="w-3.5 h-3.5" /> Find Vehicle Again
                          </button>
                        )}
                        {isCM && req.status === "PROCESSED" && (
                          <span className="text-xs text-gray-400 italic">This request has been processed — no further actions required.</span>
                        )}

                        {/* Activity logs toggle */}
                        <button
                          onClick={() => toggleActivity(req.id)}
                          className={cn(
                            "text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors",
                            showActivity === req.id
                              ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          )}
                        >
                          <ScrollText className="w-3.5 h-3.5" />
                          Activity Logs
                        </button>
                      </div>

                      {/* Activity Logs Section */}
                      <AnimatePresence>
                        {showActivity === req.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <ScrollText className="w-3.5 h-3.5" /> Pickup Request Logs
                              </div>
                              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-56 overflow-y-auto">
                                {(activityLogs[req.id] || []).length === 0 ? (
                                  <p className="text-xs text-gray-400 p-3 text-center">No activity logs</p>
                                ) : (
                                  (activityLogs[req.id] || []).map((log: any) => (
                                    <div key={log.id}>
                                      <button
                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                        className="w-full px-3 py-2 text-xs flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                                      >
                                        <span className="text-gray-400 whitespace-nowrap flex-shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">{log.user?.name}</span>
                                        <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 text-[9px] flex-shrink-0">{log.action}</span>
                                        {(log.oldValue || log.newValue) && (
                                          <ChevronRight className={cn("w-3 h-3 text-gray-400 ml-auto transition-transform", expandedLog === log.id && "rotate-90")} />
                                        )}
                                      </button>
                                      {expandedLog === log.id && (log.oldValue || log.newValue) && (
                                        <div className="px-3 pb-3">
                                          <LogDiff oldValue={log.oldValue} newValue={log.newValue} />
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Child pickups table */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50">
                              <th className="px-3 py-2 text-left text-gray-500 font-medium w-12">#</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">Location</th>
                              <th className="px-3 py-2 text-right text-gray-500 font-medium">Weight & Bags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {req.childPickups?.map((child: any) => (
                              <tr key={child.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{child.stopSequence}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {child.pickupLocType === "BFH" ? (
                                      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                        <Home className="w-4 h-4 text-orange-500" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-4 h-4 text-blue-500" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {child.pickupLocType === "BFH" ? `BFH${child.center?.centerName ? ` — ${child.center.centerName}` : ""}` : child.center?.centerName}
                                      </p>
                                      {child.villageName && (
                                        <p className="text-xs text-gray-500">{child.villageName}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex flex-col gap-2 items-end">
                                    <EditableWeight child={child} />
                                    <EditableBags child={child} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Add Stop Button */}
                      {(req.status === "SUBMITTED" || req.status === "PROCESSED" || req.status === "FINDING_VEHICLE" || req.status === "OVER_TO_NEXT") && (
                         <div>
                           <button
                             onClick={() => setAddingStopTo(req.id)}
                             className="text-emerald-600 dark:text-emerald-400 text-sm font-medium mt-2 flex items-center gap-1 hover:underline w-full justify-center p-2 rounded-lg border border-dashed border-emerald-500/30 dark:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
                           >
                             <Plus className="w-4 h-4" /> Add Stop
                           </button>
                           {/* Inform CM that approved-request modifications need LM approval */}
                           {isCM && (req.status === "FINDING_VEHICLE" || req.status === "PROCESSED") && (
                             <p className="text-[11px] text-orange-500 dark:text-orange-400 text-center mt-1.5 flex items-center justify-center gap-1">
                               <AlertTriangle className="w-3 h-3" />
                               This request is approved — your changes will need Logistic Manager review before saving.
                             </p>
                           )}
                         </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No pickup requests found</p>
          </div>
        )}
      </div>

      {/* Create pickup modal */}
      {showCreate && (
        <CreatePickupModal
          centers={centers}
          factories={factories}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); router.refresh(); }}
        />
      )}

      {/* Create delivery modal (triggered from pickup → processed) */}
      {showDelivery && (
        <CreateDeliveryModal
          masterReqId={showDelivery}
          initialFactoryId={pickups.find((p: any) => p.id === showDelivery)?.factoryId}
          factories={factories}
          onClose={() => setShowDelivery(null)}
          onSuccess={() => { setShowDelivery(null); router.refresh(); }}
        />
      )}

      {/* Add Stop Modal */}
      {addingStopTo && (
         <AddStopModal
           masterReqId={addingStopTo}
           centers={centers}
           onClose={() => setAddingStopTo(null)}
           onSuccess={() => { setAddingStopTo(null); router.refresh(); }}
         />
      )}

      {/* Chat Popup */}
      {chatReqId && (
        <ChatPopup masterReqId={chatReqId} onClose={() => setChatReqId(null)} />
      )}
    </div>
  );
}
