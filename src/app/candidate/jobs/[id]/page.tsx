"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Bookmark, BookmarkCheck, Send, CheckCircle2, Loader2,
  Sparkles, AlertTriangle, CalendarClock,
} from "lucide-react";
import {
  Panel, Field, inputClass, SkillChip, LoadingState, PrimaryButton,
  SecondaryButton, StatusPill, Badge,
} from "@/components/portal/Primitives";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"details" | "fit">("details");

  const [showApply, setShowApply] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fit, setFit] = useState<any>(null);
  const [fitLoading, setFitLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/jobs/${params.id}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setJob(d.job);
      setApplication(d.application);
      setSaved(Boolean(d.saved));
      if (d.application) setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load job.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadFit = useCallback(async () => {
    setFitLoading(true);
    setTab("fit");
    try {
      const res = await fetch("/api/portal/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: Number(params.id), includeRoadmap: true }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setFit(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze your fit.");
    } finally {
      setFitLoading(false);
    }
  }, [params.id]);

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    await fetch("/api/portal/saved-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: Number(params.id), saved: next }),
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: Number(params.id), answers, cover_letter: coverLetter }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setApplication(d.application);
      setApplied(true);
      setShowApply(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading job" />;
  if (!job) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error ?? "Job not found."}</div>;
  }

  const questions = (job.custom_questions ?? []) as { id: string; label: string; required: boolean }[];

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => router.push("/candidate/jobs")} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} /> Back to jobs
      </button>

      <Panel className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{job.companyName}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin size={13} /> {job.location}</span>}
              {job.work_mode && <Badge>{job.work_mode}</Badge>}
              {job.employment_type && <span>{job.employment_type}</span>}
              {job.salary_range && <span className="font-medium text-slate-700">{job.salary_range}</span>}
              <span>{job.experience_required ? `${job.experience_required}+ yrs` : "Experience flexible"}</span>
            </div>
            {job.deadline && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                <CalendarClock size={13} /> Applications close {new Date(job.deadline).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SecondaryButton onClick={toggleSave}>
              {saved ? <BookmarkCheck size={15} className="text-violet-600" /> : <Bookmark size={15} />}
              {saved ? "Saved" : "Save"}
            </SecondaryButton>
            {applied ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={15} /> Applied <StatusPill status={application?.status ?? "APPLIED"} />
              </div>
            ) : (
              <PrimaryButton onClick={() => setShowApply(true)}>
                <Send size={15} /> Apply now
              </PrimaryButton>
            )}
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {showApply && !applied && (
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/40 p-5">
            <h3 className="font-semibold text-slate-900">Apply for {job.title}</h3>
            <p className="mt-1 text-xs text-slate-600">
              Your saved profile and resume are shared with {job.companyName}.
            </p>
            <div className="mt-4 space-y-4">
              {questions.map((question) => (
                <Field
                  key={question.id}
                  label={question.label}
                  hint={question.required ? "Required" : "Optional"}
                >
                  <textarea
                    rows={2}
                    required={question.required}
                    className={`${inputClass} resize-none`}
                    value={answers[question.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  />
                </Field>
              ))}
              <Field label="Cover letter" hint="Optional">
                <textarea
                  rows={4}
                  className={`${inputClass} resize-none`}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <PrimaryButton
                onClick={submit}
                disabled={
                  submitting ||
                  questions.some((q) => q.required && !String(answers[q.id] ?? "").trim())
                }
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Submit application
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowApply(false)}>Cancel</SecondaryButton>
            </div>
          </div>
        )}
      </Panel>

      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {(["details", "fit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => (t === "fit" && !fit ? loadFit() : setTab(t))}
            className={`px-4 pb-3 text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-violet-600 text-violet-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "details" ? "Job details" : "My fit & roadmap"}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div className="space-y-5 md:col-span-2">
            {job.description && (
              <Panel className="p-6">
                <h2 className="mb-3 font-semibold text-slate-900">About the role</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{job.description}</p>
              </Panel>
            )}
            {job.responsibilities && (
              <Panel className="p-6">
                <h2 className="mb-3 font-semibold text-slate-900">Responsibilities</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{job.responsibilities}</p>
              </Panel>
            )}
            <Panel className="p-6">
              <h2 className="mb-4 font-semibold text-slate-900">Requirements</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Required skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(job.required_skills ?? []).length ? job.required_skills.map((s: string) => <SkillChip key={s} tone="violet">{s}</SkillChip>) : <span className="text-sm text-slate-400">Not specified</span>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(job.preferred_skills ?? []).length ? job.preferred_skills.map((s: string) => <SkillChip key={s}>{s}</SkillChip>) : <span className="text-sm text-slate-400">Not specified</span>}
                  </div>
                </div>
                {job.education_requirements && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Education</div>
                    <div className="text-sm text-slate-700">{job.education_requirements}</div>
                  </div>
                )}
                {questions.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Application questions</div>
                    <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                      {questions.map((question) => (
                        <li key={question.id}>
                          {question.label} {question.required && <span className="text-rose-500">*</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <Panel className="h-fit p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Job overview</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Company" value={job.companyName ?? "—"} />
              <Row label="Department" value={job.department ?? "—"} />
              <Row label="Location" value={job.location ?? "—"} />
              <Row label="Work mode" value={job.work_mode ?? "—"} />
              <Row label="Type" value={job.employment_type ?? "—"} />
              <Row label="Salary" value={job.salary_range ?? "—"} />
              <Row label="Experience" value={job.experience_required ? `${job.experience_required}+ yrs` : "Flexible"} />
            </dl>
          </Panel>
        </div>
      ) : (
        <div className="mt-5">
          {fitLoading ? (
            <LoadingState label="Analyzing your fit against this role" />
          ) : !fit ? (
            <Panel className="p-10 text-center">
              <p className="text-sm text-slate-500">Run a fit check to see your match, skill gaps and learning roadmap.</p>
              <div className="mt-4 flex justify-center">
                <PrimaryButton onClick={loadFit}><Sparkles size={15} /> Check my fit</PrimaryButton>
              </div>
            </Panel>
          ) : (
            <div className="space-y-5">
              <Panel className="p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Overall match</div>
                    <div className="text-4xl font-semibold text-slate-900">{fit.match.overall_score}%</div>
                  </div>
                  <Badge tone={fit.match.overall_score >= 75 ? "green" : fit.match.overall_score >= 55 ? "amber" : "red"}>
                    {fit.match.match_tier}
                  </Badge>
                  <div className="text-xs text-slate-500">
                    Semantic similarity <b className="text-slate-800">{fit.match.cosine_similarity.toFixed(3)}</b> ·
                    Required skills <b className="text-slate-800">{fit.coverage.requiredMatched}/{fit.coverage.requiredTotal}</b> ·
                    Preferred <b className="text-slate-800">{fit.coverage.preferredMatched}/{fit.coverage.preferredTotal}</b>
                  </div>
                </div>
                {fit.match.hard_warning && (
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="text-sm text-amber-900">{fit.match.hard_warning.message}</div>
                  </div>
                )}
              </Panel>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { title: "Matching skills", rows: [...fit.requiredGaps, ...fit.preferredGaps].filter((g: any) => g.status === "MATCHED") },
                  { title: "Partial matches", rows: [...fit.requiredGaps, ...fit.preferredGaps].filter((g: any) => g.status === "PARTIAL") },
                  { title: "Skill gaps", rows: [...fit.requiredGaps, ...fit.preferredGaps].filter((g: any) => g.status === "MISSING") },
                ].map((group) => (
                  <Panel key={group.title} className="p-5">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">{group.title} ({group.rows.length})</h3>
                    {group.rows.length === 0 ? (
                      <p className="text-xs text-slate-400">None</p>
                    ) : (
                      <ul className="space-y-2">
                        {group.rows.map((g: any) => (
                          <li key={g.skill} className="rounded-lg bg-slate-50 p-2.5">
                            <div className="flex items-center gap-2">
                              <SkillChip tone={g.tier === "REQUIRED" ? "violet" : "slate"}>{g.skill}</SkillChip>
                              <span className="text-[10px] uppercase text-slate-400">{g.tier}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">{g.evidence}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                ))}
              </div>

              {fit.roadmap && fit.roadmap.items.length > 0 && (
                <Panel className="p-6">
                  <h3 className="mb-1 font-semibold text-slate-900">Learning roadmap</h3>
                  <p className="mb-4 text-xs text-slate-500">
                    Generated directly from your skill gaps for this role — readiness {fit.roadmap.readiness}%.
                  </p>
                  <ol className="relative ml-2 space-y-4 border-l-2 border-slate-100 pl-6">
                    {fit.roadmap.items.map((item: any, i: number) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[10px] font-bold text-white ring-4 ring-white">
                          {item.phase ?? i + 1}
                        </span>
                        <div className="font-semibold text-slate-900">{item.skill}</div>
                        <div className="mt-1 text-xs leading-relaxed text-slate-600">
                          <b>Why:</b> {item.why}
                          <br />
                          <b>Learn:</b> {item.outcome}
                          <br />
                          <b>Build:</b> {item.project}
                          <br />
                          <b>Prerequisite:</b> {item.prerequisite} · <b>Time:</b> {item.duration}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Panel>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
