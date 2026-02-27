"use client";

import { motion } from "framer-motion";
import { Package, Truck, CheckCircle2, Weight, TrendingUp, Clock, Undo } from "lucide-react";
import { formatWeight, formatDate, getStatusColor } from "@/lib/utils";
import { useState, useEffect } from "react";
import { undoActivity } from "@/actions/dashboard";
import { useRouter } from "next/navigation";
import { UrgentApprovalBanner } from "./UrgentApprovalBanner";

const iconMap: Record<string, React.ElementType> = {
  totalRequests: Package,
  inTransit: Truck,
  completedToday: CheckCircle2,
  pendingWeight: Weight,
};

const colorMap: Record<string, string> = {
  totalRequests: "from-blue-500 to-blue-600",
  inTransit: "from-cyan-500 to-cyan-600",
  completedToday: "from-emerald-500 to-emerald-600",
  pendingWeight: "from-amber-500 to-amber-600",
};

const labelMap: Record<string, string> = {
  totalRequests: "Total Requests",
  inTransit: "In Transit",
  completedToday: "Completed Today",
  pendingWeight: "Pending Weight",
};

interface DashboardClientProps {
  kpis: {
    totalRequests: number;
    inTransit: number;
    completedToday: number;
    pendingWeight: number;
  };
  statusDistribution: { name: string; value: number }[];
  recentRequests: any[];
  recentActivity: any[];
  urgentApprovals: any[];
}

export function DashboardClient({
  kpis,
  statusDistribution,
  recentRequests,
  recentActivity,
  urgentApprovals,
}: DashboardClientProps) {
  const router = useRouter();
  const kpiEntries = Object.entries(kpis) as [string, number][];

  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000); // Check every 10s
    return () => clearInterval(timer);
  }, []);

  const handleUndo = async (logId: string) => {
    if (!confirm("Are you sure you want to undo this action?")) return;
    setUndoing(logId);
    try {
      await undoActivity(logId);
      router.refresh();
    } catch (e: any) {
      alert("Failed to undo: " + e.message);
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Urgent Approvals Banner */}
      <UrgentApprovalBanner approvals={urgentApprovals} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiEntries.map(([key, value], index) => {
          const Icon = iconMap[key];
          const color = colorMap[key];
          const label = labelMap[key];
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="card p-4 md:p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                  {Icon && <Icon className="w-5 h-5 text-white" />}
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {key === "pendingWeight" ? formatWeight(value) : value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="card p-5 lg:col-span-1"
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Request Status
          </h3>
          <div className="space-y-3">
            {statusDistribution.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet</p>
            ) : (
              statusDistribution.map((item) => {
                const total = statusDistribution.reduce((s, i) => s + i.value, 0);
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">
                        {item.name.toLowerCase()}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.value} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Recent Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="card p-5 lg:col-span-2"
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Recent Requests
          </h3>
          <div className="space-y-3">
            {recentRequests.length === 0 ? (
              <p className="text-sm text-gray-400">No requests yet</p>
            ) : (
              recentRequests.map((req: any) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {req.commodity} — {formatWeight(req.totalEstWeight)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.cm?.name} • {req._count?.childPickups} stops • {formatDate(req.pickupDate)}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${getStatusColor(req.status)}`}>
                    {req.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="card p-5"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet</p>
          ) : (
            recentActivity.map((log: any) => {
              const ageMs = now - new Date(log.createdAt).getTime();
              const canUndo = ageMs < 60000 && log.oldValue; // 1 min

              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{log.user?.name}</span>{" "}
                        {log.action} on{" "}
                        <span className="font-medium">{log.entityType}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                  {canUndo && (
                    <button
                      onClick={() => handleUndo(log.id)}
                      disabled={undoing === log.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all flex items-center gap-1"
                    >
                      <Undo className="w-3 h-3" />
                      {undoing === log.id ? "..." : "Undo"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
