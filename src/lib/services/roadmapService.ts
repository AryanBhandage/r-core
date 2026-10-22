// ============================================================================
// Career Roadmap Service — Phased Learning Plan Connected to Identified Gaps
// ============================================================================
// Generates a structured multi-phase roadmap directly from identified missing
// and partial required/preferred skills. Each roadmap item explicitly cites:
//   - Phase number & Label (e.g. Phase 1 — Docker, Phase 2 — AWS)
//   - Why it matters for the target job role
//   - Practical project deliverable
//   - Connection to detected job requirement
// ============================================================================

import {
  CandidateProfile,
  JobProfile,
  RoadmapItem,
  RoadmapResult,
  SkillTier,
  normalizeSkill,
} from "@/lib/ml/types";
import { analyzeSkillGaps } from "./skillGapService";
import { buildMatchResult } from "./matchingService";
import { generateRoadmapNarrative } from "./gemini";

interface RoadmapPlanTemplate {
  why: string;
  outcome: string;
  project: string;
  duration: string;
  prerequisite: string;
}

const ROADMAP_TEMPLATES: Record<string, RoadmapPlanTemplate> = {
  docker: {
    why: "Mandatory requirement: Docker containerization is essential for reproducible model packaging and deployment.",
    outcome: "Author multi-stage Dockerfiles and package FastAPI inference endpoints with GPU/CPU support.",
    project: "Build and containerize a FastAPI ML inference service with healthchecks.",
    duration: "2 weeks",
    prerequisite: "Python & Linux command line basics",
  },
  aws: {
    why: "Mandatory requirement: AWS is the target role's cloud infrastructure for running containerized models and data pipelines.",
    outcome: "Provision ECR registries, ECS/EC2 instances, S3 storage buckets, and IAM roles.",
    project: "Deploy the containerized ML inference service to AWS ECS/EC2 behind an Application Load Balancer.",
    duration: "3 weeks",
    prerequisite: "Phase 1 (Docker containerized service)",
  },
  kubernetes: {
    why: "Mandatory requirement: Kubernetes is required to orchestrate, auto-scale, and manage containerized ML workloads in production.",
    outcome: "Write Kubernetes Deployment, Service, ConfigMap, and HorizontalPodAutoscaler manifests.",
    project: "Deploy and scale the ML inference service using Kubernetes on EKS/minikube.",
    duration: "3 weeks",
    prerequisite: "Phase 1 (Docker) & Phase 2 (AWS)",
  },
  mlops: {
    why: "Preferred qualification: MLOps turns experimental notebooks into reliable, automated, monitored production systems.",
    outcome: "Implement model registries (MLflow), data validation, and drift detection.",
    project: "Implement automated model retraining, testing, and monitoring pipelines.",
    duration: "3 weeks",
    prerequisite: "Docker, Kubernetes & ML Fundamentals",
  },
  "ci/cd": {
    why: "Preferred qualification: CI/CD automates testing and deployment on every code push.",
    outcome: "Author GitHub Actions pipelines that lint, test, build Docker images, and deploy to Kubernetes.",
    project: "Set up automated CI/CD pipeline to test, build, and deploy the ML service image.",
    duration: "2 weeks",
    prerequisite: "Git, Docker & Kubernetes",
  },
  tensorflow: {
    why: "Target role skill: Deep learning model development and serving with TensorFlow Serving.",
    outcome: "Train, export, and serve SavedModels with TF Serving endpoints.",
    project: "Train a deep neural network classifier and serve it via TensorFlow Serving.",
    duration: "3 weeks",
    prerequisite: "Python & Machine Learning",
  },
  pytorch: {
    why: "Target role skill: PyTorch model prototyping and fine-tuning transformers.",
    outcome: "Build custom PyTorch training loops and export TorchScript models.",
    project: "Fine-tune a pretrained PyTorch transformer and optimize for low-latency inference.",
    duration: "3 weeks",
    prerequisite: "Python & Machine Learning",
  },
  postgresql: {
    why: "Core requirement: Relational database architecture and query optimization.",
    outcome: "Design indexed schema and analytical queries for ML features.",
    project: "Build a feature store database layer in PostgreSQL with indexed time-series queries.",
    duration: "2 weeks",
    prerequisite: "SQL fundamentals",
  },
};

const GENERIC_TEMPLATE = (skill: string): RoadmapPlanTemplate => ({
  why: `Requirement identified in target job description: "${skill}" is currently missing from your verified profile.`,
  outcome: `Gain hands-on production competency in ${skill}.`,
  project: `Build a deployable portfolio artifact demonstrating ${skill} integrated with your ML/backend stack.`,
  duration: "2–3 weeks",
  prerequisite: "Core Python & Engineering Fundamentals",
});

export async function generateRoadmap(
  candidate: CandidateProfile,
  job: JobProfile
): Promise<RoadmapResult> {
  const match = buildMatchResult(candidate, job);
  const gapsAnalysis = analyzeSkillGaps(candidate, job);

  const missingSkills = gapsAnalysis.missing;
  const partialSkills = gapsAnalysis.partial;
  const readiness = Math.round(match.overall_score);

  // Prioritize Missing REQUIRED skills first, then Partial REQUIRED, then Missing PREFERRED
  const orderedGaps: { skill: string; tier: SkillTier; status: "MISSING" | "PARTIAL" }[] = [
    ...gapsAnalysis.requiredGaps
      .filter((g) => g.status === "MISSING")
      .map((g) => ({ skill: g.skill, tier: "REQUIRED" as SkillTier, status: "MISSING" as const })),
    ...gapsAnalysis.requiredGaps
      .filter((g) => g.status === "PARTIAL")
      .map((g) => ({ skill: g.skill, tier: "REQUIRED" as SkillTier, status: "PARTIAL" as const })),
    ...gapsAnalysis.preferredGaps
      .filter((g) => g.status === "MISSING")
      .map((g) => ({ skill: g.skill, tier: "PREFERRED" as SkillTier, status: "MISSING" as const })),
  ];

  // Specific canonical order if Docker/AWS/Kubernetes are missing so they progress logically
  const ORDER_WEIGHT: Record<string, number> = {
    docker: 1,
    aws: 2,
    kubernetes: 3,
    mlops: 4,
    "ci/cd": 5,
  };

  orderedGaps.sort((a, b) => {
    const wa = ORDER_WEIGHT[normalizeSkill(a.skill).toLowerCase()] ?? 20;
    const wb = ORDER_WEIGHT[normalizeSkill(b.skill).toLowerCase()] ?? 20;
    if (a.tier !== b.tier) return a.tier === "REQUIRED" ? -1 : 1;
    return wa - wb;
  });

  const items: RoadmapItem[] = [];
  const seen = new Set<string>();

  orderedGaps.forEach((gap, index) => {
    const key = normalizeSkill(gap.skill).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const tpl = ROADMAP_TEMPLATES[key] ?? GENERIC_TEMPLATE(gap.skill);
    const phaseNum = index + 1;

    items.push({
      phase: phaseNum,
      phaseLabel: `Phase ${phaseNum} — ${gap.skill}`,
      skill: gap.skill,
      tier: gap.tier,
      why: tpl.why,
      outcome: tpl.outcome,
      project: tpl.project,
      duration: tpl.duration,
      prerequisite: tpl.prerequisite,
      status: gap.status,
      targetJobRequirement:
        gap.tier === "REQUIRED"
          ? `Mandatory Required Skill (${gap.skill}) in ${job.job_title} JD`
          : `Preferred Qualification (${gap.skill}) in ${job.job_title} JD`,
    });
  });

  // Add Capstone integration project tying all gaps together
  if (items.length > 0) {
    const nextPhase = items.length + 1;
    items.push({
      phase: nextPhase,
      phaseLabel: `Phase ${nextPhase} — Production Capstone Project`,
      skill: "End-to-End Cloud ML Capstone",
      tier: "REQUIRED",
      why: "Integrates all resolved infrastructure gaps (Docker + AWS + Kubernetes + MLOps) into a single verifiable production system.",
      outcome: "A live, documented cloud-native ML inference cluster with CI/CD and monitoring.",
      project:
        "Containerize the Demand Forecasting ML API with Docker, deploy to AWS EKS (Kubernetes), and set up GitHub Actions CI/CD.",
      duration: "3 weeks",
      prerequisite: `Phases 1–${items.length}`,
      status: "MISSING",
      targetJobRequirement: `Full-Stack ${job.job_title} Production Readiness`,
    });
  }

  let narrative =
    gapsAnalysis.requiredGaps.filter((g) => g.status === "MISSING").length > 0
      ? `Personalized learning roadmap generated from ${gapsAnalysis.missing.length} missing skill(s). Start with Phase 1 (Docker containerization) before deploying on AWS and Kubernetes.`
      : `You satisfy all mandatory required skills for ${job.job_title}. Complete preferred qualifications to reach top-percentile readiness.`;

  let provenance: RoadmapResult["provenance"] = "deterministic";
  try {
    narrative = await generateRoadmapNarrative({
      target_role: job.job_title,
      readiness,
      missing: missingSkills,
      partial: partialSkills,
    });
    provenance = "llm_assisted";
  } catch {
    // Keep deterministic narrative
  }

  return {
    target_role: job.job_title,
    readiness,
    required_gaps_count: gapsAnalysis.requiredGaps.filter(
      (g) => g.status === "MISSING"
    ).length,
    preferred_gaps_count: gapsAnalysis.preferredGaps.filter(
      (g) => g.status === "MISSING"
    ).length,
    current_skills: gapsAnalysis.matched,
    missing_skills: missingSkills,
    partial_skills: partialSkills,
    items,
    provenance,
    disclaimer:
      "Every roadmap phase directly addresses an identified skill gap from your resume vs. the target job description.",
  };
}
