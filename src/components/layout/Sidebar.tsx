"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  GitBranch,
  FileText,
  Target,
  AlertCircle,
  Route,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  History,
  FlaskConical,
  GitCompare,
  Beaker,
  Building2,
  Sparkles,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthContext";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const companyWorkspaceNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/company/profile", label: "Company Profile", icon: Building2 },
  { href: "/company/jobs", label: "Jobs", icon: Briefcase },
  { href: "/company/candidates", label: "Candidates", icon: Users },
  { href: "/company/search", label: "AI Search", icon: Sparkles },
  { href: "/company/applications", label: "Applications", icon: FileText },
  { href: "/company/interviews", label: "Interviews", icon: Target },
  { href: "/company/history", label: "Hiring History", icon: History },
];

const companyIntelligenceNav = [
  { href: "/resume-analyzer", label: "Resume Analyzer", icon: FileText },
  { href: "/ai-matching", label: "Matching", icon: GitBranch },
];

const candidateWorkspaceNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/candidate/profile", label: "My Profile", icon: User },
  { href: "/candidate/resume", label: "Resume", icon: FileText },
  { href: "/candidate/jobs", label: "Browse Jobs", icon: Briefcase },
  { href: "/candidate/saved-jobs", label: "Saved Jobs", icon: Bookmark },
  { href: "/candidate/applications", label: "My Applications", icon: FileText },
  { href: "/candidate/interviews", label: "Interviews", icon: Target },
  { href: "/candidate/history", label: "History", icon: History },
];

const candidateIntelligenceNav = [
  { href: "/resume-analyzer", label: "Resume Analyzer", icon: FileText },
  { href: "/candidate/roadmap", label: "Career Roadmap", icon: Route },
  { href: "/ai-matching", label: "Job Matching", icon: GitBranch },
];

const advancedNav = [
  { href: "/ai-lab", label: "Model Compare", icon: GitCompare },
  { href: "/ai-lab/research", label: "Research", icon: Beaker },
];

export function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200",
        open ? "w-60" : "w-16"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Target size={14} />
          </div>
          {open && <span className="font-semibold text-lg tracking-tight">ReqCore</span>}
        </Link>
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <NavSection title="Workspace" items={role === "COMPANY" ? companyWorkspaceNav : candidateWorkspaceNav} isActive={isActive} open={open} />
        <NavSection title="Intelligence" items={role === "COMPANY" ? companyIntelligenceNav : candidateIntelligenceNav} isActive={isActive} open={open} />
      </div>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100",
            isActive("/settings") && "bg-slate-100 text-slate-900"
          )}
        >
          <Settings size={16} />
          {open && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );
}

function NavSection({
  title,
  items,
  isActive,
  open,
}: {
  title: string;
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number }> }[];
  isActive: (href: string) => boolean;
  open: boolean;
}) {
  return (
    <div className="mb-4 px-3">
      {open && <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[1px] text-slate-400">{title}</div>}
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-violet-50 text-violet-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon size={16} />
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
