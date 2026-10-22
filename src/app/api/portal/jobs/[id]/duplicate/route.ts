import { NextRequest } from "next/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCompanyId } from "@/lib/auth";
import { recordActivity } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/portal/jobs/[id]/duplicate — clone a job as a new DRAFT. */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);

    const [source] = await db.select().from(jobs).where(eq(jobs.id, Number(id))).limit(1);
    if (!source) return Response.json({ ok: false, error: "Job not found." }, { status: 404 });
    if (source.companyId !== companyId) {
      return Response.json({ ok: false, error: "You do not have access to this job." }, { status: 403 });
    }

    const title = `${source.title} (copy)`;
    const [copy] = await db
      .insert(jobs)
      .values({
        companyId,
        title,
        slug: `${(source.slug ?? "job").replace(/-[a-z0-9]{5}$/, "")}-copy-${Date.now().toString(36).slice(-5)}`,
        department: source.department,
        location: source.location,
        work_mode: source.work_mode,
        employment_type: source.employment_type,
        salary_range: source.salary_range,
        status: "DRAFT",
        deadline: source.deadline,
        description: source.description,
        responsibilities: source.responsibilities,
        education_requirements: source.education_requirements,
        custom_questions: source.custom_questions ?? [],
        required_skills: source.required_skills ?? [],
        preferred_skills: source.preferred_skills ?? [],
        experience_required: source.experience_required ?? 0,
        profile_data: source.profile_data,
        publishedAt: null,
      })
      .returning();

    await recordActivity("COMPANY", companyId, "JOB_CREATED", `Duplicated job: ${source.title}`);
    return Response.json({ ok: true, job: copy });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
