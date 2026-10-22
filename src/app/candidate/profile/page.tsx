"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Save, Loader2, CheckCircle2, Plus, Trash2, AlertCircle } from "lucide-react";
import {
  PageHeader,
  Panel,
  Field,
  inputClass,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
} from "@/components/portal/Primitives";

type Entry = Record<string, any>;

export default function CandidateProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ percent: number; items: { label: string; done: boolean }[] } | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", location: "", title: "", experience_years: "0",
    about: "", linkedin: "", github: "", portfolio: "",
    skills: "", soft_skills: "", certifications: "",
  });
  const [education, setEducation] = useState<Entry[]>([]);
  const [experience, setExperience] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/profile");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const p = data.profile;
      const d = p.profile_data ?? {};
      setForm({
        name: p.name ?? "", email: p.email ?? "", phone: p.phone ?? "",
        location: p.location ?? "", title: p.title ?? "",
        experience_years: String(p.experience_years ?? 0),
        about: d.about ?? "", linkedin: d.links?.linkedin ?? "",
        github: d.links?.github ?? "", portfolio: d.links?.portfolio ?? "",
        skills: (d.technical_skills ?? []).join(", "),
        soft_skills: (d.soft_skills ?? []).join(", "),
        certifications: (d.certifications ?? []).map(val).join(", "),
      });
      setEducation(d.education ?? []);
      setExperience((d.experience ?? []).map((e: any) => ({ ...e, responsibilities: (e.responsibilities ?? e.highlights ?? []).join("\n") })));
      setProjects((d.projects ?? []).map((p: any) => ({ ...p, bullets: (p.bullets ?? []).join("\n"), technologies: (p.technologies ?? []).join(", ") })));
      setCompletion(data.completion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          location: form.location,
          title: form.title,
          experience_years: Number(form.experience_years || 0),
          profile_data: {
            about: form.about,
            links: { linkedin: form.linkedin, github: form.github, portfolio: form.portfolio },
            technical_skills: list(form.skills),
            soft_skills: list(form.soft_skills),
            certifications: list(form.certifications),
            education: education.filter((e) => e.degree || e.institution),
            experience: experience
              .filter((e) => e.title || e.company)
              .map((e) => ({ ...e, responsibilities: lines(e.responsibilities) })),
            projects: projects
              .filter((p) => p.title || p.name)
              .map((p) => ({
                ...p,
                name: p.title || p.name,
                bullets: lines(p.bullets),
                technologies: Array.isArray(p.technologies) ? p.technologies : list(p.technologies ?? ""),
              })),
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setCompletion(data.completion);
      setMessage("Profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading your profile" />;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="My Profile"
        description="Your canonical candidate profile. Resume extraction merges into these same sections."
        action={
          <div className="flex gap-2">
            <Link href="/candidate/resume">
              <SecondaryButton>Manage resume</SecondaryButton>
            </Link>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes
            </PrimaryButton>
          </div>
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel className="p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Identity &amp; contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <Field label="Current / target role"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Years of experience"><input type="number" min="0" step="0.5" className={inputClass} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} /></Field>
            </div>
            <div className="mt-4">
              <Field label="About"><textarea rows={4} className={`${inputClass} resize-none`} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></Field>
            </div>
            <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-900">Links</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="LinkedIn"><input className={inputClass} placeholder="https://linkedin.com/in/…" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></Field>
              <Field label="GitHub"><input className={inputClass} placeholder="https://github.com/…" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} /></Field>
              <Field label="Portfolio"><input className={inputClass} placeholder="https://…" value={form.portfolio} onChange={(e) => setForm({ ...form, portfolio: e.target.value })} /></Field>
            </div>
          </Panel>

          <Panel className="p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Skills</h2>
            <Field label="Technical skills" hint="Comma separated">
              <input className={inputClass} value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
            </Field>
            <div className="mt-4">
              <Field label="Soft skills" hint="Comma separated">
                <input className={inputClass} value={form.soft_skills} onChange={(e) => setForm({ ...form, soft_skills: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Certifications" hint="Comma separated">
                <input className={inputClass} value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
              </Field>
            </div>
          </Panel>

          <Repeatable
            title="Education"
            rows={education}
            setRows={setEducation}
            blank={{ degree: "", field: "", institution: "", year: "" }}
            fields={["degree", "field", "institution", "year"]}
          />
          <Repeatable
            title="Experience"
            rows={experience}
            setRows={setExperience}
            blank={{ title: "", company: "", duration: "", responsibilities: "" }}
            fields={["title", "company", "duration", "responsibilities"]}
            multiline={["responsibilities"]}
          />
          <Repeatable
            title="Projects"
            rows={projects}
            setRows={setProjects}
            blank={{ title: "", type: "Project", technologies: "", bullets: "" }}
            fields={["title", "type", "technologies", "bullets"]}
            multiline={["bullets"]}
          />
        </div>

        <Panel className="h-fit p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Profile completion</h2>
            <span className="text-lg font-semibold text-violet-700">{completion?.percent ?? 0}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${completion?.percent ?? 0}%` }} />
          </div>
          <ul className="mt-4 space-y-1.5">
            {(completion?.items ?? []).map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${item.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {item.done ? "✓" : "·"}
                </span>
                <span className={item.done ? "text-slate-800" : "text-slate-400"}>{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            Completeness is measured from the verified profile only. It is separate from job-match scoring.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Repeatable({
  title,
  rows,
  setRows,
  blank,
  fields,
  multiline = [],
}: {
  title: string;
  rows: Entry[];
  setRows: (r: Entry[]) => void;
  blank: Entry;
  fields: string[];
  multiline?: string[];
}) {
  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <SecondaryButton onClick={() => setRows([...rows, { ...blank }])}>
          <Plus size={14} /> Add
        </SecondaryButton>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-400">Nothing added yet.</p>}
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <Field key={f} label={f.replace(/_/g, " ")}>
                  {multiline.includes(f) ? (
                    <textarea
                      rows={3}
                      className={`${inputClass} resize-none`}
                      value={row[f] ?? ""}
                      onChange={(e) => setRows(rows.map((r, ri) => (ri === i ? { ...r, [f]: e.target.value } : r)))}
                    />
                  ) : (
                    <input
                      className={inputClass}
                      value={row[f] ?? ""}
                      onChange={(e) => setRows(rows.map((r, ri) => (ri === i ? { ...r, [f]: e.target.value } : r)))}
                    />
                  )}
                </Field>
              ))}
            </div>
            <div className="mt-3 text-right">
              <button
                onClick={() => setRows(rows.filter((_, ri) => ri !== i))}
                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const lines = (s: string) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const val = (v: unknown) => (typeof v === "string" ? v : (v as { value?: string })?.value ?? "");
