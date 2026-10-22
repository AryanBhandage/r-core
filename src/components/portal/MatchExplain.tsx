"use client";

import { AlertTriangle, Check, Minus, X, Quote } from "lucide-react";
import { Panel, SkillChip, Badge } from "./Primitives";

export interface MatchExplanationView {
  overall: number;
  tier: string;
  components: { key: string; label: string; score: number | null; applicable: boolean }[];
  matchedSkills: { skill: string; evidence: string }[];
  partialSkills: { skill: string; evidence: string }[];
  missingSkills: { skill: string; evidence: string }[];
  evidence: string[];
  hardWarning: { title: string; message: string } | null;
  cosineSimilarity?: number;
}

function tone(score: number) {
  return score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-rose-500";
}

/**
 * Explainable AI match panel: score, per-requirement component scores,
 * matched / partial / missing skills with their evidence, and the resume
 * excerpts that produced the score. No black-box numbers.
 */
export function MatchExplain({ match, compact = false }: { match: MatchExplanationView; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Overall match</div>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">{match.overall}%</div>
          </div>
          <Badge tone={match.overall >= 75 ? "green" : match.overall >= 55 ? "amber" : "red"}>{match.tier}</Badge>
          {match.cosineSimilarity !== undefined && (
            <div className="text-xs text-slate-500">
              Semantic similarity <span className="font-semibold text-slate-800">{match.cosineSimilarity.toFixed(3)}</span>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {match.components.map((c) => (
            <div key={c.key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">{c.label}</div>
              {c.applicable && c.score !== null ? (
                <>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{c.score}%</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${tone(c.score)}`} style={{ width: `${c.score}%` }} />
                  </div>
                </>
              ) : (
                <div className="mt-2 text-xs font-medium text-slate-400">Not specified in job</div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {match.hardWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="text-sm font-semibold text-amber-900">{match.hardWarning.title}</div>
            <div className="mt-0.5 text-sm text-amber-800">{match.hardWarning.message}</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SkillList title="Matching skills" icon={<Check size={13} />} items={match.matchedSkills} toneClass="text-emerald-600" />
        <SkillList title="Partial matches" icon={<Minus size={13} />} items={match.partialSkills} toneClass="text-amber-600" />
        <SkillList title="Skill gaps" icon={<X size={13} />} items={match.missingSkills} toneClass="text-rose-600" />
      </div>

      {!compact && match.evidence.length > 0 && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Quote size={15} className="text-violet-500" /> Relevant evidence from the resume
          </div>
          <ul className="space-y-2">
            {match.evidence.map((e, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {e}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function SkillList({
  title,
  icon,
  items,
  toneClass,
}: {
  title: string;
  icon: React.ReactNode;
  items: { skill: string; evidence: string }[];
  toneClass: string;
}) {
  return (
    <Panel className="p-4">
      <div className={`mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${toneClass}`}>
        {icon} {title} <span className="text-slate-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">None</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.skill}>
              <SkillChip tone="slate">{s.skill}</SkillChip>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{s.evidence}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
