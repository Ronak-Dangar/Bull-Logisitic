import { type ClassValue, clsx } from "clsx";

// Simple clsx-style utility (no twMerge needed with Tailwind v4)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatWeight(weight: number | null | undefined): string {
  if (weight == null) return "—";
  return `${weight.toFixed(1)} kg`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function timeSince(date: Date | string | null | undefined): string {
  if (!date) return "";
  const t = new Date(date).getTime();
  if (isNaN(t)) return "";
  const seconds = Math.floor((Date.now() - t) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " mins";
  return Math.floor(seconds) + " seconds";
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    SUBMITTED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    FINDING_VEHICLE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    UNABLE_TO_FIND: "bg-red-500/20 text-red-500 border-red-500/30",
    PROCESSED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    OVER_TO_NEXT: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    SCHEDULED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    LOADING: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    IN_TRANSIT: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    UNLOADING: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
    PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    LOADED: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
