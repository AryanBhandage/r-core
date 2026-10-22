import { NextRequest } from "next/server";
import { db } from "@/db";
import { applications, candidate_profiles, interviews, jobs, users } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCandidateId, requireCompanyId } from "@/lib/auth";
import { notify, recordActivity } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/portal/interviews — role-scoped interview list. */
export async function GET() {
  try {
    const session = await requireAuth();
    const base = db
      .select({
        id: interviews.id,
        applicationId: interviews.applicationId,
        type: interviews.type,
        scheduled_date: interviews.scheduled_date,
        interviewers: interviews.interviewers,
        meeting_link: interviews.meeting_link,
        status: interviews.status,
        result: interviews.result,
        notes: interviews.notes,
        jobTitle: jobs.title,
        jobCompanyId: jobs.companyId,
        candidateName: candidate_profiles.name,
        candidateId: applications.candidateId,
        applicationStatus: applications.status,
      })
      .from(interviews)
      .leftJoin(applications, eq(interviews.applicationId, applications.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .leftJoin(candidate_profiles, eq(applications.candidateId, candidate_profiles.id))
      .orderBy(desc(interviews.scheduled_date));

    const rows = await base;
    const scoped =
      session.role === "COMPANY"
        ? rows.filter((r) => r.jobCompanyId === session.companyId)
        : rows.filter((r) => r.candidateId === session.candidateId);

    return Response.json({ ok: true, interviews: scoped });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** POST /api/portal/interviews — recruiter schedules an interview. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const body = await request.json().catch(() => null);
    const applicationId = Number(body?.applicationId);
    if (!applicationId || !body?.type) {
      return Response.json({ ok: false, error: "applicationId and type are required." }, { status: 400 });
    }

    // Ownership: the application must belong to this company's job.
    const [app] = await db
      .select({ jobId: applications.jobId, candidateId: applications.candidateId, userId: candidate_profiles.userId, name: candidate_profiles.name })
      .from(applications)
      .leftJoin(candidate_profiles, eq(applications.candidateId, candidate_profiles.id))
      .where(eq(applications.id, applicationId))
      .limit(1);
    if (!app) return Response.json({ ok: false, error: "Application not found." }, { status: 404 });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(app.jobId))).limit(1);
    if (!job || job.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not own this application." }, { status: 403 });
    }

    const [created] = await db
      .insert(interviews)
      .values({
        applicationId,
        type: String(body.type),
        scheduled_date: body.scheduled_date ? new Date(body.scheduled_date) : null,
        interviewers: body.interviewers ?? null,
        meeting_link: body.meeting_link ?? null,
        notes: body.notes ?? null,
        status: "SCHEDULED",
      })
      .returning();

    await recordActivity("COMPANY", companyId, "INTERVIEW_SCHEDULED",
      `${body.type} scheduled for ${app.name ?? "candidate"} — ${job.title}`);
    if (app.userId) {
      await notify(
        app.userId,
        "INTERVIEW_SCHEDULED",
        `Interview scheduled: ${job.title}`,
        `${body.type}${body.scheduled_date ? ` on ${new Date(body.scheduled_date).toLocaleString()}` : ""}`
      );
    }

    return Response.json({ ok: true, interview: created });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** PATCH /api/portal/interviews { id, ...fields } — update status/result/notes/link. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    if (!id) return Response.json({ ok: false, error: "id is required." }, { status: 400 });

    const rows = await db
      .select({ interview: interviews, jobCompanyId: jobs.companyId, candidateOwner: applications.candidateId })
      .from(interviews)
      .leftJoin(applications, eq(interviews.applicationId, applications.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(interviews.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return Response.json({ ok: false, error: "Interview not found." }, { status: 404 });

    const ownsIt =
      session.role === "COMPANY"
        ? row.jobCompanyId === session.companyId
        : row.candidateOwner === session.candidateId;
    if (!ownsIt) return Response.json({ ok: false, error: "You do not have access to this interview." }, { status: 403 });

    const patch: Record<string, unknown> = {};
    for (const key of ["type", "interviewers", "meeting_link", "result", "notes", "status"]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (body.scheduled_date !== undefined) {
      patch.scheduled_date = body.scheduled_date ? new Date(body.scheduled_date) : null;
    }

    const [updated] = await db.update(interviews).set(patch).where(eq(interviews.id, id)).returning();
    return Response.json({ ok: true, interview: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
