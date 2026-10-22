import { NextRequest } from "next/server";
import { validateResume, validateJob } from "@/lib/services/deterministic";
import { buildMatchResult } from "@/lib/services/matchingService";
import { buildSemanticExplorer } from "@/lib/services/semanticService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.candidate || !body?.job) {
      return Response.json({ ok: false, error: "Provide verified `candidate` and `job` profiles." }, { status: 400 });
    }
    const candidate = validateResume(body.candidate);
    const job = validateJob(body.job);
    const match = buildMatchResult(candidate, job);
    const semantic = buildSemanticExplorer(candidate, job, {
      candidateVector: match.candidate_vector,
      jobVector: match.job_vector,
      cosineSimilarity: match.cosine_similarity,
    });
    return Response.json({ ok: true, semantic });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Semantic exploration failed." }, { status: 500 });
  }
}
