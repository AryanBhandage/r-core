"use client";

import { useRouter } from "next/navigation";
import { Menu, User, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { NotificationsBell } from "@/components/portal/NotificationsBell";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { role, userName, session, logout } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </button>
        <div className="text-sm">
          <span className="text-slate-400">Workspace</span>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="font-medium text-slate-700">
            {role === "COMPANY" ? session?.companyName ?? "Company" : "My Career"}
          </span>
        </div>
        {role && (
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
            {role === "COMPANY" ? "Recruiter" : "Candidate"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100">
            <User size={14} className="text-violet-600" />
          </div>
          <div className="hidden text-sm lg:block">
            <div className="font-medium text-slate-700">{userName}</div>
            <div className="text-[11px] text-slate-400">{session?.email}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <LogOut size={17} />
        </button>
      </div>
    </div>
  );
}
