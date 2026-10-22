"""Deterministic feature engineering for a (candidate, job) pair."""
from __future__ import annotations
from utils.nlp import embed_text, cosine

SYNONYMS = {
    "amazon web services": "aws", "amazon aws": "aws", "k8s": "kubernetes",
    "tensor flow": "tensorflow", "ml": "machine learning",
}


def norm(s: str) -> str:
    return SYNONYMS.get(s.strip().lower(), s.strip().lower())


def jaccard(a: list, b: list) -> float:
    sa, sb = {norm(x) for x in a}, {norm(x) for x in b}
    if not sa and not sb:
        return 0.0
    inter = len(sa & sb)
    return inter / len(sa | sb)


def partial(req: str, cand: list) -> bool:
    for c in cand:
        if req in c or c in req:
            return True
        for w in req.split(" "):
            if len(w) > 2 and w in c.split(" "):
                return True
    return False


def compute_features(candidate: dict, job: dict) -> dict:
    cand_skills = list(candidate.get("technical_skills", [])) + candidate.get("skills", []) + candidate.get("certifications", [])
    cand_norm = {norm(s) for s in cand_skills}
    req = job.get("required_skills", [])
    pref = job.get("preferred_skills", [])

    matched_req, partial_req, missing_req = [], [], []
    for r in req:
        if norm(r) in cand_norm:
            matched_req.append(r)
        elif partial(norm(r), list(cand_norm)):
            partial_req.append(r)
        else:
            missing_req.append(r)
    matched_pref = [p for p in pref if norm(p) in cand_norm]
    missing_pref = [p for p in pref if norm(p) not in cand_norm]

    required_match = len(matched_req) / len(req) if req else 1.0
    preferred_match = len(matched_pref) / len(pref) if pref else 1.0
    exp_match = min(candidate.get("experience_years", 0) / max(job.get("experience_required", 1), 0.1), 1.0)

    # education
    edu_req = job.get("education_requirements", [])
    edu_match = 1.0
    if edu_req:
        deg = [d["degree"].lower() for d in candidate.get("education", [])]
        satisfied = sum(1 for r in edu_req if "any" in r or any(r.lower() in d for d in deg))
        edu_match = satisfied / len(edu_req)

    # project relevance
    job_tech = {norm(t) for t in (job.get("technologies", []) + req)}
    proj = candidate.get("projects", [])
    proj_match = 0.0
    if proj:
        hits = sum(1 for p in proj if any(norm(t) in job_tech for t in p.get("technologies", [])))
        proj_match = min(hits / len(proj), 1.0)

    # certification match
    cert_match = 0.0
    if candidate.get("certifications") and req:
        certs = {norm(c) for c in candidate["certifications"]}
        hits = sum(1 for r in req if any(norm(r) in c or c in norm(r) for c in certs))
        cert_match = min(hits / len(req), 1.0)

    cv = embed_text(" ".join(cand_skills) + " " + str(candidate.get("experience", [])))
    jv = embed_text(" ".join(req) + " " + " ".join(pref) + " " + job.get("job_title", ""))
    semantic = cosine(cv, jv)
    overlap = (len(matched_req) + len(matched_pref)) / max(len(req) + len(pref), 1)
    skill_sim = min(0.7 * overlap + 0.3 * semantic, 1.0)

    return {
        "features": {
            "semantic_similarity": round(semantic, 4),
            "skill_similarity": round(skill_sim, 4),
            "required_skill_match": round(required_match, 4),
            "preferred_skill_match": round(preferred_match, 4),
            "experience_match": round(exp_match, 4),
            "education_match": round(edu_match, 4),
            "project_relevance": round(proj_match, 4),
            "certification_match": round(cert_match, 4),
            "matched_required": matched_req,
            "partial_required": partial_req,
            "missing_required": missing_req,
            "matched_preferred": matched_pref,
            "missing_preferred": missing_pref,
        },
        "candidate_vector": cv,
        "job_vector": jv,
    }


FEATURE_ORDER = [
    "semantic_similarity", "skill_similarity", "required_skill_match",
    "preferred_skill_match", "experience_match", "education_match",
    "project_relevance", "certification_match",
]


def to_array(features: dict) -> list:
    return [features[k] for k in FEATURE_ORDER]
