// ============================================================================
// Explainability Service — Evidence-Backed Why Explanation
// ============================================================================
// Explains WHY the candidate received the score by citing explicit supporting
// evidence from the resume and job description:
//   - Required skills matched with resume snippets
//   - Actual employment experience years vs required experience years
//   - Verified degree satisfaction
//   - Mandatory infrastructure skills missing (e.g. AWS, Docker, Kubernetes)
//   - Preferred skills matched/missing
// ============================================================================

import {
  CandidateProfile,
  EvidenceReason,
  ExplainResult,
  JobProfile,
  getEntityValue,
} from "@/lib/ml/types";
import { analyzeSkillGaps } from "./skillGapService";
import { buildMatchResult } from "./matchingService";
import { generateExplanation } from "./gemini";

export async function explainMatch(
  candidate: CandidateProfile,
  job: JobProfile
): Promise<ExplainResult> {
  const match = buildMatchResult(candidate, job);
  const gapsAnalysis = analyzeSkillGaps(candidate, job);

  const strong_matches = gapsAnalysis.matched;
  const partial_matches = gapsAnalysis.partial;
  const skill_gaps = gapsAnalysis.missing;

  const reasons: EvidenceReason[] = [];

  // 1. Required skill coverage evidence
  const matchedRequired = gapsAnalysis.requiredGaps.filter(
    (g) => g.status === "MATCHED"
  );
  const missingRequired = gapsAnalysis.requiredGaps.filter(
    (g) => g.status === "MISSING"
  );

  if (matchedRequired.length > 0) {
    reasons.push({
      category: "strength",
      title: `Strong Core Requirements Matched (${matchedRequired.length}/${job.required_skills.length})`,
      detail: `Candidate has verified proficiency in ${matchedRequired
        .map((g) => g.skill)
        .join(", ")}.`,
      evidence:
        matchedRequired
          .map((g) => `${g.skill} ("${g.evidence.slice(0, 50)}")`)
          .join(" · ") || "Explicitly present in Technical Skills section",
    });
  }

  // 2. Experience years check
  const candYears =
    candidate.totalExperienceYears ?? candidate.experience_years ?? 0;
  if (candYears >= job.experience_required) {
    reasons.push({
      category: "satisfies_requirement",
      title: "Experience Requirement Satisfied",
      detail: `${candYears} years of verified experience satisfies the ${job.experience_required}+ year requirement.`,
      evidence:
        candidate.experience
          .map(
            (e) =>
              `${e.title} at ${e.company} (${e.durationYears} yrs)`
          )
          .join("; ") || `${candYears} yrs experience verified`,
    });
  } else {
    reasons.push({
      category: "warning",
      title: "Experience Requirement Gap",
      detail: `Candidate has ${candYears} years verified experience vs ${job.experience_required} years required.`,
      evidence: `Extracted total: ${candYears} yrs`,
    });
  }

  // 3. Education credential check
  if (candidate.education.length > 0) {
    const degStr = candidate.education
      .map((e) => `${e.degree}${e.field ? ` (${e.field})` : ""}`)
      .join(", ");
    reasons.push({
      category: "satisfies_requirement",
      title: "Education Requirement Satisfied",
      detail: `Verified degree credential: ${degStr}.`,
      evidence: candidate.education[0]?.evidence || degStr,
    });
  }

  // 4. Missing mandatory required skills (e.g. AWS, Docker, Kubernetes)
  if (missingRequired.length > 0) {
    reasons.push({
      category: "missing_mandatory",
      title: `Missing Mandatory Required Skills (${missingRequired.length})`,
      detail: `${missingRequired
        .map((g) => g.skill)
        .join(
          ", "
        )} are mandatory requirements in the job description but are not present in the resume.`,
      evidence: `Not found in verified resume skills or employment records.`,
    });
  }

  // 5. Preferred skills check (e.g. TensorFlow present)
  const matchedPreferred = gapsAnalysis.preferredGaps.filter(
    (g) => g.status === "MATCHED"
  );
  const missingPreferred = gapsAnalysis.preferredGaps.filter(
    (g) => g.status === "MISSING"
  );
  if (matchedPreferred.length > 0) {
    reasons.push({
      category: "preferred_skill",
      title: "Preferred Qualifications Matched",
      detail: `${matchedPreferred
        .map((g) => g.skill)
        .join(", ")} ${
        matchedPreferred.length === 1 ? "is a" : "are"
      } preferred skill(s) explicitly present.`,
      evidence: matchedPreferred.map((g) => g.evidence).join("; "),
    });
  }
  if (missingPreferred.length > 0) {
    reasons.push({
      category: "preferred_skill",
      title: "Preferred Skills Gap",
      detail: `Nice-to-have skills not present: ${missingPreferred
        .map((g) => g.skill)
        .join(", ")}.`,
      evidence: "Preferred qualification",
    });
  }

  // Quantified achievements check
  const qCount =
    candidate.resumeQuality?.quantifiedAchievementsCount ?? 0;
  if (qCount > 0) {
    reasons.push({
      category: "strength",
      title: "Quantified Impact Metrics Verified",
      detail: `Resume demonstrates measurable impact in ${qCount} accomplishment(s).`,
      evidence:
        candidate.resumeQuality?.quantifiedAchievements
          ?.slice(0, 2)
          .join(" · ") || "Measurable outcomes documented",
    });
  }

  const sections: ExplainResult["sections"] = [
    {
      label: "STRONG MATCHES (REQUIRED)",
      items: matchedRequired.map((g) => g.skill),
      tone: "positive",
    },
    {
      label: "PREFERRED MATCHES",
      items: matchedPreferred.map((g) => g.skill),
      tone: "neutral",
    },
    {
      label: "MANDATORY SKILL GAPS",
      items: missingRequired.map((g) => g.skill),
      tone: "negative",
    },
  ];

  const summary_reason =
    missingRequired.length >= 3
      ? `${candidate.name} matches ${matchedRequired.length} core required skill(s) (${matchedRequired
          .map((g) => g.skill)
          .join(", ")}) and ${candYears} yrs experience, but misses ${
          missingRequired.length
        } mandatory infrastructure requirements (${missingRequired
          .map((g) => g.skill)
          .join(", ")}).`
      : `${candidate.name} is a ${match.overall_score}% (${match.match_tier}) match for ${job.job_title} with ${gapsAnalysis.requiredCoverageRatioText} required skills matched.`;

  let llm_explanation: string | null = null;
  let provenance: ExplainResult["provenance"] = "deterministic";
  try {
    llm_explanation = await generateExplanation({
      target_role: job.job_title,
      candidate_name: candidate.name,
      strong: matchedRequired.map((g) => g.skill),
      partial: gapsAnalysis.partial,
      gaps: missingRequired.map((g) => g.skill),
      overall: match.overall_score,
    });
    provenance = "llm_assisted";
  } catch {
    llm_explanation = summary_reason;
  }

  return {
    overall_score: match.overall_score,
    match_tier: match.match_tier,
    summary_reason,
    reasons,
    strong_matches,
    partial_matches,
    skill_gaps,
    sections,
    llm_explanation,
    provenance,
    disclaimer:
      "All match evidence is derived from extracted candidate and job data. Feature importance from the ML model is NOT causal reasoning.",
  };
}
