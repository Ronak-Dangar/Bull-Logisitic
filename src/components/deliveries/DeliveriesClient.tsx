"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, ChevronDown, MapPin, User2, MessageSquare,
  Calendar, CheckCircle2, Package, ScrollText, AlertTriangle, Home, X, FileText, ChevronRight, Pencil, Plus, Undo2
} from "lucide-react";
import { formatWeight, formatDate, formatCurrency, getStatusColor, cn } from "@/lib/utils";
import { updateDeliveryStatus, updateDelivery, undoDeliveryStatus } from "@/actions/deliveries";
import { getEntityActivityLogs } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { ChatPopup } from "../shared/ChatPopup";
import { LogDiff } from "../shared/LogDiff";

const STEPS = ["SCHEDULED", "LOADING", "IN_TRANSIT", "UNLOADING", "COMPLETED"];

// Color map for each status step
const STEP_COLORS: Record<string, { done: string; text: string; line: string }> = {
  SCHEDULED:  { done: "bg-blue-500",    text: "text-blue-500",    line: "bg-blue-500" },
  LOADING:    { done: "bg-amber-500",   text: "text-amber-500",   line: "bg-amber-500" },
  IN_TRANSIT: { done: "bg-violet-500",  text: "text-violet-500",  line: "bg-violet-500" },
  UNLOADING:  { done: "bg-orange-500",  text: "text-orange-500",  line: "bg-orange-500" },
  COMPLETED:  { done: "bg-emerald-500", text: "text-emerald-500", line: "bg-emerald-500" },
};

function groupLogsByDate(logs: any[]) {
  const groups: Record<string, any[]> = {};
  logs.forEach((log) => {
    const date = new Date(log.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
    if (date.toDateString() === today.toDateString()) label = "Today";
    else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
    
    if (!groups[label]) groups[label] = [];
    groups[label].push(log);
  });
  return groups;
}

function EditableField({ id, label, initialValue, fieldKey, type = "number", validate, variant = "ghost" }: any) {
  const router = useRouter();
  const [val, setVal] = useState(initialValue || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allow consumer to pass a global callback to update parent state after API call
  // This is a quick fix; a robust solution would use a React context or lift state up completely.
  // For now, next/navigation router.refresh() handles the server state, but local UI needs an optimistic push
  const handleBlur = async () => {
    let finalVal = type === "number" ? Number(val) : val;
    if (type === "number" && val === "") finalVal = 0; // handle empty numeric clearing
    if (type === "number" && isNaN(finalVal as number)) return;
    if (finalVal === initialValue) return;

    if (validate) {
      const errMsg = validate(finalVal);
      if (errMsg) {
        setError(errMsg);
        return;
      }
    }
    setError(null);
    
    setLoading(true);
    try {
      await updateDelivery(id, { [fieldKey]: finalVal });
      
      // Dispatch a custom event so the parent DeliveriesClient can update its local state immediately
      window.dispatchEvent(new CustomEvent('delivery-updated', { 
        detail: { id, fieldKey, finalVal } 
      }));

      router.refresh();
    } catch (e) {
      console.error(e);
      setVal(initialValue || "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {label && <span className="text-gray-500 block">{label}</span>}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        disabled={loading}
        className={cn(
          "w-full mt-1 px-2 py-1 border rounded text-sm font-medium transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50",
          variant === "gray" 
            ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
            : "bg-white dark:bg-gray-900 border-transparent hover:border-gray-300 dark:hover:border-gray-700 text-gray-900 dark:text-white"
        )}
      />
      {type === "date" && <span className="text-[10px] text-gray-400 absolute bottom-1 right-2 pointer-events-none pb-1">{val ? "" : "Select Date"}</span>}
      {error && <span className="text-[10px] text-red-500 mt-1 block">{error}</span>}
    </div>
  );
}

// ─── Complete Delivery Popup ─────────────────────────────
function CompleteDeliveryPopup({ delivery, onClose, onConfirm }: { delivery: any; onClose: () => void; onConfirm: (balanceAmount: number) => void }) {
  const ideal = delivery.idealPayment || 0;
  const advance = delivery.advancePaid || 0;
  const misc = delivery.miscAmount || 0;
  const waiting = delivery.waitingCharges || 0;
  const balanceDue = ideal - advance - misc - waiting;
  const [balanceAmount, setBalanceAmount] = useState(Math.max(balanceDue, 0).toString());
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(Number(balanceAmount) || 0);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md card p-4 z-10 space-y-3 rounded-b-none sm:rounded-b-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Complete Delivery
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Enter the final balance amount after deducting advance, misc charges, and waiting charges.
          </p>
        </div>

        {/* Financial Breakdown */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500">Ideal Payment</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(ideal)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500">− Advance Paid</span>
            <span className="font-medium text-red-500">−{formatCurrency(advance)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500">− Misc Amount</span>
            <span className="font-medium text-red-500">−{formatCurrency(misc)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500">− Waiting Charges</span>
            <span className="font-medium text-red-500">−{formatCurrency(waiting)}</span>
          </div>
          <div className="flex justify-between py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Balance Due</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(balanceDue)}</span>
          </div>
        </div>

        {/* Balance Amount Input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Balance Amount Paid (₹) *</label>
          <input
            type="number"
            step="0.01"
            value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
            className="input text-sm"
            autoFocus
            required
          />
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex gap-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-white dark:bg-gray-900">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleConfirm} disabled={loading} className="btn-primary flex-1 text-sm">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Confirm & Complete"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface DeliveriesClientProps {
  deliveries: any[];
  initialFilter?: string;
}

// ─── Invoice Prompt Popup ────────────────────────────────
function InvoicePromptPopup({ delivery, onClose, onConfirm }: { delivery: any; onClose: () => void; onConfirm: (invoiceNo: string) => void }) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!invoiceNo.trim()) return;
    setLoading(true);
    await onConfirm(invoiceNo.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm card p-4 z-10 space-y-3 rounded-b-none sm:rounded-b-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Invoice Required
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">An invoice number is required before marking as <strong>In Transit</strong>.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice Number *</label>
          <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="input text-sm" placeholder="e.g. INV-2024-001" autoFocus onKeyDown={(e) => e.key === "Enter" && handleConfirm()} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleConfirm} disabled={loading || !invoiceNo.trim()} className="btn-primary flex-1 text-sm">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Save & Continue"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function DeliveriesClient({ deliveries: initialDeliveries, initialFilter }: DeliveriesClientProps) {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialFilter || "ALL");
  const [completingDelivery, setCompletingDelivery] = useState<any>(null);
  const [invoicePromptDelivery, setInvoicePromptDelivery] = useState<any>(null);
  const [chatReqId, setChatReqId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<Record<string, any[]>>({});
  const [showActivity, setShowActivity] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Helper: refresh activity logs for a delivery if the panel is open or logs are cached
  const refreshActivityLogs = async (entityId: string) => {
    try {
      const logs = await getEntityActivityLogs("DeliveryDetail", entityId);
      setActivityLogs((prev) => ({ ...prev, [entityId]: JSON.parse(JSON.stringify(logs)) }));
    } catch (err) {
      console.error(err);
    }
  };

  // Sync from server when props change, and setup local optimistic listener
  useEffect(() => { 
    setDeliveries(initialDeliveries); 
    
    const handleLocalUpdate = async (e: any) => {
      const { id, fieldKey, finalVal } = e.detail;
      setDeliveries((prev) => prev.map((d: any) => d.id === id ? { ...d, [fieldKey]: finalVal } : d));
      // Auto-refresh activity logs for this delivery
      await refreshActivityLogs(id);
    };

    window.addEventListener('delivery-updated', handleLocalUpdate);
    return () => window.removeEventListener('delivery-updated', handleLocalUpdate);
  }, [initialDeliveries]);

  const statuses = ["ALL", ...STEPS];

  const filtered = deliveries.filter((d: any) => {
    if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
    return true;
  });

  const handleStatusAdvance = async (id: string, currentStatus: string, delivery: any) => {
    const currentIndex = STEPS.indexOf(currentStatus);
    if (currentIndex < STEPS.length - 1) {
      const nextStatus = STEPS[currentIndex + 1];
      if (nextStatus === "COMPLETED") {
        setCompletingDelivery(delivery);
        return;
      }
      if (nextStatus === "IN_TRANSIT" && !delivery.invoiceNo) {
        setInvoicePromptDelivery(delivery);
        return;
      }
      // Optimistic update
      setDeliveries((prev) => prev.map((d: any) => d.id === id ? { ...d, status: nextStatus } : d));
      await updateDeliveryStatus(id, nextStatus as any);
      await refreshActivityLogs(id);
      router.refresh();
    }
  };

  const handleStatusUndo = async (id: string, currentStatus: string) => {
    const currentIndex = STEPS.indexOf(currentStatus);
    if (currentIndex <= 0) return;
    const prevStatus = STEPS[currentIndex - 1];
    // Optimistic update
    setDeliveries((prev) => prev.map((d: any) => d.id === id ? { ...d, status: prevStatus } : d));
    await undoDeliveryStatus(id);
    await refreshActivityLogs(id);
    router.refresh();
  };

  const handleInvoiceConfirm = async (invoiceNo: string) => {
    if (!invoicePromptDelivery) return;
    // Optimistic update
    setDeliveries((prev) => prev.map((d: any) => d.id === invoicePromptDelivery.id ? { ...d, status: "IN_TRANSIT", invoiceNo } : d));
    await updateDelivery(invoicePromptDelivery.id, { invoiceNo });
    await updateDeliveryStatus(invoicePromptDelivery.id, "IN_TRANSIT" as any);
    await refreshActivityLogs(invoicePromptDelivery.id);
    setInvoicePromptDelivery(null);
    router.refresh();
  };

  const handleCompleteConfirm = async (balanceAmount: number) => {
    if (!completingDelivery) return;
    // Optimistic update
    setDeliveries((prev) => prev.map((d: any) => d.id === completingDelivery.id ? { ...d, status: "COMPLETED", actuallyPaid: balanceAmount } : d));
    await updateDelivery(completingDelivery.id, { actuallyPaid: balanceAmount });
    await updateDeliveryStatus(completingDelivery.id, "COMPLETED" as any);
    await refreshActivityLogs(completingDelivery.id);
    setCompletingDelivery(null);
    router.refresh();
  };

  const toggleActivity = async (entityId: string) => {
    if (showActivity === entityId) {
      setShowActivity(null);
      return;
    }
    setShowActivity(entityId);
    // Always fetch fresh logs when opening the panel
    await refreshActivityLogs(entityId);
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              statusFilter === s
                ? "bg-emerald-500 text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500">{filtered.length} deliver{filtered.length !== 1 ? "ies" : "y"}</p>

      {/* Delivery cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((del: any, index: number) => (
            <motion.div
              key={del.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="card-hover overflow-hidden"
            >
              <div
                onClick={() => setExpandedId(expandedId === del.id ? null : del.id)}
                className="w-full p-3 flex items-center gap-3 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
                  <Truck className="w-4.5 h-4.5 text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <EditableField 
                         id={del.id} 
                         fieldKey="vehicleNumber" 
                         label="" 
                         type="text" 
                         initialValue={del.vehicleNumber} 
                         validate={(v: string) => /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(v.toUpperCase()) ? null : "Invalid format (e.g. GJ01AB1234)"}
                      />
                    </div>
                    <span className={`badge text-[10px] shrink-0 ${getStatusColor(del.status)}`}>
                      {del.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{del.factory?.factoryName || del.deliveryLoc}</span>
                    </p>
                    {del.invoiceNo && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 shrink-0">
                        {del.invoiceNo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1 truncate"><User2 className="w-3 h-3 shrink-0" />{del.driverName || "No driver"}</span>
                    <span className="flex items-center gap-1 truncate"><Package className="w-3 h-3 shrink-0" />{del.masterRequest?.commodity}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {del.masterRequest?.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setChatReqId(del.masterRequest.id); }}
                      className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Messages"
                    >
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      {(del.masterRequest?._count?.messages || 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
                          {del.masterRequest._count.messages}
                        </span>
                      )}
                    </button>
                  )}
                  <ChevronDown className={cn(
                    "w-4 h-4 text-gray-400 transition-transform shrink-0",
                    expandedId === del.id && "rotate-180"
                  )} />
                </div>
              </div>

              <AnimatePresence>
                {expandedId === del.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                      {/* Status stepper */}
                      <div className="relative pt-2">
                        <div className="flex items-center justify-between relative z-10">
                          {STEPS.map((step, i) => {
                            const currentIdx = STEPS.indexOf(del.status);
                            const isDone = i <= currentIdx;
                            const isCurrent = i === currentIdx;
                            const color = STEP_COLORS[step];
                            return (
                              <div key={step} className="flex flex-col items-center gap-2">
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-4 box-content border-white dark:border-gray-900 transition-colors",
                                  isDone
                                    ? `${color.done} text-white`
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-500",
                                  isCurrent && "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-900 ring-current"
                                )}>
                                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Connecting Lines */}
                        <div className="absolute top-5 left-0 right-0 h-0.5 -translate-y-1/2 flex z-0 px-3">
                          {STEPS.slice(0, -1).map((step, i) => {
                            const isDone = i < STEPS.indexOf(del.status);
                            const nextStep = STEPS[i + 1];
                            const color = STEP_COLORS[nextStep];
                            return (
                              <div key={step} className={cn(
                                "h-full flex-1 transition-colors",
                                isDone ? color.line : "bg-gray-200 dark:bg-gray-700"
                              )} />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[9px] mt-2 px-1">
                          {STEPS.map((s, i) => {
                            const currentIdx = STEPS.indexOf(del.status);
                            const isDone = i <= currentIdx;
                            const color = STEP_COLORS[s];
                            return (
                              <span key={s} className={cn(
                                "w-12 text-center -mx-3 leading-tight font-medium",
                                isDone ? color.text : "text-gray-400"
                              )}>
                                {s.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Pickup Stops Section */}
                      {del.masterRequest?.childPickups?.length > 0 && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" /> Pickup Stops
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                                  <th className="px-2 py-1.5 text-left text-gray-500 font-medium">#</th>
                                  <th className="px-2 py-1.5 text-left text-gray-500 font-medium">Location</th>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-medium">Weight</th>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-medium">Bags</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {del.masterRequest.childPickups.map((cp: any) => (
                                  <tr key={cp.id}>
                                    <td className="px-2 py-1.5 text-gray-500">{cp.stopSequence}</td>
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-1">
                                        {cp.pickupLocType === "BFH" ? (
                                          <Home className="w-3 h-3 text-orange-500 shrink-0" />
                                        ) : (
                                          <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                        )}
                                        <span className="text-gray-900 dark:text-white truncate">
                                          {cp.pickupLocType === "BFH"
                                            ? `BFH${cp.center?.centerName ? ` — ${cp.center.centerName}` : ""}`
                                            : cp.center?.centerName}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                      {formatWeight(cp.actualWeight || cp.estWeight)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300">
                                      {cp.actualBags || cp.estBags || 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Details - Distinct Section Cards */}
                      <div className="space-y-3">
                        
                        {/* Card 1: Logistics Details */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-2">
                            <Truck className="w-3.5 h-3.5 text-blue-500" /> Logistics Details
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <EditableField id={del.id} fieldKey="driverName" label="Driver" type="text" initialValue={del.driverName} />
                            <EditableField id={del.id} fieldKey="driverContact" label="Driver Contact" type="text" initialValue={del.driverContact} />
                            <EditableField id={del.id} fieldKey="transporterName" label="Transporter" type="text" initialValue={del.transporterName} />
                            <EditableField id={del.id} fieldKey="invoiceNo" label="Invoice No" type="text" initialValue={del.invoiceNo} />
                            <div>
                              <span className="text-gray-500 text-xs">Total Cargo</span>
                              <p className="font-medium text-gray-900 dark:text-white mt-1 text-sm">
                                {formatWeight(del.totalWeightFinal)} <span className="text-gray-400">|</span> {del.totalBags || 0} Bags
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Timeline */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-orange-500" /> Timeline
                          </h4>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <EditableField id={del.id} fieldKey="expDeliveryDt" label="Expected" type="date" initialValue={del.expDeliveryDt ? new Date(del.expDeliveryDt).toISOString().split('T')[0] : ""} />
                            <div>
                              <span className="text-gray-500">Actual</span>
                              <p className="font-medium text-gray-900 dark:text-white mt-1 text-sm">{formatDate(del.actualDeliveryDt) || "—"}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Unloading</span>
                              <p className="font-medium text-gray-900 dark:text-white mt-1 text-sm">{formatDate(del.unloadingDt) || "—"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Card 3: Financial Summary (Receipt Ledger Pattern) */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                          <div className="px-3 py-2.5 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                              <ScrollText className="w-3.5 h-3.5 text-emerald-500" /> Financial Summary
                            </h4>
                            <div className="w-28 text-right">
                              <EditableField id={del.id} fieldKey="ratePerTon" label="" initialValue={del.ratePerTon} variant="gray" />
                              <div className="text-[10px] text-gray-400 mt-0.5">Rate / Ton (₹)</div>
                            </div>
                          </div>
                          
                          <div className="p-3 space-y-2 text-xs">
                            {/* Ideal Payment Row */}
                            <div className="flex justify-between items-center py-1">
                              <span className="text-gray-500 font-medium text-xs">Ideal Payment</span>
                              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                {formatCurrency(del.idealPayment)}
                              </span>
                            </div>
                            
                            {/* Deductions Ledger */}
                            <div className="pl-3 border-l-2 border-gray-100 dark:border-gray-800 space-y-2 pt-1">
                              {/* Advance */}
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Advance Paid</span>
                                <div className="w-28 text-right flex items-center justify-end gap-1">
                                  {del.advancePaid ? <span className="text-red-500 font-bold">−</span> : null}
                                  <EditableField id={del.id} fieldKey="advancePaid" label="" initialValue={del.advancePaid} variant="gray" />
                                </div>
                              </div>
                              
                              {/* Misc Amount */}
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Misc Amount</span>
                                <div className="w-28 text-right flex items-center justify-end gap-1">
                                  {del.miscAmount ? <span className="text-red-500 font-bold">−</span> : null}
                                  <EditableField id={del.id} fieldKey="miscAmount" label="" initialValue={del.miscAmount} variant="gray" />
                                </div>
                              </div>
                              
                              {/* Waiting Charges */}
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Waiting Charges</span>
                                <div className="w-28 text-right flex items-center justify-end gap-1">
                                  {del.waitingCharges ? <span className="text-red-500 font-bold">−</span> : null}
                                  <EditableField id={del.id} fieldKey="waitingCharges" label="" initialValue={del.waitingCharges} variant="gray" />
                                </div>
                              </div>
                            </div>

                            {/* The "Bottom Line" Callout Block - Changes based on completion */}
                            {del.status === "COMPLETED" ? (
                              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600 dark:text-gray-300 font-medium">Balance Paid</span>
                                  <div className="w-28 text-right">
                                    <EditableField id={del.id} fieldKey="actuallyPaid" label="" initialValue={del.actuallyPaid} variant="gray" />
                                  </div>
                                </div>
                                <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                                  <span className="font-bold text-indigo-800 dark:text-indigo-300 text-xs">Total Payment</span>
                                  <span className="text-base font-bold text-indigo-800 dark:text-indigo-300">
                                    {formatCurrency((del.actuallyPaid || 0) + (del.advancePaid || 0) + (del.miscAmount || 0) + (del.waitingCharges || 0))}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
                                  <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">Est. Balance Due</span>
                                  <span className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                                    {formatCurrency((del.idealPayment || 0) - (del.advancePaid || 0) - (del.miscAmount || 0) - (del.waitingCharges || 0))}
                                  </span>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      </div>

                      {/* Action buttons row */}
                      <div className="flex gap-1.5 flex-wrap">
                        {/* Undo status button */}
                        {STEPS.indexOf(del.status) > 0 && (
                          <button
                            onClick={() => handleStatusUndo(del.id, del.status)}
                            className="text-[11px] font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/40 transition-colors"
                          >
                            <Undo2 className="w-3 h-3" />
                            Back to {STEPS[STEPS.indexOf(del.status) - 1]?.replace(/_/g, " ")}
                          </button>
                        )}

                        {/* Advance status button */}
                        {del.status !== "COMPLETED" && (
                          <button
                            onClick={() => handleStatusAdvance(del.id, del.status, del)}
                            className="btn-primary text-[11px] px-2.5 py-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Advance to {STEPS[STEPS.indexOf(del.status) + 1]?.replace(/_/g, " ")}
                          </button>
                        )}

                        {/* Activity logs toggle */}
                        <button
                          onClick={() => toggleActivity(del.id)}
                          className={cn(
                            "text-[11px] font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-colors",
                            showActivity === del.id
                              ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 active:bg-gray-50 dark:active:bg-gray-800/50"
                          )}
                        >
                          <ScrollText className="w-3 h-3" />
                          Logs
                        </button>
                      </div>

                      {/* Activity Logs Section */}
                      <AnimatePresence>
                        {showActivity === del.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mt-2">
                              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800">
                                <ScrollText className="w-3 h-3" /> Activity Timeline
                              </div>
                              <div className="p-3 max-h-64 overflow-y-auto w-full">
                                {(activityLogs[del.id] || []).length === 0 ? (
                                  <p className="text-[11px] text-gray-400 text-center py-3">No activity logs</p>
                                ) : (
                                  <div className="space-y-4">
                                    {Object.entries(groupLogsByDate(activityLogs[del.id] || [])).map(([dateLabel, logs]: any) => (
                                      <div key={dateLabel} className="relative">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-3 ml-8 relative z-10 bg-white dark:bg-gray-900 inline-block px-1">
                                          {dateLabel}
                                        </div>
                                        <div className="space-y-3">
                                          {logs.map((log: any, idx: number) => {
                                            const groupKeys = Object.keys(groupLogsByDate(activityLogs[del.id]));
                                            const isLastDay = dateLabel === groupKeys[groupKeys.length - 1];
                                            const isLastLog = idx === logs.length - 1 && isLastDay;
                                            
                                            let Icon = Truck;
                                            let bgColor = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
                                            let ringColor = "ring-emerald-50 dark:ring-emerald-900/10";
                                            let actionText = "changed the delivery status";
                                            
                                            if (log.action === "UPDATE") {
                                              Icon = Pencil;
                                              bgColor = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
                                              ringColor = "ring-blue-50 dark:ring-blue-900/10";
                                              actionText = "updated the delivery details";
                                            } else if (log.action === "CREATE") {
                                              Icon = Plus;
                                              bgColor = "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400";
                                              ringColor = "ring-indigo-50 dark:ring-indigo-900/10";
                                              actionText = "created the delivery record";
                                            }

                                            return (
                                              <div key={log.id} className="relative flex gap-2 pl-1">
                                                {/* Connecting line */}
                                                {!isLastLog && <div className="absolute top-5 bottom-[-16px] left-[17px] w-[2px] bg-gray-100 dark:bg-gray-800" />}
                                                
                                                {/* Node */}
                                                <div className={`relative z-10 w-6 h-6 shrink-0 rounded-full flex items-center justify-center ring-3 bg-white dark:bg-gray-900 ${ringColor}`}>
                                                  <div className={`w-full h-full rounded-full flex items-center justify-center ${bgColor}`}>
                                                    <Icon className="w-3 h-3" />
                                                  </div>
                                                </div>
                                                
                                                {/* Content */}
                                                <div className="flex-1 pb-1 min-w-0">
                                                  <div className="flex justify-between items-start gap-1">
                                                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                                      <span className="font-semibold text-gray-900 dark:text-white">{log.user?.name}</span> {actionText}.
                                                    </p>
                                                    <span className="text-[9px] text-gray-400 whitespace-nowrap mt-0.5 shrink-0">
                                                      {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' })}
                                                    </span>
                                                  </div>
                                                  
                                                  {(log.oldValue || log.newValue) && (
                                                    <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 overflow-hidden w-full">
                                                      <LogDiff oldValue={log.oldValue} newValue={log.newValue} />
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No deliveries found</p>
          </div>
        )}
      </div>

      {/* Complete Delivery Popup */}
      {completingDelivery && (
        <CompleteDeliveryPopup
          delivery={completingDelivery}
          onClose={() => setCompletingDelivery(null)}
          onConfirm={handleCompleteConfirm}
        />
      )}

      {/* Invoice Prompt Popup */}
      {invoicePromptDelivery && (
        <InvoicePromptPopup
          delivery={invoicePromptDelivery}
          onClose={() => setInvoicePromptDelivery(null)}
          onConfirm={handleInvoiceConfirm}
        />
      )}

      {/* Chat Popup */}
      {chatReqId && (
        <ChatPopup masterReqId={chatReqId} onClose={() => setChatReqId(null)} />
      )}
    </div>
  );
}
