"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";

export type Role = "COMPANY" | "CANDIDATE";

export interface Session {
  role: Role;
  userId: number;
  name: string;
  email: string;
  companyId: number | null;
  companyName: string | null;
  candidateId: number | null;
}

interface AuthContextType {
  role: Role | null;
  session: Session | null;
  loading: boolean;
  userName: string;
  companyId: number | null;
  candidateId: number | null;
  login: (email: string, password: string) => Promise<Session>;
  register: (payload: {
    role: Role;
    name: string;
    email: string;
    password: string;
    companyName?: string;
  }) => Promise<Session>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Parse a /api/auth response, surfacing a clear message even if the
 *  server returns non-JSON (e.g. a stale build or maintenance page). */
async function parseAuthResponse(res: Response) {
  const text = await res.text();
  let data: { ok?: boolean; error?: string; session?: Session } = {};
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Unexpected response from the server. Please refresh and try again."
        : `Authentication service unavailable (${res.status}). Please try again.`
    );
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Authentication failed. Please try again.");
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Monotonic auth-operation counter. A slow or out-of-order response from an
  // older request must never overwrite state written by a newer one — e.g. the
  // GET /api/auth fired on mount must not clobber a successful login.
  const opRef = useRef(0);
  const begin = useCallback(() => ++opRef.current, []);
  const isCurrent = useCallback((op: number) => opRef.current === op, []);

  const refresh = useCallback(async () => {
    const op = begin();
    try {
      const res = await fetch("/api/auth", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await parseAuthResponse(res);
      if (!isCurrent(op)) return; // superseded by login/register/logout
      setSession(data.session ?? null);
      setLoading(false);
    } catch {
      if (!isCurrent(op)) return;
      // A transient init failure (cold start / network) must NOT be read as
      // "logged out". The server is the source of truth: it clears the session
      // on a definitive `session: null` response (above), so here we only stop
      // blocking the UI and keep whatever session we already hold.
      setLoading(false);
    }
  }, [begin, isCurrent]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const op = begin();
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = await parseAuthResponse(res);
      if (!data.session) throw new Error("Sign-in failed: no session returned.");
      if (isCurrent(op)) {
        setSession(data.session);
        setLoading(false);
      }
      return data.session;
    },
    [begin, isCurrent]
  );

  const register = useCallback(
    async (payload: { role: Role; name: string; email: string; password: string; companyName?: string }) => {
      const op = begin();
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...payload }),
      });
      const data = await parseAuthResponse(res);
      if (!data.session) throw new Error("Registration failed: no session returned.");
      if (isCurrent(op)) {
        setSession(data.session);
        setLoading(false);
      }
      return data.session;
    },
    [begin, isCurrent]
  );

  const logout = useCallback(async () => {
    const op = begin();
    await fetch("/api/auth", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    });
    // If login() is somehow racing logout(), the newer op wins.
    if (isCurrent(op)) setSession(null);
  }, [begin, isCurrent]);

  const value: AuthContextType = {
    role: session?.role ?? null,
    session,
    loading,
    userName: session?.name ?? "",
    companyId: session?.companyId ?? null,
    candidateId: session?.candidateId ?? null,
    login,
    register,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
