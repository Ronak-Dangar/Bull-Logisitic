"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";
import { NAV_ITEMS } from "@/types";
import {
  LayoutDashboard, Package, Truck, MessageSquare, Users,
  Building2, Factory, Link as LinkIcon, ScrollText, LogOut, ChevronLeft
} from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Truck, MessageSquare, Users,
  Building2, Factory, Link: LinkIcon, ScrollText,
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 sticky top-0",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        <Image
          src="/logo.png"
          alt="Bull Logistic"
          width={36}
          height={36}
          className="rounded-lg flex-shrink-0"
        />
        {!collapsed && (
          <span className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent truncate">
            Bull Logistic
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft
            className={cn(
              "w-4 h-4 text-gray-500 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              {Icon && <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-500")} />}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {getInitials(session?.user?.name || "U")}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {session?.user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{role}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
