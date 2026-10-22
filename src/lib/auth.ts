// ============================================================================
// Server-side authentication & authorization
// ============================================================================
// - Passwords: scrypt (node:crypto) with per-user salt, compared in constant
//   time. No external dependency, no secrets leave the server.
// - Sessions: opaque random tokens in an httpOnly cookie, stored in the
//   `sessions` table with an expiry.
// - Authorization helpers throw AuthError so API routes can return proper
//   401/403 responses instead of relying on hidden UI.
// ============================================================================

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users, companies, company_members, candidate_profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./passwords";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = "reqcore_session";
const SESSION_DAYS = 7;

export type Role = "COMPANY" | "CANDIDATE";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: 401 | 403 = 401) {
    super(message);
    this.status = status;
  }
}

// ----------------------------------------------------------------- sessions

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, token, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  store.delete(SESSION_COOKIE);
}

export interface AuthSession {
  userId: number;
  role: Role;
  name: string;
  email: string;
  companyId: number | null;
  companyName: string | null;
  candidateId: number | null;
}

/** Resolves the session from the request cookie. Returns null when anonymous. */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      userId: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  let companyId: number | null = null;
  let companyName: string | null = null;
  let candidateId: number | null = null;

  if (row.role === "COMPANY") {
    const [member] = await db
      .select({ companyId: company_members.companyId })
      .from(company_members)
      .where(eq(company_members.userId, row.userId))
      .limit(1);
    if (member) {
      companyId = member.companyId;
      const [company] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, member.companyId))
        .limit(1);
      companyName = company?.name ?? null;
    }
  } else {
    const [profile] = await db
      .select({ id: candidate_profiles.id })
      .from(candidate_profiles)
      .where(eq(candidate_profiles.userId, row.userId))
      .limit(1);
    candidateId = profile?.id ?? null;
  }

  return {
    userId: row.userId,
    role: row.role as Role,
    name: row.name,
    email: row.email,
    companyId,
    companyName,
    candidateId,
  };
}

/** Throws AuthError unless a session exists (and optionally matches a role). */
export async function requireAuth(role?: Role): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) throw new AuthError("Authentication required.");
  if (role && session.role !== role) {
    throw new AuthError(`This action requires a ${role.toLowerCase()} account.`, 403);
  }
  return session;
}

/** Company sessions must have a company; returns its id or throws. */
export function requireCompanyId(session: AuthSession): number {
  if (session.role !== "COMPANY" || session.companyId == null) {
    throw new AuthError("No company is linked to this account.", 403);
  }
  return session.companyId;
}

/** Candidate sessions must have a profile; returns its id or throws. */
export function requireCandidateId(session: AuthSession): number {
  if (session.role !== "CANDIDATE" || session.candidateId == null) {
    throw new AuthError("No candidate profile is linked to this account.", 403);
  }
  return session.candidateId;
}

export function authErrorStatus(error: unknown): { status: number; message: string } {
  if (error instanceof AuthError) return { status: error.status, message: error.message };
  return { status: 500, message: error instanceof Error ? error.message : "Unexpected error." };
}

// ---------------------------------------------------------------------------
// Cache semantics for session responses
// ---------------------------------------------------------------------------
// Every response derived from the session cookie is per-user. Without these
// headers a browser (or any shared cache) may store the anonymous
// `{ session: null }` reply for GET /api/auth and serve it back AFTER a
// successful login, because the response's `Vary` never listed `Cookie`.
// That is exactly how auth state was being lost on redirect/refresh.
// `no-store` also prevents one user's session payload being served to another
// by an intermediary cache.
export const SESSION_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Vary: "Cookie",
} as const;

export function sessionJson(payload: unknown, init: ResponseInit = {}): Response {
  return Response.json(payload, {
    ...init,
    headers: { ...SESSION_NO_STORE_HEADERS, ...(init.headers ?? {}) },
  });
}

// Small helper used when registering a company account.
export async function linkCompanyOwner(companyId: number, userId: number): Promise<void> {
  await db.insert(company_members).values({ companyId, userId, memberRole: "OWNER" });
}
