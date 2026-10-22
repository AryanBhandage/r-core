import { NextRequest } from "next/server";
import { db } from "@/db";
import { jobs, companies, applications } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { deterministicExtractJob } from "@/lib/services/deterministic";
import { authErrorStatus, getCurrentSession, requireAuth, requireCompanyId } from "@/lib/auth";
import { recordActivity } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const JOB_STATUS_VALUES = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] as const;

function slugify(title: string): string {
  return (
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 55) +
    `-${Date.now().toString(36).slice(-5)}`
  );
}

function splitList(value: unknown): string[] {
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * GET /api/portal/jobs
 *  - COMPANY session + ?mine=1      -> every job that company owns (all statuses)
 *  - otherwise                      -> only OPEN jobs (public board / candidates)
 * Filters: q, location, workMode, employmentType, maxExperience, minSalary,
 *          skills, status, sort, page, pageSize
 */
export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const session = await getCurrentSession();
    const mine = params.get("mine") === "1";
    const isOwnCompanyView = mine && session?.role === "COMPANY" && session.companyId != null;

    const rows = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        slug: jobs.slug,
        department: jobs.department,
        location: jobs.location,
        work_mode: jobs.work_mode,
        employment_type: jobs.employment_type,
        salary_range: jobs.salary_range,
        status: jobs.status,
        deadline: jobs.deadline,
        description: jobs.description,
        responsibilities: jobs.responsibilities,
        education_requirements: jobs.education_requirements,
        custom_questions: jobs.custom_questions,
        required_skills: jobs.required_skills,
        preferred_skills: jobs.preferred_skills,
        experience_required: jobs.experience_required,
        publishedAt: jobs.publishedAt,
        createdAt: jobs.createdAt,
        companyId: jobs.companyId,
        companyName: companies.name,
        companyLocation: companies.location,
        companyIndustry: companies.industry,
        applicantCount: sql<number>`(select count(*)::int from ${applications} where ${applications.jobId} = ${jobs.id})`,
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .orderBy(desc(jobs.createdAt));

    let result = isOwnCompanyView
      ? rows.filter((j) => j.companyId === session!.companyId)
      : rows.filter((j) => j.status === "OPEN");

    const q = params.get("q")?.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (j) =>
          j.title?.toLowerCase().includes(q) ||
          j.department?.toLowerCase().includes(q) ||
          j.companyName?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q) ||
          (j.required_skills ?? []).some((s) => s.toLowerCase().includes(q))
      );
    }
    const location = params.get("location")?.toLowerCase().trim();
    if (location && location !== "any") {
      result = result.filter((j) => j.location?.toLowerCase().includes(location));
    }
    const workMode = params.get("workMode");
    if (workMode && workMode !== "any") {
      result = result.filter((j) => (j.work_mode ?? "").toLowerCase() === workMode.toLowerCase());
    }
    const employmentType = params.get("employmentType");
    if (employmentType && employmentType !== "any") {
      result = result.filter((j) => j.employment_type === employmentType);
    }
    const maxExperience = params.get("maxExperience");
    if (maxExperience && maxExperience !== "any") {
      result = result.filter((j) => (j.experience_required ?? 0) <= Number(maxExperience));
    }
    const minSalary = Number(params.get("minSalary") ?? 0);
    if (minSalary > 0) {
      result = result.filter((j) => {
        const nums = (j.salary_range ?? "").match(/\d+/g)?.map(Number) ?? [];
        return nums.some((n) => n * (n < 1000 ? 100000 : 1) >= minSalary) || nums.length === 0;
      });
    }
    const skills = params.get("skills");
    if (skills) {
      const wanted = skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (wanted.length) {
        result = result.filter((j) => {
          const all = [...(j.required_skills ?? []), ...(j.preferred_skills ?? [])].map((s) => s.toLowerCase());
          return wanted.every((w) => all.some((s) => s.includes(w)));
        });
      }
    }
    const status = params.get("status");
    if (isOwnCompanyView && status && status !== "any") {
      result = result.filter((j) => j.status === status);
    }

    const sort = params.get("sort") ?? "newest";
    if (sort === "oldest") result = [...result].reverse();
    if (sort === "title") result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "deadline") {
      result = [...result].sort(
        (a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity)
      );
    }

    const total = result.length;
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? 12)));
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const items = result.slice((page - 1) * pageSize, page * pageSize);

    return Response.json({
      ok: true,
      jobs: items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      scope: isOwnCompanyView ? "company" : "public",
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * POST /api/portal/jobs — create (as DRAFT or OPEN).
 * Ownership always comes from the authenticated company session.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const b = await request.json().catch(() => null);
    if (!b?.title?.trim()) return Response.json({ ok: false, error: "Job title is required." }, { status: 400 });

    const required_skills = splitList(b.required_skills);
    const preferred_skills = splitList(b.preferred_skills);
    const status = JOB_STATUS_VALUES.includes(b.status) ? b.status : "DRAFT";
    const custom_questions = Array.isArray(b.custom_questions)
      ? b.custom_questions.map((q: any, i: number) => ({
          id: String(q?.id ?? `q${i + 1}`),
          label: String(q?.label ?? "").trim(),
          required: Boolean(q?.required),
        })).filter((q: any) => q.label)
      : [];

    // Feed the existing job parser so the matching engine gets a valid profile.
    const descriptionText = [
      b.title,
      b.description ?? "",
      "Responsibilities",
      b.responsibilities ?? "",
      "Required skills",
      required_skills.join(", "),
      "Preferred skills",
      preferred_skills.join(", "),
      "Qualifications",
      b.education_requirements ?? b.education ?? "",
      b.experience_required ? `${b.experience_required}+ years of experience` : "",
    ].join("\n");
    const profile = deterministicExtractJob(descriptionText);
    profile.job_title = b.title.trim();
    if (required_skills.length) profile.required_skills = required_skills;
    if (preferred_skills.length) profile.preferred_skills = preferred_skills;
    if (b.experience_required) profile.experience_required = Number(b.experience_required);
    if (b.education_requirements) profile.education_requirements = [String(b.education_requirements)];

    const [row] = await db
      .insert(jobs)
      .values({
        companyId,
        title: b.title.trim(),
        slug: slugify(b.title),
        department: b.department ?? null,
        location: b.location ?? null,
        work_mode: b.work_mode ?? null,
        employment_type: b.employment_type ?? "Full-time",
        salary_range: b.salary_range ?? null,
        status,
        deadline: b.deadline ? new Date(b.deadline) : null,
        description: b.description ?? null,
        responsibilities: b.responsibilities ?? null,
        education_requirements: b.education_requirements ?? b.education ?? null,
        custom_questions,
        required_skills,
        preferred_skills,
        experience_required: Number(b.experience_required ?? 0),
        publishedAt: status === "OPEN" ? new Date() : null,
        profile_data: profile,
      })
      .returning();

    await recordActivity(
      "COMPANY",
      companyId,
      status === "OPEN" ? "JOB_PUBLISHED" : "JOB_CREATED",
      `${status === "OPEN" ? "Published" : "Drafted"} job: ${row.title}`
    );

    return Response.json({ ok: true, job: row });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
