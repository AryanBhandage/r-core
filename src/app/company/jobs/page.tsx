"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Copy, Trash2, X, Loader2, CheckCircle2, AlertCircle, Send, RotateCcw, Archive, Users,
} from "lucide-react";
import {
  PageHeader, Panel, Field, inputClass, LoadingState, EmptyState,
  PrimaryButton, SecondaryButton, StatusPill,
} from "@/components/portal/Primitives";

interface JobRow {
  id: number; title: string; slug: string | null; department: string | null;
  location: string | null; work_mode: string | null; employment_type: string | null;
  salary_range: string | null; status: string | null; deadline: string | null;
  required_skills: string[] | null; preferred_skills: string[] | null;
  experience_required: number | null; description: string | null;
  responsibilities: string | null; education_requirements: string | null;
  custom_questions: { id: string; label: string; required: boolean }[] | null;
  applicantCount: number; createdAt: string | null;
}

const EMPTY_FORM = {
  id: 0, title: "", department: "", location: "", work_mode: "Remote",
  employment_type: "Full-time", salary_range: "", experience_required: "0",
  deadline: "", education_requirements: "", description: "", responsibilities: "",
  required_skills: "", preferred_skills: "",
};
type FormState = typeof EMPTY_FORM;

export default function CompanyJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("any");
  const [form, setForm] = useState<FormState | null>(null);
  const [questions, setQuestions] = useState<{ id: string; label: string; required: boolean }[]>([]);
  const [busy, setBusy] = useState<number | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mine: "1" });
      if (status !== "any") params.set("status", status);
      const res = await fetch(`/api/portal/jobs?${params}`);
      const d = await res.json();
      setJobs(d.ok ? d.jobs : []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setQuestions([]);
  };

  const openEdit = (job: JobRow) => {
    setForm({
      id: job.id,
      title: job.title, department: job.department ?? "", location: job.location ?? "",
      work_mode: job.work_mode ?? "Remote", employment_type: job.employment_type ?? "Full-time",
      salary_range: job.salary_range ?? "", experience_required: String(job.experience_required ?? 0),
      deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : "",
      education_requirements: job.education_requirements ?? "",
      description: job.description ?? "", responsibilities: job.responsibilities ?? "",
      required_skills: (job.required_skills ?? []).join(", "),
      preferred_skills: (job.preferred_skills ?? []).join(", "),
    });
    setQuestions(job.custom_questions ?? []);
  };

  const save = async (publish: boolean) => {
    if (!form) return;
    if (!form.title.trim()) {
      setError("Job title is required.");
      return;
    }
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title: form.title, department: form.department, location: form.location,
        work_mode: form.work_mode, employment_type: form.employment_type,
        salary_range: form.salary_range, experience_required: Number(form.experience_required || 0),
        deadline: form.deadline || null, education_requirements: form.education_requirements,
        description: form.description, responsibilities: form.responsibilities,
        required_skills: form.required_skills, preferred_skills: form.preferred_skills,
        custom_questions: questions,
        status: publish ? "OPEN" : "DRAFT",
      };
      const res = await fetch(form.id ? `/api/portal/jobs/${form.id}` : "/api/portal/jobs", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setForm(null);
      setMessage(publish ? "Job published." : form.id ? "Job saved." : "Draft saved.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save job.");
    } finally {
      setBusy(null);
    }
  };

  const move = async (job: JobRow, next: string) => {
    setBusy(job.id);
    setError(null);
    try {
      const res = await fetch(`/api/portal/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setMessage(`${job.title} → ${next}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update job.");
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async (job: JobRow) => {
    setBusy(job.id);
    try {
      const res = await fetch(`/api/portal/jobs/${job.id}/duplicate`, { method: "POST" });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setMessage(`Duplicated as draft.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate job.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (job: JobRow) => {
    if (!confirm(`Delete draft "${job.title}"? This cannot be undone.`)) return;
    setBusy(job.id);
    try {
      const res = await fetch(`/api/portal/jobs/${job.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setMessage("Draft deleted.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete job.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Jobs"
        description="Create, publish and manage your job postings."
        action={<PrimaryButton onClick={openCreate}><Plus size={15} /> Add job</PrimaryButton>}
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

      {form && (
        <Panel className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{form.id ? "Edit job" : "New job"}</h2>
            <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Department"><input className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
            <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Work mode">
              <select className={inputClass} value={form.work_mode} onChange={(e) => setForm({ ...form, work_mode: e.target.value })}>
                <option>Remote</option><option>Hybrid</option><option>On-site</option>
              </select>
            </Field>
            <Field label="Employment type">
              <select className={inputClass} value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
                <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option>
              </select>
            </Field>
            <Field label="Salary range"><input className={inputClass} placeholder="$120k - $160k" value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })} /></Field>
            <Field label="Experience required (years)"><input type="number" min="0" className={inputClass} value={form.experience_required} onChange={(e) => setForm({ ...form, experience_required: e.target.value })} /></Field>
            <Field label="Application deadline"><input type="date" className={inputClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Required skills" hint="Comma separated — heavily weighted in matching">
                <input className={inputClass} value={form.required_skills} onChange={(e) => setForm({ ...form, required_skills: e.target.value })} placeholder="Python, SQL, AWS, Docker" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Preferred skills" hint="Comma separated — nice to have">
                <input className={inputClass} value={form.preferred_skills} onChange={(e) => setForm({ ...form, preferred_skills: e.target.value })} placeholder="TensorFlow, MLOps" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Education requirements"><input className={inputClass} value={form.education_requirements} onChange={(e) => setForm({ ...form, education_requirements: e.target.value })} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description"><textarea rows={4} className={`${inputClass} resize-none`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Responsibilities"><textarea rows={4} className={`${inputClass} resize-none`} value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} /></Field>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Custom application questions</h3>
              <SecondaryButton onClick={() => setQuestions([...questions, { id: `q${Date.now()}`, label: "", required: false }])}>
                <Plus size={13} /> Add question
              </SecondaryButton>
            </div>
            <div className="space-y-2">
              {questions.map((question, i) => (
                <div key={question.id} className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder={`Question ${i + 1}`}
                    value={question.label}
                    onChange={(e) => setQuestions(questions.map((q, qi) => (qi === i ? { ...q, label: e.target.value } : q)))}
                  />
                  <label className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => setQuestions(questions.map((q, qi) => (qi === i ? { ...q, required: e.target.checked } : q)))}
                    />
                    Required
                  </label>
                  <button onClick={() => setQuestions(questions.filter((_, qi) => qi !== i))} className="text-rose-500 hover:text-rose-700">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {questions.length === 0 && <p className="text-xs text-slate-400">No custom questions — candidates apply with their profile and resume.</p>}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <PrimaryButton onClick={() => save(true)} disabled={busy !== null}>
              {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {form.id ? "Save & publish" : "Publish job"}
            </PrimaryButton>
            <SecondaryButton onClick={() => save(false)} disabled={busy !== null}>Save as draft</SecondaryButton>
            <SecondaryButton onClick={() => setForm(null)}>Cancel</SecondaryButton>
          </div>
        </Panel>
      )}

      <div className="mb-4 flex items-center gap-2">
        {["any", "DRAFT", "OPEN", "CLOSED", "ARCHIVED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              status === s ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "any" ? "All" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Loading your jobs" />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Plus size={22} />}
          title="No jobs yet"
          description="Create your first job posting to start receiving applications."
          action={<PrimaryButton onClick={openCreate}><Plus size={15} /> Add job</PrimaryButton>}
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-6 py-3">Job</th>
                  <th className="px-6 py-3">Location &amp; type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Applicants</th>
                  <th className="px-6 py-3">Deadline</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <Link href={`/company/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-violet-700">
                        {job.title}
                      </Link>
                      <div className="text-xs text-slate-500">{job.department || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{job.location || "—"}</div>
                      <div className="text-xs text-slate-500">{[job.work_mode, job.employment_type].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-6 py-4"><StatusPill status={job.status ?? "OPEN"} /></td>
                    <td className="px-6 py-4">
                      <Link href={`/company/jobs/${job.id}`} className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                        <Users size={13} /> {job.applicantCount}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {job.deadline ? new Date(job.deadline).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {job.status === "DRAFT" && (
                          <ActionBtn onClick={() => move(job, "OPEN")} icon={<Send size={12} />} label="Publish" busy={busy === job.id} />
                        )}
                        {job.status === "OPEN" && (
                          <ActionBtn onClick={() => move(job, "CLOSED")} icon={<X size={12} />} label="Close" busy={busy === job.id} />
                        )}
                        {job.status === "CLOSED" && (
                          <ActionBtn onClick={() => move(job, "OPEN")} icon={<RotateCcw size={12} />} label="Reopen" busy={busy === job.id} />
                        )}
                        {(job.status === "OPEN" || job.status === "CLOSED") && (
                          <ActionBtn onClick={() => move(job, "ARCHIVED")} icon={<Archive size={12} />} label="Archive" busy={busy === job.id} />
                        )}
                        <ActionBtn onClick={() => openEdit(job)} icon={<X size={12} />} label="Edit" busy={false} />
                        <ActionBtn onClick={() => duplicate(job)} icon={<Copy size={12} />} label="Duplicate" busy={busy === job.id} />
                        {job.status === "DRAFT" && job.applicantCount === 0 && (
                          <ActionBtn onClick={() => remove(job)} icon={<Trash2 size={12} />} label="Delete" busy={busy === job.id} danger />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function ActionBtn({
  onClick, icon, label, busy, danger,
}: { onClick: () => void; icon: React.ReactNode; label: string; busy: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        danger ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {busy ? <Loader2 size={11} className="animate-spin" /> : icon} {label}
    </button>
  );
}
