import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidate_profiles, jobs, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { candidateRowToProfile, jobRowToProfile } from "@/lib/services/portalProfile";
import { buildMatchResult } from "@/lib/services/matchingService";
import { authErrorStatus, requireAuth } from "@/lib/auth";
import { analyzeSkillGaps } from "@/lib/services/skillGapService";
import { generateRoadmap } from "@/lib/services/roadmapService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal/match  { candidateId, jobId, includeRoadmap? }
 *
 * Single entry point used by BOTH sides of the portal:
 *  - a candidate previewing their fit (and learning roadmap) before applying
 *  - a company running any candidate in the pool against any of its jobs
 *
 * All numbers come from the existing matching engine; nothing is fabricated.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => null);
    if (!body?.jobId) {
      return Response.json({ ok: false, error: "jobId is required." }, { status: 400 });
    }

    // Identity always comes from the session. A candidate scores only
    // themselves; a recruiter scores candidates against jobs their own
    // company owns.
    let candidateId: number;
    if (session.role === "CANDIDATE") {
      candidateId = session.candidateId!;
      if (body.candidateId != null && Number(body.candidateId) !== candidateId) {
        return Response.json(
          { ok: false, error: "You can only run matches for your own profile." },
          { status: 403 }
        );
      }
    } else {
      if (!body?.candidateId) {
        return Response.json(
          { ok: false, error: "candidateId is required for recruiter matches." },
          { status: 400 }
        );
      }
      candidateId = Number(body.candidateId);
    }
    body.candidateId = candidateId;

    const [candidateRow] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, Number(body.candidateId)))
      .limit(1);

    const [jobRow] = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        companyId: jobs.companyId,
        required_skills: jobs.required_skills,
        preferred_skills: jobs.preferred_skills,
        experience_required: jobs.experience_required,
        profile_data: jobs.profile_data,
        companyName: companies.name,
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobs.id, Number(body.jobId)))
      .limit(1);

    if (!candidateRow || !jobRow) {
      return Response.json({ ok: false, error: "Candidate or job not found." }, { status: 404 });
    }

    // A company may only run matches against jobs it owns.
    if (body.companyId && jobRow.companyId !== Number(body.companyId)) {
      return Response.json(
        { ok: false, error: "You do not have access to this job." },
        { status: 403 }
      );
    }

    const candidateProfile = candidateRowToProfile(candidateRow);
    const jobProfile = jobRowToProfile(jobRow);

    const match = buildMatchResult(candidateProfile, jobProfile);
    const gaps = analyzeSkillGaps(candidateProfile, jobProfile);

    let roadmap = null;
    if (body.includeRoadmap !== false) {
      roadmap = await generateRoadmap(candidateProfile, jobProfile);
    }

    return Response.json({
      ok: true,
      candidate: {
        id: candidateRow.id,
        name: candidateRow.name,
        title: candidateRow.title,
        experience_years: candidateRow.experience_years,
      },
      job: {
        id: jobRow.id,
        title: jobRow.title,
        companyName: jobRow.companyName,
      },
      match: {
        overall_score: match.overall_score,
        match_tier: match.match_tier,
        hard_warning: match.hard_warning,
        formula_breakdown: match.formula_breakdown,
        applicable_components: match.applicable_components,
        cosine_similarity: match.cosine_similarity,
      },
      coverage: {
        requiredMatched: gaps.requiredMatchedCount,
        requiredTotal: gaps.requiredTotalCount,
        requiredPercent: gaps.requiredCoveragePercent,
        preferredMatched: gaps.preferredMatchedCount,
        preferredTotal: gaps.preferredTotalCount,
        preferredPercent: gaps.preferredCoveragePercent,
      },
      requiredGaps: gaps.requiredGaps,
      preferredGaps: gaps.preferredGaps,
      roadmap,
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
