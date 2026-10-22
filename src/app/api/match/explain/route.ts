import { NextRequest } from "next/server";
import { validateResume, validateJob } from "@/lib/services/deterministic";
import { explainMatch } from "@/lib/services/explainabilityService";

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
    const result = await explainMatch(candidate, job);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Explanation failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
