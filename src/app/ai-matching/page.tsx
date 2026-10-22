"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  Play,
  Sparkles,
  ShieldCheck,
  GitBranch,
  Scissors,
  Route,
  Loader2,
  Wand2,
  Database,
  Beaker,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Check,
  X,
  FileText,
  Brain
} from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_CANDIDATE_TEXT, DEMO_JOB_TEXT } from "@/lib/demo";
import type {
  CandidateProfile,
  JobProfile,
  CompareResult,
  ExplainResult,
  SkillGap,
  RoadmapResult,
  ValidationTestCaseResult,
} from "@/lib/ml/types";
import {
  Button,
  Badge,
  Card,
  Progress,
  Tag,
} from "@/components/ui";
import { AnimatedScore, ScoreRing } from "@/components/viz";

type Tab = "match" | "compare" | "explain" | "gaps" | "roadmap" | "research";

export default function AIMatchingPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState(DEMO_CANDIDATE_TEXT);
  const [jobText, setJobText] = useState(DEMO_JOB_TEXT);
  const [useText, setUseText] = useState(true);

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [job, setJob] = useState<JobProfile | null>(null);
  const [engines, setEngines] = useState<{ resume: string; job: string }>({ resume: "-", job: "-" });
  const [ids, setIds] = useState<{ candidateId?: number; jobId?: number }>({});

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [explain, setExplain] = useState<ExplainResult | null>(null);
  const [gaps, setGaps] = useState<SkillGap[] | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResult | null>(null);

  const [tab, setTab] = useState<Tab>("match");
  const [timings, setTimings] = useState<Record<string, number>>({});

  // Automated validation test suite runner inside Research tab
  const [testSuiteResults, setTestSuiteResults] = useState<ValidationTestCaseResult[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const loadDemo = () => {
    setResumeFile(null);
    setUseText(true);
    setResumeText(DEMO_CANDIDATE_TEXT);
    setJobText(DEMO_JOB_TEXT);
    setError(null);
  };

  const handleRun = async () => {
    setError(null);
    setCompare(null);
    setExplain(null);
    setGaps(null);
    setRoadmap(null);
    setTab("match");

    try {
      setRunning(true);
      const t0 = Date.now();

      // 1. Candidate analysis
      let cand = candidate;
      if (!useText && resumeFile) {
        const res = await api.uploadResume(resumeFile);
        cand = res.profile;
        setCandidate(res.profile);
        setEngines((e) => ({ ...e, resume: res.engine }));
        setIds((i) => ({ ...i, candidateId: res.candidateId }));
      } else {
        if (!resumeText.trim()) throw new Error("Please paste resume text or upload a PDF/TXT resume.");
        const res = await api.analyzeResumeText(resumeText);
        cand = res.profile;
        setCandidate(res.profile);
        setEngines((e) => ({ ...e, resume: res.engine }));
      }

      // 2. Job Analysis
      let jb = job;
      if (jobText.trim()) {
        const res = await api.analyzeJob(jobText);
        jb = res.profile;
        setJob(res.profile);
        setEngines((e) => ({ ...e, job: res.engine }));
        setIds((i) => ({ ...i, jobId: res.jobId }));
      }

      if (!cand || !jb) throw new Error("Provide both a resume and a job description.");

      // 3. Match, Explain, Gaps, Roadmap
      const cmp = await api.compare(cand, jb, ids);
      setCompare(cmp);

      const ex = await api.explain(cand, jb);
      setExplain(ex);

      const g = await api.skillsGaps(cand, jb);
      setGaps(g.gaps);

      const rm = await api.roadmap(cand, jb, ids);
      setRoadmap(rm);

      setTimings({ total: Math.round((Date.now() - t0) / 10) / 100 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline analysis failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleRunValidationSuite = async () => {
    setRunningTests(true);
    try {
      const res = await api.testSuite();
      setTestSuiteResults(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test suite failed.");
    } finally {
      setRunningTests(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6">
        <div className="text-sm font-semibold uppercase tracking-widest text-violet-600 mb-1">
          Intelligence Module
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          AI Candidate Matching
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Upload a resume and job description to generate evidence-backed fit analysis, skill gaps, and career roadmaps.
        </p>

        {error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <div className="flex items-center gap-3">
              <AlertTriangle className="shrink-0 text-rose-600" size={20} />
              <div>
                <div className="font-semibold">Execution Error</div>
                <div>{error}</div>
              </div>
            </div>
            <Button variant="primary" onClick={handleRun}>
              <RefreshCw size={15} /> Retry
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 1</div>
              <h3 className="text-lg font-semibold text-slate-900">Candidate Resume</h3>
            </div>
            <div className="mb-4 flex gap-2 border-b border-slate-100 pb-4">
              <button
                onClick={() => setUseText(false)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${!useText ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Upload PDF/TXT
              </button>
              <button
                onClick={() => setUseText(true)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${useText ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Paste text
              </button>
            </div>

            {useText ? (
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste the candidate's resume text here…"
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-violet-300 focus:ring-4 focus:ring-violet-50 resize-none"
              />
            ) : (
              <div
                onClick={() => fileInput.current?.click()}
                className="flex h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors hover:border-violet-300 hover:bg-violet-50/30"
              >
                <UploadCloud className="text-slate-400" size={32} />
                <div className="text-sm font-semibold text-slate-700">
                  {resumeFile ? resumeFile.name : "Click to upload resume"}
                </div>
                <div className="text-xs text-slate-400">PDF or TXT</div>
              </div>
            )}
            <input ref={fileInput} type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)} />
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 2</div>
              <h3 className="text-lg font-semibold text-slate-900">Job Description</h3>
            </div>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the job description here…"
              rows={8}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-violet-300 focus:ring-4 focus:ring-violet-50 resize-none"
            />
          </Card>

          <Card className="p-6 bg-violet-50/50 border-violet-100">
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRun}
                disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 active:scale-[0.98] disabled:opacity-70"
              >
                {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                {running ? "Analyzing Match..." : "Run AI Analysis"}
              </button>
              <button
                onClick={loadDemo}
                disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                <Wand2 size={16} />
                Load Aarav Demo (50% Required Match)
              </button>
            </div>
            <p className="mt-4 text-center text-[10px] text-slate-500">
              One canonical VerifiedCandidateProfile powers all matching, scoring, explainability, and career roadmap outputs.
            </p>
          </Card>

          {candidate && compare && (
            <Card className="p-6">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Verified Candidate Profile</div>
              <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
              <div className="mt-1 text-xs text-slate-500">Verified Experience: {candidate.totalExperienceYears ?? candidate.experience_years} yrs | Quality Score: {candidate.resumeQuality?.score ?? 78}/100</div>
              
              <div className="mt-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-violet-600">
                Verified Technical Skills (With Source Section)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(candidate.technicalSkills ?? []).slice(0, 12).map((s) => (
                  <span
                    key={s.value}
                    title={`Evidence: "${s.evidence}"`}
                    className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {s.value}
                  </span>
                ))}
              </div>

              <div className="mt-5 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Target Role: {job?.job_title.toUpperCase()}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(job?.required_skills ?? []).map((s) => (
                  <span key={s} className="rounded bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                    REQUIRED: {s}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-3">
          {(compare || roadmap) && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                <TabBtn active={tab === "match"} onClick={() => setTab("match")} icon={<Sparkles size={14} />}>Match</TabBtn>
                <TabBtn active={tab === "compare"} onClick={() => setTab("compare")} icon={<GitBranch size={14} />}>Model Compare</TabBtn>
                <TabBtn active={tab === "explain"} onClick={() => setTab("explain")} icon={<ShieldCheck size={14} />}>Explain</TabBtn>
                <TabBtn active={tab === "gaps"} onClick={() => setTab("gaps")} icon={<Scissors size={14} />}>Skill Gaps</TabBtn>
                <TabBtn active={tab === "roadmap"} onClick={() => setTab("roadmap")} icon={<Route size={14} />}>Roadmap</TabBtn>
                <TabBtn active={tab === "research"} onClick={() => setTab("research")} icon={<Beaker size={14} />}>Research & Benchmark Tests</TabBtn>
              </div>

              {compare?.hard_warning && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-semibold text-amber-900">{compare.hard_warning.title}</div>
                    <div className="mt-1 text-sm text-amber-800">{compare.hard_warning.message}</div>
                  </div>
                </div>
              )}

              {tab === "match" && compare && <MatchTab compare={compare} />}
              {tab === "compare" && compare && <CompareTab compare={compare} />}
              {tab === "explain" && explain && <ExplainTab explain={explain} />}
              {tab === "gaps" && gaps && <GapsTab gaps={gaps} />}
              {tab === "roadmap" && <RoadmapTab roadmap={roadmap} />}
              {tab === "research" && compare && (
                <ResearchTab
                  compare={compare}
                  timings={timings}
                  testSuiteResults={testSuiteResults}
                  runningTests={runningTests}
                  onRunTestSuite={handleRunValidationSuite}
                />
              )}
            </div>
          )}

          {!compare && !roadmap && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                <Database size={28} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">Waiting for input</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Click <b>Run AI Analysis</b> or <b>Load Aarav Demo</b> to execute the complete verified extraction &amp; matching pipeline.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-violet-100 text-violet-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MatchTab({ compare }: { compare: CompareResult }) {
  const f = compare.features;
  const applicable = compare.applicable_components;
  const subs: { l: string; v: number | null; label: string; display?: string }[] = [
    {
      l: "Required Skill Coverage (Weight: 35%)",
      v: applicable.requiredSkillCoverage ? Math.round(f.required_skill_coverage * 100) : null,
      label: `${f.matched_required.length}/${f.matched_required.length + f.partial_required.length + f.missing_required.length} Required Skills Matched`,
    },
    {
      l: "Semantic Cosine Similarity (Weight: 20%)",
      v: Math.round(compare.cosine_similarity * 100),
      label: "Semantic layer — not a qualification percentage",
      display: compare.cosine_similarity.toFixed(3),
    },
    {
      l: "Relevant Professional Experience (Weight: 15%)",
      v: applicable.experienceMatch ? Math.round(f.experience_match * 100) : null,
      label: applicable.experienceMatch ? "JD minimum experience comparison" : "No experience requirement in JD",
    },
    {
      l: "Preferred Skill Coverage (Weight: 10%)",
      v: applicable.preferredSkillCoverage ? Math.round(f.preferred_skill_coverage * 100) : null,
      label: `${f.matched_preferred.length}/${f.matched_preferred.length + f.partial_preferred.length + f.missing_preferred.length} Preferred Skills Matched`,
    },
    {
      l: "Project Relevance (Weight: 10%)",
      v: Math.round(f.project_relevance * 100),
      label: "Verified project stack overlap",
    },
    {
      l: "Education Match (Weight: 5%)",
      v: applicable.educationMatch ? Math.round(f.education_match * 100) : null,
      label: applicable.educationMatch ? "Explicit degree requirement" : "Not specified in JD",
    },
    {
      l: "Certification Match (Weight: 5%)",
      v: applicable.certificationMatch ? Math.round(f.certification_match * 100) : null,
      label: applicable.certificationMatch ? "Explicit certification requirement" : "Not specified in JD",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ScoreRing value={compare.overall_score} label={compare.match_tier || "Overall Match"} />
        <div className="mt-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-widest">
          Synthesized Score
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          Reproducible from weights below
        </div>
      </div>
      <div className="space-y-3">
        {subs.map((s) => (
          <div key={s.l} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div>
                <span className="font-semibold text-slate-900">{s.l}</span>{" "}
                <span className="text-xs text-slate-500 ml-1 hidden sm:inline">· {s.label}</span>
              </div>
              <span className="font-bold text-violet-700">{s.v === null ? "Not specified" : (s.display ?? `${s.v}%`)}</span>
            </div>
            {s.v === null ? (
              <div className="rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 w-fit">Excluded from synthesized score</div>
            ) : (
              <Progress
                value={s.v}
                barClass={s.v >= 70 ? "bg-emerald-500" : s.v >= 45 ? "bg-amber-400" : "bg-rose-400"}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareTab({ compare }: { compare: CompareResult }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="neutral">Baseline Model (KNN)</Badge>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">K-NEAREST NEIGHBORS</span>
          </div>
          <div className="mt-4 text-5xl font-bold text-slate-900">
            <AnimatedScore value={compare.knn.score} />
          </div>
          <div className="mt-1 text-sm text-slate-500">Model Score (0–100)</div>
          <div className="mt-4 text-[11px] font-medium text-slate-400">k = {compare.knn.neighbors.length} neighbors</div>
        </Card>

        <Card className="p-6">
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="purple">Proposed Model (Gradient Boosting)</Badge>
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">GRADIENT BOOSTING</span>
          </div>
          <div className="mt-4 text-5xl font-bold text-slate-900">
            <AnimatedScore value={compare.xgboost.score} />
          </div>
          <div className="mt-1 text-sm text-slate-500">Model Score (0–100)</div>
          <div className="mt-4 text-[11px] font-medium text-slate-400">{compare.xgboost.n_trees} boosted trees</div>
        </Card>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <b>Model Evaluation Pending (Development Mode):</b> Both regression models
        run on a development calibration set. No real labelled hiring dataset
        is available, so no claim is made that one model scientifically
        outperforms the other.
      </div>

      <Card className="p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Model Feature Importance (Decision-Tree Split Gain)</h3>
          <Badge tone="neutral">SEPARATE FROM CANDIDATE SCORE</Badge>
        </div>
        <p className="mb-6 text-xs text-slate-500">
          Feature importance describes how influential a feature was to split
          decisions inside the Gradient Boosting Regressor — it is <b>NOT</b> candidate
          readiness or causal reasoning.
        </p>
        <div className="space-y-4">
          {compare.xgboost.feature_importance.map((fi) => (
            <div key={fi.feature}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-900">{fi.feature}</span>
                <span className="font-semibold text-violet-700">{(fi.importance * 100).toFixed(1)}% split gain</span>
              </div>
              <Progress value={fi.importance * 100} className="h-1.5" barClass="bg-violet-500" />
              <div className="mt-1.5 text-[11px] text-slate-500">{fi.description}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ExplainTab({ explain }: { explain: ExplainResult }) {
  const categoryTone: Record<string, { badge: string; border: string; bg: string; iconCol: string }> = {
    strength: { badge: "green", border: "border-emerald-200", bg: "bg-emerald-50/50", iconCol: "text-emerald-600" },
    satisfies_requirement: { badge: "green", border: "border-emerald-200", bg: "bg-emerald-50/50", iconCol: "text-emerald-600" },
    missing_mandatory: { badge: "red", border: "border-rose-200", bg: "bg-rose-50/50", iconCol: "text-rose-600" },
    preferred_skill: { badge: "amber", border: "border-amber-200", bg: "bg-amber-50/50", iconCol: "text-amber-600" },
    warning: { badge: "amber", border: "border-amber-200", bg: "bg-amber-50/50", iconCol: "text-amber-600" },
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-violet-50/50 border-violet-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-700 mb-3">
          <Brain size={16} /> Evidence-Backed Why Explanation
        </div>
        <p className="text-base font-medium text-slate-900 leading-relaxed">
          {explain.summary_reason}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(explain.reasons ?? []).map((r, i) => {
          const style = categoryTone[r.category] ?? { badge: "neutral", border: "border-slate-200", bg: "bg-white", iconCol: "text-slate-400" };
          const isWarning = r.category === "missing_mandatory" || r.category === "warning";
          const isPositive = r.category === "strength" || r.category === "satisfies_requirement";
          
          return (
            <Card key={i} className={`p-5 ${style.bg} ${style.border}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isWarning ? <AlertTriangle size={16} className={style.iconCol} /> : <CheckCircle2 size={16} className={style.iconCol} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-900 text-sm">{r.title}</h4>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">{r.detail}</p>
                  <div className="mt-3 rounded-md bg-white p-2.5 text-xs text-slate-600 font-mono border border-black/5 shadow-sm">
                    <span className="font-semibold text-slate-800 font-sans mr-1">Source Evidence:</span> 
                    {r.evidence}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GapsTab({ gaps }: { gaps: SkillGap[] }) {
  const reqGaps = gaps.filter((g) => g.tier === "REQUIRED");
  const prefGaps = gaps.filter((g) => g.tier === "PREFERRED");
  const reqMatchedCount = reqGaps.filter((g) => g.status === "MATCHED").length;
  const prefMatchedCount = prefGaps.filter((g) => g.status === "MATCHED").length;

  return (
    <div className="space-y-8">
      {/* REQUIRED SKILLS */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">REQUIRED (MUST-HAVE) SKILLS</h3>
            <p className="text-sm text-slate-500">Heavily weighted (35% of total synthesized match score)</p>
          </div>
          <div className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
            Coverage: {reqMatchedCount}/{reqGaps.length} ({reqGaps.length ? Math.round((reqMatchedCount / reqGaps.length) * 100) : 100}%)
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(["MATCHED", "PARTIAL", "MISSING"] as const).map((st) => {
            const list = reqGaps.filter((g) => g.status === st);
            const isMatched = st === "MATCHED";
            const isPartial = st === "PARTIAL";
            return (
              <Card key={st} className={`p-4 ${isMatched ? "border-emerald-200" : isPartial ? "border-amber-200" : "border-rose-200"}`}>
                <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className={isMatched ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-rose-700"}>
                    {st} — REQUIRED
                  </span>
                  <span className="text-slate-900">{list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.length === 0 && <li className="text-sm text-slate-400">None</li>}
                  {list.map((g) => (
                    <li key={g.skill} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{g.skill}</span>
                        {isMatched ? <Check size={16} className="text-emerald-600" /> : <X size={16} className="text-rose-600" />}
                      </div>
                      <div className="mt-1.5 text-xs text-slate-500 leading-relaxed">{g.evidence}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>

      {/* PREFERRED SKILLS */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">PREFERRED (NICE-TO-HAVE) SKILLS</h3>
            <p className="text-sm text-slate-500">Bonus weighting (10% of total synthesized match score)</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            Coverage: {prefMatchedCount}/{prefGaps.length} ({prefGaps.length ? Math.round((prefMatchedCount / prefGaps.length) * 100) : 100}%)
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(["MATCHED", "PARTIAL", "MISSING"] as const).map((st) => {
            const list = prefGaps.filter((g) => g.status === st);
            return (
              <Card key={st} className="p-4 border-slate-200">
                <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span>{st} — PREFERRED</span>
                  <span className="text-slate-900">{list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.length === 0 && <li className="text-sm text-slate-400">None</li>}
                  {list.map((g) => (
                    <li key={g.skill} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <div className="font-semibold text-slate-900">{g.skill}</div>
                      <div className="mt-1.5 text-xs text-slate-500 leading-relaxed">{g.evidence}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RoadmapTab({ roadmap }: { roadmap: RoadmapResult | null }) {
  if (!roadmap) return null;
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-slate-50 border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Target Role</div>
            <div className="text-xl font-semibold text-slate-900 mt-1">{roadmap.target_role}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Current Readiness</div>
            <div className="text-2xl font-bold text-violet-700 mt-1"><AnimatedScore value={roadmap.readiness} /></div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Badge tone="green">{roadmap.current_skills.length} matched</Badge>
          <Badge tone="red">{roadmap.required_gaps_count ?? roadmap.missing_skills.length} missing required</Badge>
        </div>
      </Card>

      <div className="relative border-l-2 border-slate-200 pl-8 ml-4">
        {roadmap.items.map((it, i) => (
          <div key={it.skill + i} className="relative mb-8 last:mb-0">
            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white ring-4 ring-white">
              {it.phase ?? i + 1}
            </span>
            <Card className="p-5 border-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">
                    {it.phaseLabel || `Phase ${i + 1}`}
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900">{it.skill}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={it.tier === "REQUIRED" ? "red" : "amber"}>{it.tier || "REQUIRED"}</Badge>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{it.duration}</span>
                </div>
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                <div className="rounded-md bg-violet-50/50 p-2 text-violet-900 border border-violet-100">
                  <span className="font-semibold mr-1">Connected JD Requirement:</span>{it.targetJobRequirement}
                </div>
                <div><span className="font-semibold text-slate-900 mr-1">Why:</span>{it.why}</div>
                <div><span className="font-semibold text-slate-900 mr-1">Learning Outcome:</span>{it.outcome}</div>
                <div><span className="font-semibold text-slate-900 mr-1">Practical Project:</span>{it.project}</div>
                <div><span className="font-semibold text-slate-900 mr-1">Prerequisite:</span>{it.prerequisite}</div>
              </div>
            </Card>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400 text-center">{roadmap.disclaimer}</p>
    </div>
  );
}

function ResearchTab({
  compare,
  timings,
  testSuiteResults,
  runningTests,
  onRunTestSuite,
}: {
  compare: CompareResult;
  timings: Record<string, number>;
  testSuiteResults: ValidationTestCaseResult[] | null;
  runningTests: boolean;
  onRunTestSuite: () => void;
}) {
  const rows = [
    ["Model Suite", "K-Nearest Neighbors Regressor (Baseline) + Gradient Boosting Regressor (Proposed)"],
    ["Synthesized Score Formula", "35% Req Coverage + 20% Semantic + 15% Experience + 10% Pref Coverage + 10% Project + 5% Edu + 5% Cert"],
    ["Required Skill Coverage", `${compare.features.matched_required.length}/${compare.features.matched_required.length + compare.features.missing_required.length} (${Math.round(compare.features.required_skill_coverage * 100)}%)`],
    ["KNN Regressor Prediction", `${compare.knn.score}% (k = ${compare.knn.neighbors.length} neighbors)`],
    ["Gradient Boosting Prediction", `${compare.xgboost.score}% (${compare.xgboost.n_trees} boosted trees)`],
    ["Evaluation Status", "Development Calibration Mode — evaluation pending"],
    ["Pipeline Processing Time", `${timings.total ?? "-"}s`],
  ];

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="mb-4 text-sm font-semibold text-slate-900">Research & Benchmark Parameters</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 mb-6">
          Explicitly separates Generative AI (section-aware extraction, explanation, roadmap), 
          Machine Learning (KNN, Gradient Boosting), Semantic NLP (hashed TF embeddings, cosine similarity), 
          and Deterministic Logic (transparent Required/Preferred coverage, hard gap warnings).
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-3 text-sm">
              <span className="text-slate-500">{k}</span>
              <span className="text-right font-medium text-slate-900">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-violet-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Automated Validation Test Suite</h3>
            <p className="mt-1 text-sm text-slate-500">Verifies pipeline integrity across 3 benchmark resumes.</p>
          </div>
          <Button onClick={onRunTestSuite} disabled={runningTests} variant="primary">
            {runningTests ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
            Run Automated Tests
          </Button>
        </div>

        {testSuiteResults && (
          <div className="space-y-4">
            {testSuiteResults.map((tc) => (
              <div key={tc.id} className={`rounded-xl border p-5 ${tc.passed ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="font-semibold text-slate-900">{tc.name}</div>
                  <Badge tone={tc.passed ? "green" : "red"}>{tc.passed ? "PASSED (100%)" : "FAILED"}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tc.assertions.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg bg-white p-3 border border-slate-100 shadow-xs">
                      {a.passed ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <X size={16} className="mt-0.5 shrink-0 text-rose-500" />}
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{a.label}</div>
                        <div className="text-xs text-slate-500 mt-1 font-mono">Actual: {a.actual}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
