import { NextRequest } from "next/server";
import { db } from "@/db";
import { saved_jobs, jobs, companies, applications } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCandidateId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/portal/saved-jobs — the signed-in candidate's bookmarks. */
export async function GET() {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const rows = await db
      .select({
        id: saved_jobs.id,
        createdAt: saved_jobs.createdAt,
        jobId: jobs.id,
        title: jobs.title,
        slug: jobs.slug,
        location: jobs.location,
        employment_type: jobs.employment_type,
        salary_range: jobs.salary_range,
        work_mode: jobs.work_mode,
        status: jobs.status,
        required_skills: jobs.required_skills,
        preferred_skills: jobs.preferred_skills,
        experience_required: jobs.experience_required,
        companyName: companies.name,
        applicantCount: sql<number>`(select count(*)::int from ${applications} where ${applications.jobId} = ${jobs.id})`,
      })
      .from(saved_jobs)
      .innerJoin(jobs, eq(saved_jobs.jobId, jobs.id))
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(saved_jobs.candidateId, candidateId))
      .orderBy(desc(saved_jobs.createdAt));
    return Response.json({ ok: true, saved: rows });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** POST /api/portal/saved-jobs { jobId, saved } — toggle a bookmark. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const body = await request.json().catch(() => null);
    const jobId = Number(body?.jobId);
    if (!jobId) return Response.json({ ok: false, error: "jobId is required." }, { status: 400 });

    const [existing] = await db
      .select({ id: saved_jobs.id })
      .from(saved_jobs)
      .where(and(eq(saved_jobs.candidateId, candidateId), eq(saved_jobs.jobId, jobId)))
      .limit(1);

    const wantsSaved = body?.saved === true || body?.saved === undefined;
    if (existing && !wantsSaved) {
      await db.delete(saved_jobs).where(eq(saved_jobs.id, existing.id));
      return Response.json({ ok: true, saved: false });
    }
    if (!existing && wantsSaved) {
      await db.insert(saved_jobs).values({ candidateId, jobId });
      return Response.json({ ok: true, saved: true });
    }
    return Response.json({ ok: true, saved: Boolean(existing) });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
