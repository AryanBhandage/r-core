import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, companies, candidate_profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createSession,
  destroySession,
  getCurrentSession,
  hashPassword,
  linkCompanyOwner,
  sessionJson,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Session-bearing responses in this route are derived from the session cookie
// and must never be cacheable (see SESSION_NO_STORE_HEADERS in lib/auth.ts).

/** GET /api/auth — current session (or null when anonymous). */
export async function GET() {
  const session = await getCurrentSession();
  return sessionJson({ ok: true, session });
}

/** DELETE /api/auth — sign out. */
export async function DELETE() {
  await destroySession();
  return sessionJson({ ok: true });
}

/**
 * POST /api/auth — { action: "login" | "register", ... }
 * login:    { email, password }
 * register: { role, name, email, password, companyName? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const action = body?.action;

    if (action === "login") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      if (!email || !password) {
        return Response.json({ ok: false, error: "Email and password are required." }, { status: 400 });
      }
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return Response.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
      }
      await createSession(user.id);
      const session = await getCurrentSession();
      return sessionJson({ ok: true, session });
    }

    if (action === "register") {
      const role = body?.role === "COMPANY" ? "COMPANY" : "CANDIDATE";
      const name = String(body?.name ?? "").trim();
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const companyName = String(body?.companyName ?? "").trim();

      if (!name || !email || password.length < 8) {
        return Response.json(
          { ok: false, error: "Name, email and a password of at least 8 characters are required." },
          { status: 400 }
        );
      }
      if (role === "COMPANY" && !companyName) {
        return Response.json({ ok: false, error: "Company name is required." }, { status: 400 });
      }

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        return Response.json({ ok: false, error: "An account with this email already exists." }, { status: 409 });
      }

      const [user] = await db
        .insert(users)
        .values({ role, name, email, passwordHash: hashPassword(password) })
        .returning();

      if (role === "COMPANY") {
        const [company] = await db
          .insert(companies)
          .values({ userId: user.id, name: companyName })
          .returning();
        await linkCompanyOwner(company.id, user.id);
      } else {
        await db.insert(candidate_profiles).values({ userId: user.id, name, email });
      }

      await createSession(user.id);
      const session = await getCurrentSession();
      return sessionJson({ ok: true, session });
    }

    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
