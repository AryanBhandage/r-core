"use client";

import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Route, Sparkles } from "lucide-react";
import { Panel, SkillChip } from "./Primitives";

export interface PortalMatch {
  candidate: { id: number; name: string; title: string | null; experience_years: number | null };
  job: { id: number; title: string; companyName: string | null };
  match: {
    overall_score: number;
    match_tier: string;
    hard_warning: { title: string; message: string } | null;
    cosine_similarity: number;
    applicable_components: Record<string, boolean>;
    formula_breakdown: Record<string, unknown>;
  };
  coverage: {
    requiredMatched: number;
    requiredTotal: number;
    requiredPercent: number;
    preferredMatched: number;
    preferredTotal: number;
    preferredPercent: number;
  };
  requiredGaps: { skill: string; status: string; evidence: string }[];
  preferredGaps: { skill: string; status: string; evidence: string }[];
  roadmap: {
    target_role: string;
    readiness: number;
    required_gaps_count: number;
    items: {
      phase: number;
      phaseLabel: string;
      skill: string;
      tier: string;
      why: string;
      outcome: string;
      project: string;
      duration: string;
      prerequisite: string;
      targetJobRequirement: string;
    }[];
  } | null;
}

function tierTone(tier: string) {
  if (tier === "Strong Match") return "bg-emerald-100 text-emerald-700";
  if (tier === "Moderate Match") return "bg-amber-100 text-amber-700";
  if (tier === "Partial Match") return "bg-orange-100 text-orange-700";
  return "bg-rose-100 text-rose-700";
}

function ringTone(score: number) {
  if (score >= 75) return "#10b981";
  if (score >= 55) return "#f59e0b";
  return "#f43f5e";
}

export function MatchResultView({ data, showRoadmap = true }: { data: PortalMatch; showRoadmap?: boolean }) {
  const { match, coverage, requiredGaps, preferredGaps, roadmap } = data;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (match.overall_score / 100) * circumference;

  return (
    <div className="space-y-5">
      {/* Score summary */}
      <Panel className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <svg width="128" height="128" className="-rotate-90">
              <circle cx="64" cy="64" r="52" stroke="#f1f5f9" strokeWidth="11" fill="none" />
              <motion.circle
                cx="64"
                cy="64"
                r="52"
                stroke={ringTone(match.overall_score)}
                strokeWidth="11"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight text-slate-900">
                {match.overall_score}%
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">match</span>
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tierTone(match.match_tier)}`}>
              {match.match_tier}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {data.candidate.name} → {data.job.title}
            </h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <CoverageBar
                label="Required skills"
                matched={coverage.requiredMatched}
                total={coverage.requiredTotal}
                percent={coverage.requiredPercent}
                tone="violet"
              />
              <CoverageBar
                label="Preferred skills"
                matched={coverage.preferredMatched}
                total={coverage.preferredTotal}
                percent={coverage.preferredPercent}
                tone="slate"
              />
            </div>
          </div>
        </div>

        {match.hard_warning && (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-semibold text-amber-900">{match.hard_warning.title}</div>
              <div className="mt-0.5 text-sm text-amber-800">{match.hard_warning.message}</div>
            </div>
          </div>
        )}
      </Panel>

      {/* Skill breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <GapColumn title="Required skills" gaps={requiredGaps} emptyLabel="No required skills listed." />
        <GapColumn title="Preferred skills" gaps={preferredGaps} emptyLabel="No preferred skills listed." />
      </div>

      {/* Roadmap */}
      {showRoadmap && roadmap && roadmap.items.length > 0 && (
        <Panel className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700">
                <Route size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">What to learn to close the gap</h3>
                <p className="text-xs text-slate-500">
                  {roadmap.required_gaps_count} required gap{roadmap.required_gaps_count === 1 ? "" : "s"} · generated
                  from this specific role
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Readiness</div>
              <div className="text-lg font-semibold text-slate-900">{roadmap.readiness}%</div>
            </div>
          </div>

          <div className="relative ml-3 space-y-4 border-l-2 border-slate-100 pl-7">
            {roadmap.items.map((item, i) => (
              <motion.div
                key={`${item.skill}-${i}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="relative"
              >
                <span className="absolute -left-[38px] top-1 grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-[10px] font-bold text-white ring-4 ring-white">
                  {item.phase ?? i + 1}
                </span>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900">{item.skill}</h4>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.tier === "REQUIRED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.tier}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {item.duration}
                      </span>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-slate-600">
                    <Row label="Why" value={item.why} />
                    <Row label="Learn" value={item.outcome} />
                    <Row label="Build" value={item.project} />
                    <Row label="Prerequisite" value={item.prerequisite} />
                  </dl>
                </div>
              </motion.div>
            ))}
          </div>
        </Panel>
      )}

      {showRoadmap && roadmap && roadmap.items.length === 0 && (
        <Panel className="flex items-center gap-3 p-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
            <Sparkles size={17} />
          </div>
          <div>
            <div className="font-semibold text-slate-900">No skill gaps for this role</div>
            <div className="text-sm text-slate-500">Every listed requirement is already covered.</div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-slate-800">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CoverageBar({
  label,
  matched,
  total,
  percent,
  tone,
}: {
  label: string;
  matched: number;
  total: number;
  percent: number;
  tone: "violet" | "slate";
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">
          {matched}/{total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className={`h-full rounded-full ${tone === "violet" ? "bg-violet-600" : "bg-slate-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function GapColumn({
  title,
  gaps,
  emptyLabel,
}: {
  title: string;
  gaps: { skill: string; status: string; evidence: string }[];
  emptyLabel: string;
}) {
  return (
    <Panel className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {gaps.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {gaps.map((g) => {
            const matched = g.status === "MATCHED";
            const partial = g.status === "PARTIAL";
            return (
              <li key={g.skill} className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                    matched ? "bg-emerald-500" : partial ? "bg-amber-500" : "bg-rose-500"
                  } text-white`}
                >
                  {matched ? <Check size={10} /> : <X size={10} />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{g.skill}</div>
                  <div className="text-[11px] leading-relaxed text-slate-500">{g.evidence}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
