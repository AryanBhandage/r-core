"use client";

import { useEffect, useState } from "react";
import { History, Briefcase, Send, UserCheck, CalendarClock, XCircle } from "lucide-react";
import { PageHeader, Panel, LoadingState, EmptyState, Badge } from "@/components/portal/Primitives";

interface Event {
  id: string;
  at: string;
  action: string;
  description: string;
}

function iconFor(action: string) {
  if (action.includes("JOB")) return Briefcase;
  if (action.includes("APPLICATION")) return Send;
  if (action.includes("INTERVIEW")) return CalendarClock;
  if (action.includes("HIRE") || action.includes("OFFER")) return UserCheck;
  return History;
}

export default function CompanyHistoryPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Recent company activity + a complete per-application audit trail.
        const dashboard = await fetch("/api/portal/dashboard").then((r) => r.json());
        const apps = await fetch("/api/portal/applications").then((r) => r.json());
        const merged: Event[] = [];

        for (const a of (dashboard.activity ?? []) as any[]) {
          merged.push({ id: `act-${a.id}`, at: a.createdAt, action: a.action, description: a.description });
        }

        const details = await Promise.all(
          ((apps.applications ?? []) as any[]).slice(0, 20).map((app) =>
            fetch(`/api/portal/applications/${app.id}`).then((r) => r.json()).catch(() => null)
          )
        );
        details.forEach((d) => {
          for (const h of d?.history ?? []) {
            merged.push({
              id: `hist-${h.id}`,
              at: h.createdAt,
              action: `STATUS_CHANGED`,
              description: `${d.candidate?.name ?? "Candidate"} · ${d.job?.title ?? "role"}: ${h.fromStatus ?? "APPLIED"} → ${h.toStatus}${h.note ? ` — ${h.note}` : ""}`,
            });
          }
        });

        merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setEvents(merged);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Hiring History"
        description="An audit trail of job, application, interview and hiring events."
      />

      {loading ? (
        <LoadingState label="Building history" />
      ) : events.length === 0 ? (
        <EmptyState icon={<History size={22} />} title="No activity yet" description="Recruiting actions will be recorded here automatically." />
      ) : (
        <Panel className="p-6">
          <ol className="relative ml-2 space-y-5 border-l-2 border-slate-100 pl-6">
            {events.map((event) => {
              const Icon = iconFor(event.action);
              return (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[34px] top-1 grid h-6 w-6 place-items-center rounded-full bg-violet-100 text-violet-700 ring-4 ring-white">
                    <Icon size={12} />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="violet">{event.action.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-slate-400">{new Date(event.at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{event.description}</div>
                </li>
              );
            })}
          </ol>
        </Panel>
      )}
    </div>
  );
}
