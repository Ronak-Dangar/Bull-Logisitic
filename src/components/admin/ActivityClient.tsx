"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, User2, FileText, ChevronRight } from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import { LogDiff } from "../shared/LogDiff";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  UPDATE: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
  STATUS_CHANGE: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
};

const ENTITY_ICONS: Record<string, string> = {
  DeliveryDetail: "🚛",
  MasterRequest: "📦",
  ChildPickup: "📍",
  User: "👤",
};

export function ActivityClient({ logs }: { logs: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{logs.length} entries</p>

      <div className="space-y-2">
        {logs.length === 0 && (
          <div className="card p-12 text-center text-sm text-gray-400">No activity logs yet</div>
        )}
        {logs.map((log: any, i: number) => {
          const hasChange = log.oldValue || log.newValue;
          const isExpanded = expandedId === log.id;
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="card-hover overflow-hidden"
            >
              <button
                onClick={() => hasChange && setExpandedId(isExpanded ? null : log.id)}
                className={cn(
                  "w-full p-3 flex items-center gap-3 text-left",
                  hasChange ? "cursor-pointer" : "cursor-default"
                )}
              >
                {/* Entity icon */}
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
                  {ENTITY_ICONS[log.entityType] || "📋"}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{log.user?.name}</span>
                    <span className="text-xs text-gray-400">({log.user?.role})</span>
                    <span className={`badge text-[10px] ${ACTION_COLORS[log.action] || "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {log.entityType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>

                {/* Expand indicator */}
                {hasChange && (
                  <ChevronRight className={cn(
                    "w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-90"
                  )} />
                )}
              </button>

              {/* Diff */}
              <AnimatePresence>
                {isExpanded && hasChange && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
                  >
                    <div className="p-3">
                      <LogDiff oldValue={log.oldValue} newValue={log.newValue} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
