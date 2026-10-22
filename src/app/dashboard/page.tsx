"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Briefcase, FileText, Target, Award, Sparkles, ArrowRight,
  History, CalendarClock, Bookmark,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import {
  PageHeader, Panel, LoadingState, EmptyState, StatusPill, PrimaryButton, Badge,
} from "@/components/portal/Primitives";

export default function DashboardPage() {
  const { role, userName, loading: sessionLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    fetch("/api/portal/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sessionLoading]);

  if (sessionLoading || loading) return <LoadingState label="Loading your workspace" />;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title={`Good to see you, ${userName || "there"}`}
        description={
          role === "COMPANY"
            ? "A live view of your recruitment activity."
            : "Your career activity at a glance."
        }
        action={
          role === "COMPANY" ? (
            <Link href="/company/jobs">
              <PrimaryButton><Briefcase size={15} /> Manage jobs</PrimaryButton>
            </Link>
          ) : (
            <Link href="/candidate/jobs">
              <PrimaryButton><Sparkles size={15} /> Browse jobs</PrimaryButton>
            </Link>
          )
        }
      />

      {!data ? (
        <EmptyState icon={<History size={22} />} title="No data yet" description="Activity will appear as soon as you start using the platform." />
      ) : role === "COMPANY" ? (
        <CompanyOverview data={data} />
      ) : (
        <CandidateOverview data={data} />
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <Panel className="p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Icon size={16} />
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </Panel>
  );
}

function ActivityList({ items }: { items: any[] }) {
  if (!items?.length) return <p className="text-sm text-slate-400">No recent activity.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a: any) => (
        <li key={a.id} className="py-2.5">
          <div className="text-sm text-slate-800">{a.description}</div>
          <div className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}

function CompanyOverview({ data }: { data: any }) {
  const m = data.metrics;
  const pipeline = data.pipeline ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Metric label="Active jobs" value={m.activeJobs} icon={Briefcase} />
        <Metric label="Applications" value={m.totalApplications} icon={FileText} />
        <Metric label="In screening" value={m.screening} icon={Users} />
        <Metric label="Interviews" value={m.interviews} icon={Target} />
        <Metric label="Offers" value={m.offers} icon={Award} />
        <Metric label="Hires" value={m.hires} icon={Users} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Pipeline overview</h2>
          <div className="space-y-2">
            {Object.entries(pipeline).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium text-slate-500">{stage}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${Math.min(100, Number(count) * 12)}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs font-semibold text-slate-800">{String(count)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Recent applications</h2>
          {data.recentApplications.length === 0 ? (
            <p className="text-sm text-slate-400">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentApplications.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link href={`/company/candidates/${a.candidateId}`} className="text-sm font-medium text-slate-900 hover:text-violet-700">
                      {a.candidateName}
                    </Link>
                    <div className="text-xs text-slate-500">{a.jobTitle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-violet-700">{a.match_score}%</span>
                    <StatusPill status={a.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Upcoming interviews</h2>
          {data.upcomingInterviews.length === 0 ? (
            <p className="text-sm text-slate-400">None scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {data.upcomingInterviews.map((i: any) => (
                <li key={i.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                  <div className="font-medium text-slate-900">{i.type}</div>
                  <div className="text-xs text-slate-500">{i.jobTitle}</div>
                  {i.scheduled_date && (
                    <div className="text-xs text-slate-500">{new Date(i.scheduled_date).toLocaleString()}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Recent jobs</h2>
          {data.recentJobs.length === 0 ? (
            <p className="text-sm text-slate-400">No jobs posted.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentJobs.map((j: any) => (
                <li key={j.id} className="flex items-center justify-between py-1.5">
                  <Link href={`/company/jobs/${j.id}`} className="text-sm font-medium text-slate-900 hover:text-violet-700">
                    {j.title}
                  </Link>
                  <StatusPill status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Recent activity</h2>
          <ActivityList items={data.activity} />
        </Panel>
      </div>
    </div>
  );
}

function CandidateOverview({ data }: { data: any }) {
  const m = data.metrics;
  const breakdown = data.statusBreakdown ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Applications" value={m.applications} icon={FileText} />
        <Metric label="Interviews" value={m.interviews} icon={CalendarClock} />
        <Metric label="Saved jobs" value={m.savedJobs} icon={Bookmark} />
        <Metric label="Offers" value={m.offers} icon={Award} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Application status</h2>
          <div className="space-y-2">
            {Object.entries(breakdown).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium text-slate-500">{stage}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, Number(count) * 25)}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-semibold text-slate-800">{String(count)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/candidate/applications" className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline">
              View applications <ArrowRight size={13} />
            </Link>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Recent applications</h2>
          {data.recentApplications.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} title="Nothing applied yet" description="Browse open roles and apply to start tracking." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentApplications.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/candidate/applications/${a.id}`} className="text-sm font-medium text-slate-900 hover:text-violet-700">
                    {a.jobTitle}
                  </Link>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Recent activity</h2>
        <ActivityList items={data.activity} />
      </Panel>
    </div>
  );
}
