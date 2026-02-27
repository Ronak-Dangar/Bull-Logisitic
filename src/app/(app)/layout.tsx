import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 overflow-hidden h-[100dvh]">
      <Sidebar />
      <main className="flex-1 w-full overflow-y-auto pb-20 md:pb-0 h-[100dvh] custom-scrollbar">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
