"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, X, Sparkles, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Briefcase, Wand2, Loader2 } from "lucide-react";
import {
  PageHeader,
  Panel,
  Field,
  inputClass,
  SkillChip,
  LoadingState,
  EmptyState,
  SecondaryButton,
  Badge,
} from "@/components/portal/Primitives";

type Tab = "all" | "search" | "recommended";

interface JobRow {
  id: number;
  title: string;
  slug: string | null;
  department: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  salary_range: string | null;
  required_skills: string[] | null;
  preferred_skills: string[] | null;
  experience_required: number | null;
  deadline: string | null;
  companyName: string | null;
  applicantCount?: number;
}

export default function CandidateJobsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [workMode, setWorkMode] = useState("any");
  const [employmentType, setEmploymentType] = useState("any");
  const [maxExperience, setMaxExperience] = useState("any");
  const [minSalary, setMinSalary] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<any[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [recs, setRecs] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "9", sort });
      if (q.trim()) params.set("q", q.trim());
      if (location.trim()) params.set("location", location.trim());
      if (skills.trim()) params.set("skills", skills.trim());
      if (workMode !== "any") params.set("workMode", workMode);
      if (employmentType !== "any") params.set("employmentType", employmentType);
      if (maxExperience !== "any") params.set("maxExperience", maxExperience);
      if (minSalary) params.set("minSalary", minSalary);

      const res = await fetch(`/api/portal/jobs?${params}`);
      const data = await res.json();
      setJobs(data.ok ? data.jobs : []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [q, location, skills, workMode, employmentType, maxExperience, minSalary, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/portal/saved-jobs")
      .then((r) => r.json())
      .then((d) => d.ok && setSavedIds(new Set(d.saved.map((s: any) => s.jobId))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "recommended" || recs) return;
    fetch("/api/portal/recommendations")
      .then((r) => r.json())
      .then((d) => d.ok && setRecs(d.recommendations))
      .catch(() => setRecs([]));
  }, [tab, recs]);

  const toggleSave = async (jobId: number) => {
    const next = new Set(savedIds);
    const saving = !next.has(jobId);
    if (saving) next.add(jobId);
    else next.delete(jobId);
    setSavedIds(next);
    await fetch("/api/portal/saved-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, saved: saving }),
    });
  };

  const runAiSearch = async () => {
    if (!aiQuery.trim()) return;
    setAiBusy(true);
    try {
      const res = await fetch(`/api/portal/search?target=jobs&q=${encodeURIComponent(aiQuery)}`);
      const data = await res.json();
      setAiResults(data.ok ? data.results : []);
    } finally {
      setAiBusy(false);
    }
  };

  const clearFilters = () => {
    setQ(""); setLocation(""); setSkills(""); setWorkMode("any");
    setEmploymentType("any"); setMaxExperience("any"); setMinSalary(""); setPage(1);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Browse Jobs"
        description="Every open role on ReqCore, with semantic AI search and profile-based recommendations."
      />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {([["all", "All jobs"], ["search", "AI search"], ["recommended", "Recommended for you"]] as [Tab, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 pb-3 text-sm font-medium transition-colors ${
                tab === key ? "border-b-2 border-violet-600 text-violet-700" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {tab === "search" && (
        <Panel className="p-6">
          <h2 className="font-semibold text-slate-900">Semantic job search</h2>
          <p className="mt-1 text-sm text-slate-500">
            Describe the role you want in plain language — e.g. “remote backend jobs involving Python and machine learning”.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              className={inputClass}
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
              placeholder="Find remote backend jobs involving Python and machine learning"
            />
            <PrimaryBtn onClick={runAiSearch} disabled={aiBusy || !aiQuery.trim()}>
              {aiBusy ? <Loader2Small /> : <Sparkles size={15} />} Search
            </PrimaryBtn>
          </div>

          <div className="mt-5 space-y-3">
            {aiResults === null ? (
              <p className="text-sm text-slate-400">Results and their match reasons appear here.</p>
            ) : aiResults.length === 0 ? (
              <EmptyState icon={<Sparkles size={20} />} title="No close matches" description="Try different wording or add skills you care about." />
            ) : (
              aiResults.map((r: any) => (
                <Panel key={r.job.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/candidate/jobs/${r.job.id}`} className="font-semibold text-slate-900 hover:text-violet-700">
                        {r.job.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {r.job.companyName} · {r.job.location} {r.job.work_mode ? `· ${r.job.work_mode}` : ""}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.reasons.map((why: string) => (
                          <SkillChip key={why} tone="violet">matches “{why}”</SkillChip>
                        ))}
                      </div>
                    </div>
                    <Badge tone="violet">{Math.round(r.similarity * 100)}% similar</Badge>
                  </div>
                </Panel>
              ))
            )}
          </div>
        </Panel>
      )}

      {tab === "recommended" && (
        <div className="space-y-3">
          {!recs ? (
            <LoadingState label="Finding recommendations" />
          ) : recs.length === 0 ? (
            <EmptyState icon={<Wand2 size={20} />} title="No recommendations yet" description="Add skills and experience to your profile to get matched roles." />
          ) : (
            recs.map((r: any) => (
              <Panel key={r.job.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/candidate/jobs/${r.job.id}`} className="text-lg font-semibold text-slate-900 hover:text-violet-700">
                      {r.job.title}
                    </Link>
                    <div className="mt-1 text-sm text-slate-500">
                      {r.job.location} {r.job.work_mode ? `· ${r.job.work_mode}` : ""} · {r.job.employment_type}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.match.matchedSkills.slice(0, 6).map((s: string) => (
                        <SkillChip key={s} tone="violet">{s}</SkillChip>
                      ))}
                      {r.match.missingSkills.slice(0, 3).map((s: string) => (
                        <SkillChip key={s} tone="amber">gap: {s}</SkillChip>
                      ))}
                    </div>
                    {r.reasons?.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-500">Because: {r.reasons.join(", ")}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-violet-700">{r.match.overall}%</div>
                    <div className="text-[11px] text-slate-500">{r.match.tier}</div>
                    {r.alreadyApplied && <Badge tone="green">Applied</Badge>}
                  </div>
                </div>
              </Panel>
            ))
          )}
        </div>
      )}

      {tab === "all" && (
        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          <Panel className="h-fit p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Filter size={15} /> Filters</div>
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                <X size={12} /> Clear
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Keyword"><input className={inputClass} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></Field>
              <Field label="Skills" hint="Comma separated, matches all">
                <input className={inputClass} value={skills} onChange={(e) => { setSkills(e.target.value); setPage(1); }} placeholder="Python, AWS" />
              </Field>
              <Field label="Location"><input className={inputClass} value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} /></Field>
              <Field label="Work mode">
                <select className={inputClass} value={workMode} onChange={(e) => { setWorkMode(e.target.value); setPage(1); }}>
                  <option value="any">Any</option><option>Remote</option><option>Hybrid</option><option>On-site</option>
                </select>
              </Field>
              <Field label="Employment type">
                <select className={inputClass} value={employmentType} onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }}>
                  <option value="any">Any</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option>
                </select>
              </Field>
              <Field label="Max experience">
                <select className={inputClass} value={maxExperience} onChange={(e) => { setMaxExperience(e.target.value); setPage(1); }}>
                  <option value="any">Any</option><option value="0">No experience</option><option value="2">Up to 2 years</option>
                  <option value="5">Up to 5 years</option>
                </select>
              </Field>
              <Field label="Min salary"><input className={inputClass} value={minSalary} onChange={(e) => { setMinSalary(e.target.value); setPage(1); }} placeholder="100000" /></Field>
              <Field label="Sort by">
                <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest</option><option value="oldest">Oldest</option>
                  <option value="title">Title</option><option value="deadline">Closing soon</option>
                </select>
              </Field>
            </div>
          </Panel>

          <div>
            {loading ? (
              <LoadingState label="Loading jobs" />
            ) : jobs.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={22} />}
                title="No jobs match your filters"
                description="Widen your search or clear the filters to see more roles."
                action={<SecondaryButton onClick={clearFilters}>Clear filters</SecondaryButton>}
              />
            ) : (
              <>
                <div className="mb-3 text-sm text-slate-500">{total} open role{total === 1 ? "" : "s"}</div>
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <Panel key={job.id} className="p-5 transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <Link href={`/candidate/jobs/${job.id}`} className="text-lg font-semibold text-slate-900 hover:text-violet-700">
                            {job.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                            <span className="font-medium text-slate-700">{job.companyName}</span>
                            {job.location && <span>{job.location}</span>}
                            {job.work_mode && <Badge>{job.work_mode}</Badge>}
                            {job.employment_type && <span>{job.employment_type}</span>}
                            {job.salary_range && <span className="font-medium text-slate-700">{job.salary_range}</span>}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(job.required_skills ?? []).slice(0, 6).map((s) => <SkillChip key={s} tone="violet">{s}</SkillChip>)}
                            {(job.preferred_skills ?? []).slice(0, 3).map((s) => <SkillChip key={s}>{s}</SkillChip>)}
                          </div>
                          {job.deadline && (
                            <div className="mt-2 text-xs text-slate-400">
                              Apply by {new Date(job.deadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => toggleSave(job.id)}
                            title={savedIds.has(job.id) ? "Unsave" : "Save job"}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                          >
                            {savedIds.has(job.id) ? <BookmarkCheck size={16} className="text-violet-600" /> : <Bookmark size={16} />}
                          </button>
                          <Link href={`/candidate/jobs/${job.id}`} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                            View job
                          </Link>
                        </div>
                      </div>
                    </Panel>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
                  <div className="flex gap-2">
                    <SecondaryButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      <ChevronLeft size={15} /> Prev
                    </SecondaryButton>
                    <SecondaryButton onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      Next <ChevronRight size={15} />
                    </SecondaryButton>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
const Loader2Small = () => <Loader2 size={15} className="animate-spin" />;
