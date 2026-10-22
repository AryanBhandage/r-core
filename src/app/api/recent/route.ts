import { db } from "@/db";
import { analyses } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(analyses).orderBy(desc(analyses.id)).limit(10);
    return Response.json({ ok: true, analyses: rows });
  } catch {
    return Response.json({ ok: false, analyses: [] });
  }
}
