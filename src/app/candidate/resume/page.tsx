"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UploadCloud, FileText, Trash2, RefreshCw, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  PageHeader,
  Panel,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  SkillChip,
  inputClass,
} from "@/components/portal/Primitives";
import type { CandidateProfile } from "@/lib/ml/types";

export default function ResumePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<any>(null);
  const [extracted, setExtracted] = useState<CandidateProfile | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "analyze" | "delete">(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/resume");
      const data = await res.json();
      setResume(data.ok ? data.resume : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (payload: FormData | Record<string, unknown>, mode: "upload" | "analyze") => {
    setBusy(mode);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/resume", {
        method: "POST",
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
        headers: payload instanceof FormData ? undefined : { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setExtracted(data.extracted);
      setResume(data.resume);
      setMessage(
        data.saved
          ? "Resume analyzed and saved to your profile."
          : "Resume analyzed (preview only — not saved to your profile)."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume analysis failed.");
    } finally {
      setBusy(null);
    }
  };

  const onFile = (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("save", "true");
    send(form, "upload");
  };

  const remove = async () => {
    if (!confirm("Delete the uploaded resume? Extracted profile data is kept.")) return;
    setBusy("delete");
    try {
      const res = await fetch("/api/portal/resume", { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setResume(null);
      setMessage("Resume deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the resume.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Resume"
        description="Upload a PDF/TXT or paste text. The existing AI parser extracts contact, education, experience, skills and projects, with source evidence."
        action={
          <Link href="/candidate/profile" className="text-sm font-medium text-violet-700 hover:underline">
            Edit profile fields
          </Link>
        }
      />

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

      {loading ? (
        <LoadingState label="Loading your resume" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <Panel className="p-6">
              <h2 className="font-semibold text-slate-900">Current resume</h2>
              {resume ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <FileText size={18} className="text-violet-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{resume.filename}</div>
                      <div className="text-xs text-slate-500">
                        Uploaded {new Date(resume.uploadedAt).toLocaleString()} · quality {resume.quality ?? 0}/100
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                      <RefreshCw size={14} /> Replace
                    </SecondaryButton>
                    <SecondaryButton onClick={remove} disabled={busy !== null}>
                      {busy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
                    </SecondaryButton>
                  </div>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-violet-700">View resume text</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
                      {resume.text}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <UploadCloud className="mx-auto text-slate-400" size={26} />
                  <p className="mt-2 text-sm text-slate-600">No resume uploaded yet.</p>
                  <div className="mt-3">
                    <PrimaryButton onClick={() => fileRef.current?.click()}>
                      <UploadCloud size={15} /> Upload resume
                    </PrimaryButton>
                  </div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </Panel>

            <Panel className="p-6">
              <h2 className="font-semibold text-slate-900">Or paste resume text</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder="Paste the raw resume text here…"
                className={`${inputClass} mt-3 resize-none`}
              />
              <div className="mt-3 flex gap-2">
                <PrimaryButton onClick={() => send({ text, save: true }, "analyze")} disabled={busy !== null || !text.trim()}>
                  {busy === "analyze" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  Analyze &amp; save to profile
                </PrimaryButton>
                <SecondaryButton
                  onClick={() => send({ text, save: false }, "analyze")}
                  disabled={busy !== null || !text.trim()}
                >
                  Preview only
                </SecondaryButton>
              </div>
            </Panel>
          </div>

          <Panel className="h-fit p-6">
            <h2 className="font-semibold text-slate-900">Extracted information</h2>
            <p className="mt-1 text-xs text-slate-500">
              Produced by the existing evidence-based parser. Nothing is invented — every value has source text.
            </p>
            {!extracted ? (
              <p className="mt-6 text-sm text-slate-400">Upload or paste a resume to see extracted data.</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <Group label="Contact">
                  <li>{extracted.name}</li>
                </Group>
                <Group label={`Skills (${extracted.technicalSkills?.length ?? 0})`}>
                  <div className="flex flex-wrap gap-1.5">
                    {(extracted.technicalSkills ?? []).map((s) => (
                      <SkillChip key={s.value} tone="violet">{s.value}</SkillChip>
                    ))}
                  </div>
                </Group>
                <Group label={`Experience (${extracted.experience?.length ?? 0})`}>
                  {(extracted.experience ?? []).map((e, i) => (
                    <li key={i}>
                      {e.title} — {e.company}{" "}
                      <span className="text-slate-400">({e.durationYears} yrs)</span>
                    </li>
                  ))}
                </Group>
                <Group label={`Education (${extracted.education?.length ?? 0})`}>
                  {(extracted.education ?? []).map((e, i) => (
                    <li key={i}>
                      {e.degree}
                      {e.field ? ` — ${e.field}` : ""} · {e.institution}
                    </li>
                  ))}
                </Group>
                <Group label={`Projects (${extracted.projects?.length ?? 0})`}>
                  {(extracted.projects ?? []).map((p, i) => (
                    <li key={i}>
                      {p.title || p.name} <span className="text-slate-400">[{p.type}]</span>
                    </li>
                  ))}
                </Group>
                <Group label={`Certifications (${extracted.certifications?.length ?? 0})`}>
                  {(extracted.certifications ?? []).map((c, i) => (
                    <li key={i}>{getVal(c)}</li>
                  ))}
                </Group>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <ul className="space-y-1 text-slate-700">{children}</ul>
    </div>
  );
}

function getVal(v: unknown): string {
  return typeof v === "string" ? v : (v as { value?: string })?.value ?? "";
}
