"""ReqCore AI Lab — Python FastAPI backend.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from services import gemini, parser, deterministic, matching, skills, roadmap  # noqa: E402

app = FastAPI(title="ReqCore AI Lab", version="0.1.0")
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobBody(BaseModel):
    job_description: str


class ProfileBody(BaseModel):
    candidate: dict
    job: dict
    candidateId: Optional[int] = None
    jobId: Optional[int] = None


class EmbedBody(BaseModel):
    text: Optional[str] = None
    candidate: Optional[dict] = None
    job: Optional[dict] = None


@app.get("/api/health")
def health():
    return {"ok": True, "gemini_configured": gemini.configured()}


# ---- Resume / Job analysis ------------------------------------------------
@app.post("/api/resume/analyze")
async def resume_analyze(file: Optional[UploadFile] = File(None)):
    if not file:
        raise HTTPException(400, "No file uploaded (field `file`).")
    content = await file.read()
    if not content:
        raise HTTPException(400, "The uploaded file is empty.")
    text = parser.extract_file(file.filename or "", content)
    engine = "deterministic"
    profile = deterministic.deterministic_candidate(text)
    if gemini.configured():
        try:
            profile = gemini.extract_candidate(text)
            engine = "gemini"
        except Exception:
            profile = deterministic.deterministic_candidate(text)
    return {"ok": True, "profile": profile, "engine": engine, "format": "file"}


@app.post("/api/job/analyze")
def job_analyze(body: JobBody):
    if not body.job_description or not body.job_description.strip():
        raise HTTPException(400, "Empty job description.")
    engine = "deterministic"
    profile = deterministic.deterministic_job(body.job_description)
    if gemini.configured():
        try:
            profile = gemini.extract_job(body.job_description)
            engine = "gemini"
        except Exception:
            profile = deterministic.deterministic_job(body.job_description)
    return {"ok": True, "profile": profile, "engine": engine}


@app.post("/api/embedding")
def embedding(body: EmbedBody):
    from utils.nlp import embed_text, cosine
    if body.text:
        return {"ok": True, "vector": embed_text(body.text), "method": "hashed-tf"}
    if body.candidate and body.job:
        from services.features import compute_features
        fe = compute_features(body.candidate, body.job)
        return {
            "ok": True,
            "candidate_vector": fe["candidate_vector"],
            "job_vector": fe["job_vector"],
            "cosine_similarity": round(cosine(fe["candidate_vector"], fe["job_vector"]), 4),
            "method": "hashed-tf",
        }
    raise HTTPException(400, "Provide `text` or both `candidate` and `job`.")


# ---- Matching -------------------------------------------------------------
@app.post("/api/match/knn")
def match_knn(body: ProfileBody):
    m = matching.build_match(body.candidate, body.job)
    return {"ok": True, "model": "knn", "label": "Baseline Model", "result": matching.run_knn(body.candidate, body.job, m)}


@app.post("/api/match/xgboost")
def match_xgboost(body: ProfileBody):
    m = matching.build_match(body.candidate, body.job)
    return {"ok": True, "model": "xgboost", "label": "Proposed Model", "result": matching.run_xgboost(body.candidate, body.job, m)}


@app.post("/api/match/compare")
def match_compare(body: ProfileBody):
    return {"ok": True, **matching.compare(body.candidate, body.job)}


@app.post("/api/match/explain")
def match_explain(body: ProfileBody):
    m = matching.build_match(body.candidate, body.job)
    gaps = skills.analyze(body.candidate, body.job)
    explanation = None
    provenance = "deterministic"
    if gemini.configured():
        try:
            explanation = gemini.explain({
                "target_role": body.job.get("job_title", ""),
                "candidate_name": body.candidate.get("name", "Candidate"),
                "strong": gaps["matched"], "partial": gaps["partial"],
                "gaps": gaps["missing"], "overall": m["overall_score"],
            })
            provenance = "llm_assisted"
        except Exception:
            pass
    return {
        "ok": True,
        "strong_matches": gaps["matched"], "partial_matches": gaps["partial"],
        "skill_gaps": gaps["missing"], "llm_explanation": explanation,
        "provenance": provenance,
        "disclaimer": "All evidence is derived from extracted candidate and job data.",
    }


@app.post("/api/skills/gaps")
def skill_gaps(body: ProfileBody):
    return {"ok": True, **skills.analyze(body.candidate, body.job), "method": "deterministic"}


@app.post("/api/roadmap")
def roadmap_gen(body: ProfileBody):
    return {"ok": True, **roadmap.generate(body.candidate, body.job)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
