"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  Sparkles,
  FileSearch,
  Target,
  Route,
  ShieldCheck,
  Users,
  Briefcase,
  Building2,
  UserRound,
} from "lucide-react";
import { NeuralCanvas, AuroraField } from "@/components/landing/Backdrop";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const features = [
  {
    icon: FileSearch,
    title: "Evidence-based resume parsing",
    body: "Section-aware extraction pulls skills, experience and education with a source snippet behind every field. Nothing is invented.",
  },
  {
    icon: Target,
    title: "Transparent match scoring",
    body: "Required and preferred skills are scored separately, so you always see coverage like 3/6 instead of one opaque number.",
  },
  {
    icon: Route,
    title: "Automatic career roadmaps",
    body: "Every gap becomes a phased learning plan with a practical project, prerequisites and a realistic time estimate.",
  },
  {
    icon: ShieldCheck,
    title: "Explainable decisions",
    body: "Each match cites the exact resume line and job requirement that produced it, ready for a hiring review.",
  },
];

const steps = [
  { n: "01", t: "Upload a resume", d: "PDF or plain text. The parser builds one verified candidate profile." },
  { n: "02", t: "Post or pick a role", d: "Companies define required vs preferred skills explicitly." },
  { n: "03", t: "Run the match", d: "Coverage, experience and education are scored against the role." },
  { n: "04", t: "Act on the gaps", d: "Candidates get a roadmap. Recruiters get an evidence trail." },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const heroFade = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfaff] text-slate-900">
      {/* ---------------- Nav ---------------- */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/40 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Sparkles size={15} />
            </div>
            <span className="text-[17px] font-semibold tracking-tight">ReqCore</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-900">Features</a>
            <a href="#how" className="transition-colors hover:text-slate-900">How it works</a>
            <a href="#roles" className="transition-colors hover:text-slate-900">For you</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block">
              Sign in
            </Link>
            <Link
              href="/login"
              className="group relative overflow-hidden rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
            >
              <span className="relative z-10">Get started</span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-transform duration-300 group-hover:translate-x-0" />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section ref={heroRef} className="relative flex min-h-[100svh] items-center justify-center px-6 pt-16">
        <AuroraField />
        <div className="absolute inset-0 grid-fade" aria-hidden="true" />
        <NeuralCanvas className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />

        <motion.div style={{ y: heroY, opacity: heroFade }} className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-violet-700 shadow-sm backdrop-blur"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-600" />
            </span>
            AI recruitment intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="text-balance text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[1.03] tracking-[-0.03em]"
          >
            <span className="text-sheen">Hiring decisions</span>
            <br />
            you can actually explain.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-600"
          >
            ReqCore reads resumes, scores them against real job requirements, and shows the
            evidence behind every match — plus a roadmap for whatever is missing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/login"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:shadow-2xl hover:shadow-violet-600/35 active:scale-[0.98] sm:w-auto"
            >
              Enter the portal
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-7 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur transition-colors hover:bg-white sm:w-auto"
            >
              See how it works
            </a>
          </motion.div>

          {/* floating product frame */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="float-slow relative mx-auto mt-16 max-w-3xl"
            style={{ perspective: 1000 }}
          >
            <div className="scanline relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-5 shadow-2xl shadow-violet-900/10 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Overall match" value="72%" tone="violet" />
                <StatTile label="Required skills" value="3 / 6" tone="amber" />
                <StatTile label="Roadmap phases" value="4" tone="slate" />
              </div>
              <div className="mt-3 space-y-2">
                <EvidenceRow skill="Python" state="matched" note="Found in Technical Skills" />
                <EvidenceRow skill="Kubernetes" state="missing" note="No supporting evidence" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="relative mx-auto max-w-6xl px-6 py-28">
        <SectionHeading
          eyebrow="Capabilities"
          title="Built to be questioned"
          body="Every score traces back to a line in the resume or the job description."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glow-border group rounded-2xl border border-slate-200/80 bg-white p-7 transition-shadow hover:shadow-xl hover:shadow-violet-900/5"
            >
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-600 ring-1 ring-violet-100 transition-transform group-hover:scale-110">
                <f.icon size={19} />
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="relative border-y border-slate-200/70 bg-white py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading eyebrow="Workflow" title="Four steps, start to offer" />
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="mb-4 font-mono text-[13px] font-semibold text-violet-500">{s.n}</div>
                <div className="mb-2 h-px w-full bg-gradient-to-r from-violet-300 to-transparent" />
                <h3 className="text-[15px] font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section id="roles" className="mx-auto max-w-6xl px-6 py-28">
        <SectionHeading eyebrow="Two sides" title="One system, two experiences" />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <RoleCard
            icon={Building2}
            tag="For companies"
            title="Fill roles with confidence"
            points={[
              "Post jobs with explicit required vs preferred skills",
              "Browse and filter the full candidate pool",
              "Run any candidate against any of your roles",
              "See the evidence behind every score",
            ]}
            cta="Sign in as a company"
          />
          <RoleCard
            icon={UserRound}
            tag="For candidates"
            title="Know exactly where you stand"
            points={[
              "One verified profile from your resume",
              "Browse every open role with live filters",
              "See your fit before you apply",
              "Get a roadmap for the skills you're missing",
            ]}
            cta="Sign in as a candidate"
            accent
          />
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="relative overflow-hidden border-t border-slate-200/70 px-6 py-28">
        <AuroraField />
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative z-10 mx-auto max-w-2xl text-center"
        >
          <h2 className="text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-tight tracking-[-0.02em]">
            Ready to see the evidence?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-slate-600">
            Open the portal and run your first match in under a minute.
          </p>
          <Link
            href="/login"
            className="group mt-9 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:shadow-2xl hover:shadow-violet-600/35 active:scale-[0.98]"
          >
            Enter the portal
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200/70 bg-white/60 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <Sparkles size={11} />
            </div>
            <span className="font-medium text-slate-700">ReqCore</span>
          </div>
          <p>Recruitment intelligence with a paper trail.</p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55 }}
      className="max-w-2xl"
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</div>
      <h2 className="text-[clamp(1.9rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.02em]">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-slate-600">{body}</p>}
    </motion.div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "violet" | "amber" | "slate" }) {
  const tones = {
    violet: "from-violet-50 to-white ring-violet-100 text-violet-700",
    amber: "from-amber-50 to-white ring-amber-100 text-amber-700",
    slate: "from-slate-50 to-white ring-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-xl bg-gradient-to-b p-4 text-left ring-1 ${tones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function EvidenceRow({ skill, state, note }: { skill: string; state: "matched" | "missing"; note: string }) {
  const ok = state === "matched";
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-left">
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
        <span className="text-sm font-medium text-slate-800">{skill}</span>
      </div>
      <span className="text-[11px] text-slate-500">{note}</span>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  tag,
  title,
  points,
  cta,
  accent = false,
}: {
  icon: React.ComponentType<{ size?: number }>;
  tag: string;
  title: string;
  points: string[];
  cta: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55 }}
      className={`relative overflow-hidden rounded-2xl border p-8 ${
        accent
          ? "border-violet-200 bg-gradient-to-b from-violet-50/70 to-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon size={12} />
        {tag}
      </div>
      <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[15px] text-slate-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
            {p}
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className="group mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
      >
        {cta}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
}
