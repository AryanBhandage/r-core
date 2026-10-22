"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/components/AuthContext";

interface AppShellProps {
  children: ReactNode;
}

// Marketing + auth render full-bleed without the workspace chrome.
const BARE_ROUTES = ["/", "/login"];

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useAuth();

  const isBare = BARE_ROUTES.includes(pathname);

  // Backend is the source of truth; this only avoids flashing private pages
  // before redirecting. Every API route independently enforces authorization.
  useEffect(() => {
    if (isBare || loading) return;
    if (!session) router.replace("/login");
  }, [isBare, loading, session, router]);

  if (isBare) return <>{children}</>;

  if (loading || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          Loading your workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
