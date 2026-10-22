import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidate_profiles, companies, jobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { authErrorStatus, requireAuth } from "@/lib/auth";
import { semanticRank } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/search?q=...&target=candidates|jobs
 * Semantic (embedding) search over the EXISTING embedding implementation,
 * returning explainable match reasons alongside each hit.
 *   recruiters -> search the candidate pool
 *   candidates -> search open jobs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim();
    const target = params.get("target") ?? (session.role === "COMPANY" ? "candidates" : "jobs");
    if (!q) return Response.json({ ok: false, error: "Enter a search query." }, { status: 400 });

    if (target === "candidates") {
      if (session.role !== "COMPANY") {
        return Response.json({ ok: false, error: "Only recruiters can search candidates." }, { status: 403 });
      }
      const rows = await db.select().from(candidate_profiles).orderBy(desc(candidate_profiles.createdAt));
      const ranked = semanticRank(
        q,
        rows,
        (c) =>
          `${c.name} ${c.title ?? ""} ${c.location ?? ""} ${(c.profile_data?.technical_skills ?? []).join(" ")} ${c.profile_data?.about ?? ""} ${(
            c.profile_data?.projects ?? []
          ).map((p: any) => `${p.title} ${(p.bullets ?? []).join(" ")}`).join(" ")} ${(
            c.profile_data?.experience ?? []
          ).map((e: any) => `${e.title ?? ""} ${(e.responsibilities ?? []).join(" ")}`).join(" ")}`
      );
      return Response.json({
        ok: true,
        target,
        query: q,
        results: ranked.filter((r) => r.similarity > 0.02).slice(0, 20).map(({ row, similarity, reasons }) => ({
          candidate: {
            id: row.id,
            name: row.name,
            title: row.title,
            location: row.location,
            experience_years: row.experience_years,
            resume_quality: row.resume_quality,
            skills: row.profile_data?.technical_skills ?? [],
          },
          similarity,
          reasons,
        })),
      });
    }

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
        required_skills: jobs.required_skills,
        preferred_skills: jobs.preferred_skills,
        experience_required: jobs.experience_required,
        status: jobs.status,
        companyId: jobs.companyId,
        companyName: companies.name,
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .orderBy(desc(jobs.createdAt));

    const open = rows.filter((r) => r.status === "OPEN");
    const ranked = semanticRank(
      q,
      open,
      (j) =>
        `${j.title} ${j.department ?? ""} ${j.location ?? ""} ${j.work_mode ?? ""} ${(j.required_skills ?? []).join(" ")} ${(
          j.preferred_skills ?? []
        ).join(" ")} ${j.companyName ?? ""}`
    );
    return Response.json({
      ok: true,
      target,
      query: q,
      results: ranked.filter((r) => r.similarity > 0.02).slice(0, 20).map(({ row, similarity, reasons }) => ({
        job: row,
        similarity,
        reasons,
      })),
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
