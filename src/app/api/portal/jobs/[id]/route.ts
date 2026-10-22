import { NextRequest } from "next/server";
import { db } from "@/db";
import { jobs, companies, applications, saved_jobs, match_scores } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { deterministicExtractJob } from "@/lib/services/deterministic";
import { authErrorStatus, getCurrentSession, requireAuth, requireCompanyId } from "@/lib/auth";
import { recordActivity } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"];
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN", "ARCHIVED"],
  OPEN: ["CLOSED", "ARCHIVED"],
  CLOSED: ["OPEN", "ARCHIVED"],
  ARCHIVED: ["OPEN"],
};

async function loadJob(id: number) {
  const [job] = await db
    .select({
      id: jobs.id, title: jobs.title, slug: jobs.slug, department: jobs.department,
      location: jobs.location, work_mode: jobs.work_mode, employment_type: jobs.employment_type,
      salary_range: jobs.salary_range, status: jobs.status, deadline: jobs.deadline,
      description: jobs.description, responsibilities: jobs.responsibilities,
      education_requirements: jobs.education_requirements, custom_questions: jobs.custom_questions,
      required_skills: jobs.required_skills, preferred_skills: jobs.preferred_skills,
      experience_required: jobs.experience_required, profile_data: jobs.profile_data,
      publishedAt: jobs.publishedAt, createdAt: jobs.createdAt, companyId: jobs.companyId,
      companyName: companies.name, companyLocation: companies.location,
      companyDescription: companies.description, companyWebsite: companies.website,
      companyIndustry: companies.industry,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(jobs.id, id))
    .limit(1);
  return job ?? null;
}

/** GET /api/portal/jobs/[id] — public for OPEN jobs; owners see any status. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getCurrentSession();
    const job = await loadJob(Number(id));
    if (!job) return Response.json({ ok: false, error: "Job not found." }, { status: 404 });

    const isOwner = session?.role === "COMPANY" && session.companyId === job.companyId;
    if (job.status !== "OPEN" && !isOwner) {
      return Response.json({ ok: false, error: "This job is not publicly available." }, { status: 404 });
    }

    let application = null;
    if (session?.role === "CANDIDATE" && session.candidateId != null) {
      const [existing] = await db
        .select().from(applications)
        .where(eq(applications.jobId, Number(id)));
      application = existing && existing.candidateId === session.candidateId ? existing : null;
    }
    let saved = false;
    if (session?.role === "CANDIDATE" && session.candidateId != null) {
      const rows = await db.select().from(saved_jobs).where(eq(saved_jobs.jobId, Number(id)));
      saved = rows.some((r) => r.candidateId === session.candidateId);
    }

    return Response.json({ ok: true, job, application, saved, isOwner });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * PATCH /api/portal/jobs/[id] — edit fields and move through the job lifecycle
 * (DRAFT -> OPEN -> CLOSED -> ARCHIVED).
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const existing = await loadJob(Number(id));
    if (!existing) return Response.json({ ok: false, error: "Job not found." }, { status: 404 });
    if (existing.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not have access to this job." }, { status: 403 });
    }

    const b = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (b.status !== undefined) {
      const next = String(b.status);
      if (!STATUSES.includes(next)) {
        return Response.json({ ok: false, error: `Invalid status: ${next}` }, { status: 400 });
      }
      const allowed = TRANSITIONS[existing.status ?? "OPEN"] ?? [];
      if (next !== existing.status && !allowed.includes(next)) {
        return Response.json(
          { ok: false, error: `Cannot move job from ${existing.status} to ${next}.` },
          { status: 400 }
        );
      }
      patch.status = next;
      if (next === "OPEN" && !existing.publishedAt) patch.publishedAt = new Date();
      await recordActivity("COMPANY", companyId, `JOB_${next}`, `${existing.title} -> ${next}`);
    }

    for (const key of ["title", "department", "location", "work_mode", "employment_type", "salary_range", "description", "responsibilities", "education_requirements"]) {
      if (b[key] !== undefined) patch[key] = b[key];
    }
    if (b.deadline !== undefined) patch.deadline = b.deadline ? new Date(b.deadline) : null;
    if (b.required_skills !== undefined) {
      patch.required_skills = Array.isArray(b.required_skills) ? b.required_skills.map(String) : [];
    }
    if (b.preferred_skills !== undefined) {
      patch.preferred_skills = Array.isArray(b.preferred_skills) ? b.preferred_skills.map(String) : [];
    }
    if (b.experience_required !== undefined) patch.experience_required = Number(b.experience_required) || 0;
    if (b.custom_questions !== undefined) {
      patch.custom_questions = Array.isArray(b.custom_questions)
        ? b.custom_questions.map((q: any, i: number) => ({
            id: String(q?.id ?? `q${i + 1}`), label: String(q?.label ?? "").trim(), required: Boolean(q?.required),
          })).filter((q: any) => q.label)
        : [];
    }

    // Re-run the existing job parser when requirement text changed.
    const skillsChanged = patch.required_skills !== undefined || patch.preferred_skills !== undefined;
    if (skillsChanged || patch.title !== undefined || patch.description !== undefined) {
      const req = (patch.required_skills as string[]) ?? existing.required_skills ?? [];
      const pref = (patch.preferred_skills as string[]) ?? existing.preferred_skills ?? [];
      const profile = deterministicExtractJob(
        [
          String(patch.title ?? existing.title),
          String(patch.description ?? existing.description ?? ""),
          "Required skills", req.join(", "),
          "Preferred skills", pref.join(", "),
          "Qualifications", String(patch.education_requirements ?? existing.education_requirements ?? ""),
          `${patch.experience_required ?? existing.experience_required ?? 0}+ years of experience`,
        ].join("\n")
      );
      profile.job_title = String(patch.title ?? existing.title);
      profile.required_skills = req;
      profile.preferred_skills = pref;
      patch.profile_data = profile;
    }

    const [updated] = await db.update(jobs).set(patch).where(eq(jobs.id, Number(id))).returning();
    return Response.json({ ok: true, job: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** DELETE /api/portal/jobs/[id] — draft-only deletion (published jobs archive). */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const existing = await loadJob(Number(id));
    if (!existing) return Response.json({ ok: false, error: "Job not found." }, { status: 404 });
    if (existing.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not have access to this job." }, { status: 403 });
    }
    const hasApplicants = await db.select().from(applications).where(eq(applications.jobId, Number(id)));
    if (existing.status !== "DRAFT" || hasApplicants.length > 0) {
      return Response.json(
        { ok: false, error: "Only empty drafts can be deleted. Close or archive this job instead." },
        { status: 400 }
      );
    }
    await db.delete(saved_jobs).where(eq(saved_jobs.jobId, Number(id)));
    await db.delete(match_scores).where(eq(match_scores.jobId, Number(id)));
    await db.delete(jobs).where(eq(jobs.id, Number(id)));
    await recordActivity("COMPANY", companyId, "JOB_DELETED", `Deleted draft: ${existing.title}`);
    return Response.json({ ok: true });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
