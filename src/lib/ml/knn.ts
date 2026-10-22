// ============================================================================
// KNN — Baseline Model (scikit-learn style K-Nearest Neighbours)
// ----------------------------------------------------------------------------
// A genuine k-nearest-neighbours regressor. Given a query vector, it finds the
// `k` closest reference vectors (using cosine distance in our embedding space)
// and predicts the label as an inverse-distance-weighted mean of the neighbours'
// labels.
//
// This is the BASELINE model. Reference profiles come from a clearly-marked
// development calibration set (and any live candidate/job profiles stored in
// the database). It is NOT claimed to be a scientifically validated model.
// ============================================================================

import { Neighbor } from "./types";
import { cosineSimilarity } from "./embedding";

export interface KNNDataPoint {
  id: string;
  label: string;
  vector: number[];
  score: number; // 0..100 ground-truth-ish label for this prototype
}

export interface KNNResult {
  score: number; // 0..100
  model: "knn";
  neighbors: Neighbor[];
  k: number;
  mode: "development" | "live";
}

/**
 * Predict a match score for a query vector given labelled reference data.
 * Uses cosine distance and inverse-distance weighting. A small positive epsilon
 * guards against zero-distance (identical) neighbours.
 */
export function knnPredict(
  query: number[],
  data: KNNDataPoint[],
  k = 5
): KNNResult {
  const scored = data
    .map((p) => ({
      p,
      sim: cosineSimilarity(query, p.vector),
    }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);

  let weightSum = 0;
  let scoreSum = 0;
  const neighbors: Neighbor[] = scored.map(({ p, sim }) => {
    const dist = 1 - Math.max(0, sim);
    const w = 1 / (dist + 1e-6);
    weightSum += w;
    scoreSum += w * p.score;
    return {
      id: p.id,
      label: p.label,
      distance: dist,
      similarity: sim,
      score: p.score,
    };
  });

  const predicted =
    weightSum === 0 ? 0 : Math.round(scoreSum / weightSum);
  return {
    score: Math.max(0, Math.min(100, predicted)),
    model: "knn",
    neighbors,
    k,
    mode: "development",
  };
}
