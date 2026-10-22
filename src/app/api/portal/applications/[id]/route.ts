import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  application_status_history,
  applications,
  candidate_notes,
  candidate_profiles,
  companies,
  interviews,
  jobs,
  users,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { authErrorStatus, requireAuth } from "@/lib/auth";
import { recordActivity, recordStatusChange, notify } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"];

async function loadApplication(id: number) {
  const rows = await db
    .select({
      application: applications,
      job: jobs,
      company: companies,
      candidate: candidate_profiles,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .leftJoin(candidate_profiles, eq(applications.candidateId, candidate_profiles.id))
    .where(eq(applications.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function canView(row: NonNullable<Awaited<ReturnType<typeof loadApplication>>>, session: { role: string; companyId: number | null; candidateId: number | null }) {
  return session.role === "COMPANY"
    ? row.job?.companyId === session.companyId
    : row.application.candidateId === session.candidateId;
}

/** GET /api/portal/applications/[id] — full application detail. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const row = await loadApplication(Number(id));
    if (!row || !canView(row, session)) {
      return Response.json({ ok: false, error: "Application not found." }, { status: 404 });
    }

    const history = await db
      .select({
        id: application_status_history.id,
        fromStatus: application_status_history.fromStatus,
        toStatus: application_status_history.toStatus,
        note: application_status_history.note,
        createdAt: application_status_history.createdAt,
        changedBy: users.name,
      })
      .from(application_status_history)
      .leftJoin(users, eq(application_status_history.changedById, users.id))
      .where(eq(application_status_history.applicationId, Number(id)))
      .orderBy(application_status_history.createdAt);

    const interviewRows = await db
      .select()
      .from(interviews)
      .where(eq(interviews.applicationId, Number(id)))
      .orderBy(desc(interviews.scheduled_date));

    // Private recruiter notes — only ever returned to the owning company.
    let notes: unknown[] = [];
    if (session.role === "COMPANY" && row.application.candidateId) {
      notes = await db
        .select({
          id: candidate_notes.id,
          body: candidate_notes.body,
          createdAt: candidate_notes.createdAt,
          authorName: users.name,
        })
        .from(candidate_notes)
        .leftJoin(users, eq(candidate_notes.authorId, users.id))
        .where(eq(candidate_notes.candidateId, row.application.candidateId))
        .orderBy(desc(candidate_notes.createdAt));
    }

    return Response.json({
      ok: true,
      application: row.application,
      job: row.job,
      company: row.company,
      candidate: session.role === "COMPANY" ? row.candidate : undefined,
      history,
      interviews: interviewRows,
      notes,
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * PATCH /api/portal/applications/[id] { status, note? }
 * Recruiters move candidates through the pipeline; candidates may withdraw.
 * Every transition is written to application_status_history and notified.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const row = await loadApplication(Number(id));
    if (!row || !canView(row, session)) {
      return Response.json({ ok: false, error: "Application not found." }, { status: 404 });
    }

    const b = await request.json().catch(() => null);
    const next = String(b?.status ?? "").toUpperCase();
    if (!ALLOWED.includes(next)) {
      return Response.json({ ok: false, error: `Invalid status: ${next}` }, { status: 400 });
    }

    // A candidate may only withdraw their own application.
    if (session.role === "CANDIDATE" && next !== "WITHDRAWN") {
      return Response.json({ ok: false, error: "Candidates can only withdraw an application." }, { status: 403 });
    }

    const from = row.application.status;
    if (from === next) return Response.json({ ok: true, application: row.application });

    const [updated] = await db
      .update(applications)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(applications.id, Number(id)))
      .returning();

    await recordStatusChange(Number(id), from, next, session.userId, b?.note ?? undefined);
    await recordActivity(
      session.role === "COMPANY" ? "COMPANY" : "CANDIDATE",
      session.role === "COMPANY" ? session.companyId! : session.candidateId!,
      next === "WITHDRAWN" ? "APPLICATION_WITHDRAWN" : "STATUS_CHANGED",
      `${row.candidate?.name ?? "Candidate"} · ${row.job?.title ?? "job"}: ${from} -> ${next}`
    );

    // Notify the counterpart.
    const targetUserId =
      session.role === "COMPANY" ? row.candidate?.userId : row.company?.userId;
    if (targetUserId) {
      await notify(
        targetUserId,
        "STATUS_CHANGED",
        `Application ${next.toLowerCase()}: ${row.job?.title ?? "role"}`,
        `${row.candidate?.name ?? "Candidate"} — ${from} -> ${next}`
      );
    }

    return Response.json({ ok: true, application: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
