// ============================================================================
// Gemini Integration (Generative AI layer)
// ----------------------------------------------------------------------------
// Server-side only. Uses the Google Generative Language API for:
//   1. Structured resume extraction (unstructured text -> CandidateProfile JSON)
//   2. Structured job analysis (job text -> JobProfile JSON)
//   3. Explanation generation (given deterministic matching evidence)
//   4. Roadmap narrative generation
//
// Keys are read from process.env (never exposed to the browser). If no API key
// is configured, or a call fails, callers fall back to the deterministic
// extractor so the prototype still works end-to-end (Demo Mode).
// ============================================================================

const GEMINI_KEY = () => process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

export function geminiConfigured(): boolean {
  return Boolean(GEMINI_KEY());
}

const MODEL = "gemini-1.5-flash";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function generateJson(system: string, user: string): Promise<string> {
  const key = GEMINI_KEY();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

function safeParse<T>(raw: string): T {
  // strip markdown code fences if present
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

/** Structurally extract a CandidateProfile from raw resume text. */
export async function extractCandidate(
  resumeText: string
): Promise<Record<string, unknown>> {
  const system =
    "You are a structured information extraction engine. " +
    "Extract ONLY information that is explicitly present in the resume text. " +
    "Do not invent experience, skills, certifications, or achievements. " +
    "Return valid JSON matching exactly this schema: " +
    '{"name":string,"skills":string[],"technical_skills":string[],"soft_skills":string[],' +
    '"experience":[{role,company,duration,years,highlights:[]}],"experience_years":number,' +
    '"education":[{degree,institution,field,year}],"projects":[{name,description,technologies:[]}],' +
    '"certifications":string[],"achievements":string[]}. ' +
    "If a field is absent use an empty array or 0. Infer experience_years from the resume text only.";
  const raw = await generateJson(system, `Resume text:\n\n${resumeText}`);
  return safeParse<Record<string, unknown>>(raw);
}

/** Structurally extract a JobProfile from job description text. */
export async function extractJob(
  jobDescription: string
): Promise<Record<string, unknown>> {
  const system =
    "You are a structured job-requirements extraction engine. " +
    "Extract ONLY requirements explicitly present in the job description. " +
    "Clearly separate REQUIRED skills from PREFERRED skills. Return valid JSON matching: " +
    '{"job_title":string,"required_skills":string[],"preferred_skills":string[],' +
    '"experience_required":number,"education_requirements":string[],' +
    '"responsibilities":string[],"technologies":string[]}. ' +
    "If a field is absent use an empty array or 0.";
  const raw = await generateJson(system, `Job description:\n\n${jobDescription}`);
  return safeParse<Record<string, unknown>>(raw);
}

/** Generate a natural-language explanation from structured match evidence. */
export async function generateExplanation(
  evidence: {
    target_role: string;
    candidate_name: string;
    strong: string[];
    partial: string[];
    gaps: string[];
    overall: number;
  }
): Promise<string> {
  const system =
    "You are an explainability module for an AI hiring matcher. " +
    "Explain the match result using ONLY the provided evidence items. " +
    "Do NOT invent or add any skills, technologies, or experiences that are not listed. " +
    "Be concise, professional and objective. Do not overstate accuracy.";
  const user =
    `Candidate: ${evidence.candidate_name}\nTarget role: ${evidence.target_role}\n` +
    `Overall match: ${evidence.overall}%\n` +
    `STRONG MATCHES: ${evidence.strong.join(", ") || "none"}\n` +
    `PARTIAL MATCHES: ${evidence.partial.join(", ") || "none"}\n` +
    `SKILL GAPS: ${evidence.gaps.join(", ") || "none"}\n\n` +
    "Write a short, evidence-based explanation (2-4 sentences).";
  return generateJson(system, user);
}

/** Generate a roadmap narrative from deterministic gap analysis. */
export async function generateRoadmapNarrative(
  data: {
    target_role: string;
    readiness: number;
    missing: string[];
    partial: string[];
  }
): Promise<string> {
  const system =
    "You are a career-coaching module. Generate a focused career roadmap narrative " +
    "based ONLY on the provided target role, readiness score and skill gaps. " +
    "Do not invent unrelated advice. Be specific and practical.";
  const user =
    `Target role: ${data.target_role}\nReadiness: ${data.readiness}%\n` +
    `Missing skills: ${data.missing.join(", ") || "none"}\n` +
    `Partial skills: ${data.partial.join(", ") || "none"}\n\n` +
    "Provide a short roadmap summary (2-4 sentences) focused on closing these gaps.";
  return generateJson(system, user);
}
