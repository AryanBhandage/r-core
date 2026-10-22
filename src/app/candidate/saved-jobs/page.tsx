"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, MapPin, Trash2 } from "lucide-react";
import {
  PageHeader,
  Panel,
  LoadingState,
  EmptyState,
  SkillChip,
  Badge,
  SecondaryButton,
} from "@/components/portal/Primitives";

export default function SavedJobsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/saved-jobs");
      const d = await res.json();
      setRows(d.ok ? d.saved : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (jobId: number) => {
    setRows((r) => r.filter((x) => x.jobId !== jobId));
    await fetch("/api/portal/saved-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, saved: false }),
    });
  };

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Saved Jobs" description="Roles you bookmarked for later." />

      {loading ? (
        <LoadingState label="Loading saved jobs" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={22} />}
          title="No saved jobs yet"
          description="Bookmark roles while browsing and they will appear here."
          action={
            <Link href="/candidate/jobs">
              <SecondaryButton>Browse jobs</SecondaryButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {rows.map((job) => (
            <Panel key={job.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link href={`/candidate/jobs/${job.jobId}`} className="text-lg font-semibold text-slate-900 hover:text-violet-700">
                  {job.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  <span className="font-medium text-slate-700">{job.companyName}</span>
                  {job.location && <span className="flex items-center gap-1"><MapPin size={13} /> {job.location}</span>}
                  {job.work_mode && <Badge>{job.work_mode}</Badge>}
                  {job.salary_range && <span>{job.salary_range}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(job.required_skills ?? []).slice(0, 6).map((s: string) => <SkillChip key={s} tone="violet">{s}</SkillChip>)}
                </div>
              </div>
              <SecondaryButton onClick={() => remove(job.jobId)}>
                <Trash2 size={14} /> Remove
              </SecondaryButton>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
