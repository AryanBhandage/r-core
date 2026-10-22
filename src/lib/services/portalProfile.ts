// ============================================================================
// Portal <-> Matching bridge
// ============================================================================
// Converts a stored candidate/job row into the canonical profiles that the
// existing matching engine consumes. Structured fields are re-serialised into
// resume/JD text so the same section-aware, evidence-verified extractor runs —
// no separate parsing path and no invented facts.
// ============================================================================

import { CandidateProfile, JobProfile } from "@/lib/ml/types";
import { deterministicExtractCandidate, deterministicExtractJob } from "./deterministic";

interface StoredProfileData {
  rawText?: string;
  summary?: string;
  technical_skills?: string[];
  technicalSkills?: { value: string }[];
  education?: { degree?: string; field?: string; institution?: string; year?: string }[];
  experience?: {
    title?: string;
    role?: string;
    company?: string;
    duration?: string;
    responsibilities?: string[];
  }[];
  projects?: { title?: string; name?: string; bullets?: string[]; technologies?: string[] }[];
  certifications?: ({ value: string } | string)[];
}

interface CandidateRow {
  name: string;
  title?: string | null;
  experience_years?: number | null;
  profile_data?: unknown;
}

/** Rebuild resume text from stored structured data so extraction stays evidence-based. */
function synthesizeResumeText(row: CandidateRow, data: StoredProfileData): string {
  const lines: string[] = [row.name];

  const years = row.experience_years ?? 0;
  lines.push("Summary");
  lines.push(
    data.summary?.trim() ||
      `${row.title ?? "Professional"} with ${years} years of experience.`
  );

  const skills = data.technical_skills ?? data.technicalSkills?.map((s) => s.value) ?? [];
  if (skills.length) {
    lines.push("Technical Skills");
    lines.push(skills.join(", "));
  }

  if (data.experience?.length) {
    lines.push("Experience");
    for (const e of data.experience) {
      const header = [e.title ?? e.role, e.company].filter(Boolean).join(", ");
      lines.push(e.duration ? `${header} (${e.duration})` : header);
      for (const r of e.responsibilities ?? []) lines.push(`- ${r}`);
    }
  } else if (row.title) {
    // Keep the stated total experience discoverable even without records.
    lines.push("Experience");
    lines.push(`${row.title} (${years} years)`);
  }

  if (data.education?.length) {
    lines.push("Education");
    for (const e of data.education) {
      lines.push([e.degree, e.field, e.institution, e.year].filter(Boolean).join(" — "));
    }
  }

  if (data.projects?.length) {
    lines.push("Projects");
    for (const p of data.projects) {
      const title = p.title ?? p.name ?? "Project";
      lines.push(p.technologies?.length ? `${title} — ${p.technologies.join(", ")}` : title);
      for (const b of p.bullets ?? []) lines.push(`- ${b}`);
    }
  }

  if (data.certifications?.length) {
    lines.push("Certifications");
    for (const c of data.certifications) lines.push(typeof c === "string" ? c : c.value);
  }

  return lines.filter(Boolean).join("\n");
}

export function candidateRowToProfile(row: CandidateRow): CandidateProfile {
  const data = (row.profile_data ?? {}) as StoredProfileData;
  // Prefer the original uploaded resume text when available.
  const source = data.rawText?.trim() ? data.rawText : synthesizeResumeText(row, data);
  return deterministicExtractCandidate(source);
}

interface JobRow {
  title: string;
  required_skills?: string[] | null;
  preferred_skills?: string[] | null;
  experience_required?: number | null;
  education_requirements?: string | null;
  work_mode?: string | null;
  profile_data?: unknown;
}

export function jobRowToProfile(row: JobRow): JobProfile {
  const data = (row.profile_data ?? {}) as {
    description?: string;
    responsibilities?: string;
  };
  const required = row.required_skills ?? [];
  const preferred = row.preferred_skills ?? [];

  const text = [
    row.title,
    data.description ?? "",
    "Responsibilities",
    data.responsibilities ?? "",
    "Required skills",
    required.join(", "),
    "Preferred skills",
    preferred.join(", "),
    "Qualifications",
    // The JD's stated education requirement must reach the matcher, otherwise
    // Education Match would silently read as "not specified".
    row.education_requirements ?? "",
    row.experience_required ? `${row.experience_required}+ years of experience` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const profile = deterministicExtractJob(text);
  // Authoritative company-declared tiers always win over inferred ones.
  profile.job_title = row.title;
  if (required.length) profile.required_skills = required;
  if (preferred.length) profile.preferred_skills = preferred;
  if (row.experience_required) profile.experience_required = row.experience_required;
  if (row.education_requirements) profile.education_requirements = [row.education_requirements];
  return profile;
}
