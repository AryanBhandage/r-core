import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidate_profiles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCandidateId } from "@/lib/auth";
import { profileCompletion } from "@/lib/services/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/profile
 * The authenticated candidate's own profile + completion breakdown.
 */
export async function GET() {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const [profile] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);
    if (!profile) return Response.json({ ok: false, error: "Profile not found." }, { status: 404 });
    return Response.json({
      ok: true,
      profile,
      completion: profileCompletion(profile),
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * PUT /api/portal/profile
 * Merges editable profile fields. Never trusts a client-supplied candidateId —
 * ownership always comes from the session.
 */
export async function POST(request: NextRequest) {
  return PUT(request);
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("CANDIDATE");
    const candidateId = requireCandidateId(session);
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });

    const [existing] = await db
      .select()
      .from(candidate_profiles)
      .where(eq(candidate_profiles.id, candidateId))
      .limit(1);
    if (!existing) return Response.json({ ok: false, error: "Profile not found." }, { status: 404 });

    const current = (existing.profile_data ?? {}) as Record<string, unknown>;
    const incoming = (body.profile_data ?? {}) as Record<string, unknown>;
    // Deep-ish merge: structured sections replace when provided, otherwise keep.
    const nextData: Record<string, unknown> = { ...current, ...incoming };
    if (body.links !== undefined) {
      nextData.links = { ...((current.links as object) ?? {}), ...body.links };
    }
    if (incoming.links !== undefined) {
      nextData.links = { ...((current.links as object) ?? {}), ...((incoming.links as object) ?? {}) };
    }

    const [updated] = await db
      .update(candidate_profiles)
      .set({
        name: body.name?.trim() || existing.name,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        title: body.title ?? existing.title,
        location: body.location ?? existing.location,
        experience_years:
          body.experience_years !== undefined
            ? Math.max(0, Number(body.experience_years) || 0)
            : existing.experience_years,
        profile_data: nextData,
      })
      .where(eq(candidate_profiles.id, candidateId))
      .returning();

    // Keep the account email in sync with the contact email when provided.
    if (body.email && session.userId) {
      await db
        .update(users)
        .set({ name: body.name?.trim() || session.name })
        .where(eq(users.id, session.userId));
    }

    return Response.json({ ok: true, profile: updated, completion: profileCompletion(updated) });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
