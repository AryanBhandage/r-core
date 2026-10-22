"""Gemini (Generative AI) integration. Keys read from env; graceful fallback."""
from __future__ import annotations
import os
import json

MODEL = "gemini-1.5-flash"


def configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))


def _generate_json(system: str, user: str) -> dict:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not configured")
    import urllib.request

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    cleaned = text.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


def extract_candidate(resume_text: str) -> dict:
    system = (
        "You are a structured extraction engine. Extract ONLY info present in the text. "
        'Return JSON: {"name":str,"skills":[],"technical_skills":[],"soft_skills":[],'
        '"experience":[{role,company,duration,years,highlights:[]}],"experience_years":0,'
        '"education":[{degree,institution,field,year}],"projects":[{name,description,technologies:[]}],'
        '"certifications":[],"achievements":[]}. Use empty arrays/0 when absent.'
    )
    return _generate_json(system, f"Resume text:\n\n{resume_text}")


def extract_job(job_description: str) -> dict:
    system = (
        "You are a structured job-requirements extractor. Extract ONLY explicit requirements. "
        'Return JSON: {"job_title":str,"required_skills":[],"preferred_skills":[],'
        '"experience_required":0,"education_requirements":[],"responsibilities":[],"technologies":[]}.'
    )
    return _generate_json(system, f"Job description:\n\n{job_description}")


def explain(evidence: dict) -> str:
    system = (
        "You are an explainability module. Explain using ONLY the provided evidence. "
        "Do not invent skills. Be concise and objective."
    )
    user = (
        f"Candidate: {evidence['candidate_name']}\nRole: {evidence['target_role']}\n"
        f"Overall: {evidence['overall']}%\nStrong: {evidence['strong']}\n"
        f"Partial: {evidence['partial']}\nGaps: {evidence['gaps']}\nWrite 2-4 sentences."
    )
    return _generate_json(system, user).get("explanation", "") or _generate_json(system, user).get("text", "")


def roadmap_narrative(data: dict) -> str:
    system = (
        "You are a career coach. Generate a focused roadmap narrative based ONLY on the provided "
        "target role, readiness and skill gaps. Be specific."
    )
    user = (
        f"Target role: {data['target_role']}\nReadiness: {data['readiness']}%\n"
        f"Missing: {data['missing']}\nPartial: {data['partial']}\nWrite 2-4 sentences."
    )
    return _generate_json(system, user).get("text", "") or _generate_json(system, user).get("explanation", "")
