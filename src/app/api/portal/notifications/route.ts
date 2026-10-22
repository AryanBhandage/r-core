import { NextRequest } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { authErrorStatus, requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/portal/notifications — the signed-in user's inbox. */
export async function GET() {
  try {
    const session = await requireAuth();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(sql`${notifications.userId} = ${session.userId} and ${notifications.read} = false`);
    return Response.json({ ok: true, notifications: rows, unread: Number(unread?.count ?? 0) });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** PATCH /api/portal/notifications { id? } — mark one (or all) as read. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => null);
    if (body?.id) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(sql`${notifications.id} = ${Number(body.id)} and ${notifications.userId} = ${session.userId}`);
    } else {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, session.userId));
    }
    return Response.json({ ok: true });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
