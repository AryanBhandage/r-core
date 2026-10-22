import { NextRequest } from "next/server";
import { embedText, cosineSimilarity } from "@/lib/ml/embedding";
import { validateResume, validateJob } from "@/lib/services/deterministic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/embedding
// Accepts either { text } or { candidate, job } and returns the embedding
// vectors plus cosine similarity.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

    if (typeof body.text === "string") {
      const vector = embedText(body.text);
      return Response.json({ ok: true, vector, dim: vector.length, method: "hashed-tf" });
    }

    if (body.candidate && body.job) {
      const candidate = validateResume(body.candidate);
      const job = validateJob(body.job);
      const { embedCandidate, embedJob } = await import("@/lib/ml/embedding");
      const cv = embedCandidate(candidate);
      const jv = embedJob(job);
      const similarity = cosineSimilarity(cv, jv);
      return Response.json({
        ok: true,
        candidate_vector: cv,
        job_vector: jv,
        cosine_similarity: similarity,
        dim: cv.length,
        method: "hashed-tf",
        note: "2D projection in UI is illustrative; actual vectors are high-dimensional.",
      });
    }

    return Response.json(
      { ok: false, error: "Provide either `text` or both `candidate` and `job`." },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
