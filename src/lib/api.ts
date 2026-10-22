// Client-side API wrapper for the ReqCore pipeline endpoints.

import type {
  CompareResult,
  ExplainResult,
  RoadmapResult,
  SkillGap,
} from "@/lib/ml/types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

export const api = {
  uploadResume: async (file: File): Promise<AnalyzeResumeResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/resume/analyze", { method: "POST", body: form });
    const data = (await res.json()) as AnalyzeResumeResponse & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Resume analysis failed");
    return data;
  },
  analyzeJob: (job_description: string): Promise<AnalyzeJobResponse> =>
    post("/api/job/analyze", { job_description }),
  analyzeResumeText: (text: string): Promise<AnalyzeResumeResponse> =>
    post("/api/resume/analyze", { text }),
  embedding: (body: {
    text?: string;
    candidate?: unknown;
    job?: unknown;
  }): Promise<{
    candidate_vector: number[];
    job_vector: number[];
    cosine_similarity: number;
  }> => post("/api/embedding", body),
  knn: (candidate: unknown, job: unknown) =>
    post("/api/match/knn", { candidate, job }),
  xgboost: (candidate: unknown, job: unknown) =>
    post("/api/match/xgboost", { candidate, job }),
  compare: (
    candidate: unknown,
    job: unknown,
    ids?: { candidateId?: number; jobId?: number }
  ): Promise<CompareResult> =>
    post("/api/match/compare", { candidate, job, ...ids }),
  explain: (candidate: unknown, job: unknown): Promise<ExplainResult> =>
    post("/api/match/explain", { candidate, job }),
  skillsGaps: (
    candidate: unknown,
    job: unknown
  ): Promise<{ gaps: SkillGap[] }> => post("/api/skills/gaps", { candidate, job }),
  roadmap: (
    candidate: unknown,
    job: unknown,
    ids?: { candidateId?: number; jobId?: number }
  ): Promise<RoadmapResult> => post("/api/roadmap", { candidate, job, ...ids }),
  demo: async (kind = "all") => {
    const res = await fetch(`/api/demo?kind=${kind}`);
    return res.json();
  },
  testSuite: async (): Promise<{
    ok: boolean;
    allPassed: boolean;
    totalTests: number;
    passedTests: number;
    results: import("@/lib/ml/types").ValidationTestCaseResult[];
  }> => {
    const res = await fetch("/api/test-suite");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to run test suite");
    return data;
  },
};

export type AnalyzeResumeResponse = {
  ok: boolean;
  profile: import("@/lib/ml/types").CandidateProfile;
  engine: "gemini" | "deterministic";
  format: string;
  candidateId?: number;
};

export type AnalyzeJobResponse = {
  ok: boolean;
  profile: import("@/lib/ml/types").JobProfile;
  engine: "gemini" | "deterministic";
  jobId?: number;
};
