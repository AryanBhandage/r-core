import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidate_notes, candidate_profiles, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCompanyId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Private recruiter notes on a candidate. Always scoped to the authenticated
 * company — notes are never visible to candidates or to other companies.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const candidateId = Number(new URL(request.url).searchParams.get("candidateId"));
    if (!candidateId) return Response.json({ ok: false, error: "candidateId is required." }, { status: 400 });

    const rows = await db
      .select({
        id: candidate_notes.id,
        body: candidate_notes.body,
        createdAt: candidate_notes.createdAt,
        authorName: users.name,
        candidateName: candidate_profiles.name,
      })
      .from(candidate_notes)
      .leftJoin(users, eq(candidate_notes.authorId, users.id))
      .leftJoin(candidate_profiles, eq(candidate_notes.candidateId, candidate_profiles.id))
      .where(and(eq(candidate_notes.candidateId, candidateId), eq(candidate_notes.companyId, companyId)))
      .orderBy(desc(candidate_notes.createdAt));

    return Response.json({ ok: true, notes: rows });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const body = await request.json().catch(() => null);
    const candidateId = Number(body?.candidateId);
    const text = String(body?.body ?? "").trim();
    if (!candidateId || !text) {
      return Response.json({ ok: false, error: "candidateId and body are required." }, { status: 400 });
    }
    const [created] = await db
      .insert(candidate_notes)
      .values({ candidateId, companyId, authorId: session.userId, body: text })
      .returning();
    return Response.json({ ok: true, note: created });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    const text = String(body?.body ?? "").trim();
    if (!id || !text) return Response.json({ ok: false, error: "id and body are required." }, { status: 400 });

    const [existing] = await db.select().from(candidate_notes).where(eq(candidate_notes.id, id)).limit(1);
    if (!existing || existing.companyId !== companyId) {
      return Response.json({ ok: false, error: "Note not found." }, { status: 404 });
    }
    const [updated] = await db.update(candidate_notes).set({ body: text }).where(eq(candidate_notes.id, id)).returning();
    return Response.json({ ok: true, note: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ ok: false, error: "id is required." }, { status: 400 });
    const [existing] = await db.select().from(candidate_notes).where(eq(candidate_notes.id, id)).limit(1);
    if (!existing || existing.companyId !== companyId) {
      return Response.json({ ok: false, error: "Note not found." }, { status: 404 });
    }
    await db.delete(candidate_notes).where(eq(candidate_notes.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
