"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Ban, Check } from "lucide-react";
import {
  PageHeader,
  Panel,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  Badge,
} from "@/components/portal/Primitives";

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/applications/${params.id}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load application.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async () => {
    if (!confirm("Withdraw this application? The company will be notified.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "WITHDRAWN" }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading application" />;
  if (error && !data) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  if (!data) return null;

  const { application, job, company, history = [], interviews = [] } = data;
  const withdrawable = !["REJECTED", "WITHDRAWN", "HIRED"].includes(application.status);

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => router.push("/candidate/applications")} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} /> Back to applications
      </button>

      <PageHeader
        eyebrow="Application"
        title={job?.title ?? "Role"}
        description={company?.name ?? ""}
        action={
          <div className="flex items-center gap-2">
            <StatusPill status={application.status} />
            {withdrawable && (
              <SecondaryButton onClick={withdraw} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Withdraw
              </SecondaryButton>
            )}
          </div>
        }
      />

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Status timeline</h2>
          <ol className="relative ml-2 space-y-4 border-l-2 border-slate-100 pl-5">
            {history.map((h: any) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-violet-500 ring-2 ring-white" />
                <div className="flex items-center gap-2">
                  <StatusPill status={h.toStatus} />
                  <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
                </div>
                {h.note && <div className="mt-1 text-xs text-slate-600">{h.note}</div>}
                {h.changedBy && <div className="text-[11px] text-slate-400">by {h.changedBy}</div>}
              </li>
            ))}
            {history.length === 0 && <li className="text-sm text-slate-400">No history recorded.</li>}
          </ol>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Your submission</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Applied</dt>
                <dd>{new Date(application.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Match score at application</dt>
                <dd className="font-semibold text-violet-700">{application.match_score ?? 0}%</dd>
              </div>
              {application.cover_letter && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Cover letter</dt>
                  <dd className="whitespace-pre-wrap text-slate-700">{application.cover_letter}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Interviews</h2>
            {interviews.length === 0 ? (
              <p className="text-sm text-slate-400">None scheduled yet.</p>
            ) : (
              <ul className="space-y-3">
                {interviews.map((i: any) => (
                  <li key={i.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">{i.type}</span>
                      <StatusPill status={i.status} />
                    </div>
                    {i.scheduled_date && (
                      <div className="mt-1 text-xs text-slate-600">{new Date(i.scheduled_date).toLocaleString()}</div>
                    )}
                    {i.meeting_link && (
                      <a href={i.meeting_link} target="_blank" className="mt-1 inline-block text-xs text-violet-700 hover:underline">
                        Join meeting
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
