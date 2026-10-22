import { NextRequest } from "next/server";
import { validateResume, validateJob } from "@/lib/services/deterministic";
import { generateRoadmap } from "@/lib/services/roadmapService";
import { db } from "@/db";
import { roadmaps } from "@/db/schema";

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
    const result = await generateRoadmap(candidate, job);

    try {
      await db.insert(roadmaps).values({
        candidateId: body.candidateId ?? null,
        target_role: result.target_role,
        readiness: result.readiness,
        items: result.items as unknown as object,
      });
    } catch {
      // best-effort persistence
    }

    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Roadmap generation failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
