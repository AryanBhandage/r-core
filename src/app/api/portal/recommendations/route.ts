import { NextRequest } from "next/server";
import { db } from "@/db";
import { applications, candidate_profiles, jobs } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCandidateId, requireCompanyId } from "@/lib/auth";
import {
  explainMatch,
  recommendCandidatesForJob,
  recommendJobsForCandidate,
} from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/recommendations
 *  - candidates: recommended open jobs (skills/experience/embeddings)
 *  - recruiters: ?jobId= -> potential candidates for that job
 * Every recommendation carries the reasons that produced it.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const params = new URL(request.url).searchParams;

    if (session.role === "CANDIDATE") {
      const candidateId = requireCandidateId(session);
      const [profile] = await db
        .select()
        .from(candidate_profiles)
        .where(eq(candidate_profiles.id, candidateId))
        .limit(1);
      const applied = await db
        .select({ jobId: applications.jobId })
        .from(applications)
        .where(eq(applications.candidateId, candidateId));
      const appliedIds = applied.map((a) => a.jobId);

      const recs = await recommendJobsForCandidate(profile, 6);
      return Response.json({
        ok: true,
        target: "jobs",
        recommendations: recs.map((r) => {
          const explanation = explainMatch(profile, r.job);
          return {
            job: {
              id: r.job.id,
              title: r.job.title,
              slug: r.job.slug,
              location: r.job.location,
              work_mode: r.job.work_mode,
              employment_type: r.job.employment_type,
              salary_range: r.job.salary_range,
              required_skills: r.job.required_skills,
              preferred_skills: r.job.preferred_skills,
            },
            companyName: undefined,
            similarity: r.similarity,
            reasons: r.reasons,
            match: {
              overall: explanation.overall,
              tier: explanation.tier,
              matchedSkills: explanation.matchedSkills.map((s) => s.skill),
              missingSkills: explanation.missingSkills.map((s) => s.skill),
            },
            alreadyApplied: appliedIds.includes(r.job.id),
          };
        }),
      });
    }

    const companyId = requireCompanyId(session);
    const jobId = Number(params.get("jobId"));
    if (!jobId) return Response.json({ ok: false, error: "jobId is required." }, { status: 400 });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job || job.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not have access to this job." }, { status: 403 });
    }

    const appliedRows = await db
      .select({ candidateId: applications.candidateId })
      .from(applications)
      .where(eq(applications.jobId, jobId));
    const applicantIds = new Set(appliedRows.map((a) => a.candidateId));

    const recs = await recommendCandidatesForJob(job, 8);
    return Response.json({
      ok: true,
      target: "candidates",
      recommendations: recs.map((r) => {
        const explanation = explainMatch(r.candidate, job);
        return {
          candidate: {
            id: r.candidate.id,
            name: r.candidate.name,
            title: r.candidate.title,
            location: r.candidate.location,
            experience_years: r.candidate.experience_years,
            skills: r.candidate.profile_data?.technical_skills ?? [],
          },
          similarity: r.similarity,
          reasons: r.reasons,
          match: {
            overall: explanation.overall,
            tier: explanation.tier,
            matchedSkills: explanation.matchedSkills.map((s) => s.skill),
            missingSkills: explanation.missingSkills.map((s) => s.skill),
            evidence: explanation.evidence,
          },
          alreadyApplied: applicantIds.has(r.candidate.id),
        };
      }),
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
