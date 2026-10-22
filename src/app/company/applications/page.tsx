"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, ChevronRight, Sparkles } from "lucide-react";
import {
  PageHeader, Panel, StatusPill, LoadingState, EmptyState, Badge,
} from "@/components/portal/Primitives";

export default function CompanyApplicationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("any");
  const [q, setQ] = useState("");
  const [jobId, setJobId] = useState("any");
  const [jobOptions, setJobOptions] = useState<{ id: number; title: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "any") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (jobId !== "any") params.set("jobId", jobId);
      const res = await fetch(`/api/portal/applications?${params}`);
      const d = await res.json();
      setRows(d.ok ? d.applications : []);
    } finally {
      setLoading(false);
    }
  }, [status, q, jobId]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/portal/jobs?mine=1")
      .then((r) => r.json())
      .then((d) => d.ok && setJobOptions(d.jobs.map((j: any) => ({ id: j.id, title: j.title }))))
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Applications"
        description="Every applicant across your jobs. Open a job to run AI analysis over all its applicants."
        action={
          <Link href="/company/search" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Sparkles size={15} /> AI candidate search
          </Link>
        }
      />

      <Panel className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300"
            placeholder="Search applicant or role…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="any">All jobs</option>
            {jobOptions.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="any">All statuses</option>
            <option>APPLIED</option><option>SCREENING</option><option>INTERVIEW</option>
            <option>OFFER</option><option>HIRED</option><option>REJECTED</option><option>WITHDRAWN</option>
          </select>
        </div>
      </Panel>

      {loading ? (
        <LoadingState label="Loading applications" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="No applications found"
          description="Applications appear here as candidates apply to your open roles."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="px-6 py-3">Candidate</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Match</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Applied</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <Link href={`/company/candidates/${a.candidateId}`} className="font-medium text-slate-900 hover:text-violet-700">
                        {a.candidateName}
                      </Link>
                      <div className="text-xs text-slate-500">{a.candidateTitle ?? ""}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{a.jobTitle}</td>
                    <td className="px-6 py-4 font-semibold text-violet-700">{a.match_score ?? 0}%</td>
                    <td className="px-6 py-4"><StatusPill status={a.status} /></td>
                    <td className="px-6 py-4 text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/company/jobs/${a.jobId}`} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                        Pipeline <ChevronRight size={12} />
                      </Link>
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
