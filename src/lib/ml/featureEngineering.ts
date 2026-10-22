// ============================================================================
// Deterministic feature engineering for the verified candidate/job pair.
// Candidate project bullets are treated as one project record; professional
// experience is never inferred from projects.
// ============================================================================

import { cosineSimilarity, embedCandidate, embedJob } from "./embedding";
import { CandidateProfile, FeatureVector, JobProfile, getEntityValue, normalizeSkill } from "./types";

function tokenKey(value: string): string[] {
  return normalizeSkill(value).toLowerCase().split(/[^a-z0-9+#]+/).filter((token) => token.length > 2).map((token) => token.endsWith("s") ? token.slice(0, -1) : token);
}

function relatedSkill(requirement: string, candidates: string[]): boolean {
  const requirementTokens = new Set(tokenKey(requirement));
  if (!requirementTokens.size) return false;
  return candidates.some((candidate) => {
    const candidateTokens = new Set(tokenKey(candidate));
    let overlap = 0;
    for (const token of requirementTokens) if (candidateTokens.has(token)) overlap++;
    return overlap > 0;
  });
}

function educationMatch(candidate: CandidateProfile, job: JobProfile): number {
  if (!job.education_requirements.length) return 1;
  const candidateEducation = candidate.education.map((education) => `${education.degree} ${education.field ?? ""}`.toLowerCase());
  let satisfied = 0;
  for (const requirement of job.education_requirements) {
    const req = requirement.toLowerCase();
    const degreeSatisfied = candidateEducation.some((education) => {
      const bachelorVariant = req.includes("bachelor") && /bachelor|bca|b\.tech|b\.e\.|b\.s\./i.test(education);
      const masterVariant = req.includes("master") && /master|m\.tech|m\.s\.|mba/i.test(education);
      const fieldSatisfied = req.split(/\s+/).filter((word) => word.length > 3).some((word) => education.includes(word));
      return req.includes("any") || bachelorVariant || masterVariant || fieldSatisfied;
    });
    if (degreeSatisfied) satisfied++;
  }
  return satisfied / job.education_requirements.length;
}

function projectRelevance(candidate: CandidateProfile, job: JobProfile): number {
  if (!candidate.projects.length) return 0;
  const jobTerms = new Set([...job.required_skills, ...job.preferred_skills, ...job.technologies].map(normalizeSkill));
  let relevant = 0;
  for (const project of candidate.projects) {
    const projectText = [project.title, ...project.bullets, project.description, ...project.technologies].join(" ");
    const direct = [...jobTerms].some((term) => projectText.toLowerCase().includes(term.toLowerCase()));
    const related = [...jobTerms].some((term) => relatedSkill(term, [projectText]));
    if (direct || related) relevant++;
  }
  return relevant / candidate.projects.length;
}

function certificationMatch(candidate: CandidateProfile, job: JobProfile): number {
  const certificationRequirement = job.other_qualifications.some((value) => /certif|license|credential/i.test(value));
  if (!certificationRequirement) return 1;
  if (!candidate.certifications.length) return 0;
  const candidateCerts = candidate.certifications.map((cert) => getEntityValue(cert).toLowerCase());
  const hits = job.other_qualifications.filter((requirement) => candidateCerts.some((cert) => cert.includes(requirement.toLowerCase()) || requirement.toLowerCase().includes(cert))).length;
  return hits / Math.max(1, job.other_qualifications.filter((value) => /certif|license|credential/i.test(value)).length);
}

function relevantProfessionalYears(candidate: CandidateProfile, job: JobProfile): number {
  const required = job.required_skills.map(normalizeSkill);
  if (!required.length) return candidate.totalExperienceYears;
  return candidate.experience.reduce((sum, record) => {
    const evidence = `${record.title} ${record.responsibilities.join(" ")} ${record.achievements.join(" ")} ${record.technologies.join(" ")}`;
    const relevant = required.some((skill) => evidence.toLowerCase().includes(skill.toLowerCase())) ||
      (/\b(machine\s+learning|ml)\b/i.test(evidence) && /\b(machine\s+learning|ml)\b/i.test(job.sourceText ?? ""));
    return sum + (relevant ? record.durationYears : 0);
  }, 0);
}

export function computeFeatures(candidate: CandidateProfile, job: JobProfile): { features: FeatureVector; candidateVector: number[]; jobVector: number[] } {
  const candidateSkills = [
    ...(candidate.technicalSkills ?? []).map((entity) => entity.value),
    ...(candidate.skills ?? []),
    ...(candidate.certifications ?? []).map(getEntityValue),
  ];
  const candidateCanonical = new Set(candidateSkills.map(normalizeSkill));
  const matchedRequired: string[] = [];
  const partialRequired: string[] = [];
  const missingRequired: string[] = [];
  for (const requirement of job.required_skills) {
    const canonical = normalizeSkill(requirement);
    if (candidateCanonical.has(canonical)) matchedRequired.push(requirement);
    else if (relatedSkill(requirement, candidateSkills)) partialRequired.push(requirement);
    else missingRequired.push(requirement);
  }
  const matchedPreferred: string[] = [];
  const partialPreferred: string[] = [];
  const missingPreferred: string[] = [];
  for (const requirement of job.preferred_skills) {
    const canonical = normalizeSkill(requirement);
    if (candidateCanonical.has(canonical)) matchedPreferred.push(requirement);
    else if (relatedSkill(requirement, candidateSkills)) partialPreferred.push(requirement);
    else missingPreferred.push(requirement);
  }

  const required_skill_coverage = job.required_skills.length ? matchedRequired.length / job.required_skills.length : 1;
  const preferred_skill_coverage = job.preferred_skills.length ? matchedPreferred.length / job.preferred_skills.length : 1;
  const totalYears = candidate.totalExperienceYears ?? candidate.experience_years ?? 0;
  const relevantYears = relevantProfessionalYears(candidate, job);
  const specificProfessionalRequirement = /professional\s+(?:experience|background)/i.test(job.sourceText ?? "") && /(?:machine\s+learning|ml|backend|cloud|platform)/i.test(job.sourceText ?? "");
  const experience_match = Math.min((specificProfessionalRequirement ? relevantYears : totalYears) / Math.max(job.experience_required, 0.5), 1);
  const relevant_experience_match = Math.min(relevantYears / Math.max(job.experience_required, 0.5), 1);

  const candidateVector = embedCandidate(candidate);
  const jobVector = embedJob(job);
  const semantic_similarity = cosineSimilarity(candidateVector, jobVector);
  const skill_overlap = (matchedRequired.length + matchedPreferred.length) / Math.max(1, job.required_skills.length + job.preferred_skills.length);
  const skill_similarity = Math.min(0.7 * skill_overlap + 0.3 * semantic_similarity, 1);
  const features: FeatureVector = {
    required_skill_coverage,
    preferred_skill_coverage,
    semantic_similarity,
    skill_similarity,
    experience_match,
    relevant_experience_match,
    education_match: educationMatch(candidate, job),
    project_relevance: projectRelevance(candidate, job),
    certification_match: certificationMatch(candidate, job),
    required_skill_match: required_skill_coverage,
    preferred_skill_match: preferred_skill_coverage,
    matched_required: matchedRequired,
    partial_required: partialRequired,
    missing_required: missingRequired,
    matched_preferred: matchedPreferred,
    partial_preferred: partialPreferred,
    missing_preferred: missingPreferred,
  };
  return { features, candidateVector, jobVector };
}

export function featuresToArray(features: FeatureVector): number[] {
  return [features.semantic_similarity, features.skill_similarity, features.required_skill_coverage, features.preferred_skill_coverage, features.experience_match, features.education_match, features.project_relevance, features.certification_match];
}

export const FEATURE_NAMES = [
  "Semantic Similarity",
  "Skill Similarity",
  "Required Skill Coverage",
  "Preferred Skill Coverage",
  "Experience Match",
  "Education Match",
  "Project Relevance",
  "Certification Match",
];
