"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Card } from "./ui";

// ---------------------------------------------------------------------------
// AnimatedScore: counts from 0 to `value` using a motion value.
// ---------------------------------------------------------------------------
export function AnimatedScore({
  value,
  className = "",
  suffix = "%",
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  const [display, setDisplay] = useState("0");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      const ctrl = animate(mv, value, { duration: 1.4, ease: "easeOut" });
      const unsub = mv.on("change", (v) => setDisplay(Math.round(v).toString()));
      return () => {
        ctrl.stop();
        unsub();
      };
    }
    started.current = true;
    const ctrl = animate(mv, value, { duration: 1.4, ease: "easeOut" });
    const unsub = mv.on("change", (v) => setDisplay(Math.round(v).toString()));
    return () => {
      ctrl.stop();
      unsub();
    };
  }, [value, mv]);

  return (
    <span className={`${className} tabular-nums`}>
      {display}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ScoreRing: circular progress gauge.
// ---------------------------------------------------------------------------
export function ScoreRing({
  value,
  size = 150,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProgress(value), 100);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eee9ff" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#grad)"
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * progress) / 100}
          style={{ transition: "stroke-dashoffset 1.4s ease-out" }}
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a583f7" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-ink">
          <AnimatedScore value={progress} />
        </div>
        {label && <div className="text-[11px] font-medium text-slate-500">{label}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VectorSpace: illustrative 2D projection of the embedding vectors.
// ---------------------------------------------------------------------------
export function VectorSpace({
  cosine,
  candidatePoints,
}: {
  cosine: number;
  candidatePoints: number[][];
}) {
  // deterministic 2D projection (first two components of the normalized vector)
  const project = (v: number[]) => {
    const x = v[0] ?? 0;
    const y = v[1] ?? 0;
    return { x: Math.max(0.12, Math.min(0.88, 0.5 + x * 0.8)), y: Math.max(0.12, Math.min(0.88, 0.5 + y * 0.8)) };
  };
  const cand = project(candidatePoints[0] ?? []);
  const job = project(candidatePoints[1] ?? []);
  const sx = (cand.x + job.x) / 2;
  const sy = (cand.y + job.y) / 2;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">Semantic Vector Space</div>
          <div className="text-[11px] text-slate-400">
            Illustrative 2D projection — actual vectors are high-dimensional
          </div>
        </div>
        <div className="rounded-lg bg-brand-600 px-3 py-1 text-sm font-bold text-white">
          Cosine: {cosine.toFixed(2)}
        </div>
      </div>
      <div className="grid-bg relative aspect-[2/1] w-full overflow-hidden rounded-xl border border-brand-100 bg-white/70">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" preserveAspectRatio="none">
          <line
            x1={cand.x * 200}
            y1={cand.y * 100}
            x2={job.x * 200}
            y2={job.y * 100}
            stroke="#c2b0fb"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        </svg>
        <motion.div
          className="absolute h-4 w-4 rounded-full bg-brand-600 shadow-[0_0_20px_rgba(124,58,237,0.7)]"
          style={{ top: `${cand.y * 100}%`, left: `${cand.x * 100}%` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <span className="absolute left-5 top-0 whitespace-nowrap text-[11px] font-semibold text-brand-800">
            Candidate
          </span>
        </motion.div>
        <motion.div
          className="absolute h-4 w-4 rounded-full bg-brand-300 border-2 border-white shadow-[0_0_16px_rgba(196,181,253,0.8)]"
          style={{ top: `${job.y * 100}%`, left: `${job.x * 100}%` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="absolute left-5 top-0 whitespace-nowrap text-[11px] font-semibold text-brand-600">
            Job
          </span>
        </motion.div>
        {/* center of attraction */}
        <motion.div
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500"
          style={{ top: `${sy * 100}%`, left: `${sx * 100}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <span className="absolute left-3 top-0 whitespace-nowrap text-[10px] text-slate-400">
            related
          </span>
        </motion.div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PipelineStageNode: one stage in the animated pipeline.
// ---------------------------------------------------------------------------
export function PipelineStageNode({
  index,
  title,
  tag,
  status,
  expanded,
  input,
  process,
  output,
  onToggle,
}: {
  index: number;
  title: string;
  tag: string;
  status: "pending" | "running" | "done" | "error";
  expanded: boolean;
  input: string;
  process: string;
  output: string;
  onToggle: () => void;
}) {
  const statusColor =
    status === "done"
      ? "bg-emerald-400"
      : status === "running"
      ? "bg-amber-400"
      : status === "error"
      ? "bg-rose-400"
      : "bg-brand-200";
  const tagColor =
    tag === "generative"
      ? "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
      : tag === "machine_learning"
      ? "bg-brand-100 text-brand-800 border-brand-200"
      : tag === "semantic"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div
        className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-brand-100 bg-white/80 px-4 py-3 transition-all hover:border-brand-300 hover:shadow-sm"
        onClick={onToggle}
      >
        <div className="relative flex items-center">
          <motion.span
            className={`flex h-3.5 w-3.5 rounded-full ${statusColor}`}
            animate={status === "running" ? { scale: [1, 1.4, 1] } : {}}
            transition={{ repeat: status === "running" ? Infinity : 0, duration: 0.8 }}
          />
          <span className="absolute left-5 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-brand-100" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] text-slate-400">{(index + 1).toString().padStart(2, "0")}</span>
            <span className="text-sm font-semibold text-ink">{title}</span>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tagColor}`}>
          {tag.replace("_", " ")}
        </span>
      </div>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mt-2 overflow-hidden rounded-xl border border-brand-100 bg-brand-50/50 p-4"
        >
          <InfoRow label="INPUT" value={input} />
          <InfoRow label="PROCESS" value={process} />
          <InfoRow label="OUTPUT" value={output} />
        </motion.div>
      )}
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{label}</div>
      <div className="text-sm text-slate-700">{value}</div>
    </div>
  );
}
