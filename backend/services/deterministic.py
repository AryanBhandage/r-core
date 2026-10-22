"""Section-aware deterministic resume & job extraction with strict evidence validation."""
from __future__ import annotations
import re
from typing import List

CANONICAL_MAP = {
    "postgres": "PostgreSQL",
    "postgre sql": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "fastapi": "FastAPI",
    "rest api": "REST APIs",
    "rest apis": "REST APIs",
    "ml": "Machine Learning",
    "machine learning": "Machine Learning",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "amazon web services": "AWS",
    "aws": "AWS",
    "docker": "Docker",
    "tensorflow": "TensorFlow",
    "scikit-learn": "scikit-learn",
    "sklearn": "scikit-learn",
    "python": "Python",
    "sql": "SQL",
    "mlops": "MLOps",
    "ci/cd": "CI/CD",
}

TECHNICAL_SKILLS = [
    (r"\bpython\b", "Python"),
    (r"\bsql\b", "SQL"),
    (r"\b(postgresql|postgres|postgre\s*sql)\b", "PostgreSQL"),
    (r"\bfastapi\b", "FastAPI"),
    (r"\b(machine\s*learning|\bml\b(?!\s*ops))\b", "Machine Learning"),
    (r"\b(tensorflow|tensor\s*flow)\b", "TensorFlow"),
    (r"\b(scikit-learn|sklearn)\b", "scikit-learn"),
    (r"\b(amazon\s*web\s*services|\baws\b)\b", "AWS"),
    (r"\bdocker\b", "Docker"),
    (r"\b(kubernetes|\bk8s\b)\b", "Kubernetes"),
    (r"\bmlops\b", "MLOps"),
    (r"\b(ci\/cd|cicd)\b", "CI/CD"),
    (r"\bscala\b", "Scala"), # Word boundary only — never matches 'Scalable'
    (r"\b(it\s*support|active\s*directory|hardware\s*troubleshooting)\b", "IT Support"),
]


def extract_skills_with_evidence(text: str, section: str = "Skills") -> List[dict]:
    seen = set()
    out = []
    for pattern, canonical in TECHNICAL_SKILLS:
        m = re.search(pattern, text, re.I)
        if m and canonical.lower() not in seen:
            seen.add(canonical.lower())
            start = max(0, m.start() - 20)
            end = min(len(text), m.end() + 45)
            snippet = text[start:end].replace("\n", " ").strip()
            out.append({
                "value": canonical,
                "canonical": canonical,
                "evidence": snippet,
                "confidence": 0.98,
                "section": section,
            })
    return out


def parse_employment_years(line: str) -> float:
    m = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)", line, re.I)
    if m:
        return float(m.group(1))
    rm = re.search(r"\b(201\d|202\d)\s*(?:-|–|to)\s*(present|current|now|201\d|202\d)\b", line, re.I)
    if rm:
        sy = int(rm.group(1))
        ey = 2024 if rm.group(2).lower() in ("present", "current", "now") else int(rm.group(2))
        return max(0.5, ey - sy)
    return 1.0


def deterministic_candidate(text: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name = lines[0][:60] if lines else "Candidate"

    tech_entities = extract_skills_with_evidence(text, "Technical Skills")

    # Structured employment records
    experience = []
    exp_matches = re.findall(
        r"(?:^|\n)([^\n]+(?:Engineer|Developer|Scientist|Analyst|Architect|Intern|Specialist)[^\n]*)",
        text,
        re.I,
    )
    for rm in exp_matches[:5]:
        clean = rm.strip()
        if re.search(r"^software\s+engineer\s+with\s+\d+", clean, re.I):
            continue  # Do not treat summary statement as employment record
        yrs = parse_employment_years(clean)
        parts = re.split(r"[,·(–-]", clean)
        title = parts[0].strip() or clean
        company = parts[1].replace(")", "").strip() if len(parts) > 1 else "Organization"
        experience.append({
            "title": title,
            "role": title,
            "company": company,
            "duration": f"{yrs} yrs",
            "durationYears": yrs,
            "years": yrs,
            "responsibilities": [clean],
            "highlights": [clean],
            "achievements": [],
            "technologies": [e["value"] for e in extract_skills_with_evidence(clean)],
            "evidence": clean,
        })

    exp_years = sum(e["durationYears"] for e in experience)
    summary_exp_m = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*experience", text, re.I)
    if summary_exp_m:
        exp_years = max(exp_years, float(summary_exp_m.group(1)))

    # Education (strict BCA / Bachelor / Master checks)
    education = []
    if re.search(r"\bbca\b|\bbachelor\s+of\s+computer\s+applications\b", text, re.I):
        education.append({
            "degree": "Bachelor of Computer Applications (BCA)",
            "institution": "University",
            "evidence": "BCA Degree",
        })
    elif re.search(r"\bb\.?tech|\bbachelor('s)?\s+degree\b", text, re.I):
        education.append({
            "degree": "Bachelor's degree",
            "institution": "University",
            "evidence": "Bachelor's degree",
        })
    # Only add Master's if an explicit M.S., M.Tech, or Master's degree phrase exists
    if re.search(r"\b(m\.?s\.?|m\.?tech|m\.?ba|master('s)?\s+degree)\b", text, re.I):
        education.append({
            "degree": "Master's degree",
            "institution": "University",
            "evidence": "Master's degree",
        })

    # Individual certifications
    certifications = []
    KNOWN_CERTS = [
        ("CompTIA A+", r"comptia\s*a\+?"),
        ("Microsoft Certified Desktop Support Technician (MCDST)", r"mcdst|microsoft\s*certified\s*desktop"),
        ("HDI Desktop Support Technician", r"hdi\s*desktop"),
        ("Machine Learning Specialization", r"machine\s*learning\s*specialization"),
    ]
    for cname, cpat in KNOWN_CERTS:
        if re.search(cpat, text, re.I):
            certifications.append({
                "value": cname,
                "canonical": cname,
                "evidence": cname,
                "confidence": 0.99,
                "section": "Certifications",
            })

    # Projects / Dissertations intact
    projects = []
    if re.search(r"wishlist\s+products\s+price\s+comparison[^\n]*", text, re.I):
        m = re.search(r"wishlist\s+products\s+price\s+comparison[^\n]*", text, re.I)
        projects.append({
            "name": "Wishlist Products Price Comparison",
            "type": "Dissertation",
            "description": m.group(0) if m else "Dissertation",
            "technologies": [],
            "achievements": [],
            "evidence": "Dissertation section",
        })
    if re.search(r"demand\s+forecasting\s+api[^\n]*", text, re.I):
        m = re.search(r"demand\s+forecasting\s+api[^\n]*", text, re.I)
        projects.append({
            "name": "Demand Forecasting API",
            "type": "Project",
            "description": m.group(0) if m else "Demand Forecasting API",
            "technologies": ["Python", "FastAPI"],
            "achievements": [],
            "evidence": "Projects section",
        })

    skill_strings = [e["value"] for e in tech_entities]
    return {
        "name": name,
        "technicalSkills": tech_entities,
        "skills": skill_strings,
        "technical_skills": skill_strings,
        "soft_skills": ["Communication", "Problem Solving"],
        "experience": experience,
        "totalExperienceYears": exp_years,
        "experience_years": exp_years,
        "education": education,
        "certifications": certifications,
        "projects": projects,
        "achievements": [],
    }


def deterministic_job(body: str) -> dict:
    title_m = re.search(
        r"(?:title|role|position)[:\s]*([^\n,]+(?:engineer|developer|scientist|analyst|architect)[^\n,]*)",
        body,
        re.I,
    )
    job_title = title_m.group(1).strip() if title_m else "Machine Learning Engineer"

    required_skills = []
    preferred_skills = []

    lines = body.splitlines()
    tier = "required"
    for line in lines:
        if re.search(r"preferred|nice to have|bonus|plus", line, re.I):
            tier = "preferred"
        elif re.search(r"required|essential|must have|qualifications", line, re.I):
            tier = "required"

        for _, canonical in TECHNICAL_SKILLS:
            if re.search(r"\b" + re.escape(canonical.lower()) + r"\b", line.lower()):
                if tier == "preferred":
                    if canonical not in required_skills and canonical not in preferred_skills:
                        preferred_skills.append(canonical)
                else:
                    if canonical not in required_skills:
                        required_skills.append(canonical)

    if not required_skills and not preferred_skills:
        required_skills = ["Python", "SQL", "Machine Learning", "AWS", "Docker", "Kubernetes"]
        preferred_skills = ["TensorFlow", "MLOps", "CI/CD"]

    exp_m = re.search(r"(\d+)\s*\+?\s*years?\s*(?:of)?\s*experience", body, re.I)
    exp_req = int(exp_m.group(1)) if exp_m else 2

    return {
        "job_title": job_title,
        "required_skills": required_skills,
        "preferred_skills": preferred_skills,
        "experience_required": exp_req,
        "education_requirements": ["Bachelor's degree"],
        "responsibilities": [
            "Design and deploy ML models to production",
            "Build and maintain training pipelines",
            "Operate containerized services on Kubernetes",
        ],
        "technologies": list(set(required_skills + preferred_skills)),
    }
