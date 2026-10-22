"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Building2, UserRound, ArrowLeft, Loader2, Mail, Lock, User } from "lucide-react";
import { AuroraField, NeuralCanvas } from "@/components/landing/Backdrop";
import { useAuth, type Role } from "@/components/AuthContext";
import { inputClass } from "@/components/portal/Primitives";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("CANDIDATE");
  const [form, setForm] = useState({ name: "", companyName: "", email: "", password: "" });
  const [busy, setBusy] = useState<null | "form" | "demo-c" | "demo-r">(null);
  const [error, setError] = useState<string | null>(null);

  // Shared /dashboard renders the correct workspace based on session.role;
  // this keeps the destination explicit and derived from the authenticated user.
  const routeForRole = (sessionRole: Role) => "/dashboard";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy !== null) return; // prevent double submission
    setBusy("form");
    setError(null);
    try {
      const session =
        mode === "login"
          ? await login(form.email, form.password)
          : await register({
              role,
              name: form.name,
              email: form.email,
              password: form.password,
              companyName: form.companyName,
            });
      router.replace(routeForRole(session.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const demo = async (which: "candidate" | "company") => {
    if (busy !== null) return; // prevent double submission
    setBusy(which === "candidate" ? "demo-c" : "demo-r");
    setError(null);
    try {
      const session = await login(
        which === "candidate" ? "aarav@demo.test" : "recruiter@acme.test",
        "demo1234"
      );
      router.replace(routeForRole(session.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfaff] px-6 py-12">
      <AuroraField />
      <div className="absolute inset-0 grid-fade" aria-hidden="true" />
      <NeuralCanvas className="pointer-events-none absolute inset-0 h-full w-full opacity-40" />

      <Link
        href="/"
        className="absolute left-6 top-6 z-20 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-600/25">
            <Sparkles size={20} />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-[15px] text-slate-600">
            {mode === "login" ? "Sign in to your workspace." : "Choose how you will use ReqCore."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/85 p-6 shadow-2xl shadow-violet-900/10 backdrop-blur-xl">
          {mode === "register" && (
            <div className="mb-5 grid grid-cols-2 gap-2">
              <RoleButton
                active={role === "CANDIDATE"}
                icon={UserRound}
                label="Candidate"
                onClick={() => setRole("CANDIDATE")}
              />
              <RoleButton
                active={role === "COMPANY"}
                icon={Building2}
                label="Company"
                onClick={() => setRole("COMPANY")}
              />
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <>
                <Field icon={User}>
                  <input
                    className={inputClass}
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                {role === "COMPANY" && (
                  <Field icon={Building2}>
                    <input
                      className={inputClass}
                      placeholder="Company name"
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      required
                    />
                  </Field>
                )}
              </>
            )}
            <Field icon={Mail}>
              <input
                className={inputClass}
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field icon={Lock}>
              <input
                className={inputClass}
                type="password"
                placeholder={mode === "register" ? "At least 8 characters" : "Password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={mode === "register" ? 8 : undefined}
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:shadow-xl hover:shadow-violet-600/30 active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "form" && <Loader2 size={15} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => demo("candidate")}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "demo-c" ? <Loader2 size={14} className="animate-spin" /> : <UserRound size={14} />}
              Demo candidate
            </button>
            <button
              onClick={() => demo("company")}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "demo-r" ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
              Demo recruiter
            </button>
          </div>

          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-violet-700 hover:text-violet-900"
          >
            {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RoleButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-violet-300 bg-violet-50 text-violet-800"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function Field({ icon: Icon, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <div className="[&>input]:pl-9">{children}</div>
    </div>
  );
}
