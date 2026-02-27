"use client";

import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { PushManager } from "@/components/shared/PushManager";

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
            {title || "Dashboard"}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
          )}

          {/* Push Notifications bell */}
          <PushManager mode="icon" />

          {/* Mobile user info */}
          <div className="md:hidden flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {session?.user?.name?.split(" ")[0]}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
