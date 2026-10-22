// ============================================================================
// Modular Embedding Service
// ============================================================================
// A deterministic 300-dimensional hashed TF embedding is used offline. All
// profile vectors are built from the verified canonical profile. A learned
// embedding provider can replace embedText without changing downstream APIs.
// ============================================================================

import { normalizeSkill } from "./types";

export const EMBEDDING_DIM = 300;
export const EMBEDDING_MODEL_NAME = "ReqCore hashed TF word/bigram + character-trigram embedding";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, " ")
    .split(/[\s+/]+/)
    .filter((token) => token.length > 1);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

function charNgrams(text: string, n = 3): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean.length < n) return clean ? [clean] : [];
  const grams: string[] = [];
  for (let i = 0; i <= clean.length - n; i++) grams.push(clean.slice(i, i + n));
  return grams;
}

export function embedText(text: string): number[] {
  const vector = new Float64Array(EMBEDDING_DIM);
  const terms = tokenize(text);
  const frequency = new Map<string, number>();
  for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  for (let i = 0; i < terms.length - 1; i++) {
    const bigram = `${terms[i]} ${terms[i + 1]}`;
    frequency.set(bigram, (frequency.get(bigram) ?? 0) + 1);
  }
  for (const gram of charNgrams(text)) frequency.set(`¤${gram}`, (frequency.get(`¤${gram}`) ?? 0) + 1);

  for (const [term, count] of frequency) {
    const hash = fnv1a(term);
    const index = Math.floor(hash * EMBEDDING_DIM);
    vector[index] += (hash > 0.5 ? 1 : -1) * (1 + Math.log(count));
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (!norm) return new Array(EMBEDDING_DIM).fill(0);
  return Array.from(vector, (value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  const denominator = Math.sqrt(aNorm) * Math.sqrt(bNorm);
  return denominator ? dot / denominator : 0;
}

export function embedCandidate(profile: {
  name?: string;
  summary?: string;
  skills?: string[];
  technical_skills?: string[];
  technicalSkills?: { value: string }[];
  soft_skills?: string[];
  softSkills?: { value: string }[];
  experience_years?: number;
  totalExperienceYears?: number;
  experience?: {
    role?: string;
    title?: string;
    company: string;
    highlights?: string[];
    responsibilities?: string[];
    achievements?: string[];
    technologies?: string[];
  }[];
  education?: { degree: string; field?: string; institution?: string }[];
  projects?: {
    name?: string;
    title?: string;
    description?: string;
    bullets?: string[];
    technologies: string[];
    source_evidence?: string;
  }[];
  certifications?: (string | { value: string; evidence?: string })[];
  achievements?: (string | { value: string; evidence?: string })[];
  quantifiedEvidence?: { value: string; source_text: string }[];
}): number[] {
  const parts: string[] = [profile.name ?? "", profile.summary ?? ""];
  const technical = profile.technicalSkills?.map((skill) => skill.value) ?? profile.technical_skills ?? profile.skills ?? [];
  parts.push(technical.map(normalizeSkill).join(" "));
  parts.push(profile.softSkills?.map((skill) => skill.value).join(" ") ?? (profile.soft_skills ?? []).join(" "));
  for (const record of profile.experience ?? []) {
    parts.push(`${record.role ?? record.title ?? ""} ${record.company} ${(record.highlights ?? record.responsibilities ?? []).join(" ")} ${(record.achievements ?? []).join(" ")} ${(record.technologies ?? []).join(" ")}`);
  }
  parts.push((profile.education ?? []).map((education) => `${education.degree} ${education.field ?? ""} ${education.institution ?? ""}`).join(" "));
  for (const project of profile.projects ?? []) {
    parts.push(`${project.title ?? project.name ?? ""} ${(project.bullets ?? []).join(" ")} ${project.description ?? ""} ${project.technologies.join(" ")} ${project.source_evidence ?? ""}`);
  }
  parts.push((profile.certifications ?? []).map((cert) => typeof cert === "string" ? cert : `${cert.value} ${cert.evidence ?? ""}`).join(" "));
  parts.push((profile.achievements ?? []).map((achievement) => typeof achievement === "string" ? achievement : `${achievement.value} ${achievement.evidence ?? ""}`).join(" "));
  parts.push((profile.quantifiedEvidence ?? []).map((metric) => `${metric.value} ${metric.source_text}`).join(" "));
  parts.push(`years ${profile.totalExperienceYears ?? profile.experience_years ?? 0} experience`);
  return embedText(parts.join(" "));
}

export function embedJob(profile: {
  job_title: string;
  summary?: string;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  technologies: string[];
  experience_required: number;
  education_requirements?: string[];
  other_qualifications?: string[];
}): number[] {
  return embedText([
    profile.job_title,
    profile.summary ?? "",
    profile.required_skills.map(normalizeSkill).join(" "),
    profile.preferred_skills.map(normalizeSkill).join(" "),
    profile.responsibilities.join(" "),
    profile.technologies.map(normalizeSkill).join(" "),
    (profile.education_requirements ?? []).join(" "),
    (profile.other_qualifications ?? []).join(" "),
    profile.experience_required > 0 ? `${profile.experience_required} years experience required` : "",
  ].join(" "));
}
