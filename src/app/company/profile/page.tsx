"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  PageHeader, Panel, Field, inputClass, LoadingState, PrimaryButton, Badge,
} from "@/components/portal/Primitives";

export default function CompanyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalJobs: 0, activeJobs: 0, drafts: 0, applications: 0 });
  const [form, setForm] = useState({
    name: "", description: "", website: "", industry: "", company_size: "", location: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/company");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setForm({
        name: data.company.name ?? "",
        description: data.company.description ?? "",
        website: data.company.website ?? "",
        industry: data.company.industry ?? "",
        company_size: data.company.company_size ?? "",
        location: data.company.location ?? "",
      });
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load company.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setMessage("Company profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save company profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading company profile" />;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Company Profile"
        description="Shown to candidates on every job you publish."
        action={
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes
          </PrimaryButton>
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
        <Panel className="p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Organisation details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Website"><input className={inputClass} placeholder="https://…" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
            <Field label="Industry"><input className={inputClass} placeholder="e.g. Fintech" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
            <Field label="Company size">
              <select className={inputClass} value={form.company_size} onChange={(e) => setForm({ ...form, company_size: e.target.value })}>
                <option value="">Select…</option>
                <option>1-10</option><option>11-50</option><option>51-200</option>
                <option>201-1000</option><option>1000+</option>
              </select>
            </Field>
            <Field label="Primary location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          </div>
          <div className="mt-4">
            <Field label="About the company">
              <textarea rows={5} className={`${inputClass} resize-none`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-100 text-violet-700">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{form.name || "Your company"}</div>
                <div className="truncate text-xs text-slate-500">
                  {[form.industry, form.location].filter(Boolean).join(" · ") || "No details set"}
                </div>
              </div>
            </div>
          </Panel>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total jobs" value={stats.totalJobs} />
            <Stat label="Open jobs" value={stats.activeJobs} />
            <Stat label="Drafts" value={stats.drafts} />
            <Stat label="Applicants" value={stats.applications} />
          </div>
          <Panel className="p-5">
            <div className="text-sm font-semibold text-slate-900">Recruiter tools</div>
            <p className="mt-1 text-xs text-slate-500">
              Company data is scoped to your organisation. Other companies never see your jobs, applicants, notes or history.
            </p>
            <div className="mt-3"><Badge tone="green">Multi-tenant isolation enforced</Badge></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Panel className="p-4 text-center">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </Panel>
  );
}
