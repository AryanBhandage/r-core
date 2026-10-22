import { NextRequest } from "next/server";
import { analyzeJob } from "@/lib/services/jobService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/job/analyze  { job_description: string }
// Ad-hoc analysis for the matching tool. This does NOT create a job posting —
// job postings are owned by a company and created via /api/portal/jobs.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const jobDescription = body?.job_description ?? "";
    if (typeof jobDescription !== "string" || !jobDescription.trim()) {
      return Response.json(
        { ok: false, error: "Empty job description. Please enter a non-empty description." },
        { status: 400 }
      );
    }

    const { profile, engine } = await analyzeJob(jobDescription);
    return Response.json({ ok: true, profile, engine });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to analyze job.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
