import { getCurrentSession, sessionJson } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/session
 * Returns the authenticated session resolved from the httpOnly cookie and the
 * database. Anonymous requests receive { session: null } — identity is never
 * inferred from a query parameter.
 *
 * The response is per-user and MUST NOT be cacheable: without `no-store` (and
 * without `Vary: Cookie`) a browser can store the anonymous reply and serve it
 * back after a successful login, discarding the authenticated session.
 */
export async function GET() {
  const session = await getCurrentSession();
  return sessionJson({ ok: true, session });
}
