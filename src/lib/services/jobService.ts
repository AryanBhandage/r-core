// ============================================================================
// Job Service — Verified Structured Job Profile
// ============================================================================

import { JobProfile } from "@/lib/ml/types";
import { deterministicExtractJob } from "./deterministic";

export async function analyzeJob(jobDescription: string): Promise<{
  profile: JobProfile;
  engine: "deterministic";
}> {
  const trimmed = jobDescription?.trim() ?? "";
  if (!trimmed) {
    throw new Error("Empty job description. Please enter a non-empty description.");
  }
  // Retain sourceText/sourceEvidence so explainability and semantic inspection
  // can cite the same verified JD that was matched.
  return { profile: deterministicExtractJob(trimmed), engine: "deterministic" };
}
