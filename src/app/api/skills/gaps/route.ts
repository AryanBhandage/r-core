import { NextRequest } from "next/server";
import { validateResume, validateJob } from "@/lib/services/deterministic";
import { analyzeSkillGaps } from "@/lib/services/skillGapService";

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
    const { gaps, matched, partial, missing, coverage } = analyzeSkillGaps(candidate, job);
    return Response.json({
      ok: true,
      gaps,
      matched,
      partial,
      missing,
      coverage,
      method: "deterministic",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Skill gap analysis failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
