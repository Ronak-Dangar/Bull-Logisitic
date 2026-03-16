"use client";
import { cn } from "@/lib/utils";

// ─── Field label prettifier ──────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  ratePerTon: "Rate / Ton",
  totalWeightFinal: "Final Weight",
  idealPayment: "Ideal Payment",
  advancePaid: "Advance Paid",
  miscAmount: "Misc Amount",
  waitingCharges: "Waiting Charges",
  actuallyPaid: "Balance Paid",
  vehicleNumber: "Vehicle No.",
  driverName: "Driver",
  driverContact: "Driver Contact",
  transporterName: "Transporter",
  invoiceNo: "Invoice No.",
  totalBags: "Total Bags",
  scheduledPickupTime: "Scheduled Pickup",
  expDeliveryDt: "Expected Delivery",
  actualDeliveryDt: "Actual Delivery",
  unloadingDt: "Factory Reached",
};

const TIMELINE_DATE_FIELDS = new Set([
  "scheduledPickupTime",
  "expDeliveryDt",
  "actualDeliveryDt",
  "unloadingDt",
]);

function formatDateTimeValue(val: string): string {
  const date = new Date(val);
  if (isNaN(date.getTime())) return val;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function prettifyValue(val: any, key?: string): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return val.toLocaleString("en-IN");
  if (typeof val === "string") {
    // Timeline fields always show date+time so minute-level changes are visible in logs.
    if (TIMELINE_DATE_FIELDS.has(key || "") && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      return formatDateTimeValue(val);
    }
    // Other ISO dates keep compact date-only formatting.
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const date = new Date(val);
      if (isNaN(date.getTime())) return val;
      return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }
    // Enum-style
    return val.replace(/_/g, " ");
  }
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

function parseLogValue(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return { value: raw }; }
}

interface LogDiffProps {
  oldValue: any;
  newValue: any;
}

/**
 * Renders a human-friendly diff of old→new values in an activity log entry.
 * Shows a per-field table instead of raw JSON.
 */
export function LogDiff({ oldValue, newValue }: LogDiffProps) {
  const oldObj = parseLogValue(oldValue);
  const newObj = parseLogValue(newValue);

  // Collect all keys from both objects
  const keys = Array.from(new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]));

  if (keys.length === 0) return null;

  return (
    <div className="flex flex-col">
      {keys.map((key) => {
        const before = oldObj?.[key];
        const after = newObj?.[key];
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        
        // Don't show unchanged fields in pure update logs to prevent clutter
        if (!changed && keys.length > 2) return null;
        
        return (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs py-1.5 border-b border-gray-100/60 dark:border-gray-800/60 last:border-0">
            <span className="text-gray-500 font-medium w-32 shrink-0">{FIELD_LABELS[key] || key}</span>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              {changed ? (
                <>
                  {before !== undefined && (
                    <span className="text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                      {prettifyValue(before, key)}
                    </span>
                  )}
                  {before !== undefined && <span className="text-gray-300 dark:text-gray-600">→</span>}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {after !== undefined ? prettifyValue(after, key) : "—"}
                  </span>
                </>
              ) : (
                <span className="text-gray-700 dark:text-gray-300">
                  {before !== undefined ? prettifyValue(before, key) : "—"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
