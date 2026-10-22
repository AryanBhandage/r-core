"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import {
  PageHeader,
  Panel,
  StatusPill,
  LoadingState,
  EmptyState,
  PrimaryButton,
} from "@/components/portal/Primitives";

export default function CandidateApplicationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("any");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "any") params.set("status", status);
      const res = await fetch(`/api/portal/applications?${params}`);
      const d = await res.json();
      setRows(d.ok ? d.applications : []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="My Applications"
        description="Track every application and its progress through the hiring pipeline."
        action={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-300"
          >
            <option value="any">All statuses</option>
            <option>APPLIED</option>
            <option>SCREENING</option>
            <option>INTERVIEW</option>
            <option>OFFER</option>
            <option>HIRED</option>
            <option>REJECTED</option>
            <option>WITHDRAWN</option>
          </select>
        }
      />

      {loading ? (
        <LoadingState label="Loading applications" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="No applications yet"
          description="Browse open roles and apply — status updates will appear here."
          action={
            <Link href="/candidate/jobs">
              <PrimaryButton>Browse jobs</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Link key={a.id} href={`/candidate/applications/${a.id}`}>
              <Panel className="flex items-center justify-between p-5 transition-shadow hover:shadow-md">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{a.jobTitle}</div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {a.companyName} · applied {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.match_score != null && (
                    <span className="text-sm font-semibold text-violet-700">{a.match_score}%</span>
                  )}
                  <StatusPill status={a.status} />
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
