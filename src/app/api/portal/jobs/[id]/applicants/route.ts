import { NextRequest } from "next/server";
import { db } from "@/db";
import { applications, candidate_profiles, jobs, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCompanyId } from "@/lib/auth";
import {
  explainMatch,
  saveMatchScore,
  recordActivity,
  notify,
} from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/jobs/[id]/applicants?analyze=1
 * Recruiter shortlisting workspace. With `analyze=1` it runs the EXISTING
 * matching engine over every applicant, persists each score, and returns an
 * explainable breakdown (matched skills, gaps, evidence) — never a bare ranking.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);

    const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(id))).limit(1);
    if (!job) return Response.json({ ok: false, error: "Job not found." }, { status: 404 });
    if (job.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not have access to this job." }, { status: 403 });
    }

    const analyze = new URL(request.url).searchParams.get("analyze") === "1";

    const rows = await db
      .select({
        id: applications.id,
        status: applications.status,
        match_score: applications.match_score,
        match_data: applications.match_data,
        cover_letter: applications.cover_letter,
        answers: applications.answers,
        createdAt: applications.createdAt,
        candidate: candidate_profiles,
      })
      .from(applications)
      .innerJoin(candidate_profiles, eq(applications.candidateId, candidate_profiles.id))
      .where(eq(applications.jobId, Number(id)))
      .orderBy(desc(applications.createdAt));

    const results = await Promise.all(
      rows.map(async (row) => {
        let explanation = (row.match_data as any)?.explanation ?? null;
        if (analyze || !explanation) {
          explanation = explainMatch(row.candidate, job);
          await saveMatchScore(row.candidate.id, job.id, explanation);
          await db
            .update(applications)
            .set({ match_score: explanation.overall, match_data: { explanation } })
            .where(eq(applications.id, row.id));
        }
        return {
          applicationId: row.id,
          status: row.status,
          appliedAt: row.createdAt,
          cover_letter: row.cover_letter,
          answers: row.answers ?? {},
          candidate: {
            id: row.candidate.id,
            name: row.candidate.name,
            title: row.candidate.title,
            location: row.candidate.location,
            experience_years: row.candidate.experience_years,
            resume_quality: row.candidate.resume_quality,
            skills: row.candidate.profile_data?.technical_skills ?? [],
            resume: row.candidate.profile_data?.resume ?? null,
          },
          explanation,
        };
      })
    );

    // Explainable ordering: highest synthesized match first.
    results.sort((a, b) => (b.explanation?.overall ?? 0) - (a.explanation?.overall ?? 0));
    return Response.json({ ok: true, job: { id: job.id, title: job.title }, analyzed: analyze, applicants: results });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** POST /api/portal/jobs/[id]/applicants { applicationId, status } — pipeline move. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const b = await request.json().catch(() => null);
    const applicationId = Number(b?.applicationId);
    const next = String(b?.status ?? "");
    if (!applicationId || !next) {
      return Response.json({ ok: false, error: "applicationId and status are required." }, { status: 400 });
    }

    const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(id))).limit(1);
    if (!job || job.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not have access to this job." }, { status: 403 });
    }
    const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
    if (!app || app.jobId !== Number(id)) {
      return Response.json({ ok: false, error: "Application not found." }, { status: 404 });
    }

    const [updated] = await db
      .update(applications)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(applications.id, applicationId))
      .returning();

    const { recordStatusChange } = await import("@/lib/services/recruitment");
    await recordStatusChange(applicationId, app.status, next, session.userId, b?.note ?? undefined);
    await recordActivity("COMPANY", companyId, "STATUS_CHANGED", `${job.title}: application ${app.status} -> ${next}`);

    const [candidate] = await db.select().from(candidate_profiles).where(eq(candidate_profiles.id, app.candidateId!)).limit(1);
    if (candidate?.userId) {
      await notify(candidate.userId, "STATUS_CHANGED", `Update on ${job.title}`, `Your application is now ${next}.`);
    }

    return Response.json({ ok: true, application: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
