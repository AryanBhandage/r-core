import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidate_profiles } from "@/db/schema";
import { desc } from "drizzle-orm";
import { authErrorStatus, requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfileData {
  technical_skills?: string[];
  technicalSkills?: { value: string }[];
  education?: { degree: string; field?: string; institution?: string }[];
}

/**
 * GET /api/portal/candidates — the candidate pool a company can browse.
 * Filters: q, skills, minExperience, maxExperience, education, location.
 */
export async function GET(request: NextRequest) {
  try {
    // The candidate pool is recruiter-only; candidates never see other people's
    // profiles. Enforcement happens here, not in the UI.
    await requireAuth("COMPANY");
    const params = new URL(request.url).searchParams;
    const rows = await db.select().from(candidate_profiles).orderBy(desc(candidate_profiles.createdAt));

    const enriched = rows.map((row) => {
      const data = (row.profile_data ?? {}) as ProfileData;
      const skills =
        data.technical_skills ?? data.technicalSkills?.map((s) => s.value) ?? [];
      const education = (data.education ?? []).map((e) =>
        [e.degree, e.field, e.institution].filter(Boolean).join(" · ")
      );
      return {
        id: row.id,
        name: row.name,
        title: row.title,
        location: row.location,
        experience_years: row.experience_years ?? 0,
        resume_quality: row.resume_quality ?? 0,
        skills,
        education,
        createdAt: row.createdAt,
      };
    });

    let result = enriched;

    const q = params.get("q")?.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    const skills = params.get("skills");
    if (skills) {
      const wanted = skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (wanted.length) {
        result = result.filter((c) => {
          const owned = c.skills.map((s) => s.toLowerCase());
          return wanted.every((w) => owned.some((s) => s.includes(w)));
        });
      }
    }

    const minExperience = params.get("minExperience");
    if (minExperience && minExperience !== "any") {
      result = result.filter((c) => c.experience_years >= Number(minExperience));
    }

    const education = params.get("education")?.toLowerCase().trim();
    if (education && education !== "any") {
      result = result.filter((c) => c.education.some((e) => e.toLowerCase().includes(education)));
    }

    const location = params.get("location")?.toLowerCase().trim();
    if (location && location !== "any") {
      result = result.filter((c) => c.location?.toLowerCase().includes(location));
    }

    return Response.json({ ok: true, candidates: result });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
