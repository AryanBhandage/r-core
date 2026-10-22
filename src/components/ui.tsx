"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-brand-100 bg-white/80 ${
        glow ? "shadow-[0_8px_40px_rgba(124,58,237,0.12)]" : "shadow-sm"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  kicker,
  title,
  sub,
  right,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">
            {kicker}
          </div>
        )}
        <h3 className="mt-1 text-xl font-semibold text-ink">{title}</h3>
        {sub && <p className="mt-1 max-w-2xl text-sm text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  children,
  tone = "brand",
  className = "",
}: {
  children: ReactNode;
  tone?: "brand" | "purple" | "green" | "amber" | "red" | "neutral";
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-100 text-brand-800 border-brand-200",
    purple: "bg-brand-600 text-white border-brand-600",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary:
      "bg-brand-600 text-white shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:bg-brand-700 hover:shadow-[0_6px_26px_rgba(124,58,237,0.45)] active:scale-[0.98]",
    ghost: "bg-transparent text-brand-700 hover:bg-brand-50",
    outline:
      "border border-brand-200 bg-white text-brand-700 hover:border-brand-400 hover:bg-brand-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Progress({
  value,
  className = "",
  barClass = "bg-brand-600",
}: {
  value: number;
  className?: string;
  barClass?: string;
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-brand-100 ${className}`}>
      <motion.div
        className={`h-full rounded-full ${barClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-brand-500">
        {label}
      </div>
      <div className="mt-0.5 text-base font-bold text-ink">{value}</div>
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
      {children}
    </span>
  );
}
