import { NextRequest } from "next/server";
import { db } from "@/db";
import { applications, companies, jobs } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { authErrorStatus, requireAuth, requireCompanyId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/portal/company — the authenticated company's profile + stats. */
export async function GET() {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) return Response.json({ ok: false, error: "Company not found." }, { status: 404 });

    const companyJobs = await db.select().from(jobs).where(eq(jobs.companyId, companyId));
    const jobIds = companyJobs.map((j) => j.id);
    let applicationCount = 0;
    if (jobIds.length) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(inArray(applications.jobId, jobIds));
      applicationCount = Number(row?.count ?? 0);
    }

    return Response.json({
      ok: true,
      company,
      stats: {
        totalJobs: companyJobs.length,
        activeJobs: companyJobs.filter((j) => j.status === "OPEN").length,
        drafts: companyJobs.filter((j) => j.status === "DRAFT").length,
        applications: applicationCount,
      },
    });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/**
 * PUT /api/portal/company — update the company profile.
 * The company id comes from the session; client-supplied ids are ignored.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth("COMPANY");
    const companyId = requireCompanyId(session);
    const b = await request.json().catch(() => null);

    const [existing] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!existing) return Response.json({ ok: false, error: "Company not found." }, { status: 404 });

    const patch: Record<string, unknown> = {};
    for (const key of ["name", "description", "website", "industry", "company_size", "location"]) {
      if (b?.[key] !== undefined) patch[key] = b[key];
    }
    if (patch.name !== undefined && !String(patch.name).trim()) {
      return Response.json({ ok: false, error: "Company name cannot be empty." }, { status: 400 });
    }

    const [updated] = await db
      .update(companies)
      .set(patch)
      .where(eq(companies.id, companyId))
      .returning();

    return Response.json({ ok: true, company: updated });
  } catch (error) {
    const { status, message } = authErrorStatus(error);
    return Response.json({ ok: false, error: message }, { status });
  }
}
