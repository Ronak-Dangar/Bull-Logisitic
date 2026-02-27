"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/types";
import {
  LayoutDashboard, Package, Truck, MessageSquare, Users,
  Building2, Link as LinkIcon, ScrollText, LogOut
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Truck, MessageSquare, Users,
  Building2, Link: LinkIcon, ScrollText,
};

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  // Show only top 4–5 items for mobile bottom nav
  const filteredNav = NAV_ITEMS
    .filter((item) => item.roles.includes(role))
    .slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
      <div className="flex justify-around items-center py-1.5">
        {filteredNav.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px]",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive && "text-emerald-500"
                  )}
                />
              )}
              <span className="text-[10px] font-medium truncate max-w-[56px]">
                {item.label}
              </span>
              {isActive && (
                <div className="w-4 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </Link>
          );
        })}
        {/* Logout button for mobile bottom nav */}
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] text-gray-500 hover:text-red-500"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium truncate max-w-[56px]">
            Logout
          </span>
        </button>
      </div>
    </nav>
  );
}
