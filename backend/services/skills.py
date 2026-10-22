"""Deterministic skill-gap analysis."""
from __future__ import annotations
from services.features import norm


def _classify(cand_norm: set, skill: str) -> tuple:
    sn = norm(skill)
    if sn in cand_norm:
        return "MATCHED", f'Exact match: "{skill}"'
    for c in cand_norm:
        for w in sn.split(" "):
            if len(w) > 2 and w in c.split(" "):
                return "PARTIAL", f'Overlaps candidate skill "{c}"'
    return "MISSING", f'"{skill}" not present'


def analyze(candidate: dict, job: dict) -> dict:
    cand = set(norm(s) for s in (
        candidate.get("technical_skills", []) + candidate.get("skills", []) + candidate.get("certifications", [])
    ))
    gaps, matched, partial, missing = [], [], [], []
    for skill in job.get("required_skills", []):
        status, evidence = _classify(cand, skill)
        gaps.append({"skill": skill, "required": True, "status": status, "evidence": evidence})
        (matched if status == "MATCHED" else partial if status == "PARTIAL" else missing).append(skill)
    for skill in job.get("preferred_skills", []):
        status, evidence = _classify(cand, skill)
        gaps.append({"skill": skill, "required": False, "status": status, "evidence": evidence})
        (matched if status == "MATCHED" else partial if status == "PARTIAL" else missing).append(skill)
    total = len(job.get("required_skills", [])) + len(job.get("preferred_skills", []))
    coverage = (len(matched) / total) if total else 0.0
    return {"gaps": gaps, "matched": matched, "partial": partial, "missing": missing, "coverage": coverage}
