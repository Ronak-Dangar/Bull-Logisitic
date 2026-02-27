"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, X, MapPin, Home, Clock, User2 } from "lucide-react";
import { resolveUrgentApproval } from "@/actions/pickups";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface UrgentApproval {
  id: string;
  changeType: string;
  pendingData: any;
  createdAt: string;
  masterRequest: {
    id: string;
    commodity: string;
    status: string;
    cm: { name: string } | null;
    factory: { factoryName: string } | null;
  };
  requestedBy: {
    name: string;
    phone: string;
  };
}

interface UrgentApprovalPopupProps {
  approval: UrgentApproval;
  onClose: () => void;
  onResolved: () => void;
}

function ChangeDetails({ changeType, pendingData }: { changeType: string; pendingData: any }) {
  if (changeType === "ADD_STOP") {
    const stop = pendingData.stopData;
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide text-xs">
          Add New Stop
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800/50">
          {stop?.pickupLocType === "BFH" ? (
            <Home className="w-5 h-5 text-orange-500 flex-shrink-0" />
          ) : (
            <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {stop?.pickupLocType === "BFH" ? `BFH — ${stop?.villageName || "Village"}` : "Collection Center stop"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Est. Weight: <strong>{stop?.estWeight} kg</strong> · Est. Bags: <strong>{stop?.estBags || 0}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (changeType === "UPDATE_STOP") {
    const changes = pendingData.changes || {};
    const labels: Record<string, string> = {
      estWeight: "Est. Weight (kg)",
      estBags: "Est. Bags",
      actualWeight: "Actual Weight (kg)",
      actualBags: "Actual Bags",
      supervisorName: "Supervisor Name",
      loadingStatus: "Loading Status",
    };
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide text-xs">
          Update Stop Details
        </p>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800/50 divide-y divide-orange-100 dark:divide-orange-900/30 overflow-hidden">
          {Object.entries(changes).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-gray-500">{labels[key] || key}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function UrgentApprovalPopup({ approval, onClose, onResolved }: UrgentApprovalPopupProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);

  const handleResolve = async (approve: boolean) => {
    setLoading(approve ? "approve" : "deny");
    try {
      await resolveUrgentApproval(approval.id, approve);
      onResolved();
      router.refresh();
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-sm mx-4 sm:mx-0 overflow-hidden"
        >
          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            {/* Orange header stripe */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 px-6 pt-6 pb-8 text-white relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
              <div className="absolute top-4 -right-2 w-12 h-12 rounded-full bg-white/10" />

              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-orange-200">
                    Urgent Review Required
                  </p>
                  <h2 className="text-xl font-bold">Modification Request</h2>
                </div>
              </div>

              <div className="mt-4 relative z-10">
                <p className="text-sm text-orange-100">
                  <strong className="text-white">{approval.requestedBy.name}</strong>{" "}
                  (CM) wants to modify an approved pickup for{" "}
                  <strong className="text-white">
                    {approval.masterRequest.commodity}
                  </strong>{" "}
                  at{" "}
                  <strong className="text-white">
                    {approval.masterRequest.factory?.factoryName || "—"}
                  </strong>
                </p>
              </div>
            </div>

            {/* Pull-up content */}
            <div className="-mt-4 bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-5 pb-6 space-y-4">
              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User2 className="w-3 h-3" />
                  {approval.requestedBy.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(approval.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Change details */}
              <ChangeDetails changeType={approval.changeType} pendingData={approval.pendingData as any} />

              <p className="text-xs text-gray-400 text-center">
                Pickup is currently{" "}
                <span className="font-medium text-orange-500">
                  {approval.masterRequest.status.replace(/_/g, " ")}
                </span>
                . Changes will only be saved if you allow.
              </p>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => handleResolve(false)}
                  disabled={!!loading}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading === "deny" ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <X className="w-5 h-5" />
                  )}
                  Deny
                </button>
                <button
                  onClick={() => handleResolve(true)}
                  disabled={!!loading}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading === "approve" ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  Allow
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Dismiss (review later on dashboard)
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
