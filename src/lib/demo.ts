// ============================================================================
// Demo Dataset & Verified Candidate/Job Profiles
// ============================================================================

import {
  deterministicExtractCandidate,
  deterministicExtractJob,
} from "@/lib/services/deterministic";

export const DEMO_CANDIDATE_TEXT = [
  "Aarav Sharma",
  "Summary",
  "Machine Learning Engineer with 2.5 years of experience in data engineering and deployment.",
  "Technical Skills",
  "Python, SQL, Machine Learning, FastAPI, TensorFlow",
  "Soft Skills",
  "Communication, Problem Solving, Teamwork",
  "Experience",
  "Data Engineer, Nova Analytics (Jan 2022 - Jun 2023)",
  "- Built ETL pipelines in Python processing 50K daily requests.",
  "- Engineered SQL reporting dashboards with 40% latency reduction.",
  "ML Engineer Intern, Lumen Labs (Jul 2023 - Jun 2024)",
  "- Trained classification models with TensorFlow achieving 92% accuracy.",
  "- Deployed FastAPI inference service.",
  "Education",
  "Bachelor's degree — Computer Science, State University, 2022",
  "Projects",
  "Demand Forecasting API — time-series forecasting with gradient boosting and FastAPI",
  "Certifications",
  "Machine Learning Specialization",
].join("\n");

export const DEMO_JOB_TEXT = [
  "Machine Learning Engineer",
  "Responsibilities",
  "Design and deploy ML models to production. Build and maintain training pipelines.",
  "Collaborate with data scientists on feature engineering. Operate containerized services on Kubernetes.",
  "Required skills",
  "Python, SQL, Machine Learning, AWS, Docker, Kubernetes (must have)",
  "Preferred skills",
  "TensorFlow, MLOps, CI/CD (nice to have)",
  "Qualifications",
  "Bachelor's degree. 2+ years of experience.",
].join("\n");

export const DEMO_CANDIDATE = deterministicExtractCandidate(DEMO_CANDIDATE_TEXT);
export const DEMO_JOB = deterministicExtractJob(DEMO_JOB_TEXT);
