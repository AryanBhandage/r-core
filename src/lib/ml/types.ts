// Shared domain types for the ReqCore AI Lab pipeline.
// These types define the verified, evidence-backed output of every stage.

export interface ExtractedEntity<T = string> {
  value: T;
  canonical: string;
  evidence: string;
  confidence: number;
  section: string;
}

export interface EmploymentRecord {
  title: string;
  role: string; // alias for title
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  duration: string;
  durationYears: number;
  years: number; // alias for durationYears
  responsibilities: string[];
  highlights: string[]; // alias for responsibilities + achievements
  achievements: string[]; // Measurable quantified achievements e.g. "40% latency reduction"
  technologies: string[];
  evidence: string;
}

export interface EducationRecord {
  degree: string;
  field?: string;
  institution: string;
  location?: string;
  year?: string;
  evidence: string;
}

export interface ProjectRecord {
  title: string;
  name: string; // backwards-compatible alias for title
  type: "Project" | "Dissertation";
  technologies: string[];
  bullets: string[];
  description: string; // backwards-compatible joined bullet text
  achievements: string[];
  evidence: string;
  source_section: string;
  source_evidence: string;
}

export interface QuantifiedEvidence {
  value: string;
  metric_type: string;
  source_text: string;
  source_section: string;
  source_record?: string;
}

export interface ResumeQualityAnalysis {
  score: number; // 0..100 SEPARATE from Job Match
  strengths: { title: string; evidence: string }[];
  weaknesses: { title: string; evidence: string }[];
  quantifiedAchievementsCount: number;
  quantifiedAchievements: string[];
}

export interface VerifiedCandidateProfile {
  identity: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    evidence: string;
  };
  summary: string;
  technicalSkills: ExtractedEntity<string>[];
  softSkills: ExtractedEntity<string>[];
  experience: EmploymentRecord[];
  totalExperienceYears: number; // Calculated from actual employment dates
  education: EducationRecord[];
  certifications: ExtractedEntity<string>[];
  projects: ProjectRecord[];
  achievements: ExtractedEntity<string>[];
  languages: ExtractedEntity<string>[];
  resumeQuality: ResumeQualityAnalysis;
  quantifiedEvidence: QuantifiedEvidence[];
  sourceEvidence: string[];
  extractionConfidence: number;
  rawText: string;

  // Backwards-compatible convenience fields for components
  name: string;
  skills: string[];
  technical_skills: string[];
  soft_skills: string[];
  experience_years: number;
}

export interface StructuredJobProfile {
  job_title: string;
  summary?: string;
  required_skills: string[]; // MUST-HAVE
  preferred_skills: string[]; // NICE-TO-HAVE
  responsibilities: string[];
  experience_required: number;
  education_requirements: string[];
  other_qualifications: string[];
  technologies: string[];
  sourceText?: string;
  sourceEvidence?: string[];
}

// Backwards-compatible type alias
export type JobProfile = StructuredJobProfile;
export type CandidateProfile = VerifiedCandidateProfile;

export interface ScoreWeights {
  requiredSkillCoverage: number; // default 0.35 (35%)
  semanticSimilarity: number;    // default 0.20 (20%)
  experienceMatch: number;       // default 0.15 (15%)
  preferredSkillCoverage: number;// default 0.10 (10%)
  projectRelevance: number;      // default 0.10 (10%)
  educationMatch: number;        // default 0.05 (5%)
  certificationMatch: number;    // default 0.05 (5%)
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  requiredSkillCoverage: 0.35,
  semanticSimilarity: 0.20,
  experienceMatch: 0.15,
  preferredSkillCoverage: 0.10,
  projectRelevance: 0.10,
  educationMatch: 0.05,
  certificationMatch: 0.05,
};

export interface FeatureVector {
  // Deterministic candidate performance scores (0..1)
  required_skill_coverage: number;
  preferred_skill_coverage: number;
  semantic_similarity: number;
  skill_similarity: number;
  experience_match: number;
  education_match: number;
  project_relevance: number;
  certification_match: number;
  relevant_experience_match: number;

  // Backwards compatibility aliases
  required_skill_match: number;
  preferred_skill_match: number;

  // Skill coverage breakdowns
  matched_required: string[];
  partial_required: string[];
  missing_required: string[];
  matched_preferred: string[];
  partial_preferred: string[];
  missing_preferred: string[];
}

export type SkillStatus = "MATCHED" | "PARTIAL" | "MISSING";
export type SkillTier = "REQUIRED" | "PREFERRED";
export type SkillMatchType = "EXACT" | "ALIAS" | "RELATED" | "MISSING";

export interface SkillGap {
  skill: string;
  canonical: string;
  tier: SkillTier;
  required: boolean;
  status: SkillStatus;
  matchType: SkillMatchType;
  semanticSimilarity?: number;
  evidence: string;
  candidateMatchText?: string;
}

export interface HardRequirementWarning {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  missingRequiredSkills: string[];
}

export interface MatchResult {
  overall_score: number; // 0..100 synthesized formula score
  formula_breakdown: {
    required_skill_coverage_score: number; // e.g. 50%
    semantic_similarity_score: number;     // e.g. 78%
    experience_score: number;              // e.g. 100%
    preferred_skill_coverage_score: number;// e.g. 33%
    project_score: number;                 // e.g. 80%
    education_score: number;               // e.g. 100%
    certification_score: number;           // e.g. 20%
    weights_used: ScoreWeights;
  };
  hard_warning: HardRequirementWarning | null;
  applicable_components: {
    requiredSkillCoverage: boolean;
    semanticSimilarity: boolean;
    experienceMatch: boolean;
    preferredSkillCoverage: boolean;
    projectRelevance: boolean;
    educationMatch: boolean;
    certificationMatch: boolean;
  };
  match_tier: "Strong Match" | "Moderate Match" | "Partial Match" | "Low Match";
  cosine_similarity: number;
  semantic_score: number;
  skills_score: number;
  experience_score: number;
  project_score: number;
  education_score: number;
  required_coverage: number; // e.g. 50 (for 50%)
  preferred_coverage: number; // e.g. 33
  features: FeatureVector;
  candidate_vector?: number[];
  job_vector?: number[];
}

export interface Neighbor {
  id: string;
  label: string;
  distance: number;
  similarity: number;
  score: number;
}

export interface KNNResult {
  score: number; // 0..100
  model: "knn";
  modelName: "K-Nearest Neighbors Regressor";
  neighbors: Neighbor[];
  k: number;
  mode: "development" | "live";
  label: string;
  disclaimer: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number; // normalized 0..1 sum to 1
  description: string;
}

export interface XGBoostResult {
  score: number; // 0..100
  model: "gradient_boosting";
  modelName: "Gradient Boosting Regressor";
  feature_importance: FeatureImportance[];
  n_trees: number;
  mode: "development" | "live";
  label: string;
  disclaimer: string;
  probability: number;
}

export interface CompareResult {
  knn: KNNResult;
  xgboost: XGBoostResult;
  synthesized_match: MatchResult;
  cosine_similarity: number;
  features: FeatureVector;
  overall_score: number;
  match_tier: string;
  hard_warning: HardRequirementWarning | null;
  applicable_components: {
    requiredSkillCoverage: boolean;
    semanticSimilarity: boolean;
    experienceMatch: boolean;
    preferredSkillCoverage: boolean;
    projectRelevance: boolean;
    educationMatch: boolean;
    certificationMatch: boolean;
  };
  semantic?: SemanticExplorerResult;
  model_evaluation: string; // "pending" | "validated"
  methods: {
    generative_ai: string[];
    machine_learning: string[];
    semantic_nlp: string[];
    deterministic_logic: string[];
  };
}

export interface ExplainSection {
  label: string;
  items: string[];
  tone: "positive" | "neutral" | "negative";
}

export interface EvidenceReason {
  category: "strength" | "satisfies_requirement" | "missing_mandatory" | "preferred_skill" | "warning";
  title: string;
  detail: string;
  evidence: string;
}

export interface ExplainResult {
  overall_score: number;
  match_tier: string;
  summary_reason: string;
  reasons: EvidenceReason[];
  strong_matches: string[];
  partial_matches: string[];
  skill_gaps: string[];
  sections: ExplainSection[];
  llm_explanation: string | null;
  provenance: "deterministic" | "llm_assisted";
  disclaimer: string;
}

export interface RoadmapItem {
  phase: number;
  phaseLabel: string;
  skill: string;
  tier: SkillTier;
  why: string;
  outcome: string;
  project: string;
  duration: string;
  prerequisite: string;
  status: SkillStatus;
  targetJobRequirement: string;
}

export interface RoadmapResult {
  target_role: string;
  readiness: number; // 0..100
  required_gaps_count: number;
  preferred_gaps_count: number;
  current_skills: string[];
  missing_skills: string[];
  partial_skills: string[];
  items: RoadmapItem[];
  provenance: "deterministic" | "llm_assisted";
  disclaimer: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  input: string;
  process: string;
  output: string;
  tag: "generative" | "machine_learning" | "semantic" | "deterministic";
}

export interface ValidationTestCaseResult {
  id: string;
  name: string;
  role: string;
  passed: boolean;
  actualExperienceYears: number;
  expectedExperienceYears: number;
  extractedSkills: string[];
  missingRequiredSkillsDetected: string[];
  extractedCertifications: string[];
  extractedDegrees: string[];
  noHallucinatedDegrees: boolean;
  noHallucinatedSkills: boolean;
  requiredSkillCoverageRatio: string;
  requiredSkillCoveragePercent: number;
  projectsCount: number;
  assertions: {
    label: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
}

// Canonical skill normalization table mapping aliases to canonical name
export const CANONICAL_SKILL_MAP: Record<string, string> = {
  // Databases
  "postgres": "PostgreSQL",
  "postgre sql": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "mysql": "MySQL",
  "mongodb": "MongoDB",
  "mongo": "MongoDB",
  "redis": "Redis",
  "sql": "SQL",

  // Programming & Frameworks
  "python": "Python",
  "fastapi": "FastAPI",
  "flask": "Flask",
  "django": "Django",
  "javascript": "JavaScript",
  "typescript": "TypeScript",
  "react": "React",
  "react.js": "React",
  "reactjs": "React",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "java": "Java",
  "c++": "C++",
  "c#": "C#",
  "go": "Go",
  "golang": "Go",
  "rust": "Rust",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  "restful": "REST APIs",
  "restful apis": "REST APIs",
  "graphql": "GraphQL",

  // AI & ML
  "machine learning": "Machine Learning",
  "ml": "Machine Learning",
  "machine-learning": "Machine Learning",
  "deep learning": "Deep Learning",
  "deep-learning": "Deep Learning",
  "tensorflow": "TensorFlow",
  "tensor flow": "TensorFlow",
  "pytorch": "PyTorch",
  "scikit-learn": "scikit-learn",
  "scikit learn": "scikit-learn",
  "sklearn": "scikit-learn",
  "keras": "Keras",
  "pandas": "Pandas",
  "numpy": "NumPy",
  "nlp": "NLP",
  "natural language processing": "NLP",
  "computer vision": "Computer Vision",
  "llm": "LLMs",
  "large language models": "LLMs",

  // Cloud & DevOps
  "aws": "AWS",
  "amazon web services": "AWS",
  "amazon aws": "AWS",
  "docker": "Docker",
  "kubernetes": "Kubernetes",
  "k8s": "Kubernetes",
  "google cloud": "Google Cloud",
  "gcp": "Google Cloud",
  "google cloud platform": "Google Cloud",
  "azure": "Microsoft Azure",
  "microsoft azure": "Microsoft Azure",
  "mlops": "MLOps",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "ci cd": "CI/CD",
  "git": "Git",
  "github": "GitHub",
  "linux": "Linux",
  "terraform": "Terraform",
};

export function normalizeSkill(skill: string): string {
  const clean = skill
    .trim()
    .replace(/^[•\-\*\s]+/, "")
    .replace(/[,;]+$/, "")
    .trim();
  const lower = clean.toLowerCase();
  return CANONICAL_SKILL_MAP[lower] ?? clean;
}

export function getEntityValue(item: string | ExtractedEntity<string>): string {
  if (typeof item === "string") return item;
  return item?.value ?? "";
}

export function entityValues(list: (string | ExtractedEntity<string>)[] | undefined): string[] {
  if (!list) return [];
  return list.map(getEntityValue).filter(Boolean);
}

export function createEntity(
  value: string,
  evidence: string,
  section = "General",
  confidence = 0.95
): ExtractedEntity<string> {
  return {
    value,
    canonical: normalizeSkill(value),
    evidence: evidence || value,
    confidence,
    section,
  };
}

export interface SemanticComponent {
  id: string;
  label: string;
  type: "candidate" | "job";
  category: string;
  tier?: SkillTier;
  sourceSection: string;
  sourceText: string;
  vector: number[];
  projected: { x: number; y: number };
  closestConcepts: string[];
}

export interface SemanticMatrixCell {
  candidateId: string;
  jobId: string;
  similarity: number;
  candidateSource: string;
  jobSource: string;
  evidence: string;
  requirementStatus?: SkillStatus;
}

export interface SemanticExplorerResult {
  embeddingModel: string;
  vectorDimensions: number;
  projectionMethod: "PCA";
  projectionAvailable: boolean;
  projectionNote: string;
  candidateComponents: SemanticComponent[];
  jobComponents: SemanticComponent[];
  matrix: SemanticMatrixCell[];
  cosineSimilarity: number;
  candidateVector: number[];
  jobVector: number[];
}
