"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, ChevronDown, MapPin, User2, MessageSquare,
  Calendar, CheckCircle2, Package, ScrollText, AlertTriangle, Home, X, FileText, ChevronRight, Pencil, Plus, Undo2, Download, Phone, Clock3
} from "lucide-react";
import { formatWeight, formatDate, formatCurrency, getStatusColor, cn } from "@/lib/utils";
import { updateDeliveryStatus, updateDelivery, undoDeliveryStatus, getDeliveriesExportData } from "@/actions/deliveries";
import { getEntityActivityLogs } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { ChatPopup } from "../shared/ChatPopup";
import { LogDiff } from "../shared/LogDiff";

const STEPS = ["SCHEDULED", "LOADING", "IN_TRANSIT", "AT_FACTORY", "COMPLETED", "RECEIPT_SUBMITTED"];

// Display label overrides for statuses
const STEP_DISPLAY_NAMES: Record<string, string> = {
  COMPLETED: "OFF LOADED",
  UNLOADING: "AT FACTORY",
};

function getStepDisplayName(step: string): string {
  return STEP_DISPLAY_NAMES[step] || step.replace(/_/g, " ");
}

// Color map for each status step
const STEP_COLORS: Record<string, { done: string; text: string; line: string }> = {
  SCHEDULED: { done: "bg-blue-500", text: "text-blue-500", line: "bg-blue-500" },
  LOADING: { done: "bg-amber-500", text: "text-amber-500", line: "bg-amber-500" },
  IN_TRANSIT: { done: "bg-violet-500", text: "text-violet-500", line: "bg-violet-500" },
  AT_FACTORY: { done: "bg-orange-500", text: "text-orange-500", line: "bg-orange-500" },
  COMPLETED: { done: "bg-emerald-500", text: "text-emerald-500", line: "bg-emerald-500" },
  RECEIPT_SUBMITTED: { done: "bg-teal-500", text: "text-teal-500", line: "bg-teal-500" },
};

const ADVANCE_STATUS_STYLES: Record<string, { button: string; dot: string }> = {
  LOADING: {
    button: "bg-amber-600 hover:bg-amber-700 border-amber-500 text-white shadow-sm shadow-amber-700/20",
    dot: "bg-amber-100",
  },
  IN_TRANSIT: {
    button: "bg-violet-600 hover:bg-violet-700 border-violet-500 text-white shadow-sm shadow-violet-700/20",
    dot: "bg-violet-100",
  },
  AT_FACTORY: {
    button: "bg-orange-600 hover:bg-orange-700 border-orange-500 text-white shadow-sm shadow-orange-700/20",
    dot: "bg-orange-100",
  },
  COMPLETED: {
    button: "bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white shadow-sm shadow-emerald-700/20",
    dot: "bg-emerald-100",
  },
  RECEIPT_SUBMITTED: {
    button: "bg-teal-600 hover:bg-teal-700 border-teal-500 text-white shadow-sm shadow-teal-700/20",
    dot: "bg-teal-100",
  },
};

function getNextStep(status: string): string {
  // Legacy compatibility: UNLOADING existed in older data.
  if (status === "UNLOADING") return "COMPLETED";
  const idx = STEPS.indexOf(status);
  if (idx < 0 || idx >= STEPS.length - 1) return "";
  return STEPS[idx + 1];
}

function getPrevStep(status: string): string {
  // Legacy compatibility: treat UNLOADING as the step after AT_FACTORY.
  if (status === "UNLOADING") return "AT_FACTORY";
  const idx = STEPS.indexOf(status);
  if (idx <= 0) return "";
  return STEPS[idx - 1];
}

function canGoBack(status: string): boolean {
  return !!getPrevStep(status);
}

function getFlowStatus(status: string): string {
  return status === "UNLOADING" ? "AT_FACTORY" : status;
}

function getAdvanceButtonClass(currentStatus: string): string {
  const nextStep = getNextStep(currentStatus);
  const tone = ADVANCE_STATUS_STYLES[nextStep];
  return cn(
    "min-h-10 w-full rounded-lg border text-[11px] font-semibold px-2.5 py-1.5",
    "flex items-center justify-center gap-1.5 transition-colors",
    tone?.button || "bg-cyan-600 hover:bg-cyan-700 border-cyan-500 text-white shadow-sm shadow-cyan-700/20"
  );
}

function getAdvanceDotClass(currentStatus: string): string {
  const nextStep = getNextStep(currentStatus);
  return ADVANCE_STATUS_STYLES[nextStep]?.dot || "bg-cyan-400";
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type=\"Number\">${value}</Data></Cell>`;
  }
  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type=\"Boolean\">${value ? 1 : 0}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type=\"String\">${escapeXml(value)}</Data></Cell>`;
}

function worksheetXml(name: string, headers: string[], rows: unknown[][]) {
  const headerXml = `<Row>${headers.map((h) => `<Cell><Data ss:Type=\"String\">${escapeXml(h)}</Data></Cell>`).join("")}</Row>`;
  const rowXml = rows
    .map((row) => `<Row>${row.map((cell) => formatCell(cell)).join("")}</Row>`)
    .join("");

  return `<Worksheet ss:Name=\"${escapeXml(name)}\"><Table>${headerXml}${rowXml}</Table></Worksheet>`;
}

function downloadExcelXml(deliveryRows: unknown[][], logRows: unknown[][]) {
  const workbook = `<?xml version=\"1.0\"?>
<?mso-application progid=\"Excel.Sheet\"?>
<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"
 xmlns:o=\"urn:schemas-microsoft-com:office:office\"
 xmlns:x=\"urn:schemas-microsoft-com:office:excel\"
 xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"
 xmlns:html=\"http://www.w3.org/TR/REC-html40\">
  ${worksheetXml("Deliveries", [
    "Delivery ID",
    "Vehicle Number",
    "Status",
    "Factory",
    "Delivery Location",
    "Driver Name",
    "Driver Contact",
    "Transporter",
    "Invoice No",
    "Master Request ID",
    "CM Name",
    "Commodity",
    "Est Weight",
    "Final Weight",
    "Rate/Ton",
    "Ideal Payment",
    "Advance Paid",
    "Misc Amount",
    "Waiting Charges",
    "Actually Paid",
    "Expected Delivery",
    "Actual Delivery",
    "Unloading Date",
    "Created At",
    "Updated At"
  ], deliveryRows)}
  ${worksheetXml("Delivery Logs", [
    "Delivery ID",
    "Vehicle Number",
    "Action",
    "Changed By",
    "User Role",
    "Changed At",
    "Old Value",
    "New Value"
  ], logRows)}
</Workbook>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `deliveries-export-${date}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

function EditableField({ id, label, initialValue, fieldKey, type = "number", validate, variant = "ghost", isReadonly = false, onBeforeChange }: any) {
  const router = useRouter();
  const [val, setVal] = useState(initialValue || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDateTime = type === "datetime-local";
  const [isDateTimeEditorOpen, setIsDateTimeEditorOpen] = useState(false);
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const toLocalDateTimeParts = (value: any) => {
    if (!value) return { date: "", time: "" };
    const d = new Date(value);
    if (isNaN(d.getTime())) return { date: "", time: "" };
    return {
      date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    };
  };

  const toLocalDateTimeValue = (date: string, time: string) => {
    if (!date) return "";
    return `${date}T${time || "00:00"}`;
  };

  const formatDateTimePreview = (value: any) => {
    if (!value) return "Not set";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "Not set";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  };

  useEffect(() => {
    setVal(initialValue || "");
    if (isDateTime) {
      const parts = toLocalDateTimeParts(initialValue);
      setDatePart(parts.date);
      setTimePart(parts.time);
      setIsDateTimeEditorOpen(false);
    }
  }, [initialValue]);

  // Allow consumer to pass a global callback to update parent state after API call
  // This is a quick fix; a robust solution would use a React context or lift state up completely.
  // For now, next/navigation router.refresh() handles the server state, but local UI needs an optimistic push
  const handleBlur = async () => {
    let finalVal = type === "number" ? Number(val) : val;
    if (type === "number" && val === "") finalVal = 0; // handle empty numeric clearing
    if (type === "number" && isNaN(finalVal as number)) return;
    if (finalVal === initialValue) return;

    // Optional confirmation gate (used for financial fields after payment)
    if (onBeforeChange && !onBeforeChange()) {
      setVal(initialValue || "");
      return;
    }

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

  const saveDateTime = async () => {
    const finalVal = toLocalDateTimeValue(datePart, timePart);
    if (finalVal === (initialValue || "")) {
      setIsDateTimeEditorOpen(false);
      return;
    }

    if (onBeforeChange && !onBeforeChange()) {
      const parts = toLocalDateTimeParts(initialValue);
      setDatePart(parts.date);
      setTimePart(parts.time);
      setIsDateTimeEditorOpen(false);
      return;
    }

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
      await updateDelivery(id, { [fieldKey]: finalVal || null });

      window.dispatchEvent(new CustomEvent("delivery-updated", {
        detail: { id, fieldKey, finalVal }
      }));

      setVal(finalVal);
      setIsDateTimeEditorOpen(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      const parts = toLocalDateTimeParts(initialValue);
      setDatePart(parts.date);
      setTimePart(parts.time);
    } finally {
      setLoading(false);
    }
  };

  const cancelDateTimeEdit = () => {
    const parts = toLocalDateTimeParts(initialValue);
    setDatePart(parts.date);
    setTimePart(parts.time);
    setError(null);
    setIsDateTimeEditorOpen(false);
  };

  const setNow = () => {
    const now = new Date();
    setDatePart(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`);
    setTimePart(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
  };

  if (isDateTime) {
    const preview = formatDateTimePreview(toLocalDateTimeValue(datePart, timePart) || initialValue);

    return (
      <div className="space-y-1.5">
        {label && <span className="text-gray-500 block">{label}</span>}

        <button
          type="button"
          disabled={loading || isReadonly}
          onClick={() => !isReadonly && setIsDateTimeEditorOpen((s) => !s)}
          className={cn(
            "w-full mt-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
            "flex items-center justify-between gap-2 disabled:opacity-60",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/40",
            variant === "gray"
              ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              : "bg-white dark:bg-gray-900 border-transparent hover:border-gray-300 dark:hover:border-gray-700 text-gray-900 dark:text-white"
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Clock3 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="truncate text-sm font-medium">{preview}</span>
          </span>
          {!isReadonly && <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        </button>

        <AnimatePresence initial={false}>
          {isDateTimeEditorOpen && !isReadonly && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="rounded-xl border border-cyan-200/60 dark:border-cyan-800/60 bg-gradient-to-b from-cyan-50/70 to-white dark:from-cyan-950/20 dark:to-gray-900 p-2.5 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500">Date</label>
                  <input
                    type="date"
                    value={datePart}
                    onChange={(e) => setDatePart(e.target.value)}
                    className="w-full mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900 px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500">Time</label>
                  <input
                    type="time"
                    step="60"
                    value={timePart}
                    onChange={(e) => setTimePart(e.target.value)}
                    className="w-full mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900 px-2 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={setNow}
                  className="px-2 py-1 rounded-md text-[11px] font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!datePart) return;
                    const base = new Date(toLocalDateTimeValue(datePart, timePart || "00:00"));
                    base.setMinutes(base.getMinutes() + 30);
                    setDatePart(`${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`);
                    setTimePart(`${pad2(base.getHours())}:${pad2(base.getMinutes())}`);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  +30 min
                </button>
              </div>

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={cancelDateTimeEdit}
                  className="flex-1 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={saveDateTime}
                  className="flex-1 h-8 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-xs font-semibold"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <span className="text-[10px] text-red-500 mt-1 block">{error}</span>}
      </div>
    );
  }

  return (
    <div>
      {label && <span className="text-gray-500 block">{label}</span>}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        disabled={loading || isReadonly}
        className={cn(
          "w-full mt-1 px-2 py-1 border rounded text-sm font-medium transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50",
          variant === "gray"
            ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
            : "bg-white dark:bg-gray-900 border-transparent hover:border-gray-300 dark:hover:border-gray-700 text-gray-900 dark:text-white"
        )}
      />
      {error && <span className="text-[10px] text-red-500 mt-1 block">{error}</span>}
    </div>
  );
}

// ─── Phone Field with Dial/Copy Button ───────────────────
function PhoneField({ id, fieldKey, label, initialValue, isReadonly = false, onBeforeChange }: any) {
  const [copied, setCopied] = useState(false);

  const handleDial = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = initialValue?.toString().trim();
    if (!phone) return;

    // Check if mobile device
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `tel:${phone}`;
    } else {
      navigator.clipboard.writeText(phone).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="relative">
      <EditableField id={id} fieldKey={fieldKey} label={label} type="text" initialValue={initialValue} isReadonly={isReadonly} onBeforeChange={onBeforeChange} />
      {initialValue && (
        <button
          onClick={handleDial}
          className="absolute right-1 bottom-1 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
          title={copied ? "Copied!" : "Call / Copy number"}
        >
          {copied ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Phone className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

// ─── Complete Delivery Popup ─────────────────────────────
function CompleteDeliveryPopup({ delivery, onClose, onConfirm }: { delivery: any; onClose: () => void; onConfirm: (balanceAmount: number) => void }) {
  const ideal = delivery.idealPayment || 0;
  const advance = delivery.advancePaid || 0;
  const misc = delivery.miscAmount || 0;
  const waiting = delivery.waitingCharges || 0;
  const balanceDue = ideal - advance - misc + waiting;
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
            Enter the final balance amount after deducting advance and misc charges, and adding waiting charges.
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
            <span className="text-gray-500">+ Waiting Charges</span>
            <span className="font-medium text-emerald-600">+{formatCurrency(waiting)}</span>
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

// ─── Receipt Prompt Popup ────────────────────────────────
function ReceiptPromptPopup({ delivery, onClose, onConfirm }: { delivery: any; onClose: () => void; onConfirm: (receiptUrl: string) => void }) {
  const [receiptUrl, setReceiptUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(receiptUrl);
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
        className="relative w-full max-w-md card p-4 z-10 space-y-4 rounded-b-none sm:rounded-b-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-teal-500" /> Upload Receipt
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="text-xs text-gray-500">Provide a link or base64 representation of the submitted receipt to complete the workflow.</p>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt Image URL</label>
          <input
            type="text"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            className="input w-full text-sm"
            placeholder="https://..."
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm bg-gray-100 dark:bg-gray-800 border-transparent">Skip</button>
          <button onClick={handleConfirm} disabled={loading || !receiptUrl.trim()} className="btn-primary flex-1 text-sm !bg-teal-600 hover:!bg-teal-700 border-teal-600">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Submit Receipt"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface DeliveriesClientProps {
  deliveries: any[];
  initialFilter?: string;
  isCM?: boolean;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

export function DeliveriesClient({ deliveries: initialDeliveries, initialFilter, isCM = false }: DeliveriesClientProps) {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialFilter || "ALL");
  const [completingDelivery, setCompletingDelivery] = useState<any>(null);
  const [invoicePromptDelivery, setInvoicePromptDelivery] = useState<any>(null);
  const [receiptPromptDelivery, setReceiptPromptDelivery] = useState<any>(null);
  const [chatReqId, setChatReqId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<Record<string, any[]>>({});
  const [showActivity, setShowActivity] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
    const nextStatus = getNextStep(currentStatus);
    if (nextStatus) {
      if (nextStatus === "COMPLETED") {
        setCompletingDelivery(delivery);
        return;
      }
      if (nextStatus === "RECEIPT_SUBMITTED") {
        setReceiptPromptDelivery(delivery);
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
    const prevStatus = getPrevStep(currentStatus);
    if (!prevStatus) return;
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

  const handleReceiptConfirm = async (receiptUrl: string) => {
    if (!receiptPromptDelivery) return;
    // Optimistic update
    setDeliveries((prev) => prev.map((d: any) => d.id === receiptPromptDelivery.id ? { ...d, status: "RECEIPT_SUBMITTED", receiptUrl } : d));
    await updateDelivery(receiptPromptDelivery.id, { receiptUrl });
    await updateDeliveryStatus(receiptPromptDelivery.id, "RECEIPT_SUBMITTED" as any);
    await refreshActivityLogs(receiptPromptDelivery.id);
    setReceiptPromptDelivery(null);
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

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const payload = await getDeliveriesExportData({ status: statusFilter });
      const byId = new Map(payload.deliveries.map((d: any) => [d.id, d]));

      const deliveryRows = payload.deliveries.map((d: any) => [
        d.id,
        d.vehicleNumber || "",
        d.status,
        d.factory?.factoryName || "",
        d.deliveryLoc || d.masterRequest?.deliveryLocation || "",
        d.driverName || "",
        d.driverContact || "",
        d.transporterName || "",
        d.invoiceNo || "",
        d.masterReqId || d.masterRequest?.id || "",
        d.masterRequest?.cm?.name || "",
        d.masterRequest?.commodity || "",
        d.masterRequest?.totalEstWeight ?? "",
        d.totalWeightFinal ?? "",
        d.ratePerTon ?? "",
        d.idealPayment ?? "",
        d.advancePaid ?? "",
        d.miscAmount ?? "",
        d.waitingCharges ?? "",
        d.actuallyPaid ?? "",
        d.expDeliveryDt ? new Date(d.expDeliveryDt).toISOString() : "",
        d.actualDeliveryDt ? new Date(d.actualDeliveryDt).toISOString() : "",
        d.unloadingDt ? new Date(d.unloadingDt).toISOString() : "",
        d.createdAt ? new Date(d.createdAt).toISOString() : "",
        d.updatedAt ? new Date(d.updatedAt).toISOString() : "",
      ]);

      const logRows = payload.logs.map((log: any) => {
        const delivery = byId.get(log.entityId);
        return [
          log.entityId,
          delivery?.vehicleNumber || "",
          log.action,
          log.user?.name || "",
          log.user?.role || "",
          log.createdAt ? new Date(log.createdAt).toISOString() : "",
          log.oldValue ? JSON.stringify(log.oldValue) : "",
          log.newValue ? JSON.stringify(log.newValue) : "",
        ];
      });

      downloadExcelXml(deliveryRows, logRows);
    } catch (error: any) {
      alert(error?.message || "Failed to export deliveries");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="space-y-2">
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

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            {filtered.length} deliver{filtered.length !== 1 ? "ies" : "y"}
          </p>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="btn-secondary h-9 px-3 text-xs w-auto shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
        </div>
      </div>

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
                      {getStepDisplayName(del.status)}
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
                            const currentIdx = STEPS.indexOf(getFlowStatus(del.status));
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
                            const isDone = i < STEPS.indexOf(getFlowStatus(del.status));
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
                            const currentIdx = STEPS.indexOf(getFlowStatus(del.status));
                            const isDone = i <= currentIdx;
                            const color = STEP_COLORS[s];
                            return (
                              <span key={s} className={cn(
                                "w-12 text-center -mx-3 leading-tight font-medium",
                                isDone ? color.text : "text-gray-400"
                              )}>
                                {getStepDisplayName(s)}
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
                                            ? `BFH${cp.villageName ? ` - ${cp.villageName}` : ""}`
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <EditableField id={del.id} fieldKey="driverName" label="Driver" type="text" initialValue={del.driverName} isReadonly={isCM} />
                            <PhoneField id={del.id} fieldKey="driverContact" label="Driver Contact" initialValue={del.driverContact} isReadonly={isCM} />
                            <EditableField id={del.id} fieldKey="transporterName" label="Transporter" type="text" initialValue={del.transporterName} isReadonly={isCM} />
                            <EditableField id={del.id} fieldKey="invoiceNo" label="Invoice No" type="text" initialValue={del.invoiceNo} isReadonly={isCM} />
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <EditableField id={del.id} fieldKey="scheduledPickupTime" label="Scheduled Pickup" type="datetime-local" initialValue={del.scheduledPickupTime || ""} isReadonly={isCM} />
                            <EditableField id={del.id} fieldKey="expDeliveryDt" label="Expected Delivery" type="datetime-local" initialValue={del.expDeliveryDt || ""} isReadonly={isCM} />
                            <EditableField id={del.id} fieldKey="actualDeliveryDt" label="Actual Delivery" type="datetime-local" initialValue={del.actualDeliveryDt || ""} isReadonly={isCM} />
                            <EditableField id={del.id} fieldKey="unloadingDt" label="Factory Reached" type="datetime-local" initialValue={del.unloadingDt || ""} isReadonly={isCM} />
                          </div>
                        </div>

                        {/* Card 3: Financial Summary (Receipt Ledger Pattern) */}
                        {!isCM && (
                          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                            <div className="px-3 py-2.5 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                <ScrollText className="w-3.5 h-3.5 text-emerald-500" /> Financial Summary
                              </h4>
                              <div className="w-28 text-right">
                                <EditableField id={del.id} fieldKey="ratePerTon" label="" initialValue={del.ratePerTon} variant="gray" onBeforeChange={(STEPS.indexOf(del.status) >= STEPS.indexOf("COMPLETED") && del.actuallyPaid) ? () => window.confirm("Are you sure you want to change this?") : undefined} />
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
                                    <EditableField id={del.id} fieldKey="advancePaid" label="" initialValue={del.advancePaid} variant="gray" onBeforeChange={(STEPS.indexOf(del.status) >= STEPS.indexOf("COMPLETED") && del.actuallyPaid) ? () => window.confirm("Are you sure you want to change this?") : undefined} />
                                  </div>
                                </div>

                                {/* Misc Amount */}
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Misc Amount</span>
                                  <div className="w-28 text-right flex items-center justify-end gap-1">
                                    {del.miscAmount ? <span className="text-red-500 font-bold">−</span> : null}
                                    <EditableField id={del.id} fieldKey="miscAmount" label="" initialValue={del.miscAmount} variant="gray" onBeforeChange={(STEPS.indexOf(del.status) >= STEPS.indexOf("COMPLETED") && del.actuallyPaid) ? () => window.confirm("Are you sure you want to change this?") : undefined} />
                                  </div>
                                </div>

                                {/* Waiting Charges */}
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Waiting Charges</span>
                                  <div className="w-28 text-right flex items-center justify-end gap-1">
                                    {del.waitingCharges ? <span className="text-red-500 font-bold">−</span> : null}
                                    <EditableField id={del.id} fieldKey="waitingCharges" label="" initialValue={del.waitingCharges} variant="gray" onBeforeChange={(STEPS.indexOf(del.status) >= STEPS.indexOf("COMPLETED") && del.actuallyPaid) ? () => window.confirm("Are you sure you want to change this?") : undefined} />
                                  </div>
                                </div>
                              </div>

                              {/* The "Bottom Line" Callout Block - Changes based on completion */}
                              {(del.status === "COMPLETED" || del.status === "RECEIPT_SUBMITTED") ? (
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-300 font-medium">Balance Paid</span>
                                    <div className="w-28 text-right">
                                      <EditableField id={del.id} fieldKey="actuallyPaid" label="" initialValue={del.actuallyPaid} variant="gray" onBeforeChange={del.actuallyPaid ? () => window.confirm("Are you sure you want to change this?") : undefined} />
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                                    <span className="font-bold text-indigo-800 dark:text-indigo-300 text-xs">Total Payment</span>
                                    <span className="text-base font-bold text-indigo-800 dark:text-indigo-300">
                                      {formatCurrency((del.actuallyPaid || 0) + (del.advancePaid || 0) + (del.miscAmount || 0) + (del.waitingCharges || 0))}
                                    </span>
                                  </div>
                                  {/* Payment Completed Banner */}
                                  {del.actuallyPaid != null && del.actuallyPaid > 0 && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Payment Completed</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
                                    <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">Est. Balance Due</span>
                                    <span className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                                      {formatCurrency((del.idealPayment || 0) - (del.advancePaid || 0) - (del.miscAmount || 0) + (del.waitingCharges || 0))}
                                    </span>
                                  </div>
                                </div>
                              )}

                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons row */}
                      <div className="space-y-2">
                        {!isCM && (
                          <div className="grid grid-cols-2 gap-2">
                            {canGoBack(del.status) ? (
                              <button
                                onClick={() => handleStatusUndo(del.id, del.status)}
                                className="min-h-10 w-full rounded-lg border border-rose-500 text-white text-[11px] font-semibold px-2.5 py-1.5 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm shadow-rose-700/20"
                              >
                                <Undo2 className="w-3 h-3 shrink-0" />
                                <span className="text-center leading-tight whitespace-normal wrap-break-word">
                                  <span className="block">Back to</span>
                                  <span className="block">{getStepDisplayName(getPrevStep(del.status) || "")}</span>
                                </span>
                              </button>
                            ) : (
                              <div className="h-9" />
                            )}

                            {del.status !== "RECEIPT_SUBMITTED" ? (
                              <button
                                onClick={() => handleStatusAdvance(del.id, del.status, del)}
                                className={getAdvanceButtonClass(del.status)}
                              >
                                <span className={cn("w-2 h-2 rounded-full shrink-0", getAdvanceDotClass(del.status))} />
                                {del.status === "COMPLETED" ? (
                                  <span className="text-center leading-tight whitespace-normal wrap-break-word">
                                    <span className="block">Upload</span>
                                    <span className="block">Receipt</span>
                                  </span>
                                ) : (
                                  <span className="text-center leading-tight whitespace-normal wrap-break-word">
                                    <span className="block">Advance to</span>
                                    <span className="block">{getStepDisplayName(getNextStep(del.status) || "")}</span>
                                  </span>
                                )}
                              </button>
                            ) : (
                              <div className="h-9" />
                            )}
                          </div>
                        )}

                        {/* Voucher download buttons */}
                        {(del.advancePaid || del.actuallyPaid) && (
                          <div className="flex gap-2">
                            {del.advancePaid ? (
                              <a
                                href={`/voucher/${del.id}/advance`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-h-9 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold px-2.5 py-1.5 flex items-center justify-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              >
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="text-center leading-tight">
                                  <span className="block">Advance</span>
                                  <span className="block">Voucher</span>
                                </span>
                              </a>
                            ) : null}
                            {del.actuallyPaid ? (
                              <a
                                href={`/voucher/${del.id}/final`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-h-9 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2.5 py-1.5 flex items-center justify-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                              >
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="text-center leading-tight">
                                  <span className="block">Final</span>
                                  <span className="block">Voucher</span>
                                </span>
                              </a>
                            ) : null}
                          </div>
                        )}

                        {/* Activity logs toggle */}
                        <button
                          onClick={() => toggleActivity(del.id)}
                          className={cn(
                            "h-9 rounded-lg border text-[11px] font-medium flex items-center gap-1 px-2.5 transition-colors",
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

      {/* Receipt Prompt Popup */}
      {receiptPromptDelivery && (
        <ReceiptPromptPopup
          delivery={receiptPromptDelivery}
          onClose={() => setReceiptPromptDelivery(null)}
          onConfirm={handleReceiptConfirm}
        />
      )}

      {/* Chat Popup */}
      {chatReqId && (
        <ChatPopup masterReqId={chatReqId} onClose={() => setChatReqId(null)} />
      )}
    </div>
  );
}
