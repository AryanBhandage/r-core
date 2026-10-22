"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Loader2, Users, CalendarClock, AlertCircle, CheckCircle2, Video, GripVertical,
} from "lucide-react";
import {
  Panel, Field, inputClass, LoadingState, PrimaryButton, SecondaryButton,
  StatusPill, SkillChip, Badge, EmptyState,
} from "@/components/portal/Primitives";
import { MatchExplain, type MatchExplanationView } from "@/components/portal/MatchExplain";

const COLUMNS = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;
const SIDE_COLUMNS = ["REJECTED", "WITHDRAWN"] as const;

interface Applicant {
  applicationId: number;
  status: string;
  appliedAt: string;
  cover_letter: string | null;
  answers: Record<string, string>;
  candidate: {
    id: number; name: string; title: string | null; location: string | null;
    experience_years: number | null; resume_quality: number | null;
    skills: string[]; resume: any;
  };
  explanation: MatchExplanationView | null;
}

export default function JobPipelinePage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState<"pipeline" | "analysis">("pipeline");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [interviewFor, setInterviewFor] = useState<number | null>(null);
  const [form, setForm] = useState({ type: "Technical Interview", datetime: "", interviewers: "", meeting_link: "", notes: "" });
  const [busy, setBusy] = useState<number | "interview" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);

  const load = useCallback(async (analyze = false) => {
    if (!analyze) setLoading(true);
    try {
      const res = await fetch(`/api/portal/jobs/${params.id}/applicants${analyze ? "?analyze=1" : ""}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setJob(d.job);
      setApplicants(d.applicants);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load applicants.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setTab("analysis");
    await load(true);
    setAnalyzing(false);
  };

  const moveTo = async (applicationId: number, status: string) => {
    setBusy(applicationId);
    setError(null);
    try {
      const res = await fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setApplicants((rows) =>
        rows.map((a) => (a.applicationId === applicationId ? { ...a, status } : a))
      );
      setMessage(`Candidate moved to ${status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status.");
    } finally {
      setBusy(null);
    }
  };

  const schedule = async () => {
    if (!interviewFor) return;
    setBusy("interview");
    setError(null);
    try {
      const res = await fetch("/api/portal/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: interviewFor,
          type: form.type,
          scheduled_date: form.datetime || null,
          interviewers: form.interviewers,
          meeting_link: form.meeting_link,
          notes: form.notes,
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setInterviewFor(null);
      setForm({ type: "Technical Interview", datetime: "", interviewers: "", meeting_link: "", notes: "" });
      setMessage("Interview scheduled — candidate notified.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule interview.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState label="Loading pipeline" />;

  const byStatus = (status: string) => applicants.filter((a) => a.status === status);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Workspace / Jobs</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{job?.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <StatusPill status={job?.status ?? "OPEN"} />
            <span>{applicants.length} applicant{applicants.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => load()}>Refresh</SecondaryButton>
          <PrimaryButton onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            AI Analyze Applicants
          </PrimaryButton>
        </div>
      </div>

      {message && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {(["pipeline", "analysis"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 pb-3 text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-violet-600 text-violet-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "pipeline" ? "Pipeline" : "AI analysis"}
          </button>
        ))}
      </div>

      {applicants.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No applicants yet"
          description="When candidates apply to this job they land in the APPLIED column."
        />
      ) : tab === "pipeline" ? (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-5">
            {COLUMNS.map((column) => (
              <div
                key={column}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId != null) moveTo(dragId, column);
                  setDragId(null);
                }}
                className="min-h-[180px] rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{column}</span>
                  <Badge tone="slate">{byStatus(column).length}</Badge>
                </div>
                <div className="space-y-2">
                  {byStatus(column).map((app) => (
                    <div
                      key={app.applicationId}
                      draggable
                      onDragStart={() => setDragId(app.applicationId)}
                      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/company/candidates/${app.candidate.id}`} className="text-sm font-semibold text-slate-900 hover:text-violet-700">
                          {app.candidate.name}
                        </Link>
                        <GripVertical size={13} className="mt-0.5 shrink-0 text-slate-300" />
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {app.candidate.experience_years ?? 0} yrs · {new Date(app.appliedAt).toLocaleDateString()}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {app.candidate.skills.slice(0, 3).map((s: string) => <SkillChip key={s}>{s}</SkillChip>)}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-violet-700">
                          {app.explanation ? `${app.explanation.overall}% match` : "not analyzed"}
                        </span>
                        <button onClick={() => setExpanded(expanded === app.applicationId ? null : app.applicationId)} className="text-[11px] text-violet-700 hover:underline">
                          {expanded === app.applicationId ? "hide" : "details"}
                        </button>
                      </div>

                      {expanded === app.applicationId && (
                        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                          <select
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px]"
                            value={app.status}
                            disabled={busy === app.applicationId}
                            onChange={(e) => moveTo(app.applicationId, e.target.value)}
                          >
                            {[...COLUMNS, ...SIDE_COLUMNS].map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <button
                            onClick={() => setInterviewFor(app.applicationId)}
                            className="w-full rounded-md bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
                          >
                            Schedule interview
                          </button>
                          {app.explanation && (
                            <div className="text-[11px] text-slate-600">
                              <div className="font-semibold text-emerald-700">Matched</div>
                              {app.explanation.matchedSkills.slice(0, 3).map((s) => <div key={s.skill}>✓ {s.skill}</div>)}
                              <div className="mt-1 font-semibold text-rose-700">Gaps</div>
                              {app.explanation.missingSkills.slice(0, 3).map((s) => <div key={s.skill}>○ {s.skill}</div>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {SIDE_COLUMNS.some((c) => byStatus(c).length > 0) && (
            <Panel className="p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Closed</div>
              <div className="flex flex-wrap gap-2">
                {SIDE_COLUMNS.flatMap((c) => byStatus(c)).map((app) => (
                  <span key={app.applicationId} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                    {app.candidate.name} <StatusPill status={app.status} />
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {analyzing ? (
            <LoadingState label="Scoring every applicant with the matching engine" />
          ) : (
            applicants.map((app) => (
              <div key={app.applicationId}>
                <Panel className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link href={`/company/candidates/${app.candidate.id}`} className="text-lg font-semibold text-slate-900 hover:text-violet-700">
                        {app.candidate.name}
                      </Link>
                      <div className="text-sm text-slate-500">
                        {app.candidate.title} · {app.candidate.experience_years} yrs
                      </div>
                    </div>
                    <StatusPill status={app.status} />
                  </div>
                  {app.explanation ? (
                    <MatchExplain match={app.explanation} />
                  ) : (
                    <p className="text-sm text-slate-400">Not analyzed yet — run “AI Analyze Applicants”.</p>
                  )}
                </Panel>
              </div>
            ))
          )}
        </div>
      )}

      {interviewFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <Panel className="w-full max-w-lg p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Schedule interview</h2>
            <div className="space-y-4">
              <Field label="Interview type">
                <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Technical Interview</option><option>Behavioral Interview</option>
                  <option>System Design</option><option>Hiring Manager</option><option>Final Round</option>
                </select>
              </Field>
              <Field label="Date & time"><input type="datetime-local" className={inputClass} value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} /></Field>
              <Field label="Interviewer(s)"><input className={inputClass} value={form.interviewers} onChange={(e) => setForm({ ...form, interviewers: e.target.value })} /></Field>
              <Field label="Meeting link"><input className={inputClass} placeholder="https://meet…" value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} /></Field>
              <Field label="Notes"><textarea rows={3} className={`${inputClass} resize-none`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex gap-2">
              <PrimaryButton onClick={schedule} disabled={busy === "interview"}>
                {busy === "interview" ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />} Schedule
              </PrimaryButton>
              <SecondaryButton onClick={() => setInterviewFor(null)}>Cancel</SecondaryButton>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
