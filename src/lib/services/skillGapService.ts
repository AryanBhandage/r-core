// ============================================================================
// Skill Gap Service — Distinct Required vs Preferred Tier Analysis
// ============================================================================
// Classifies every job requirement into:
//   REQUIRED:
//     - MATCHED — REQUIRED
//     - PARTIAL — REQUIRED
//     - MISSING — REQUIRED
//   PREFERRED:
//     - MATCHED — PREFERRED
//     - PARTIAL — PREFERRED
//     - MISSING — PREFERRED
// Uses canonical skill normalization and explicit candidate evidence snippets.
// ============================================================================

import {
  CandidateProfile,
  JobProfile,
  SkillGap,
  SkillStatus,
  SkillTier,
  getEntityValue,
  normalizeSkill,
} from "@/lib/ml/types";
import { cosineSimilarity, embedText } from "@/lib/ml/embedding";

function classifySkillMatch(
  candNormMap: Map<string, string>,
  skill: string
): {
  status: SkillStatus;
  matchType: "EXACT" | "ALIAS" | "RELATED" | "MISSING";
  semanticSimilarity?: number;
  evidence: string;
  candidateMatchText?: string;
} {
  const sn = normalizeSkill(skill);

  // Exact canonical match
  if (candNormMap.has(sn)) {
    const originalText = candNormMap.get(sn) ?? skill;
    return {
      status: "MATCHED",
      matchType: originalText.toLowerCase().includes(skill.toLowerCase()) ? "EXACT" : "ALIAS",
      semanticSimilarity: cosineSimilarity(embedText(skill), embedText(originalText)),
      evidence: `Verified ${originalText.toLowerCase().includes(skill.toLowerCase()) ? "exact" : "canonical alias"} match: "${skill}" extracted in candidate profile`,
      candidateMatchText: originalText,
    };
  }

  // Partial match: word overlap or substring overlap
  const targetWords = new Set(sn.split(/\s+/));
  for (const [candNorm, originalText] of candNormMap.entries()) {
    if (sn.includes(candNorm) || candNorm.includes(sn)) {
      return {
        status: "PARTIAL",
        matchType: "RELATED",
        evidence: `Related evidence: "${skill}" overlaps candidate skill "${originalText}"; this is not an exact explicit match`,
        candidateMatchText: originalText,
      };
    }
    const cWords = new Set(candNorm.split(/\s+/));
    let shared = 0;
    for (const w of targetWords) {
      if (w.length > 2 && cWords.has(w)) shared++;
    }
    if (shared >= 1 && targetWords.size <= 2) {
      return {
        status: "PARTIAL",
        matchType: "RELATED",
        evidence: `Related evidence: "${skill}" overlaps candidate skill "${originalText}"; this is not an exact explicit match`,
        candidateMatchText: originalText,
      };
    }
  }

  return {
    status: "MISSING",
    matchType: "MISSING",
    evidence: `Missing skill: "${skill}" has no supporting evidence in the resume`,
  };
}

export function analyzeSkillGaps(
  candidate: CandidateProfile,
  job: JobProfile
): {
  gaps: SkillGap[];
  requiredGaps: SkillGap[];
  preferredGaps: SkillGap[];
  matched: string[];
  partial: string[];
  missing: string[];
  requiredMatchedCount: number;
  requiredTotalCount: number;
  requiredCoverageRatioText: string;
  requiredCoveragePercent: number;
  preferredMatchedCount: number;
  preferredTotalCount: number;
  preferredCoverageRatioText: string;
  preferredCoveragePercent: number;
  coverage: number;
} {
  // Collect candidate skills with original text reference
  const candNormMap = new Map<string, string>();

  const techEntities = candidate.technicalSkills ?? [];
  for (const e of techEntities) {
    candNormMap.set(normalizeSkill(e.value), e.evidence || e.value);
  }
  for (const sk of candidate.skills ?? []) {
    candNormMap.set(normalizeSkill(sk), sk);
  }
  for (const cert of candidate.certifications ?? []) {
    const val = getEntityValue(cert);
    candNormMap.set(normalizeSkill(val), val);
  }

  const gaps: SkillGap[] = [];
  const requiredGaps: SkillGap[] = [];
  const preferredGaps: SkillGap[] = [];

  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];

  const pushGap = (skill: string, tier: SkillTier) => {
    const { status, matchType, semanticSimilarity, evidence, candidateMatchText } = classifySkillMatch(
      candNormMap,
      skill
    );
    const item: SkillGap = {
      skill,
      canonical: normalizeSkill(skill),
      tier,
      required: tier === "REQUIRED",
      status,
      matchType,
      semanticSimilarity,
      evidence,
      candidateMatchText,
    };
    gaps.push(item);
    if (tier === "REQUIRED") requiredGaps.push(item);
    else preferredGaps.push(item);

    if (status === "MATCHED") matched.push(skill);
    else if (status === "PARTIAL") partial.push(skill);
    else missing.push(skill);
  };

  for (const s of job.required_skills) pushGap(s, "REQUIRED");
  for (const s of job.preferred_skills) pushGap(s, "PREFERRED");

  const requiredMatchedCount = requiredGaps.filter(
    (g) => g.status === "MATCHED"
  ).length;
  const requiredTotalCount = job.required_skills.length;
  const requiredCoveragePercent =
    requiredTotalCount === 0
      ? 100
      : Math.round((requiredMatchedCount / requiredTotalCount) * 100);
  const requiredCoverageRatioText = `${requiredMatchedCount}/${requiredTotalCount}`;

  const preferredMatchedCount = preferredGaps.filter(
    (g) => g.status === "MATCHED"
  ).length;
  const preferredTotalCount = job.preferred_skills.length;
  const preferredCoveragePercent =
    preferredTotalCount === 0
      ? 100
      : Math.round((preferredMatchedCount / preferredTotalCount) * 100);
  const preferredCoverageRatioText = `${preferredMatchedCount}/${preferredTotalCount}`;

  const total = requiredTotalCount + preferredTotalCount;
  const coverage =
    total === 0 ? 1 : (requiredMatchedCount + preferredMatchedCount) / total;

  return {
    gaps,
    requiredGaps,
    preferredGaps,
    matched,
    partial,
    missing,
    requiredMatchedCount,
    requiredTotalCount,
    requiredCoverageRatioText,
    requiredCoveragePercent,
    preferredMatchedCount,
    preferredTotalCount,
    preferredCoverageRatioText,
    preferredCoveragePercent,
    coverage,
  };
}
