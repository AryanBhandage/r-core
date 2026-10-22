"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Filter, X, MapPin } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  PageHeader,
  Panel,
  Field,
  inputClass,
  SkillChip,
  LoadingState,
  EmptyState,
  SecondaryButton,
} from "@/components/portal/Primitives";

interface CandidateRow {
  id: number;
  name: string;
  title: string | null;
  location: string | null;
  experience_years: number;
  resume_quality: number;
  skills: string[];
  education: string[];
}

export default function BrowseCandidatesPage() {
  const { loading: sessionLoading } = useAuth();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [skills, setSkills] = useState("");
  const [minExperience, setMinExperience] = useState("any");
  const [education, setEducation] = useState("");
  const [location, setLocation] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (skills.trim()) params.set("skills", skills.trim());
      if (minExperience !== "any") params.set("minExperience", minExperience);
      if (education.trim()) params.set("education", education.trim());
      if (location.trim()) params.set("location", location.trim());

      const res = await fetch(`/api/portal/candidates?${params.toString()}`);
      const data = await res.json();
      setCandidates(data.ok ? data.candidates : []);
    } finally {
      setLoading(false);
    }
  }, [q, skills, minExperience, education, location]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const clearFilters = () => {
    setQ("");
    setSkills("");
    setMinExperience("any");
    setEducation("");
    setLocation("");
  };

  const hasFilters = Boolean(q || skills || education || location || minExperience !== "any");

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Candidates"
        description="Browse the candidate pool and filter by skills, experience and education."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Panel className="h-fit p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter size={15} /> Filters
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <div className="space-y-4">
            <Field label="Name or role">
              <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Engineer" />
            </Field>
            <Field label="Skills" hint="Comma separated. Matches all.">
              <input className={inputClass} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, AWS" />
            </Field>
            <Field label="Minimum experience">
              <select className={inputClass} value={minExperience} onChange={(e) => setMinExperience(e.target.value)}>
                <option value="any">Any</option>
                <option value="1">1+ years</option>
                <option value="3">3+ years</option>
                <option value="5">5+ years</option>
                <option value="8">8+ years</option>
              </select>
            </Field>
            <Field label="Education">
              <input className={inputClass} value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Bachelor, B.Tech…" />
            </Field>
            <Field label="Location">
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote" />
            </Field>
          </div>
        </Panel>

        <div>
          {sessionLoading || loading ? (
            <LoadingState label="Loading candidates" />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="No candidates match your filters"
              description="Try widening your search or clearing filters to see more of the talent pool."
              action={hasFilters ? <SecondaryButton onClick={clearFilters}>Clear filters</SecondaryButton> : undefined}
            />
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                {candidates.length} candidate{candidates.length === 1 ? "" : "s"} available
              </div>
              {candidates.map((c) => (
                <Panel key={c.id} className="p-5 transition-shadow hover:shadow-md">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/company/candidates/${c.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-violet-700"
                      >
                        {c.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span className="font-medium text-slate-700">{c.title || "Role not set"}</span>
                        <span>{c.experience_years} yrs experience</span>
                        {c.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={13} /> {c.location}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.skills.slice(0, 8).map((s) => (
                          <SkillChip key={s}>{s}</SkillChip>
                        ))}
                        {c.skills.length === 0 && <span className="text-xs text-slate-400">No skills recorded</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Resume quality</div>
                        <div className="text-lg font-semibold text-slate-900">{c.resume_quality}/100</div>
                      </div>
                      <Link
                        href={`/company/candidates/${c.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
