import { NextRequest } from "next/server";
import { validateResume, validateJob } from "@/lib/services/deterministic";
import { compareModels } from "@/lib/services/matchingService";
import { buildSemanticExplorer } from "@/lib/services/semanticService";
import { db } from "@/db";
import { analyses } from "@/db/schema";

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
    const result = compareModels(candidate, job);
    // The explorer consumes the same verified profiles and exact vectors used
    // by the synthesized match; its PCA is visualization-only.
    const semantic = buildSemanticExplorer(candidate, job, {
      candidateVector: result.synthesized_match.candidate_vector,
      jobVector: result.synthesized_match.job_vector,
      cosineSimilarity: result.cosine_similarity,
    });

    try {
      await db.insert(analyses).values({
        candidateId: body.candidateId ?? null,
        jobId: body.jobId ?? null,
        overall_score: result.overall_score,
        cosine_similarity: Math.round(result.cosine_similarity * 100),
        knn_score: result.knn.score,
        xgboost_score: result.xgboost.score,
        features: result.features as unknown as object,
        match: result as unknown as object,
      });
    } catch {
      // best-effort persistence
    }

    return Response.json({ ok: true, ...result, semantic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Model comparison failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
