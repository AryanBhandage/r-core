"""Career roadmap generation from actual skill gaps."""
from __future__ import annotations
from services.matching import build_match
from services.skills import analyze

TEMPLATES = {
    "aws": ("AWS is a core requirement and the foundation of cloud deployment.",
            "Deploy containerised ML services on EC2/ECS with S3/Lambda.",
            "Deploy a FastAPI model as a serverless function with API Gateway.",
            "4-6 weeks", "Linux and Python"),
    "docker": ("Docker is essential for reproducible model packaging.",
               "Author multi-stage Dockerfiles and run images with volumes.",
               "Containerise the inference service with a healthcheck.",
               "2-3 weeks", "Linux basics"),
    "kubernetes": ("Kubernetes orchestrates and scales containerised ML workloads.",
                   "Deploy services using Deployments, Services and Ingress.",
                   "Run the inference API on a local cluster with autoscaling.",
                   "4-6 weeks", "Docker"),
    "mlops": ("MLOps turns experimental models into monitored production systems.",
              "Build a training/CI pipeline with experiment tracking and registry.",
              "Create a CI/CD pipeline that retrains and redeploys the model.",
              "6 weeks", "Docker, CI/CD, Kubernetes"),
    "tensorflow": ("TensorFlow is the deep-learning framework used by this role.",
                   "Train, evaluate and export Keras models with TF Serving.",
                   "Train an image classifier and serve with TensorFlow Serving.",
                   "4 weeks", "Python and Machine Learning"),
    "pytorch": ("PyTorch is used for custom model development.",
                "Build and fine-tune models with the PyTorch training loop.",
                "Fine-tune a pretrained transformer for classification.",
                "4 weeks", "Python and Machine Learning"),
    "ci/cd": ("CI/CD automates testing and deployment.",
              "Write pipelines that run tests and deploy artifacts.",
              "Set up GitHub Actions to test and build the model image.",
              "2 weeks", "Git and Docker"),
    "deep learning": ("Deep learning powers the neural architectures this role builds.",
                      "Design, train and regularise neural networks.",
                      "Train a CNN or transformer and report metrics.",
                      "6 weeks", "Machine Learning and Python"),
    "nlp": ("NLP techniques are central to the role's models.",
            "Build text classification and embeddings pipelines.",
            "Deploy a named-entity-recognition service.",
            "5 weeks", "Machine Learning and Python"),
}
GENERIC = ("This skill is explicitly required and is currently missing.",
           "Demonstrate working proficiency with a deliverable.",
           "Build a small portfolio project applying this skill end-to-end.",
           "3-5 weeks", "Python fundamentals")


def generate(candidate: dict, job: dict) -> dict:
    match = build_match(candidate, job)
    gaps = analyze(candidate, job)
    readiness = round(match["overall_score"])
    missing, partial = gaps["missing"], gaps["partial"]

    ordered = [s for s in missing if any(r.lower() == s.lower() for r in job.get("required_skills", []))]
    ordered += partial
    ordered += [s for s in missing if s not in ordered]

    items, seen = [], set()
    for skill in ordered:
        key = skill.lower()
        if key in seen:
            continue
        seen.add(key)
        why, outcome, project, dur, prereq = TEMPLATES.get(key, GENERIC)
        items.append({
            "skill": skill, "why": why, "outcome": outcome, "project": project,
            "duration": dur, "prerequisite": prereq,
            "status": "PARTIAL" if skill in partial else "MISSING",
        })
    if items and not any(i["skill"].lower() == "capstone" for i in items):
        items.append({
            "skill": "Capstone Project",
            "why": "A capstone ties every gap into a portfolio piece proving job-readiness.",
            "outcome": "A deployable, documented system combining cloud, containers and ML.",
            "project": "Build and deploy a production-grade ML service with monitoring and CI/CD.",
            "duration": "6-8 weeks", "prerequisite": "All preceding roadmap items",
            "status": "MISSING",
        })

    return {
        "target_role": job.get("job_title", "Target Role"),
        "readiness": readiness,
        "current_skills": gaps["matched"],
        "missing_skills": missing,
        "partial_skills": partial,
        "items": items,
        "provenance": "deterministic",
        "disclaimer": "Roadmap generated from the candidate's actual skill gaps.",
    }
