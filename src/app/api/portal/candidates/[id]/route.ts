import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  application_status_history,
  applications,
  candidate_profiles,
  jobs,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  authErrorStatus,
  requireAuth,
  requireCandidateId,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/candidates/[id]
 * Recruiters may view anyone in the pool; candidates may view only themselves.
 * For recruiters, only applications to their own company's jobs are returned.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const candidateId = Number(id);

    if (session.role === "CANDIDATE" && session.candidateId !== candidateId) {
      return Response.json({ ok: false, error: "You can only view your own profile." }, { status: 403 });
    }
    const companyId = session.role === "COMPANY" ? session.companyId : null;

    const [candidate] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);
    if (!candidate) return Response.json({ ok: false, error: "Candidate not found." }, { status: 404 });

    let companyApplications: unknown[] = [];
    let history: unknown[] = [];
    if (companyId) {
      const rows = await db
        .select({
          id: applications.id,
          status: applications.status,
          match_score: applications.match_score,
          match_data: applications.match_data,
          answers: applications.answers,
          cover_letter: applications.cover_letter,
          createdAt: applications.createdAt,
          jobId: jobs.id,
          jobTitle: jobs.title,
          jobCompanyId: jobs.companyId,
          custom_questions: jobs.custom_questions,
        })
        .from(applications)
        .leftJoin(jobs, eq(applications.jobId, jobs.id))
        .where(eq(applications.candidateId, candidateId))
        .orderBy(asc(applications.createdAt));

      // Tenant isolation: only applications to this company's own jobs.
      const owned = rows.filter((r) => r.jobCompanyId === companyId);
      companyApplications = owned.map((r) => ({
        ...r,
        explanation: (r.match_data as { explanation?: unknown })?.explanation ?? null,
      }));

      if (owned.length) {
        history = await db
          .select()
          .from(application_status_history)
          .where(eq(application_status_history.applicationId, owned[owned.length - 1].id))
          .orderBy(asc(application_status_history.createdAt));
      }
    }

    return Response.json({
      ok: true,
      candidate,
      applications: companyApplications,
      history,
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** PUT /api/portal/candidates/[id] — candidates edit only their own profile. */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth("CANDIDATE");
    if (requireCandidateId(session) !== Number(id)) {
      return Response.json({ ok: false, error: "You can only edit your own profile." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });

    const [existing] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, Number(id)))
      .limit(1);
    if (!existing) return Response.json({ ok: false, error: "Candidate not found." }, { status: 404 });

    const nextProfileData = body.profile_data
      ? { ...((existing.profile_data ?? {}) as object), ...(body.profile_data as object) }
      : existing.profile_data;

    const [updated] = await db
      .update(candidate_profiles)
      .set({
        name: body.name ?? existing.name,
        title: body.title ?? existing.title,
        location: body.location ?? existing.location,
        experience_years:
          body.experience_years !== undefined ? Number(body.experience_years) : existing.experience_years,
        resume_quality: body.resume_quality ?? existing.resume_quality,
        profile_data: nextProfileData,
      })
      .where(eq(candidate_profiles.id, Number(id)))
      .returning();

    return Response.json({ ok: true, candidate: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
