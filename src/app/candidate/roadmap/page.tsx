"use client";

import { useState } from "react";
import { Loader2, Route, ArrowRight, Play } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_CANDIDATE, DEMO_JOB } from "@/lib/demo";
import { Card } from "@/components/ui";

export default function CandidateRoadmapPage() {
  const [roadmap, setRoadmap] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await api.roadmap(DEMO_CANDIDATE, DEMO_JOB);
      setRoadmap(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!roadmap) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Route size={28} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Career Roadmap</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Generate a personalized learning path based on your actual skill gaps for your target role.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Build Roadmap
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="text-sm font-medium text-violet-600">Career Roadmap</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{roadmap.target_role}</h1>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="font-semibold text-slate-700">{roadmap.readiness}% ready</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{roadmap.required_gaps_count} required skill gaps</span>
        </div>
      </div>

      <div className="relative border-l-2 border-slate-200 pl-8 ml-4">
        {roadmap.items.map((it: any, i: number) => (
          <div key={i} className="relative mb-8 last:mb-0">
            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white ring-4 ring-white">
              {it.phase ?? i + 1}
            </span>
            <Card className="p-5 border-slate-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {it.phaseLabel || `Phase ${i + 1}`}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{it.skill}</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {it.duration}
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div>
                  <span className="font-semibold text-slate-900">Why it matters: </span>
                  {it.why}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">What to learn: </span>
                  {it.outcome}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Practical project: </span>
                  {it.project}
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
