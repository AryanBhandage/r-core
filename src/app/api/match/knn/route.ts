import { NextRequest } from "next/server";
import { validateResume, validateJob } from "@/lib/services/deterministic";
import { buildMatchResult, runKNN } from "@/lib/services/matchingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.candidate || !body?.job) {
      return Response.json(
        { ok: false, error: "Provide `candidate` and `job` profiles." },
        { status: 400 }
      );
    }
    const candidate = validateResume(body.candidate);
    const job = validateJob(body.job);
    const match = buildMatchResult(candidate, job);
    const result = runKNN(candidate, job, match);
    return Response.json({
      ok: true,
      model: "knn",
      label: "Baseline Model",
      result,
      cosine_similarity: match.cosine_similarity,
      mode: result.mode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "KNN matching failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
