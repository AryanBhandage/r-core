"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, StickyNote, Trash2, Plus, Loader2, AlertCircle, CheckCircle2, CalendarClock,
} from "lucide-react";
import {
  Panel, Field, inputClass, LoadingState, PrimaryButton, SecondaryButton,
  StatusPill, SkillChip, Badge,
} from "@/components/portal/Primitives";
import { MatchExplain, type MatchExplanationView } from "@/components/portal/MatchExplain";

const STATUSES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"];

export default function CandidateWorkspacePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/candidates/${params.id}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setData(d);
      const n = await fetch(`/api/portal/notes?candidateId=${params.id}`).then((r) => r.json());
      setNotes(n.ok ? n.notes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candidate.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setBusy("note");
    try {
      const res = await fetch("/api/portal/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: Number(params.id), body: noteText }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setNoteText("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add note.");
    } finally {
      setBusy(null);
    }
  };

  const deleteNote = async (id: number) => {
    if (!confirm("Delete this note?")) return;
    setBusy(`note-${id}`);
    await fetch(`/api/portal/notes?id=${id}`, { method: "DELETE" });
    setNotes((rows) => rows.filter((n) => n.id !== id));
    setBusy(null);
  };

  const changeStatus = async (applicationId: number, status: string) => {
    setBusy(`app-${applicationId}`);
    setError(null);
    try {
      const res = await fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setMessage(`Application moved to ${status}.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState label="Loading candidate" />;
  if (!data) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error ?? "Candidate not found."}</div>;

  const candidate = data.candidate;
  const profileData = candidate.profile_data ?? {};
  const applications: any[] = data.applications ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/company/applications" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} /> Back to applications
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{candidate.name}</h1>
          <div className="mt-1 text-sm text-slate-500">
            {candidate.title || "Role not set"} · {candidate.experience_years ?? 0} yrs
            {candidate.location ? ` · ${candidate.location}` : ""}
            {candidate.email ? ` · ${candidate.email}` : ""}
          </div>
        </div>
        <Badge tone="slate">Resume quality {candidate.resume_quality ?? 0}/100</Badge>
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {applications.length > 0 && (
            <Panel className="p-5">
              <h2 className="mb-3 font-semibold text-slate-900">Applications to your jobs</h2>
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{app.jobTitle}</div>
                        <div className="text-xs text-slate-500">
                          Applied {new Date(app.createdAt).toLocaleDateString()} · match {app.match_score ?? 0}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={app.status} />
                        <select
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          value={app.status}
                          disabled={busy === `app-${app.id}`}
                          onChange={(e) => changeStatus(app.id, e.target.value)}
                        >
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    {app.answers && Object.keys(app.answers).length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Answers to application questions
                        </div>
                        <dl className="space-y-2">
                          {Object.entries(app.answers).map(([key, value]) => {
                            const question = (app.custom_questions ?? []).find(
                              (q: any) => q.id === key
                            );
                            return (
                              <div key={key} className="rounded bg-slate-50 p-2 text-xs">
                                <dt className="font-semibold text-slate-700">
                                  {question?.label ?? key}
                                  {question?.required ? " *" : ""}
                                </dt>
                                <dd className="text-slate-600">{String(value)}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </div>
                    )}
                    {app.cover_letter && (
                      <div className="mt-3 text-xs text-slate-600">
                        <b>Cover letter:</b> {app.cover_letter}
                      </div>
                    )}
                    {app.explanation && (
                      <div className="mt-4">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          AI match for this role
                        </div>
                        <MatchExplain match={app.explanation} compact />
                      </div>
                    )}
                    <div className="mt-3">
                      <Link href={`/company/jobs/${app.jobId}`} className="text-xs font-medium text-violet-700 hover:underline">
                        Open pipeline →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Profile &amp; resume</h2>
            <div className="space-y-4 text-sm">
              {profileData.about && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">About</div>
                  <p className="text-slate-700">{profileData.about}</p>
                </div>
              )}
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {(profileData.technical_skills ?? []).map((s: string) => <SkillChip key={s} tone="violet">{s}</SkillChip>)}
                </div>
              </div>
              {(profileData.experience ?? []).length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Experience</div>
                  <ul className="space-y-2">
                    {(profileData.experience ?? []).map((e: any, i: number) => (
                      <li key={i} className="rounded bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{e.title} — {e.company}</div>
                        <div className="text-xs text-slate-500">{e.duration}</div>
                        <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                          {(e.responsibilities ?? []).slice(0, 3).map((r: string, ri: number) => <li key={ri}>{r}</li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(profileData.education ?? []).length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Education</div>
                  <ul className="space-y-1 text-slate-700">
                    {(profileData.education ?? []).map((e: any, i: number) => (
                      <li key={i}>{e.degree}{e.field ? ` — ${e.field}` : ""} · {e.institution}</li>
                    ))}
                  </ul>
                </div>
              )}
              {profileData.resume?.text && (
                <details>
                  <summary className="cursor-pointer text-sm text-violet-700">View resume ({profileData.resume.filename})</summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
                    {profileData.resume.text}
                  </pre>
                </details>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <StickyNote size={15} className="text-violet-600" />
              <h2 className="font-semibold text-slate-900">Private notes</h2>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">Visible only to members of your company.</p>
            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Add a note about this candidate…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="mt-2">
              <PrimaryButton onClick={addNote} disabled={busy === "note" || !noteText.trim()}>
                {busy === "note" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add note
              </PrimaryButton>
            </div>
            <div className="mt-4 space-y-2">
              {notes.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-700">{note.body}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{note.authorName} · {new Date(note.createdAt).toLocaleDateString()}</span>
                    <button onClick={() => deleteNote(note.id)} className="text-rose-500 hover:text-rose-700">
                      {busy === `note-${note.id}` ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {data.history && data.history.length > 0 && (
            <Panel className="p-5">
              <h2 className="mb-3 font-semibold text-slate-900">Application history</h2>
              <ol className="relative ml-2 space-y-3 border-l-2 border-slate-100 pl-5">
                {data.history.map((h: any) => (
                  <li key={h.id} className="relative text-xs">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-violet-500 ring-2 ring-white" />
                    <StatusPill status={h.toStatus} />
                    <div className="mt-1 text-slate-500">{new Date(h.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
