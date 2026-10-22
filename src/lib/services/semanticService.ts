// ============================================================================
// Semantic Intelligence Explorer
// ============================================================================
// Uses the same embedding implementation and canonical profiles as matching.
// No coordinates or similarities are fabricated: the graph coordinates are
// derived with PCA from the actual high-dimensional vectors, while every
// similarity is cosine over the original vectors.
// ============================================================================

import {
  CandidateProfile,
  JobProfile,
  SemanticComponent,
  SemanticExplorerResult,
  SemanticMatrixCell,
  getEntityValue,
  normalizeSkill,
} from "@/lib/ml/types";
import { embedCandidate, embedJob, embedText, cosineSimilarity, EMBEDDING_DIM } from "@/lib/ml/embedding";
import { analyzeSkillGaps } from "./skillGapService";

interface ComponentSeed {
  id: string;
  label: string;
  type: "candidate" | "job";
  category: string;
  tier?: "REQUIRED" | "PREFERRED";
  sourceSection: string;
  sourceText: string;
  vector: number[];
}

function candidateSeeds(candidate: CandidateProfile, overallVector: number[]): ComponentSeed[] {
  const seeds: ComponentSeed[] = [
    {
      id: "candidate-profile",
      label: candidate.name || "Candidate Profile",
      type: "candidate",
      category: "profile",
      sourceSection: candidate.identity?.evidence ? "Identity" : "Candidate Profile",
      sourceText: candidate.rawText,
      vector: overallVector,
    },
  ];
  if (candidate.summary.trim()) seeds.push(seed("candidate-summary", "Summary", "summary", "Summary", candidate.summary));
  if (candidate.technicalSkills.length) {
    const text = candidate.technicalSkills.map((e) => e.value).join(", ");
    const evidence = candidate.technicalSkills.map((e) => e.evidence).join(" ");
    seeds.push(seed("candidate-technical-skills", "Technical Skills", "skills", "Technical Skills", `${text}. Evidence: ${evidence}`));
  }
  if (candidate.softSkills.length) {
    const text = candidate.softSkills.map((e) => e.value).join(", ");
    seeds.push(seed("candidate-soft-skills", "Soft Skills", "skills", "Soft Skills", text));
  }
  candidate.experience.forEach((record, index) => {
    const text = `${record.title} at ${record.company}. ${record.responsibilities.join(" ")} ${record.achievements.join(" ")} Technologies: ${record.technologies.join(", ")}`.trim();
    seeds.push(seed(`candidate-experience-${index}`, record.title || `Experience ${index + 1}`, "experience", "Experience", text));
  });
  candidate.projects.forEach((project, index) => {
    const text = `${project.title}. ${project.bullets.join(" ")} Technologies: ${project.technologies.join(", ")}`.trim();
    seeds.push(seed(`candidate-project-${index}`, project.title, "project", project.source_section || "Projects", project.source_evidence || text));
  });
  candidate.education.forEach((education, index) => {
    seeds.push(seed(`candidate-education-${index}`, education.degree, "education", "Education", education.evidence));
  });
  if (candidate.certifications.length) {
    seeds.push(seed("candidate-certifications", "Certifications", "certifications", "Certifications", candidate.certifications.map((e) => `${getEntityValue(e)} — ${typeof e === "string" ? e : e.evidence}`).join(" ")));
  }
  if (candidate.achievements.length) {
    seeds.push(seed("candidate-achievements", "Achievements", "achievements", "Achievements", candidate.achievements.map((e) => `${getEntityValue(e)} — ${typeof e === "string" ? e : e.evidence}`).join(" ")));
  }
  if (candidate.languages.length) {
    seeds.push(seed("candidate-languages", "Languages", "languages", "Languages", candidate.languages.map((e) => getEntityValue(e)).join(", ")));
  }
  return seeds;
}

function jobSeeds(job: JobProfile, overallVector: number[]): ComponentSeed[] {
  const seeds: ComponentSeed[] = [
    {
      id: "job-profile",
      label: job.job_title || "Job Profile",
      type: "job",
      category: "profile",
      sourceSection: "Job Description",
      sourceText: job.sourceText || job.job_title,
      vector: overallVector,
    },
  ];
  if (job.summary?.trim()) seeds.push(seed("job-summary", "Job Summary", "summary", "Job Summary", job.summary));
  if (job.responsibilities.length) seeds.push(seed("job-responsibilities", "Responsibilities", "responsibilities", "Responsibilities", job.responsibilities.join(" ")));
  if (job.required_skills.length) seeds.push({ ...seed("job-required-skills", "Required Skills", "requirements", "Required Skills", job.required_skills.join(", ")), tier: "REQUIRED" });
  if (job.preferred_skills.length) seeds.push({ ...seed("job-preferred-skills", "Preferred Skills", "requirements", "Preferred Skills", job.preferred_skills.join(", ")), tier: "PREFERRED" });
  if (job.education_requirements.length) seeds.push(seed("job-education", "Education Requirements", "qualifications", "Qualifications", job.education_requirements.join(", ")));
  if (job.other_qualifications?.length) seeds.push(seed("job-other-qualifications", "Other Qualifications", "qualifications", "Other Qualifications", job.other_qualifications.join(" ")));
  return seeds;
}

function seed(id: string, label: string, category: string, sourceSection: string, sourceText: string): ComponentSeed {
  return { id, label, type: id.startsWith("job-") ? "job" : "candidate", category, sourceSection, sourceText, vector: embedText(sourceText) };
}

function pcaProject(seeds: ComponentSeed[]): { coordinates: Map<string, { x: number; y: number }>; available: boolean } {
  const dimension = seeds[0]?.vector.length ?? 0;
  if (seeds.length < 2 || dimension < 2 || seeds.some((s) => s.vector.length !== dimension)) {
    return { coordinates: new Map(), available: false };
  }
  const mean = new Array(dimension).fill(0);
  for (const seed of seeds) for (let j = 0; j < dimension; j++) mean[j] += seed.vector[j] / seeds.length;
  const centered = seeds.map((seed) => seed.vector.map((value, j) => value - mean[j]));
  const covApply = (v: number[]) => {
    const result = new Array(dimension).fill(0);
    for (const row of centered) {
      let dot = 0;
      for (let j = 0; j < dimension; j++) dot += row[j] * v[j];
      for (let j = 0; j < dimension; j++) result[j] += row[j] * dot;
    }
    return result;
  };
  const power = (deflate?: number[]) => {
    let v = new Array(dimension).fill(0).map((_, i) => ((i * 17 + 11) % 23) / 23 - 0.5);
    normalizeInPlace(v);
    for (let i = 0; i < 35; i++) {
      let next = covApply(v);
      if (deflate) {
        const projection = dot(next, deflate);
        next = next.map((value, j) => value - projection * deflate[j]);
      }
      normalizeInPlace(next);
      v = next;
    }
    return v;
  };
  const pc1 = power();
  const pc2 = power(pc1);
  const raw = centered.map((row) => ({ x: dot(row, pc1), y: dot(row, pc2) }));
  const maxAbs = Math.max(1e-9, ...raw.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]));
  const coordinates = new Map<string, { x: number; y: number }>();
  raw.forEach((point, index) => coordinates.set(seeds[index].id, { x: point.x / maxAbs, y: point.y / maxAbs }));
  return { coordinates, available: true };
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function normalizeInPlace(vector: number[]): void {
  const norm = Math.sqrt(dot(vector, vector));
  if (norm === 0) return;
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
}

function closestConcepts(component: ComponentSeed, other: ComponentSeed[]): string[] {
  return other
    .map((item) => ({ label: item.label, similarity: cosineSimilarity(component.vector, item.vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((item) => item.label);
}

export function buildSemanticExplorer(
  candidate: CandidateProfile,
  job: JobProfile,
  actual?: { candidateVector?: number[]; jobVector?: number[]; cosineSimilarity?: number }
): SemanticExplorerResult {
  const candidateVector = actual?.candidateVector?.length ? actual.candidateVector : embedCandidate(candidate);
  const jobVector = actual?.jobVector?.length ? actual.jobVector : embedJob(job);
  const embeddingsGenerated = candidateVector.some((value) => value !== 0) && jobVector.some((value) => value !== 0);
  const candidateSeedsList = candidateSeeds(candidate, candidateVector);
  const jobSeedsList = jobSeeds(job, jobVector);
  const allSeeds = [...candidateSeedsList, ...jobSeedsList];
  const projection = pcaProject(allSeeds);
  const gaps = analyzeSkillGaps(candidate, job);

  const makeComponent = (component: ComponentSeed, opposite: ComponentSeed[]): SemanticComponent => ({
    id: component.id,
    label: component.label,
    type: component.type,
    category: component.category,
    tier: component.tier,
    sourceSection: component.sourceSection,
    sourceText: component.sourceText,
    vector: component.vector,
    projected: projection.coordinates.get(component.id) ?? { x: 0, y: 0 },
    closestConcepts: closestConcepts(component, opposite),
  });

  const candidateComponents = candidateSeedsList.map((item) => makeComponent(item, jobSeedsList));
  const jobComponents = jobSeedsList.map((item) => makeComponent(item, candidateSeedsList));
  const matrix: SemanticMatrixCell[] = [];
  for (const candidateComponent of candidateComponents) {
    for (const jobComponent of jobComponents) {
      const requirementStatus = statusForCell(candidateComponent, jobComponent, gaps);
      matrix.push({
        candidateId: candidateComponent.id,
        jobId: jobComponent.id,
        similarity: cosineSimilarity(candidateComponent.vector, jobComponent.vector),
        candidateSource: `${candidateComponent.sourceSection}: ${candidateComponent.sourceText}`,
        jobSource: `${jobComponent.sourceSection}: ${jobComponent.sourceText}`,
        evidence: `${candidateComponent.label} ↔ ${jobComponent.label}`,
        requirementStatus,
      });
    }
  }

  const cosine = actual?.cosineSimilarity ?? cosineSimilarity(candidateVector, jobVector);
  return {
    embeddingModel: "ReqCore hashed TF word/bigram + character-trigram embedding",
    vectorDimensions: EMBEDDING_DIM,
    projectionMethod: "PCA",
    projectionAvailable: embeddingsGenerated && projection.available,
    projectionNote: embeddingsGenerated && projection.available
      ? "2D projection of high-dimensional embeddings. 2D distance is not cosine similarity."
      : "Semantic projection unavailable — embeddings were not generated.",
    candidateComponents,
    jobComponents,
    matrix,
    cosineSimilarity: cosine,
    candidateVector,
    jobVector,
  };
}

function statusForCell(candidate: SemanticComponent, job: SemanticComponent, gaps: ReturnType<typeof analyzeSkillGaps>): "MATCHED" | "PARTIAL" | "MISSING" | undefined {
  if (job.category !== "requirements") return undefined;
  const requirement = job.label === "Required Skills" ? gaps.requiredGaps : gaps.preferredGaps;
  if (candidate.category !== "skills" && candidate.category !== "project" && candidate.category !== "experience") return undefined;
  const all = requirement.find((gap) => normalizeSkill(candidate.label).includes(normalizeSkill(gap.skill)) || normalizeSkill(gap.skill).includes(normalizeSkill(candidate.label)));
  return all?.status;
}
