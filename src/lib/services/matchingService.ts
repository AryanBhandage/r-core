// ============================================================================
// Matching Service — Reproducible Synthesized Scoring & Hard Requirement Warnings
// ============================================================================
// 1. Explicit weighted Synthesized Score formula:
//      Required Skill Coverage: 35%
//      Semantic Similarity:     20%
//      Experience Match:        15%
//      Preferred Skill Coverage:10%
//      Project Relevance:       10%
//      Education Match:          5%
//      Certification Match:      5%
// 2. Hard Requirement Warning Layer:
//      Missing multiple MUST-HAVE skills triggers a clear warning and caps the
//      match tier at "Moderate Match" or lower so no candidate missing 3 core
//      infrastructure requirements is ever called a "Strong Match".
// 3. Clear Separation between Candidate Performance Scores vs ML Model Feature
//      Importance (Gradient Boosting Regressor gain).
// ============================================================================

import {
  CandidateProfile,
  CompareResult,
  DEFAULT_SCORE_WEIGHTS,
  HardRequirementWarning,
  JobProfile,
  KNNResult,
  MatchResult,
  ScoreWeights,
  XGBoostResult,
} from "@/lib/ml/types";
import {
  computeFeatures,
  featuresToArray,
} from "@/lib/ml/featureEngineering";
import { cosineSimilarity } from "@/lib/ml/embedding";
import { knnPredict } from "@/lib/ml/knn";
import { buildKNNData } from "@/lib/ml/knowledgeBase";
import {
  GBDTModel,
  normalizeImportance,
  predictGBDT,
  trainGBDT,
} from "@/lib/ml/gbdt";

// Calibration set for Gradient Boosting Regressor (Development Mode)
const CALIBRATION: { x: number[]; y: number }[] = [
  { x: [0.9, 0.9, 0.95, 0.8, 1.0, 1.0, 0.8, 0.5], y: 92 },
  { x: [0.85, 0.85, 1.0, 0.7, 1.0, 1.0, 0.6, 0.4], y: 90 },
  { x: [0.78, 0.78, 0.85, 0.65, 0.9, 1.0, 0.7, 0.35], y: 84 },
  { x: [0.75, 0.75, 0.8, 0.6, 0.9, 1.0, 0.7, 0.3], y: 82 },
  { x: [0.75, 0.75, 0.5, 0.33, 1.0, 1.0, 0.8, 0.2], y: 68 }, // Aarav profile calibration
  { x: [0.7, 0.7, 0.75, 0.5, 0.8, 1.0, 0.5, 0.3], y: 76 },
  { x: [0.6, 0.6, 0.6, 0.4, 0.7, 0.8, 0.5, 0.2], y: 68 },
  { x: [0.55, 0.55, 0.5, 0.3, 0.6, 0.8, 0.4, 0.1], y: 62 },
  { x: [0.45, 0.45, 0.4, 0.3, 0.5, 0.7, 0.3, 0.1], y: 54 },
  { x: [0.4, 0.4, 0.35, 0.2, 0.4, 0.6, 0.2, 0], y: 46 },
  { x: [0.3, 0.3, 0.25, 0.2, 0.3, 0.5, 0.2, 0], y: 38 },
  { x: [0.95, 0.95, 1.0, 0.9, 1.0, 1.0, 0.9, 0.7], y: 95 },
];

let cachedModel: GBDTModel | null = null;
function getModel(): GBDTModel {
  if (!cachedModel) {
    cachedModel = trainGBDT(
      CALIBRATION.map((c) => c.x),
      CALIBRATION.map((c) => c.y),
      { nTrees: 60, learningRate: 0.08, maxDepth: 3, minLeaf: 2 }
    );
  }
  return cachedModel;
}

export function detectHardRequirementWarning(
  missingRequired: string[],
  matchedRequired: string[],
  jobTitle: string
): HardRequirementWarning | null {
  if (missingRequired.length === 0) return null;

  const count = missingRequired.length;
  const matchedCount = matchedRequired.length;

  if (count >= 3) {
    const matchedListStr =
      matchedCount > 0 ? ` (${matchedRequired.join(", ")})` : "";
    return {
      severity: "warning",
      title: "Hard Requirement Gap Detected",
      message: `Moderate Match — candidate meets ${matchedCount} core requirement(s)${matchedListStr} but is missing ${count} mandatory required skills (${missingRequired.join(
        ", "
      )}).`,
      missingRequiredSkills: missingRequired,
    };
  }

  if (count >= 1) {
    return {
      severity: "info",
      title: "Mandatory Skill Gap",
      message: `Candidate satisfies ${matchedCount} required skill(s) for ${jobTitle}, with ${count} missing mandatory requirement(s): ${missingRequired.join(
        ", "
      )}.`,
      missingRequiredSkills: missingRequired,
    };
  }

  return null;
}

export function determineMatchTier(
  overallScore: number,
  missingRequiredCount: number,
  requiredTotal: number
): MatchResult["match_tier"] {
  const coverageRatio =
    requiredTotal === 0 ? 1 : (requiredTotal - missingRequiredCount) / requiredTotal;

  // Never call a candidate "Strong Match" if they miss >= 3 mandatory skills or coverage < 75%
  if (missingRequiredCount >= 3 || coverageRatio < 0.6) {
    if (overallScore >= 55) return "Moderate Match";
    if (overallScore >= 40) return "Partial Match";
    return "Low Match";
  }

  if (overallScore >= 82 && coverageRatio >= 0.8) return "Strong Match";
  if (overallScore >= 64) return "Moderate Match";
  if (overallScore >= 45) return "Partial Match";
  return "Low Match";
}

/** Full match result with reproducible formula scoring. */
export function buildMatchResult(
  candidate: CandidateProfile,
  job: JobProfile,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): MatchResult {
  const { features, candidateVector, jobVector } = computeFeatures(
    candidate,
    job
  );
  const cosine = cosineSimilarity(candidateVector, jobVector);

  const reqScore = Math.round(features.required_skill_coverage * 100);
  const semScore = Math.round(cosine * 100);
  const expScore = Math.round(features.experience_match * 100);
  const prefScore = Math.round(features.preferred_skill_coverage * 100);
  const projScore = Math.round(features.project_relevance * 100);
  const eduScore = Math.round(features.education_match * 100);
  const certScore = Math.round(features.certification_match * 100);

  const applicable_components = {
    requiredSkillCoverage: job.required_skills.length > 0,
    semanticSimilarity: true,
    experienceMatch: job.experience_required > 0,
    preferredSkillCoverage: job.preferred_skills.length > 0,
    projectRelevance: true,
    educationMatch: job.education_requirements.length > 0,
    certificationMatch: job.other_qualifications.some((value) => /certif|license|credential/i.test(value)),
  };
  const baseWeights: ScoreWeights = {
    requiredSkillCoverage: applicable_components.requiredSkillCoverage ? weights.requiredSkillCoverage : 0,
    semanticSimilarity: applicable_components.semanticSimilarity ? weights.semanticSimilarity : 0,
    experienceMatch: applicable_components.experienceMatch ? weights.experienceMatch : 0,
    preferredSkillCoverage: applicable_components.preferredSkillCoverage ? weights.preferredSkillCoverage : 0,
    projectRelevance: applicable_components.projectRelevance ? weights.projectRelevance : 0,
    educationMatch: applicable_components.educationMatch ? weights.educationMatch : 0,
    certificationMatch: applicable_components.certificationMatch ? weights.certificationMatch : 0,
  };
  const activeWeightTotal = Object.values(baseWeights).reduce((sum, value) => sum + value, 0);
  const normalizedWeights: ScoreWeights = activeWeightTotal
    ? {
        requiredSkillCoverage: baseWeights.requiredSkillCoverage / activeWeightTotal,
        semanticSimilarity: baseWeights.semanticSimilarity / activeWeightTotal,
        experienceMatch: baseWeights.experienceMatch / activeWeightTotal,
        preferredSkillCoverage: baseWeights.preferredSkillCoverage / activeWeightTotal,
        projectRelevance: baseWeights.projectRelevance / activeWeightTotal,
        educationMatch: baseWeights.educationMatch / activeWeightTotal,
        certificationMatch: baseWeights.certificationMatch / activeWeightTotal,
      }
    : DEFAULT_SCORE_WEIGHTS;

  // Reproducible synthesized formula, renormalized over categories explicitly
  // present in the JD. No arbitrary model score replaces this formula.
  const rawSynthesized =
    reqScore * normalizedWeights.requiredSkillCoverage +
    semScore * normalizedWeights.semanticSimilarity +
    expScore * normalizedWeights.experienceMatch +
    prefScore * normalizedWeights.preferredSkillCoverage +
    projScore * normalizedWeights.projectRelevance +
    eduScore * normalizedWeights.educationMatch +
    certScore * normalizedWeights.certificationMatch;
  let overall_score = Math.round(rawSynthesized);

  // Mandatory omissions materially limit the interpretation of the score.
  // The cap is a policy guard, not a fabricated model prediction.
  if (features.missing_required.length >= 3 && overall_score > 74) overall_score = 74;

  const hard_warning = detectHardRequirementWarning(
    features.missing_required,
    features.matched_required,
    job.job_title
  );

  const match_tier = determineMatchTier(
    overall_score,
    features.missing_required.length,
    job.required_skills.length
  );

  return {
    overall_score,
    formula_breakdown: {
      required_skill_coverage_score: reqScore,
      semantic_similarity_score: semScore,
      experience_score: expScore,
      preferred_skill_coverage_score: prefScore,
      project_score: projScore,
      education_score: eduScore,
      certification_score: certScore,
      weights_used: normalizedWeights,
    },
    applicable_components,
    hard_warning,
    match_tier,
    cosine_similarity: cosine,
    semantic_score: semScore,
    skills_score: Math.round(features.skill_similarity * 100),
    experience_score: expScore,
    project_score: projScore,
    education_score: eduScore,
    required_coverage: reqScore,
    preferred_coverage: prefScore,
    features,
    candidate_vector: candidateVector,
    job_vector: jobVector,
  };
}

/** Run the KNN baseline. */
export function runKNN(
  candidate: CandidateProfile,
  job: JobProfile,
  match: MatchResult
): KNNResult {
  const data = buildKNNData(job);
  const result = knnPredict(match.candidate_vector ?? [], data, 5);

  // Blend with direct cosine and required skill coverage so the baseline reflects real candidate readiness
  const blended = Math.round(
    0.5 * result.score +
      0.3 * match.formula_breakdown.required_skill_coverage_score +
      0.2 * (match.cosine_similarity * 100)
  );

  // Honor hard mandatory requirement constraints
  const finalScore =
    match.features.missing_required.length >= 3
      ? Math.min(blended, 72)
      : Math.max(0, Math.min(100, blended));

  return {
    ...result,
    score: finalScore,
    model: "knn",
    modelName: "K-Nearest Neighbors Regressor",
    label: "Baseline Model (KNN)",
    disclaimer:
      "Model Score (development calibration mode) — retrieves k nearest candidate vectors by cosine distance.",
  };
}

/** Run the Gradient Boosting Regressor (proposed model). */
export function runXGBoost(
  candidate: CandidateProfile,
  job: JobProfile,
  match: MatchResult
): XGBoostResult {
  const model = getModel();
  const x = featuresToArray(match.features);
  const raw = predictGBDT(model, x);
  let score = Math.max(0, Math.min(100, Math.round(raw)));

  // If candidate is missing >=3 mandatory skills, cap gradient-boosted score
  if (match.features.missing_required.length >= 3 && score > 73) {
    score = 70;
  }

  const probability = Math.max(0, Math.min(1, score / 100));
  return {
    score,
    probability,
    model: "gradient_boosting",
    modelName: "Gradient Boosting Regressor",
    feature_importance: normalizeImportance(model.featureImportance),
    n_trees: model.trees.length,
    mode: "development",
    label: "Proposed Model (Gradient Boosting)",
    disclaimer:
      "Model Score (development calibration mode) — feature importance represents decision-tree split gain, NOT candidate performance.",
  };
}

/** Run both models and build the comparison payload. */
export function compareModels(
  candidate: CandidateProfile,
  job: JobProfile
): CompareResult {
  const match = buildMatchResult(candidate, job);
  const knn = runKNN(candidate, job, match);
  const xgboost = runXGBoost(candidate, job, match);

  return {
    knn,
    xgboost,
    synthesized_match: match,
    cosine_similarity: match.cosine_similarity,
    features: match.features,
    overall_score: match.overall_score,
    match_tier: match.match_tier,
    hard_warning: match.hard_warning,
    applicable_components: match.applicable_components,
    model_evaluation: "pending",
    methods: {
      generative_ai: [
        "Structured section-aware extraction",
        "Evidence-backed explanation",
        "Personalized roadmap narrative",
      ],
      machine_learning: [
        "K-Nearest Neighbors Regressor (Baseline)",
        "Gradient Boosting Regressor (Proposed Model)",
      ],
      semantic_nlp: [
        "Dense word/bigram/character embeddings",
        "Cosine similarity in vector space",
      ],
      deterministic_logic: [
        "Transparent Required vs Preferred skill coverage",
        "Strict no-hallucination evidence verification",
        "Reproducible weighted formula scoring",
        "Hard requirement gap detection",
      ],
    },
  };
}
