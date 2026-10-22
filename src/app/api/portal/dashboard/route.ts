import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  applications,
  candidate_notes,
  candidate_profiles,
  interviews,
  jobs,
  saved_jobs,
} from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCandidateId, requireCompanyId } from "@/lib/auth";
import { latestActivityFor, notify, recordActivity } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/dashboard
 * Role-scoped, real database metrics (no fabricated numbers).
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.userId;

    if (session.role === "COMPANY") {
      const companyId = requireCompanyId(session);
      const companyJobs = await db.select().from(jobs).where(eq(jobs.companyId, companyId));
      const jobIds = companyJobs.map((j) => j.id);

      let appRows: any[] = [];
      if (jobIds.length) {
        appRows = await db
          .select({
            id: applications.id,
            status: applications.status,
            match_score: applications.match_score,
            createdAt: applications.createdAt,
            jobId: applications.jobId,
            candidateName: candidate_profiles.name,
            candidateId: applications.candidateId,
          })
          .from(applications)
          .leftJoin(candidate_profiles, eq(applications.candidateId, candidate_profiles.id))
          .where(inArray(applications.jobId, jobIds))
          .orderBy(desc(applications.createdAt));
      }

      const interviewRows = jobIds.length
        ? await db
            .select({
              id: interviews.id,
              type: interviews.type,
              status: interviews.status,
              scheduled_date: interviews.scheduled_date,
              applicationId: interviews.applicationId,
              jobTitle: jobs.title,
            })
            .from(interviews)
            .leftJoin(applications, eq(interviews.applicationId, applications.id))
            .leftJoin(jobs, eq(applications.jobId, jobs.id))
            .where(inArray(applications.jobId, jobIds))
            .orderBy(interviews.scheduled_date)
        : [];

      const upcoming = interviewRows.filter(
        (i) => i.status !== "CANCELLED" && (!i.scheduled_date || i.scheduled_date.getTime() >= Date.now() - 86400000)
      );

      return Response.json({
        ok: true,
        role: "COMPANY",
        metrics: {
          activeJobs: companyJobs.filter((j) => j.status === "OPEN").length,
          totalApplications: appRows.length,
          screening: appRows.filter((a) => a.status === "SCREENING").length,
          interviews: appRows.filter((a) => a.status === "INTERVIEW").length,
          offers: appRows.filter((a) => a.status === "OFFER").length,
          hires: appRows.filter((a) => a.status === "HIRED").length,
          savedJobs: 0,
        },
        pipeline: {
          APPLIED: appRows.filter((a) => a.status === "APPLIED").length,
          SCREENING: appRows.filter((a) => a.status === "SCREENING").length,
          INTERVIEW: appRows.filter((a) => a.status === "INTERVIEW").length,
          OFFER: appRows.filter((a) => a.status === "OFFER").length,
          HIRED: appRows.filter((a) => a.status === "HIRED").length,
          REJECTED: appRows.filter((a) => a.status === "REJECTED").length,
        },
        recentApplications: appRows.slice(0, 6),
        recentJobs: companyJobs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 5),
        upcomingInterviews: upcoming.slice(0, 5),
        activity: await latestActivityFor({ companyActorId: companyId }, 8),
      });
    }

    const candidateId = requireCandidateId(session);
    const [profile] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);

    const appRows = await db
      .select({
        id: applications.id,
        status: applications.status,
        match_score: applications.match_score,
        createdAt: applications.createdAt,
        jobTitle: jobs.title,
        jobId: jobs.id,
        companyName: sql<string | null>`(select name from companies where id = ${jobs.companyId})`,
      })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.candidateId, candidateId))
      .orderBy(desc(applications.createdAt));

    const interviewRows = await db
      .select({
        id: interviews.id,
        type: interviews.type,
        status: interviews.status,
        scheduled_date: interviews.scheduled_date,
        jobTitle: jobs.title,
        companyName: sql<string | null>`(select name from companies where id = ${jobs.companyId})`,
      })
      .from(interviews)
      .leftJoin(applications, eq(interviews.applicationId, applications.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.candidateId, candidateId))
      .orderBy(interviews.scheduled_date);

    const [savedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(saved_jobs)
      .where(eq(saved_jobs.candidateId, candidateId));

    return Response.json({
      ok: true,
      role: "CANDIDATE",
      profile,
      metrics: {
        applications: appRows.length,
        interviews: interviewRows.filter((i) => i.status === "SCHEDULED").length,
        savedJobs: Number(savedCount?.count ?? 0),
        offers: appRows.filter((a) => a.status === "OFFER").length,
      },
      statusBreakdown: {
        APPLIED: appRows.filter((a) => a.status === "APPLIED").length,
        SCREENING: appRows.filter((a) => a.status === "SCREENING").length,
        INTERVIEW: appRows.filter((a) => a.status === "INTERVIEW").length,
        OFFER: appRows.filter((a) => a.status === "OFFER").length,
        HIRED: appRows.filter((a) => a.status === "HIRED").length,
        REJECTED: appRows.filter((a) => a.status === "REJECTED").length,
      },
      recentApplications: appRows.slice(0, 6),
      upcomingInterviews: interviewRows
        .filter((i) => i.status !== "CANCELLED")
        .slice(0, 5),
      activity: await latestActivityFor({ candidateActorId: candidateId }, 8),
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
