"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Video, Check, X } from "lucide-react";
import {
  PageHeader, Panel, LoadingState, EmptyState, StatusPill, SecondaryButton, Badge,
} from "@/components/portal/Primitives";

export default function CompanyInterviewsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/portal/interviews")
      .then((r) => r.json())
      .then((d) => setRows(d.ok ? d.interviews : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const update = async (id: number, status: string) => {
    setBusy(id);
    await fetch("/api/portal/interviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setRows((r) => r.map((i) => (i.id === id ? { ...i, status } : i)));
    setBusy(null);
  };

  const upcoming = rows.filter((i) => i.status === "SCHEDULED");
  const past = rows.filter((i) => i.status !== "SCHEDULED");

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Interviews"
        description="Scheduled interviews across your open roles. Schedule from a job's pipeline."
      />

      {loading ? (
        <LoadingState label="Loading interviews" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={22} />}
          title="No interviews scheduled"
          description="Open a job's pipeline and use “Schedule interview” on a candidate card."
          action={
            <Link href="/company/jobs" className="text-sm font-medium text-violet-700 hover:underline">
              Go to jobs →
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <Section title="Upcoming" rows={upcoming} onUpdate={update} busy={busy} />
          <Section title="Completed & cancelled" rows={past} onUpdate={update} busy={busy} />
        </div>
      )}
    </div>
  );
}

function Section({
  title, rows, onUpdate, busy,
}: { title: string; rows: any[]; onUpdate: (id: number, s: string) => void; busy: number | null }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">None.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((i) => (
            <Panel key={i.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-slate-900">{i.type}</span>
                    <StatusPill status={i.status} />
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    <Link href={`/company/candidates/${i.candidateId}`} className="font-medium text-slate-700 hover:text-violet-700">
                      {i.candidateName}
                    </Link>{" "}
                    · {i.jobTitle}
                  </div>
                  {i.scheduled_date && (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                      <CalendarClock size={14} /> {new Date(i.scheduled_date).toLocaleString()}
                    </div>
                  )}
                  {i.interviewers && <div className="text-xs text-slate-500">Interviewer: {i.interviewers}</div>}
                  {i.meeting_link && (
                    <a href={i.meeting_link} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
                      <Video size={12} /> Meeting link
                    </a>
                  )}
                  {i.notes && <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">{i.notes}</div>}
                </div>
                {i.status === "SCHEDULED" && (
                  <div className="flex gap-2">
                    <SecondaryButton onClick={() => onUpdate(i.id, "COMPLETED")} disabled={busy === i.id}>
                      <Check size={13} /> Complete
                    </SecondaryButton>
                    <SecondaryButton onClick={() => onUpdate(i.id, "CANCELLED")} disabled={busy === i.id}>
                      <X size={13} /> Cancel
                    </SecondaryButton>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
