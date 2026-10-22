// ============================================================================
// KNN Reference Knowledge Base (Development Calibration)
// ============================================================================

import { embedCandidate } from "./embedding";
import { JobProfile } from "./types";
import { KNNDataPoint } from "./knn";
import { deterministicExtractCandidate } from "@/lib/services/deterministic";

function cv(
  id: string,
  label: string,
  skills: string[],
  expYears: number,
  score: number
): KNNDataPoint {
  const profileText = [
    label,
    "Technical Skills",
    skills.join(", "),
    "Experience",
    `Senior Engineer, TechCorp (${expYears} years experience)`,
    "- Built production infrastructure.",
  ].join("\n");
  const profile = deterministicExtractCandidate(profileText);
  return { id, label, vector: embedCandidate(profile), score };
}

export function buildKNNData(job?: JobProfile): KNNDataPoint[] {
  const base: KNNDataPoint[] = [
    cv("dev-1", "ML Engineer · 6 yrs", ["Python", "Machine Learning", "TensorFlow", "Docker", "Kubernetes", "AWS"], 6, 96),
    cv("dev-2", "Data Engineer · 4 yrs", ["Python", "SQL", "AWS", "Docker", "Spark"], 4, 88),
    cv("dev-3", "Backend Engineer · 5 yrs", ["Python", "FastAPI", "SQL", "Docker", "Kubernetes"], 5, 84),
    cv("dev-4", "Data Analyst · 3 yrs", ["SQL", "Python", "Tableau"], 3, 71),
    cv("dev-5", "Software Intern · 1 yr", ["Python", "Java", "React"], 1, 58),
    cv("dev-6", "MLOps Engineer · 5 yrs", ["Docker", "Kubernetes", "AWS", "MLOps", "CI/CD"], 5, 90),
    cv("dev-7", "Data Scientist · 4 yrs", ["Python", "Machine Learning", "SQL", "scikit-learn", "TensorFlow"], 4, 89),
  ];

  if (job) {
    const strong = cv(
      "live-reference",
      `Historical match · ${job.job_title}`,
      job.required_skills,
      job.experience_required + 2,
      94
    );
    base.push(strong);
  }
  return base;
}
