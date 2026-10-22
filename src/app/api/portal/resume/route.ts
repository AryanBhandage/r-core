import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidate_profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCandidateId } from "@/lib/auth";
import { extractFileText } from "@/lib/services/fileParser";
import { analyzeResume } from "@/lib/services/resumeService";
import { profileCompletion } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/resume — the stored resume document for the signed-in candidate.
 * Storage is intentionally plain PostgreSQL (filename + extracted text) because
 * the project has no object store; no S3/MinIO is introduced here.
 */
export async function GET() {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const [row] = await db
      .select({ profile_data: candidate_profiles.profile_data })
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);
    const resume = (row?.profile_data as any)?.resume ?? null;
    return Response.json({ ok: true, resume });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * POST /api/portal/resume
 * multipart/form-data { file }  OR  JSON { text, filename, save }
 * -> existing AI parser -> extracted contact/education/experience/skills/projects
 * When `save` is true the extracted profile is merged into the candidate profile.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);

    let text = "";
    let filename = "resume.txt";
    let save = true;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const saveFlag = form.get("save");
      if (saveFlag != null) save = String(saveFlag) !== "false";
      if (!(file instanceof File)) {
        return Response.json({ ok: false, error: "Attach a resume file as `file`." }, { status: 400 });
      }
      if (file.size === 0) {
        return Response.json({ ok: false, error: "The uploaded file is empty." }, { status: 400 });
      }
      filename = file.name || filename;
      const parsed = await extractFileText(Buffer.from(await file.arrayBuffer()), filename);
      text = parsed.text;
    } else {
      const body = await request.json().catch(() => null);
      text = String(body?.text ?? "");
      if (body?.filename) filename = String(body.filename);
      if (body?.save === false) save = false;
    }

    if (!text.trim()) {
      return Response.json({ ok: false, error: "No resume text could be extracted." }, { status: 400 });
    }

    // Existing evidence-based parser — unchanged.
    const { profile, engine } = await analyzeResume(text);

    const [existing] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);
    if (!existing) return Response.json({ ok: false, error: "Profile not found." }, { status: 404 });

    const current = (existing.profile_data ?? {}) as Record<string, unknown>;
    const nextData: Record<string, unknown> = { ...current };

    // Always keep the document itself so the recruiter can view the resume.
    nextData.resume = {
      filename,
      text,
      uploadedAt: new Date().toISOString(),
      quality: profile.resumeQuality?.score ?? 0,
    };

    if (save) {
      // Merge extracted sections into the canonical profile.
      const skills = (profile.technicalSkills ?? []).map((s) => s.value);
      nextData.technical_skills = skills;
      nextData.soft_skills = (profile.softSkills ?? []).map((s) => s.value);
      nextData.education = profile.education;
      nextData.experience = profile.experience;
      nextData.projects = profile.projects;
      nextData.certifications = profile.certifications;
      nextData.rawText = text;
      if (profile.summary) nextData.about = profile.summary;
    }

    const [updated] = await db
      .update(candidate_profiles)
      .set({
        profile_data: nextData,
        resume_quality: profile.resumeQuality?.score ?? existing.resume_quality ?? 0,
        experience_years: save
          ? Math.round(profile.totalExperienceYears ?? existing.experience_years ?? 0)
          : existing.experience_years,
        name: save && profile.name && profile.name !== "Candidate" ? profile.name : existing.name,
      })
      .where(eq(candidate_profiles.id, candidateId))
      .returning();

    return Response.json({
      ok: true,
      engine,
      saved: save,
      resume: nextData.resume,
      extracted: profile,
      profile: updated,
      completion: profileCompletion(updated),
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** DELETE /api/portal/resume — remove the stored resume document. */
export async function DELETE() {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const [existing] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);
    const nextData = { ...((existing?.profile_data ?? {}) as Record<string, unknown>) };
    delete nextData.resume;
    delete nextData.rawText;
    const [updated] = await db
      .update(candidate_profiles)
      .set({ profile_data: nextData })
      .where(eq(candidate_profiles.id, candidateId))
      .returning();
    return Response.json({ ok: true, profile: updated, completion: profileCompletion(updated) });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
