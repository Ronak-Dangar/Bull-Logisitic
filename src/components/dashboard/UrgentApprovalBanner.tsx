"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, X, ChevronRight, MapPin, Home, User2 } from "lucide-react";
import { resolveUrgentApproval } from "@/actions/pickups";
import { useRouter } from "next/navigation";
import { UrgentApprovalPopup } from "../pickups/UrgentApprovalPopup";

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
  requestedBy: { name: string; phone: string };
}

interface UrgentApprovalBannerProps {
  approvals: UrgentApproval[];
}

function ApprovalCard({ approval }: { approval: UrgentApproval }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const handleResolve = async (approve: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(approve ? "approve" : "deny");
    try {
      await resolveUrgentApproval(approval.id, approve);
      router.refresh();
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setLoading(null);
    }
  };

  const timeAgo = () => {
    const mins = Math.floor((Date.now() - new Date(approval.createdAt).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const changeLabel =
    approval.changeType === "ADD_STOP"
      ? "Add New Stop"
      : "Modify Stop Details";

  const stopIcon =
    (approval.pendingData as any)?.stopData?.pickupLocType === "BFH" ? (
      <Home className="w-4 h-4 text-orange-500" />
    ) : (
      <MapPin className="w-4 h-4 text-blue-500" />
    );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="min-w-[300px] max-w-[320px] flex-shrink-0 bg-white dark:bg-gray-900 border-2 border-orange-400/60 dark:border-orange-500/40 rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:border-orange-500 dark:hover:border-orange-400 transition-colors"
        onClick={() => setShowPopup(true)}
      >
        {/* Orange top strip */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-white" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">Urgent Approval</span>
          <span className="ml-auto text-xs text-orange-200">{timeAgo()}</span>
        </div>

        <div className="p-4">
          {/* Who + what */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <User2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {approval.requestedBy.name}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                {stopIcon}
                {changeLabel} · {approval.masterRequest.commodity}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
          </div>

          <p className="text-xs text-gray-400 mb-3 truncate">
            📍 {approval.masterRequest.factory?.factoryName || approval.masterRequest.cm?.name}
          </p>

          {/* Inline action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => handleResolve(false, e)}
              disabled={!!loading}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold text-xs hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95 disabled:opacity-50"
            >
              {loading === "deny" ? (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              Deny
            </button>
            <button
              onClick={(e) => handleResolve(true, e)}
              disabled={!!loading}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-xs shadow hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading === "approve" ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Allow
            </button>
          </div>
        </div>
      </motion.div>

      {showPopup && (
        <UrgentApprovalPopup
          approval={approval}
          onClose={() => setShowPopup(false)}
          onResolved={() => { setShowPopup(false); router.refresh(); }}
        />
      )}
    </>
  );
}

export function UrgentApprovalBanner({ approvals }: UrgentApprovalBannerProps) {
  if (!approvals || approvals.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2"
    >
      {/* Header label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
            {approvals.length}
          </span>
        </div>
        <span className="font-semibold text-orange-600 dark:text-orange-400 text-sm">
          {approvals.length} Urgent Approval{approvals.length > 1 ? "s" : ""} Pending
        </span>
        <span className="text-xs text-gray-400">· Comm. Manager modifications need your review</span>
      </div>

      {/* Horizontal scroll cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {approvals.map((approval) => (
          <div key={approval.id} className="snap-start">
            <ApprovalCard approval={approval} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
