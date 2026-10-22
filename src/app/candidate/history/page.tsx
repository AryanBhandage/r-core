"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader, Panel, LoadingState, EmptyState, StatusPill, PrimaryButton } from "@/components/portal/Primitives";

interface TimelineEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
  status?: string;
  href?: string;
}

export default function CandidateHistoryPage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetch("/api/portal/applications").then((r) => r.json());
        const apps = (list.applications ?? []).slice(0, 15);
        const details = await Promise.all(
          apps.map((a: any) => fetch(`/api/portal/applications/${a.id}`).then((r) => r.json()).catch(() => null))
        );
        const merged: TimelineEvent[] = [];
        details.forEach((d, idx) => {
          if (!d?.ok) return;
          const app = apps[idx];
          for (const h of d.history ?? []) {
            merged.push({
              id: `h-${h.id}`,
              at: h.createdAt,
              label: `Application ${String(h.toStatus).toLowerCase()}`,
              detail: `${app.jobTitle} · ${app.companyName ?? ""}${h.note ? ` — ${h.note}` : ""}`,
              status: h.toStatus,
              href: `/candidate/applications/${app.id}`,
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
        title="History"
        description="A permanent record of every application event — nothing is removed."
      />

      {loading ? (
        <LoadingState label="Building your history" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<History size={22} />}
          title="No history yet"
          description="Your application timeline will build up here as you apply and progress."
          action={
            <Link href="/candidate/jobs">
              <PrimaryButton>Browse jobs</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <Panel className="p-6">
          <ol className="relative ml-2 space-y-5 border-l-2 border-slate-100 pl-6">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-violet-500 ring-2 ring-white" />
                <div className="flex flex-wrap items-center gap-2">
                  {event.status && <StatusPill status={event.status} />}
                  <span className="text-sm font-medium text-slate-900">{event.label}</span>
                  <span className="text-xs text-slate-400">{new Date(event.at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {event.href ? (
                    <Link href={event.href} className="hover:text-violet-700 hover:underline">
                      {event.detail}
                    </Link>
                  ) : (
                    event.detail
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
