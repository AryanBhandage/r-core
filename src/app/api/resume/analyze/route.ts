import { NextRequest } from "next/server";
import { extractFileText } from "@/lib/services/fileParser";
import { analyzeResume } from "@/lib/services/resumeService";
import { db } from "@/db";
import { candidates } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/resume/analyze
//  - multipart/form-data with `file`, OR
//  - JSON { text: string }
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let text: string;
    let format = "text";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return Response.json(
          { error: "No file uploaded. Attach a resume under the field name `file`." },
          { status: 400 }
        );
      }
      if (file.size === 0) {
        return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await extractFileText(buffer, file.name);
      text = parsed.text;
      format = parsed.format;
    } else {
      const body = await request.json().catch(() => null);
      text = typeof body?.text === "string" ? body.text : "";
      if (!text.trim()) {
        return Response.json({ error: "No resume text provided." }, { status: 400 });
      }
    }

    const { profile, engine } = await analyzeResume(text);

    let candidateId: number | undefined;
    try {
      const [row] = await db
        .insert(candidates)
        .values({
          name: profile.name,
          skills: profile.technical_skills,
          experience_years: Math.round(profile.experience_years),
          profile: profile as unknown as object,
          engine,
        })
        .returning({ id: candidates.id });
      candidateId = row.id;
    } catch {
      // persistence is best-effort for the prototype
    }

    return Response.json({
      ok: true,
      profile,
      engine,
      format,
      candidateId,
      characters: text.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to analyze resume.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
