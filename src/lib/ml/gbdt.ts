// ============================================================================
// Gradient Boosted Decision Trees — "Proposed Model" (XGBoost-style)
// ----------------------------------------------------------------------------
// A from-scratch, real gradient-boosting regressor implemented in TypeScript so
// the prototype ships a genuine ML model that runs anywhere. It is a simplified
// analogue of XGBoost: an ensemble of shallow regression trees fit to the
// negative gradient (residuals) of a squared-error loss, with shrinkage.
//
// IMPORTANT RESEARCH CAVEAT:
// The model is trained on a small, clearly-labelled DEVELOPMENT CALIBRATION
// set because no real labelled candidate/job dataset is available. This is a
// demo/dev-mode model. It is NOT a scientifically validated model and we do
// NOT claim accuracy. Feature importance reflects gain inside these trees and
// is NOT causal reasoning.
//
// A real labelled dataset can be supplied later via `train()` and the model
// re-fitted end-to-end (see README).
// ============================================================================

import { FEATURE_NAMES } from "./featureEngineering";
import { FeatureImportance } from "./types";

interface TreeNode {
  feature: number;
  threshold: number;
  left: TreeNode | null;
  right: TreeNode | null;
  value: number;
}

export interface GBDTModel {
  trees: TreeNode[];
  learningRate: number;
  basePrediction: number;
  nFeatures: number;
  featureImportance: number[];
}

function fitTree(
  X: number[][],
  y: number[],
  maxDepth: number,
  minLeaf = 1
): TreeNode {
  const n = X.length;
  const nFeat = X[0].length;

  if (maxDepth === 0 || n <= minLeaf) {
    return {
      feature: -1,
      threshold: 0,
      left: null,
      right: null,
      value: y.reduce((a, b) => a + b, 0) / n,
    };
  }

  const parentVar = variance(y);
  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeft: number[] = [];
  let bestRight: number[] = [];

  for (let f = 0; f < nFeat; f++) {
    // sort indices by feature value for efficient split search
    const idx = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => X[a][f] - X[b][f]
    );
    for (let s = 1; s < n; s++) {
      const l = idx.slice(0, s);
      const r = idx.slice(s);
      if (l.length < minLeaf || r.length < minLeaf) continue;
      const yl = l.map((i) => y[i]);
      const yr = r.map((i) => y[i]);
      const gain =
        parentVar -
        (l.length / n) * variance(yl) -
        (r.length / n) * variance(yr);
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = (X[idx[s - 1]][f] + X[idx[s]][f]) / 2;
        bestLeft = l;
        bestRight = r;
      }
    }
  }

  if (bestFeature === -1) {
    return {
      feature: -1,
      threshold: 0,
      left: null,
      right: null,
      value: y.reduce((a, b) => a + b, 0) / n,
    };
  }

  return {
    feature: bestFeature,
    threshold: bestThreshold,
    left: fitTree(
      bestLeft.map((i) => X[i]),
      bestLeft.map((i) => y[i]),
      maxDepth - 1,
      minLeaf
    ),
    right: fitTree(
      bestRight.map((i) => X[i]),
      bestRight.map((i) => y[i]),
      maxDepth - 1,
      minLeaf
    ),
    value: 0,
  };
}

function variance(x: number[]): number {
  if (x.length === 0) return 0;
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  return x.reduce((a, b) => a + (b - m) * (b - m), 0) / x.length;
}

function predictTree(t: TreeNode | null, x: number[]): number {
  if (!t) return 0;
  if (t.feature === -1) return t.value;
  if (x[t.feature] <= t.threshold) return predictTree(t.left, x);
  return predictTree(t.right, x);
}

/** Trains a gradient-boosted regressor on labelled data. */
export function trainGBDT(
  X: number[][],
  y: number[],
  opts: { nTrees: number; learningRate: number; maxDepth: number; minLeaf: number } = {
    nTrees: 40,
    learningRate: 0.1,
    maxDepth: 3,
    minLeaf: 2,
  }
): GBDTModel {
  const n = X.length;
  const basePrediction = y.reduce((a, b) => a + b, 0) / n;
  let F = new Array(n).fill(basePrediction);
  const trees: TreeNode[] = [];
  const featureImportance = new Array(X[0].length).fill(0);

  for (let m = 0; m < opts.nTrees; m++) {
    // residuals = negative gradient of squared error
    const residuals = y.map((yi, i) => yi - F[i]);
    const tree = fitTree(X, residuals, opts.maxDepth, opts.minLeaf);
    trees.push(tree);
    collectImportance(tree, featureImportance, n, X.length);
    for (let i = 0; i < n; i++) {
      F[i] += opts.learningRate * predictTree(tree, X[i]);
    }
  }

  return {
    trees,
    learningRate: opts.learningRate,
    basePrediction,
    nFeatures: X[0].length,
    featureImportance,
  };
}

function collectImportance(
  node: TreeNode,
  importance: number[],
  parentN: number,
  totalN: number
): void {
  if (node.feature === -1) return;
  // gain-based importance (proportional to node sample share)
  const gain = parentN / totalN;
  importance[node.feature] += gain;
  // recursively gather; note left/right children sample counts approximated
  if (node.left) collectImportance(node.left, importance, parentN / 2, totalN);
  if (node.right)
    collectImportance(node.right, importance, parentN / 2, totalN);
}

export function predictGBDT(model: GBDTModel, x: number[]): number {
  let pred = model.basePrediction;
  for (const tree of model.trees) {
    pred += model.learningRate * predictTree(tree, x);
  }
  return pred;
}

export function normalizeImportance(imp: number[]): FeatureImportance[] {
  const sum = imp.reduce((a, b) => a + b, 0);
  const descriptions: Record<string, string> = {
    "Semantic Similarity":
      "Model split gain contributed by cosine similarity of embeddings (not candidate score).",
    "Skill Similarity":
      "Model split gain contributed by skill overlap (not candidate score).",
    "Required Skill Coverage":
      "Model split gain contributed by mandatory skill coverage (not candidate score).",
    "Preferred Skill Coverage":
      "Model split gain contributed by nice-to-have skill coverage (not candidate score).",
    "Experience Match":
      "Model split gain contributed by employment duration (not candidate score).",
    "Education Match":
      "Model split gain contributed by degree requirement (not candidate score).",
    "Project Relevance":
      "Model split gain contributed by project stack alignment (not candidate score).",
    "Certification Match":
      "Model split gain contributed by certifications (not candidate score).",
  };
  if (sum === 0) {
    return FEATURE_NAMES.map((feature) => ({
      feature,
      importance: 1 / FEATURE_NAMES.length,
      description: descriptions[feature] ?? "Tree split importance",
    }));
  }
  return imp.map((v, i) => ({
    feature: FEATURE_NAMES[i],
    importance: v / sum,
    description: descriptions[FEATURE_NAMES[i]] ?? "Tree split importance",
  }));
}
