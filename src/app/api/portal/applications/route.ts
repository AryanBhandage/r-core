import { NextRequest } from "next/server";
import { db } from "@/db";
import { applications, candidate_profiles, companies, jobs, users } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  authErrorStatus,
  requireAuth,
  requireCandidateId,
  requireCompanyId,
} from "@/lib/auth";
import {
  explainMatch,
  saveMatchScore,
  recordStatusChange,
  recordActivity,
  notify,
} from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/applications?status=&q=&jobId=
 * Candidates see their own applications; recruiters see applications for the
 * jobs their company owns. Ownership is never taken from client parameters.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const params = new URL(request.url).searchParams;

    const rows = await db
      .select({
        id: applications.id,
        status: applications.status,
        match_score: applications.match_score,
        cover_letter: applications.cover_letter,
        answers: applications.answers,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        candidateId: applications.candidateId,
        candidateName: candidate_profiles.name,
        candidateTitle: candidate_profiles.title,
        candidateEmail: candidate_profiles.email,
        jobId: jobs.id,
        jobTitle: jobs.title,
        jobLocation: jobs.location,
        jobStatus: jobs.status,
        jobCompanyId: jobs.companyId,
        companyName: companies.name,
        companyUserId: companies.userId,
        candidateUserId: candidate_profiles.userId,
      })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .leftJoin(candidate_profiles, eq(applications.candidateId, candidate_profiles.id))
      .orderBy(desc(applications.updatedAt));

    let result = rows;
    if (session.role === "CANDIDATE") {
      result = result.filter((r) => r.candidateId === session.candidateId);
    } else {
      result = result.filter((r) => r.jobCompanyId === session.companyId);
    }

    const jobId = params.get("jobId");
    if (jobId) result = result.filter((r) => r.jobId === Number(jobId));
    const status = params.get("status");
    if (status && status !== "any") result = result.filter((r) => r.status === status);
    const q = params.get("q")?.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (r) =>
          (r.candidateName ?? "").toLowerCase().includes(q) ||
          (r.jobTitle ?? "").toLowerCase().includes(q) ||
          (r.candidateTitle ?? "").toLowerCase().includes(q)
      );
    }

    return Response.json({ ok: true, applications: result });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * POST /api/portal/applications — candidate applies to a job.
 * Validates custom question requirements, blocks duplicates (DB + check),
 * scores the application with the existing matching engine, and notifies.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const b = await request.json().catch(() => null);
    const jobId = Number(b?.jobId);
    if (!jobId) return Response.json({ ok: false, error: "jobId is required." }, { status: 400 });

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) return Response.json({ ok: false, error: "Job not found." }, { status: 404 });
    if (job.status !== "OPEN") {
      return Response.json({ ok: false, error: "This job is not accepting applications." }, { status: 400 });
    }

    // Duplicate application prevention (also enforced by a unique index).
    const [existing] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.candidateId, candidateId), eq(applications.jobId, jobId)))
      .limit(1);
    if (existing) {
      return Response.json({ ok: false, error: "You have already applied to this job." }, { status: 409 });
    }

    const answers = (b?.answers ?? {}) as Record<string, string>;
    const questions = (job.custom_questions ?? []) as { id: string; label: string; required: boolean }[];
    for (const question of questions) {
      if (question.required && !String(answers[question.id] ?? "").trim()) {
        return Response.json(
          { ok: false, error: `Please answer the required question: ${question.label}` },
          { status: 400 }
        );
      }
    }

    const [candidate] = await db.select().from(candidate_profiles).where(eq(candidate_profiles.id, candidateId)).limit(1);
    if (!candidate) return Response.json({ ok: false, error: "Candidate profile not found." }, { status: 404 });

    const explanation = explainMatch(candidate, job);
    await saveMatchScore(candidateId, jobId, explanation);

    const [created] = await db
      .insert(applications)
      .values({
        candidateId,
        jobId,
        status: "APPLIED",
        match_score: explanation.overall,
        match_data: { explanation },
        cover_letter: b?.cover_letter ? String(b.cover_letter) : null,
        answers,
      })
      .returning();

    await recordStatusChange(created.id, null, "APPLIED", session.userId, "Application received");
    await recordActivity("CANDIDATE", candidateId, "APPLICATION_SUBMITTED", `${candidate.name} applied for ${job.title}`);

    const [company] = await db.select().from(companies).where(eq(companies.id, job.companyId!)).limit(1);
    if (company?.userId) {
      await notify(company.userId, "NEW_APPLICATION", `New applicant: ${candidate.name}`, `${job.title} — ${explanation.overall}% match`);
    }

    return Response.json({ ok: true, application: created, explanation });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
