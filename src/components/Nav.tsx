"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, FlaskConical, User } from "lucide-react";
import { motion } from "framer-motion";

const links = [
  { href: "/", label: "Home" },
  { href: "/ai-lab", label: "AI Lab" },
  { href: "/ai-lab/pipeline", label: "AI Pipeline" },
  { href: "/candidate", label: "Candidate" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)]">
            <Sparkles size={16} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-ink">ReqCore</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-brand-500">
              AI Lab
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "text-brand-700" : "text-slate-500 hover:text-brand-700"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-brand-50"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {l.href.startsWith("/ai-lab") && <FlaskConical size={13} />}
                  {l.href.startsWith("/candidate") && <User size={13} />}
                  {l.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
