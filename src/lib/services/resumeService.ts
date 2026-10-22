// ============================================================================
// Resume Service — Verified Canonical Profile Boundary
// ============================================================================
// The deterministic section parser is the authoritative source for candidate
// facts. A generative response without source evidence is never allowed to
// replace it. This prevents a Gemini response from inventing skills, degrees,
// projects, dates, or certifications.
// ============================================================================

import { CandidateProfile } from "@/lib/ml/types";
import { deterministicExtractCandidate } from "./deterministic";

export async function analyzeResume(text: string): Promise<{
  profile: CandidateProfile;
  engine: "deterministic";
}> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) {
    throw new Error("Empty resume text. Please upload a non-empty resume.");
  }

  // The profile has literal source evidence on every emitted entity. Gemini may
  // be added later as a candidate extractor, but its output must first pass an
  // evidence-aware adapter; it cannot bypass this canonical boundary.
  const profile = deterministicExtractCandidate(trimmed);
  return { profile, engine: "deterministic" };
}
