// ============================================================================
// Recruitment domain service
// ============================================================================
// Thin orchestration over the EXISTING AI stack. Nothing here re-implements
// parsing, embeddings, matching, gap analysis or roadmaps — it composes:
//   portalProfile.ts      DB row  -> canonical VerifiedCandidateProfile / JobProfile
//   matchingService.ts    buildMatchResult()  -> synthesized, weighted score
//   skillGapService.ts    analyzeSkillGaps()  -> matched / partial / missing
//   roadmapService.ts     generateRoadmap()   -> phased learning plan
//   embedding.ts          embedText/cosine    -> semantic search + similarity
// ============================================================================

import { db } from "@/db";
import {
  activity_history,
  application_status_history,
  applications,
  candidate_profiles,
  jobs,
  match_scores,
  notifications,
} from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { candidateRowToProfile, jobRowToProfile } from "./portalProfile";
import { buildMatchResult } from "./matchingService";
import { analyzeSkillGaps } from "./skillGapService";
import { cosineSimilarity, embedText } from "@/lib/ml/embedding";
import type { SkillGap } from "@/lib/ml/types";

export const APPLICATION_STATUSES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

// Kanban stage order used by the recruiter pipeline.
export const PIPELINE_STAGES = ["SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;

export interface MatchComponent {
  key: string;
  label: string;
  score: number | null; // null => requirement not specified in the JD
  applicable: boolean;
}

export interface MatchExplanation {
  overall: number;
  tier: string;
  components: MatchComponent[];
  matchedSkills: SkillGap[];
  partialSkills: SkillGap[];
  missingSkills: SkillGap[];
  evidence: string[];
  hardWarning: { title: string; message: string } | null;
  cosineSimilarity: number;
}

/**
 * Explainable candidate-vs-job match. All numbers come from the existing
 * synthesized formula; every claim carries the source evidence text.
 */
export function explainMatch(candidateRow: any, jobRow: any): MatchExplanation {
  const candidate = candidateRowToProfile(candidateRow);
  const job = jobRowToProfile(jobRow);
  const match = buildMatchResult(candidate, job);
  const gaps = analyzeSkillGaps(candidate, job);
  const everyGap: SkillGap[] = [...gaps.requiredGaps, ...gaps.preferredGaps];
  const fb = match.formula_breakdown;
  const ap = match.applicable_components;

  const components: MatchComponent[] = [
    { key: "skills", label: "Skills", score: fb.required_skill_coverage_score, applicable: ap.requiredSkillCoverage },
    { key: "experience", label: "Experience", score: ap.experienceMatch ? fb.experience_score : null, applicable: ap.experienceMatch },
    { key: "education", label: "Education", score: ap.educationMatch ? fb.education_score : null, applicable: ap.educationMatch },
    { key: "projects", label: "Projects", score: fb.project_score, applicable: true },
    { key: "preferred", label: "Preferred skills", score: ap.preferredSkillCoverage ? fb.preferred_skill_coverage_score : null, applicable: ap.preferredSkillCoverage },
  ];

  // Evidence sentences derived only from verified resume/job content.
  const evidence: string[] = [];
  for (const record of candidate.experience ?? []) {
    const years = record.durationYears ?? 0;
    if (years > 0) {
      evidence.push(
        `${years} yr${years === 1 ? "" : "s"} — ${record.title}${record.company ? ` at ${record.company}` : ""}`
      );
    }
    for (const achievement of record.achievements ?? []) evidence.push(achievement);
  }
  for (const project of candidate.projects ?? []) {
    evidence.push(`Project: ${project.title} (${(project.technologies ?? []).join(", ") || "no stack listed"})`);
  }
  for (const edu of candidate.education ?? []) {
    evidence.push(`Education: ${edu.degree}${edu.field ? ` — ${edu.field}` : ""}`);
  }

  return {
    overall: match.overall_score,
    tier: match.match_tier,
    components,
    matchedSkills: gaps.requiredGaps.filter((g) => g.status === "MATCHED").concat(gaps.preferredGaps.filter((g) => g.status === "MATCHED")),
    partialSkills: everyGap.filter((g) => g.status === "PARTIAL"),
    missingSkills: everyGap.filter((g) => g.status === "MISSING"),
    evidence: evidence.slice(0, 8),
    hardWarning: match.hard_warning ? { title: match.hard_warning.title, message: match.hard_warning.message } : null,
    cosineSimilarity: match.cosine_similarity,
  };
}

/** Persist a computed match so dashboards and rankings can reuse it. */
export async function saveMatchScore(
  candidateId: number,
  jobId: number,
  explanation: MatchExplanation
): Promise<void> {
  try {
    const existing = await db
      .select({ id: match_scores.id })
      .from(match_scores)
      .where(sql`${match_scores.candidateId} = ${candidateId} and ${match_scores.jobId} = ${jobId}`)
      .limit(1);
    const payload = {
      overall: explanation.overall,
      components: explanation.components as unknown as object,
    };
    if (existing.length) {
      await db.update(match_scores).set(payload).where(eq(match_scores.id, existing[0].id));
    } else {
      await db.insert(match_scores).values({ candidateId, jobId, ...payload });
    }
  } catch {
    // Match caching is best-effort; scoring already succeeded.
  }
}

export async function notify(userId: number, type: string, title: string, body?: string) {
  try {
    await db.insert(notifications).values({ userId, type, title, body: body ?? null });
  } catch {
    // Notifications must never break the primary action.
  }
}

export async function recordActivity(
  actorType: "COMPANY" | "CANDIDATE",
  actorId: number,
  action: string,
  description: string
) {
  try {
    await db.insert(activity_history).values({ actorType, actorId, action, description });
  } catch {
    // Audit trail is best-effort.
  }
}

export async function recordStatusChange(
  applicationId: number,
  fromStatus: string | null,
  toStatus: string,
  changedById: number | null,
  note?: string
) {
  await db.insert(application_status_history).values({
    applicationId,
    fromStatus,
    toStatus,
    changedById,
    note: note ?? null,
  });
}

// ---------------------------------------------------------------- completion

export interface CompletionItem {
  label: string;
  done: boolean;
}

export function profileCompletion(profile: any): { percent: number; items: CompletionItem[] } {
  const data = profile?.profile_data ?? {};
  const items: CompletionItem[] = [
    { label: "Name", done: Boolean(profile?.name) },
    { label: "Email", done: Boolean(profile?.email) },
    { label: "Phone", done: Boolean(profile?.phone) },
    { label: "Location", done: Boolean(profile?.location) },
    { label: "About", done: Boolean(data.about) },
    { label: "Skills (3+)", done: (data.technical_skills ?? []).length >= 3 },
    { label: "Experience", done: (data.experience ?? []).length > 0 },
    { label: "Education", done: (data.education ?? []).length > 0 },
    { label: "Projects", done: (data.projects ?? []).length > 0 },
    { label: "Resume uploaded", done: Boolean(data.resume?.text) },
    { label: "Links (LinkedIn/GitHub)", done: Boolean(data.links?.linkedin || data.links?.github || data.links?.portfolio) },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

// ------------------------------------------------------------- semantic search

/**
 * Semantic ranking over the existing embedding implementation. A query is
 * embedded once and compared against each record's searchable text; the top
 * matched terms are returned as the "why" so results are explainable.
 */
export function semanticRank<T>(
  query: string,
  rows: T[],
  textOf: (row: T) => string
): { row: T; similarity: number; reasons: string[] }[] {
  const queryVector = embedText(query);
  const queryTerms = Array.from(new Set(query.toLowerCase().match(/[a-z+#.]{2,}/g) ?? []));
  return rows
    .map((row) => {
      const text = textOf(row);
      const similarity = cosineSimilarity(queryVector, embedText(text));
      const lower = text.toLowerCase();
      const reasons = queryTerms.filter((t) => lower.includes(t)).slice(0, 5);
      return { row, similarity, reasons };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

/** Ranked open jobs for a candidate profile (recommendations + semantic search). */
export async function recommendJobsForCandidate(candidateRow: any, limit = 6) {
  const openJobs = await db.select().from(jobs).where(eq(jobs.status, "OPEN"));
  const ranked = semanticRank(
    `${candidateRow.title ?? ""} ${(candidateRow.profile_data?.technical_skills ?? []).join(" ")} ${candidateRow.profile_data?.about ?? ""}`,
    openJobs,
    (job) => `${job.title} ${job.department ?? ""} ${(job.required_skills ?? []).join(" ")} ${(job.preferred_skills ?? []).join(" ")} ${job.profile_data?.description ?? ""}`
  );
  return ranked.slice(0, limit).map(({ row, similarity, reasons }) => ({
    job: row,
    similarity,
    reasons,
  }));
}

/** Ranked candidates for a job (recruiter recommendations / shortlisting aid). */
export async function recommendCandidatesForJob(jobRow: any, limit = 8) {
  const candidates = await db.select().from(candidate_profiles);
  const ranked = semanticRank(
    `${jobRow.title} ${(jobRow.required_skills ?? []).join(" ")} ${(jobRow.preferred_skills ?? []).join(" ")}`,
    candidates,
    (c) => `${c.title ?? ""} ${(c.profile_data?.technical_skills ?? []).join(" ")} ${c.profile_data?.about ?? ""} ${(c.profile_data?.projects ?? []).map((p: any) => p.title).join(" ")}`
  );
  return ranked.slice(0, limit).map(({ row, similarity, reasons }) => ({
    candidate: row,
    similarity,
    reasons,
  }));
}

export async function latestActivityFor(ids: { companyActorId?: number; candidateActorId?: number }, limit = 8) {
  const rows = await db.select().from(activity_history).orderBy(desc(activity_history.createdAt)).limit(40);
  return rows
    .filter((r) => {
      if (r.actorType === "COMPANY") return ids.companyActorId == null || r.actorId === ids.companyActorId;
      return ids.candidateActorId == null || r.actorId === ids.candidateActorId;
    })
    .slice(0, limit);
}

export { inArray };
