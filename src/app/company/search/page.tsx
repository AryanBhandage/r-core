"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, Loader2, Users } from "lucide-react";
import {
  PageHeader, Panel, inputClass, LoadingState, EmptyState,
  PrimaryButton, SkillChip, Badge,
} from "@/components/portal/Primitives";

export default function CandidateSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/search?target=candidates&q=${encodeURIComponent(query)}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setResults(d.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="AI Candidate Search"
        description="Search your candidate pool in natural language. Every result explains why it matched."
      />

      <Panel className="p-6">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Find candidates with strong React experience who have worked on large-scale web applications"
          />
          <PrimaryButton onClick={run} disabled={busy || !query.trim()}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Search
          </PrimaryButton>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Find candidates with strong React experience who have worked on large-scale web applications",
            "Backend engineers with Python and PostgreSQL",
            "Machine learning candidates with TensorFlow and deployment experience",
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setQuery(suggestion)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-violet-300 hover:text-violet-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
        {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </Panel>

      <div className="mt-5 space-y-3">
        {results === null ? (
          <EmptyState
            icon={<Search size={22} />}
            title="Search the talent pool"
            description="Results rank by embedding similarity and list the terms that produced the match."
          />
        ) : results.length === 0 ? (
          <EmptyState icon={<Users size={22} />} title="No close matches" description="Try broader wording or different skills." />
        ) : (
          <>
            <div className="text-sm text-slate-500">{results.length} candidate{results.length === 1 ? "" : "s"}</div>
            {results.map((r: any) => (
              <Panel key={r.candidate.id} className="p-5 transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/company/candidates/${r.candidate.id}`} className="text-lg font-semibold text-slate-900 hover:text-violet-700">
                      {r.candidate.name}
                    </Link>
                    <div className="mt-0.5 text-sm text-slate-500">
                      {r.candidate.title || "Role not set"} · {r.candidate.experience_years} yrs
                      {r.candidate.location ? ` · ${r.candidate.location}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(r.candidate.skills ?? []).slice(0, 8).map((s: string) => <SkillChip key={s}>{s}</SkillChip>)}
                    </div>
                    {r.reasons?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.reasons.map((why: string) => (
                          <SkillChip key={why} tone="violet">matched “{why}”</SkillChip>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-violet-700">{Math.round(r.similarity * 100)}%</div>
                    <div className="text-[11px] text-slate-500">semantic similarity</div>
                    <Badge tone="slate">{r.candidate.resume_quality}/100 resume</Badge>
                  </div>
                </div>
              </Panel>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
