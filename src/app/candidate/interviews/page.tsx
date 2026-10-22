"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Video } from "lucide-react";
import { PageHeader, Panel, LoadingState, EmptyState, StatusPill, Badge } from "@/components/portal/Primitives";

export default function CandidateInterviewsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/interviews")
      .then((r) => r.json())
      .then((d) => setRows(d.ok ? d.interviews : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = rows.filter((i) => i.status === "SCHEDULED");
  const past = rows.filter((i) => i.status !== "SCHEDULED");

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Interviews" description="Upcoming and past interviews across your applications." />

      {loading ? (
        <LoadingState label="Loading interviews" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={22} />}
          title="No interviews scheduled"
          description="When a recruiter schedules an interview, it appears here with the meeting link."
        />
      ) : (
        <div className="space-y-6">
          <Section title="Upcoming" rows={upcoming} />
          <Section title="Past &amp; cancelled" rows={past} />
        </div>
      )}
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">None.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((i) => (
            <Panel key={i.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{i.type}</div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {i.jobTitle} · {i.companyName ?? "Company"}
                  </div>
                  {i.scheduled_date && (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                      <CalendarClock size={14} /> {new Date(i.scheduled_date).toLocaleString()}
                    </div>
                  )}
                  {i.interviewers && <div className="mt-1 text-xs text-slate-500">Interviewer: {i.interviewers}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={i.status} />
                  {i.meeting_link && (
                    <a href={i.meeting_link} target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">
                      <Video size={13} /> Join
                    </a>
                  )}
                </div>
              </div>
              {i.notes && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{i.notes}</div>}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
