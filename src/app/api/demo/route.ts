import { NextRequest } from "next/server";
import { DEMO_CANDIDATE, DEMO_JOB, DEMO_CANDIDATE_TEXT, DEMO_JOB_TEXT } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "all";
  const payload: Record<string, unknown> = { ok: true, label: "Demo Dataset" };
  if (kind === "candidate" || kind === "all") {
    payload.candidate = DEMO_CANDIDATE;
    payload.candidate_text = DEMO_CANDIDATE_TEXT;
  }
  if (kind === "job" || kind === "all") {
    payload.job = DEMO_JOB;
    payload.job_text = DEMO_JOB_TEXT;
  }
  return Response.json(payload);
}
