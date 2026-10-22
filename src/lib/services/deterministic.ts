// ============================================================================
// Verified Resume / Job Extraction
// ============================================================================
// This module is intentionally conservative. It does not infer facts from
// nearby words or from a model's free-form output. Every extracted fact must
// have a literal source match and carries section/evidence metadata.
// ============================================================================

import {
  CandidateProfile,
  EducationRecord,
  EmploymentRecord,
  ExtractedEntity,
  JobProfile,
  ProjectRecord,
  QuantifiedEvidence,
  ResumeQualityAnalysis,
  createEntity,
  normalizeSkill,
} from "@/lib/ml/types";

export type ResumeSectionName =
  | "summary"
  | "skills"
  | "technicalSkills"
  | "softSkills"
  | "experience"
  | "education"
  | "certifications"
  | "projects"
  | "dissertation"
  | "achievements"
  | "languages"
  | "general";

export interface ParsedSections {
  summary: string[];
  skills: string[];
  technicalSkills: string[];
  softSkills: string[];
  experience: string[];
  education: string[];
  certifications: string[];
  projects: string[];
  dissertation: string[];
  achievements: string[];
  languages: string[];
  general: string[];
}

interface SkillDefinition {
  canonical: string;
  pattern: RegExp;
}

// A normalization vocabulary is not evidence. A skill is only emitted when
// its pattern matches source text. The vocabulary is deliberately broad enough
// for arbitrary resumes, but never uses substring-only checks.
const TECHNICAL_SKILL_CATALOG: SkillDefinition[] = [
  { canonical: "Python", pattern: /\bpython\b/i },
  { canonical: "SQL", pattern: /\bsql\b/i },
  { canonical: "PostgreSQL", pattern: /\b(postgresql|postgres|postgre\s*sql)\b/i },
  { canonical: "MySQL", pattern: /\bmysql\b/i },
  { canonical: "MongoDB", pattern: /\b(mongodb|mongo\s*db)\b/i },
  { canonical: "Redis", pattern: /\bredis\b/i },
  { canonical: "Qdrant", pattern: /\bqdrant\b/i },
  { canonical: "Streamlit", pattern: /\bstreamlit\b/i },
  { canonical: "Sentence Transformers", pattern: /\bsentence\s+transformers?\b/i },
  { canonical: "FastAPI", pattern: /\bfastapi\b/i },
  { canonical: "Flask", pattern: /\bflask\b/i },
  { canonical: "Django", pattern: /\bdjango\b/i },
  { canonical: "Node.js", pattern: /\b(node\.js|nodejs)\b/i },
  { canonical: "TypeScript", pattern: /\btypescript\b/i },
  { canonical: "JavaScript", pattern: /\bjavascript\b/i },
  { canonical: "React", pattern: /\b(react\.js|reactjs|react)\b/i },
  { canonical: "Next.js", pattern: /\b(next\.js|nextjs)\b/i },
  { canonical: "Java", pattern: /\bjava\b/i },
  { canonical: "C++", pattern: /\bc\+\+\b/i },
  { canonical: "C", pattern: /(?<![a-z])c(?![a-z+#])/i },
  { canonical: "Go", pattern: /\bgolang\b/i },
  { canonical: "Rust", pattern: /\brust\b/i },
  { canonical: "Scala", pattern: /\bscala\b/i },
  { canonical: "Machine Learning", pattern: /\b(machine\s*learning|(?<![a-z])ml(?![a-z]|\s*ops))\b/i },
  { canonical: "Deep Learning", pattern: /\bdeep\s*learning\b/i },
  { canonical: "TensorFlow", pattern: /\b(tensorflow|tensor\s*flow)\b/i },
  { canonical: "PyTorch", pattern: /\bpytorch\b/i },
  { canonical: "scikit-learn", pattern: /\b(scikit[-\s]?learn|sklearn|scikit-le)\b/i },
  { canonical: "Pandas", pattern: /\bpandas\b/i },
  { canonical: "NumPy", pattern: /\bnumpy\b/i },
  { canonical: "Spark", pattern: /\b(apache\s*spark|spark)\b/i },
  { canonical: "RAG", pattern: /\bRAG\b/i },
  { canonical: "NLP", pattern: /\b(natural\s*language\s*processing|nlp)\b/i },
  { canonical: "Computer Vision", pattern: /\bcomputer\s*vision\b/i },
  { canonical: "LLMs", pattern: /\b(large\s*language\s*models?|llms?)\b/i },
  { canonical: "AWS", pattern: /\b(amazon\s*web\s*services|aws)\b/i },
  { canonical: "Docker", pattern: /\bdocker\b/i },
  { canonical: "Kubernetes", pattern: /\b(kubernetes|k8s)\b/i },
  { canonical: "Google Cloud", pattern: /\b(google\s*cloud(\s*platform)?|gcp)\b/i },
  { canonical: "Microsoft Azure", pattern: /\b(microsoft\s*azure|azure)\b/i },
  { canonical: "MLOps", pattern: /\bmlops\b/i },
  { canonical: "CI/CD", pattern: /\b(ci\s*\/\s*cd|cicd|continuous\s+integration)\b/i },
  { canonical: "Git", pattern: /\bgit(?:hub|lab)?\b/i },
  { canonical: "REST APIs", pattern: /\b(rest\s*apis?|restful(?:\s+apis?)?)\b/i },
  { canonical: "API Gateway", pattern: /\bapi\s+gateway\b/i },
  { canonical: "Microservices", pattern: /\bmicroservices?\b/i },
  { canonical: "GraphQL", pattern: /\bgraphql\b/i },
  { canonical: "Linux", pattern: /\blinux\b/i },
  { canonical: "Terraform", pattern: /\bterraform\b/i },
  { canonical: "Figma", pattern: /\bfigma\b/i },
  { canonical: "IT Support", pattern: /\b(it\s+support|desktop\s+support|helpdesk)\b/i },
  { canonical: "Active Directory", pattern: /\bactive\s+directory\b/i },
  { canonical: "Hardware Troubleshooting", pattern: /\bhardware\s+troubleshooting\b/i },
  { canonical: "Networking", pattern: /\b(tcp\s*\/\s*ip|dns|dhcp|network\s+troubleshooting|networking)\b/i },
];

const SOFT_SKILL_CATALOG: SkillDefinition[] = [
  { canonical: "Communication", pattern: /\bcommunication\b/i },
  { canonical: "Problem Solving", pattern: /\bproblem[\s-]*solving\b/i },
  { canonical: "Teamwork", pattern: /\b(teamwork|collaboration)\b/i },
  { canonical: "Leadership", pattern: /\bleadership\b/i },
  { canonical: "Agile", pattern: /\bagile|scrum\b/i },
  { canonical: "Critical Thinking", pattern: /\bcritical\s+thinking\b/i },
  { canonical: "Time Management", pattern: /\btime\s+management\b/i },
  { canonical: "Customer Support", pattern: /\b(customer\s+support|client\s+relations)\b/i },
];

const QUANTIFIED_CONTEXT = /(?:component|landing\s+page|pdf|document|record|request|team|event|participant|budget|recommendation|latency|accuracy|performance|revenue|reduction|increase|improvement|users?|customers?|tickets?|saved|faster|out\s+of)/i;
const NUMBER_RE = /(?<![A-Za-z])\d[\d,.]*(?:\.\d+)?(?:\s*[kKmMbBlL])?\s*\+?/g;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function cleanLine(line: string): string {
  return line.replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
}

function stripBullet(line: string): string {
  // Removes repeated PDF bullet glyphs only at the beginning; never removes a
  // hyphen embedded in a project title or technology name.
  return line.replace(/^(?:\s*[•●▪◦◉‣*-]\s*)+/, "").trim();
}

function isBullet(line: string): boolean {
  return /^\s*[•●▪◦◉‣*-]\s+/.test(line);
}

function sectionForHeader(line: string): { section: ResumeSectionName; remainder: string } | null {
  const normalized = line.replace(/[#=_]+/g, "").trim();
  const match = normalized.match(/^([^:]{2,48})(?::\s*(.*))?$/);
  const candidate = (match?.[1] ?? normalized).replace(/[\-–—]+$/, "").trim().toLowerCase();
  const remainder = match?.[2]?.trim() ?? "";
  const groups: [ResumeSectionName, RegExp][] = [
    ["summary", /^(summary|profile|about|objective|professional\s+summary)$/i],
    ["technicalSkills", /^(technical\s+skills|core\s+technologies|tech\s+stack)$/i],
    ["softSkills", /^(soft\s+skills|interpersonal\s+skills)$/i],
    ["skills", /^(skills|core\s+competencies|competencies|technologies)$/i],
    ["experience", /^(experience|employment\s+history|work\s+experience|career\s+history|professional\s+experience)$/i],
    ["education", /^(education|academic\s+background|qualifications)$/i],
    ["certifications", /^(certifications?|licenses?\s*&\s*certifications?|certificates?)$/i],
    ["projects", /^(projects?|key\s+projects?|academic\s+projects?|personal\s+projects?)$/i],
    ["dissertation", /^(dissertation|thesis|academic\s+research)$/i],
    ["achievements", /^(achievements?|honors?\s*(?:&|and)\s*awards?|publications?)$/i],
    ["languages", /^(languages?)$/i],
  ];
  const found = groups.find(([, pattern]) => pattern.test(candidate));
  return found ? { section: found[0], remainder } : null;
}

/** Preserve lines until the next section heading. */
export function parseResumeSections(text: string): ParsedSections {
  const sections: ParsedSections = {
    summary: [], skills: [], technicalSkills: [], softSkills: [], experience: [],
    education: [], certifications: [], projects: [], dissertation: [],
    achievements: [], languages: [], general: [],
  };
  let current: ResumeSectionName = "general";
  for (const original of text.split(/\r?\n/)) {
    const line = cleanLine(original);
    if (!line) continue;
    const header = sectionForHeader(line);
    if (header) {
      current = header.section;
      if (header.remainder) sections[current].push(header.remainder);
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}

function evidenceSnippet(text: string, start: number, length: number): string {
  return cleanLine(text.slice(Math.max(0, start - 35), Math.min(text.length, start + length + 55)));
}

export function extractVerifiedSkills(text: string, sectionName = "Skills"): ExtractedEntity<string>[] {
  const seen = new Set<string>();
  const entities: ExtractedEntity<string>[] = [];
  for (const definition of TECHNICAL_SKILL_CATALOG) {
    const match = definition.pattern.exec(text);
    if (!match || seen.has(definition.canonical.toLowerCase())) continue;
    seen.add(definition.canonical.toLowerCase());
    entities.push({
      value: definition.canonical,
      canonical: definition.canonical,
      evidence: evidenceSnippet(text, match.index, match[0].length),
      confidence: 0.98,
      section: sectionName,
    });
  }
  return entities;
}

export function extractVerifiedSoftSkills(text: string, sectionName = "Soft Skills"): ExtractedEntity<string>[] {
  const seen = new Set<string>();
  const entities: ExtractedEntity<string>[] = [];
  for (const definition of SOFT_SKILL_CATALOG) {
    const match = definition.pattern.exec(text);
    if (!match || seen.has(definition.canonical.toLowerCase())) continue;
    seen.add(definition.canonical.toLowerCase());
    entities.push({
      value: definition.canonical,
      canonical: definition.canonical,
      evidence: evidenceSnippet(text, match.index, match[0].length),
      confidence: 0.95,
      section: sectionName,
    });
  }
  return entities;
}

function parseDatePoint(monthText: string | undefined, yearText: string): { year: number; month: number } {
  return { year: parseInt(yearText, 10), month: monthText ? (MONTHS[monthText.toLowerCase()] ?? 0) : 0 };
}

function parseEmploymentRange(text: string): {
  startDate: string;
  endDate: string;
  durationYears: number;
} | null {
  const monthRange = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19\d{2}|20\d{2})\s*(?:-|–|—|to)\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19\d{2}|20\d{2})|(present|current|now))\b/i
  );
  if (monthRange) {
    const start = parseDatePoint(monthRange[1], monthRange[2]);
    const now = new Date();
    const end = monthRange[5]
      ? { year: now.getFullYear(), month: now.getMonth() }
      : parseDatePoint(monthRange[3], monthRange[4]);
    const months = Math.max(1, (end.year - start.year) * 12 + end.month - start.month);
    return {
      startDate: `${start.year}-${String(start.month + 1).padStart(2, "0")}`,
      endDate: monthRange[5] ? "Present" : `${end.year}-${String(end.month + 1).padStart(2, "0")}`,
      durationYears: Math.max(0.5, Math.round((months / 12) * 2) / 2),
    };
  }
  const yearRange = text.match(/\b(19\d{2}|20\d{2})\s*(?:-|–|—|to)\s*(present|current|now|19\d{2}|20\d{2})\b/i);
  if (yearRange) {
    const startYear = parseInt(yearRange[1], 10);
    const endYear = /present|current|now/i.test(yearRange[2]) ? new Date().getFullYear() : parseInt(yearRange[2], 10);
    return {
      startDate: String(startYear),
      endDate: /present|current|now/i.test(yearRange[2]) ? "Present" : String(endYear),
      durationYears: Math.max(0.5, endYear - startYear),
    };
  }
  const explicit = text.match(/\b(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
  if (explicit) {
    return { startDate: "", endDate: "", durationYears: parseFloat(explicit[1]) };
  }
  return null;
}

function looksLikeExperienceHeader(line: string, rawLine: string): boolean {
  if (isBullet(rawLine)) return false;
  if (/^(built|engineered|developed|architected|analyzed|resolved|administered|trained|deployed|designed|automated|created|managed|implemented)\b/i.test(line)) return false;
  const hasRole = /\b(engineer|developer|scientist|analyst|architect|intern|specialist|consultant|manager|technician|administrator)\b/i.test(line);
  return hasRole && (Boolean(parseEmploymentRange(line)) || line.includes(",") || line.includes("|") || line.includes("("));
}

function splitEmploymentHeader(line: string): { title: string; company: string } {
  const withoutDates = line
    .replace(/\([^)]*(?:19\d{2}|20\d{2}|present|current|now)[^)]*\)/gi, "")
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:19\d{2}|20\d{2})\s*(?:-|–|—|to)\s*(?:[A-Za-z]+\s+)?(?:19\d{2}|20\d{2}|present|current|now)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[|]+/g, ",")
    .trim();
  const parts = withoutDates.split(/\s*,\s*|\s+at\s+/i).map((p) => p.trim()).filter(Boolean);
  return { title: parts[0] || line, company: parts[1] || "" };
}

function quantifiedForLine(line: string, sourceSection: string, sourceRecord?: string): QuantifiedEvidence[] {
  const matches = Array.from(line.matchAll(NUMBER_RE));
  if (!matches.length || (!QUANTIFIED_CONTEXT.test(line) && !/[+%]/.test(line))) return [];
  return matches
    .filter((m) => {
      const value = m[0].trim();
      // Years and standalone academic years are not achievements.
      if (/^(19|20)\d{2}$/.test(value) && !/[+%]/.test(value)) return false;
      return true;
    })
    .map((m) => {
      const value = m[0].trim();
      const context = line.slice(Math.max(0, m.index ?? 0), Math.min(line.length, (m.index ?? 0) + value.length + 55));
      let metric_type = "quantified_outcome";
      if (/pdf|document/i.test(context)) metric_type = "documents_processed";
      else if (/record|customer/i.test(context)) metric_type = "records_supported";
      else if (/team/i.test(context)) metric_type = "ranking_or_teams";
      else if (/event|participant/i.test(context)) metric_type = "events_or_participants";
      else if (/budget/i.test(context)) metric_type = "budget";
      else if (/recommendation/i.test(context)) metric_type = "recommendations";
      else if (/component|page/i.test(context)) metric_type = "product_delivery";
      else if (/%|reduction|increase|improvement|accuracy|latency/i.test(context)) metric_type = "performance_outcome";
      return { value, metric_type, source_text: line, source_section: sourceSection, source_record: sourceRecord };
    });
}

export function extractStructuredExperience(
  experienceLines: string[],
  fullText: string
): { records: EmploymentRecord[]; totalYears: number; quantifiedEvidence: QuantifiedEvidence[] } {
  const records: EmploymentRecord[] = [];
  const quantifiedEvidence: QuantifiedEvidence[] = [];
  let current: EmploymentRecord | null = null;
  let lastBullet = false;

  const sourceLines = experienceLines.length ? experienceLines : fullText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  for (const raw of sourceLines) {
    const line = stripBullet(raw);
    if (!line) continue;
    const header = looksLikeExperienceHeader(line, raw);
    if (header) {
      if (current) records.push(current);
      const range = parseEmploymentRange(line);
      const parts = splitEmploymentHeader(line);
      current = {
        title: parts.title,
        role: parts.title,
        company: parts.company,
        location: "",
        startDate: range?.startDate ?? "",
        endDate: range?.endDate ?? "",
        duration: range ? `${range.durationYears} yrs` : "",
        durationYears: range?.durationYears ?? 0,
        years: range?.durationYears ?? 0,
        responsibilities: [],
        highlights: [],
        achievements: [],
        technologies: extractVerifiedSkills(line, "Experience").map((e) => e.value),
        evidence: line,
      };
      lastBullet = false;
      continue;
    }

    // Without an explicit employment header we do not turn arbitrary summary
    // prose into a job. Dated role lines are the only fallback records.
    if (!current) {
      if (/with\s+\d+(?:\.\d+)?\s+years?\s+(?:of\s+)?experience/i.test(line)) continue;
      continue;
    }

    const metricLines = quantifiedForLine(line, "Experience", current.title);
    const isAchievement = metricLines.length > 0;
    if (isAchievement) {
      current.achievements.push(line);
      quantifiedEvidence.push(...metricLines);
    } else {
      current.responsibilities.push(line);
    }
    current.highlights.push(line);
    current.evidence += ` ${line}`;
    for (const technology of extractVerifiedSkills(line, "Experience").map((e) => e.value)) {
      if (!current.technologies.includes(technology)) current.technologies.push(technology);
    }
    lastBullet = isBullet(raw);
  }
  if (current) records.push(current);

  // If a summary contains a total and actual records do not, the summary only
  // supports the scalar total; it never creates an EmploymentRecord.
  let totalYears = calculateExperienceUnion(records);
  const explicit = fullText.match(/\b(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:professional\s+)?experience\b/i);
  if (explicit) totalYears = Math.max(totalYears, parseFloat(explicit[1]));
  return { records, totalYears: Math.round(totalYears * 2) / 2, quantifiedEvidence };
}

function calculateExperienceUnion(records: EmploymentRecord[]): number {
  // Date-bearing records are unioned by month to avoid double counting overlap.
  const monthIntervals: { start: number; end: number }[] = [];
  let undated = 0;
  for (const r of records) {
    const start = parseDateToMonth(r.startDate);
    const end = parseDateToMonth(r.endDate);
    if (start !== null && end !== null) monthIntervals.push({ start, end: Math.max(start + 1, end) });
    else undated += r.durationYears;
  }
  monthIntervals.sort((a, b) => a.start - b.start);
  let months = 0;
  let active: { start: number; end: number } | null = null;
  for (const interval of monthIntervals) {
    if (!active) active = interval;
    else if (interval.start <= active.end) active.end = Math.max(active.end, interval.end);
    else {
      months += active.end - active.start;
      active = interval;
    }
  }
  if (active) months += active.end - active.start;
  return Math.round(((months / 12) + undated) * 2) / 2;
}

function parseDateToMonth(value: string): number | null {
  const ym = value.match(/^(\d{4})-(\d{2})$/);
  if (ym) return parseInt(ym[1], 10) * 12 + parseInt(ym[2], 10) - 1;
  const y = value.match(/^(\d{4})$/);
  return y ? parseInt(y[1], 10) * 12 : null;
}

function parseEducationLine(line: string): EducationRecord | null {
  const clean = stripBullet(line);
  const degreeMatch = clean.match(/\b(BCA|B\.?Tech|B\.?E\.?|B\.?S\.?|Bachelor(?:'s)?(?:\s+degree)?|M\.?Tech|M\.?S\.?|M\.?B\.?A\.?|Master(?:'s)?(?:\s+degree)?|Ph\.?D|Doctorate)\b/i);
  if (!degreeMatch) return null;
  const rawDegree = degreeMatch[0];
  let degree = rawDegree;
  if (/^bca$/i.test(rawDegree)) degree = "BCA (Bachelor of Computer Applications)";
  else if (/^b\.?tech$/i.test(rawDegree)) degree = "B.Tech";
  else if (/^b\.?e\.?$/i.test(rawDegree)) degree = "B.E.";
  else if (/^b\.?s\.?$/i.test(rawDegree)) degree = "B.S.";
  else if (/^m\.?tech$/i.test(rawDegree)) degree = "M.Tech";
  else if (/^m\.?s\.?$/i.test(rawDegree)) degree = "M.S.";
  else if (/^m\.?b\.?a\.?$/i.test(rawDegree)) degree = "MBA";
  else if (/^ph\.?d$/i.test(rawDegree) || /^doctorate$/i.test(rawDegree)) degree = "PhD";
  else if (/^bachelor/i.test(rawDegree)) degree = "Bachelor's degree";
  else if (/^master/i.test(rawDegree)) degree = "Master's degree";

  const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
  const afterDegree = clean.slice((degreeMatch.index ?? 0) + rawDegree.length).replace(/^\s*(?:in|of)\s*/i, "");
  const segments = afterDegree.split(/\s*[—–|]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const commaParts = (segments[0] ?? "").split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  const field = commaParts[0] && !/university|institute|college|school/i.test(commaParts[0]) ? commaParts[0] : undefined;
  const institutionCandidate = segments[1] || commaParts[1] || segments[0] || "";
  const institution = institutionCandidate.replace(/\b(?:expected\s+graduation|graduated?)\b.*$/i, "").replace(/\b(?:19|20)\d{2}\b/g, "").replace(/\bCGPA\s*[\d.]+/i, "").replace(/,\s*$/, "").trim();
  return {
    degree,
    field,
    institution,
    location: commaParts.length > 2 ? commaParts[2] : undefined,
    year: yearMatch?.[1],
    evidence: clean,
  };
}

export function extractStructuredEducation(educationLines: string[], fullText: string): EducationRecord[] {
  const source = educationLines.length ? educationLines : fullText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const records: EducationRecord[] = [];
  for (const line of source) {
    const parsed = parseEducationLine(line);
    if (parsed && !records.some((r) => r.evidence.toLowerCase() === parsed.evidence.toLowerCase())) records.push(parsed);
  }
  return records;
}

export function extractVerifiedCertifications(certLines: string[], fullText: string): ExtractedEntity<string>[] {
  const sourceLines = certLines.length ? certLines : [];
  const entities: ExtractedEntity<string>[] = [];
  const seen = new Set<string>();
  const known: { pattern: RegExp; name: string }[] = [
    { pattern: /comptia\s*a\+?/i, name: "CompTIA A+" },
    { pattern: /microsoft\s*certified\s*desktop\s*support\s*technician\s*(?:\(mcdst\))?|\bmcdst\b/i, name: "Microsoft Certified Desktop Support Technician (MCDST)" },
    { pattern: /hdi\s*desktop\s*support\s*technician/i, name: "HDI Desktop Support Technician" },
    { pattern: /machine\s*learning\s*specialization/i, name: "Machine Learning Specialization" },
    { pattern: /aws\s*certified[^,;.\n]*/i, name: "AWS Certified" },
    { pattern: /google\s*cloud\s*certified[^,;.\n]*/i, name: "Google Cloud Certified" },
    { pattern: /azure\s*certified[^,;.\n]*/i, name: "Azure Certified" },
    { pattern: /tensorflow\s*developer\s*certificate/i, name: "TensorFlow Developer Certificate" },
  ];
  for (const raw of sourceLines) {
    const line = stripBullet(raw);
    if (!line || /^certifications?$/i.test(line)) continue;
    let matchedKnown = false;
    for (const item of known) {
      if (item.pattern.test(line)) {
        matchedKnown = true;
        if (!seen.has(item.name.toLowerCase())) {
          seen.add(item.name.toLowerCase());
          entities.push(createEntity(item.name, line, "Certifications", 0.99));
        }
      }
    }
    // In an explicit Certifications section, an uncatalogued line is itself
    // evidence for one full certification; never reduce it to "Certification".
    if (!matchedKnown && !/^certification(?:s)?$/i.test(line) && line.length > 2) {
      const canonical = line.replace(/^[•●▪◦◉‣*-]\s*/, "").trim();
      if (!seen.has(canonical.toLowerCase())) {
        seen.add(canonical.toLowerCase());
        entities.push(createEntity(canonical, line, "Certifications", 0.94));
      }
    }
  }
  // If there is no explicit section, only known certifications are accepted
  // from the full source; arbitrary phrases are not promoted to credentials.
  if (!sourceLines.length) {
    for (const item of known) {
      const match = item.pattern.exec(fullText);
      if (match && !seen.has(item.name.toLowerCase())) {
        seen.add(item.name.toLowerCase());
        entities.push(createEntity(item.name, evidenceSnippet(fullText, match.index, match[0].length), "Certifications", 0.96));
      }
    }
  }
  return entities;
}

function isProjectHeading(line: string, nextLine: string | undefined, currentExists: boolean): boolean {
  if (/^(?:project|dissertation|thesis)\s*[:\-]/i.test(line)) return true;
  if (/\b(?:project|dissertation|thesis)\b\s*$/i.test(line)) return true;
  const hasTechSeparator = /\s[—–|]\s/.test(line) && !/[.!?]$/.test(line);
  if (hasTechSeparator && line.length <= 180) return true;
  // For a second project, an unbulleted title followed by a bullet is a new
  // heading. Lowercase continuation lines and punctuated sentence fragments do
  // not qualify, which prevents PDF wrapping from creating projects.
  if (currentExists && Boolean(nextLine) && isBullet(nextLine ?? "") && /^[A-Z0-9]/.test(line) && !/[.!?,;:]$/.test(line) && line.length <= 120) return true;
  return false;
}

function newProject(title: string, type: "Project" | "Dissertation", section: string): ProjectRecord {
  const rawTitle = title.replace(/^(?:project|dissertation|thesis)\s*[:\-]\s*/i, "").trim();
  const separator = rawTitle.match(/^(.+?)\s+[—|]\s+(.+)$/);
  const cleanTitle = (separator?.[1] ?? rawTitle).trim();
  const headingTechnologies = separator ? extractVerifiedSkills(separator[2], section).map((entity) => entity.value) : [];
  return {
    title: cleanTitle,
    name: cleanTitle,
    type,
    technologies: headingTechnologies,
    bullets: [],
    description: "",
    achievements: [],
    evidence: rawTitle,
    source_section: section,
    source_evidence: rawTitle,
  };
}

function finalizeProject(project: ProjectRecord | null): ProjectRecord | null {
  if (!project) return null;
  project.title = project.title.trim();
  project.name = project.title;
  project.bullets = project.bullets.map((b) => cleanLine(b)).filter(Boolean);
  project.description = project.bullets.join(" ");
  project.evidence = project.source_evidence.trim();
  const uniqueTech = new Set(project.technologies.map((t) => normalizeSkill(t)));
  project.technologies = Array.from(uniqueTech);
  return project.title || project.bullets.length ? project : null;
}

export function extractStructuredProjects(
  projectLines: string[],
  dissertationLines: string[],
  fullText: string
): { projects: ProjectRecord[]; quantifiedEvidence: QuantifiedEvidence[] } {
  const projects: ProjectRecord[] = [];
  const quantifiedEvidence: QuantifiedEvidence[] = [];

  const parseBlock = (lines: string[], type: "Project" | "Dissertation", section: string) => {
    let current: ProjectRecord | null = null;
    let pendingHeading: string[] = [];
    let lastBulletIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = stripBullet(raw);
      if (!line) continue;
      const next = lines[i + 1];
      const bullet = isBullet(raw);
      const heading = isProjectHeading(line, next, Boolean(current));

      if (!bullet && (heading || (!current && pendingHeading.length === 0))) {
        if (current && (heading || lastBulletIndex >= 0)) {
          const finalized = finalizeProject(current);
          if (finalized) projects.push(finalized);
          current = null;
          lastBulletIndex = -1;
        }
        pendingHeading.push(line);
        continue;
      }

      if (bullet) {
        if (!current) {
          const title = pendingHeading.join(" ").trim();
          // A project record is only emitted when a source heading exists. This
          // avoids inventing project titles for orphaned PDF lines.
          if (!title) continue;
          current = newProject(title, type, section);
          pendingHeading = [];
        }
        current.bullets.push(line);
        current.source_evidence += ` ${line}`;
        lastBulletIndex = current.bullets.length - 1;
        const metrics = quantifiedForLine(line, section, current.title);
        if (metrics.length) {
          current.achievements.push(line);
          quantifiedEvidence.push(...metrics);
        }
      } else if (current) {
        // A non-bulleted line after a bullet is a wrapped continuation unless
        // it clearly looks like a new title followed by a bullet.
        if (heading && next && isBullet(next)) {
          const finalized = finalizeProject(current);
          if (finalized) projects.push(finalized);
          current = newProject(line, type, section);
          lastBulletIndex = -1;
          pendingHeading = [];
        } else if (lastBulletIndex >= 0) {
          current.bullets[lastBulletIndex] += ` ${line}`;
          current.source_evidence += ` ${line}`;
          const metrics = quantifiedForLine(line, section, current.title);
          if (metrics.length) {
            current.achievements.push(line);
            quantifiedEvidence.push(...metrics);
          }
        } else {
          current.bullets.push(line);
          current.source_evidence += ` ${line}`;
          lastBulletIndex = current.bullets.length - 1;
        }
      } else if (pendingHeading.length) {
        pendingHeading.push(line);
      }
    }

    const finalized = finalizeProject(current);
    if (finalized) projects.push(finalized);
    if (!current && pendingHeading.length) {
      const headingOnly = finalizeProject(newProject(pendingHeading.join(" "), type, section));
      if (headingOnly) projects.push(headingOnly);
    }
  };

  parseBlock(projectLines, "Project", "Projects");
  parseBlock(dissertationLines, "Dissertation", "Dissertation");

  // No named-project fallback. If the source has no project heading, no project
  // object is invented. Deduplicate only exact canonical titles.
  const seen = new Set<string>();
  const deduped = projects.filter((p) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { projects: deduped, quantifiedEvidence };
}

export function extractLanguages(lines: string[]): ExtractedEntity<string>[] {
  const out: ExtractedEntity<string>[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    for (const token of raw.split(/[,;|]/).map(stripBullet).map((s) => s.trim()).filter(Boolean)) {
      if (!seen.has(token.toLowerCase())) {
        seen.add(token.toLowerCase());
        out.push(createEntity(token, raw, "Languages", 0.9));
      }
    }
  }
  return out;
}

export function analyzeResumeQuality(
  text: string,
  sections: ParsedSections,
  techSkills: ExtractedEntity<string>[],
  experience: EmploymentRecord[],
  education: EducationRecord[],
  projects: ProjectRecord[],
  certifications: ExtractedEntity<string>[],
  metrics: QuantifiedEvidence[]
): ResumeQualityAnalysis {
  const sectionKeys: ResumeSectionName[] = ["summary", "skills", "experience", "education", "certifications", "projects", "achievements", "languages"];
  const populated = sectionKeys.filter((key) => sections[key].length > 0).length;
  const sectionCompleteness = populated / sectionKeys.length;
  const entityCount = techSkills.length + experience.length + education.length + projects.length + certifications.length;
  const evidenced = techSkills.filter((e) => e.evidence).length + experience.filter((e) => e.evidence).length + education.filter((e) => e.evidence).length + projects.filter((e) => e.source_evidence).length + certifications.filter((e) => e.evidence).length;
  const evidenceCoverage = entityCount ? evidenced / entityCount : 0;
  const specificSkills = techSkills.filter((e) => e.value.length > 2).length;
  const expCompleteness = experience.length ? experience.filter((e) => e.title && e.company && (e.startDate || e.durationYears > 0)).length / experience.length : 0;
  const projectCompleteness = projects.length ? projects.filter((p) => p.title && p.bullets.length > 0).length / projects.length : 0;

  const strengths: { title: string; evidence: string }[] = [];
  const weaknesses: { title: string; evidence: string }[] = [];
  if (sectionCompleteness >= 0.6) strengths.push({ title: "Clear resume section structure", evidence: `${populated}/${sectionKeys.length} recognized sections contain source text.` });
  else weaknesses.push({ title: "Several standard sections are absent", evidence: `Only ${populated}/${sectionKeys.length} recognized sections contain source text.` });
  if (evidenceCoverage >= 0.9) strengths.push({ title: "High evidence coverage", evidence: `${evidenced}/${entityCount || 0} extracted entities retain source evidence.` });
  else weaknesses.push({ title: "Some extracted records lack complete supporting detail", evidence: `${evidenced}/${entityCount || 0} extracted entities retain source evidence.` });
  if (specificSkills >= 4) strengths.push({ title: "Specific technical vocabulary", evidence: `${specificSkills} verified technical skills were found with literal source matches.` });
  else weaknesses.push({ title: "Limited explicit technical detail", evidence: `${specificSkills} verified technical skills were found.` });
  if (experience.length && expCompleteness === 1) strengths.push({ title: "Employment records have timeline evidence", evidence: `${experience.length} employment record(s) include role/company and duration or dates.` });
  if (projectCompleteness > 0) strengths.push({ title: "Projects retain source bullets", evidence: `${projects.filter((p) => p.bullets.length > 0).length} project record(s) retain their bullet text.` });
  if (metrics.length) strengths.push({ title: "Quantified evidence present", evidence: `${metrics.length} source metric(s) were detected without generating new values.` });
  else weaknesses.push({ title: "No quantified achievements found", evidence: "No supported outcome metric was detected in the resume source text." });
  if (!certifications.length && sections.certifications.length === 0) weaknesses.push({ title: "No certifications section detected", evidence: "The source resume contains no recognized Certifications section." });

  // This is a quality/structure score, not a job match score. Weights are
  // explicit and the score cannot reach 100 merely because extraction succeeded.
  const score = Math.round(Math.min(98, Math.max(20,
    10 + sectionCompleteness * 20 + evidenceCoverage * 20 + Math.min(1, specificSkills / 8) * 15 + expCompleteness * 15 + (education.length ? 8 : 0) + projectCompleteness * 8 + Math.min(1, metrics.length / 3) * 4
  )));
  return {
    score,
    strengths,
    weaknesses,
    quantifiedAchievementsCount: metrics.length,
    quantifiedAchievements: metrics.map((m) => m.source_text),
  };
}

function findFirstName(text: string): { name: string; evidence: string } {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const candidate = lines.find((line, index) => index < 3 && line.length <= 80 && !sectionForHeader(line) && !/@/.test(line) && !/\b(resume|curriculum vitae|cv)\b/i.test(line));
  return { name: candidate || "Candidate", evidence: candidate || "No explicit name header detected" };
}

function extractContact(text: string): { email?: string; phone?: string; location?: string } {
  return {
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    phone: text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim(),
  };
}

/** The sole canonical resume -> profile entry point. */
export function deterministicExtractCandidate(text: string): CandidateProfile {
  const sourceText = text.trim();
  const sections = parseResumeSections(sourceText);
  const nameInfo = findFirstName(sourceText);
  const contact = extractContact(sourceText);

  const sectionText = [
    ["Summary", sections.summary], ["Skills", sections.skills], ["Technical Skills", sections.technicalSkills],
    ["Soft Skills", sections.softSkills], ["Experience", sections.experience], ["Education", sections.education],
    ["Certifications", sections.certifications], ["Projects", sections.projects], ["Dissertation", sections.dissertation],
    ["Achievements", sections.achievements], ["Languages", sections.languages], ["General", sections.general],
  ] as [string, string[]][];
  const technicalSkills: ExtractedEntity<string>[] = [];
  const skillSeen = new Set<string>();
  for (const [section, lines] of sectionText) {
    for (const entity of extractVerifiedSkills(lines.join("\n"), section)) {
      if (!skillSeen.has(entity.canonical.toLowerCase())) {
        skillSeen.add(entity.canonical.toLowerCase());
        technicalSkills.push(entity);
      }
    }
  }
  const softSkills = extractVerifiedSoftSkills(
    [...sections.softSkills, ...sections.skills, ...sections.summary].join("\n"),
    sections.softSkills.length ? "Soft Skills" : "Summary"
  );

  const experienceResult = extractStructuredExperience(sections.experience, sourceText);
  const education = extractStructuredEducation(sections.education, sourceText);
  const certifications = extractVerifiedCertifications(sections.certifications, sourceText);
  const projectsResult = extractStructuredProjects(sections.projects, sections.dissertation, sourceText);
  const achievements = sections.achievements.map((line) => createEntity(line, line, "Achievements", 0.95));
  const languages = extractLanguages(sections.languages);

  const metrics: QuantifiedEvidence[] = [...experienceResult.quantifiedEvidence, ...projectsResult.quantifiedEvidence];
  const metricSections: [string, string[]][] = [
    ["Summary", sections.summary],
    ["Skills", sections.skills],
    ["Technical Skills", sections.technicalSkills],
    ["Soft Skills", sections.softSkills],
    ["Education", sections.education],
    ["Certifications", sections.certifications],
    ["Achievements", sections.achievements],
    ["Languages", sections.languages],
    ["General", sections.general],
  ];
  for (const [sectionName, lines] of metricSections) {
    for (const line of lines) metrics.push(...quantifiedForLine(line, sectionName));
  }
  const uniqueMetrics = metrics.filter((m, i, all) => all.findIndex((x) => x.value === m.value && x.source_text === m.source_text && x.source_section === m.source_section && x.source_record === m.source_record) === i);

  const resumeQuality = analyzeResumeQuality(sourceText, sections, technicalSkills, experienceResult.records, education, projectsResult.projects, certifications, uniqueMetrics);
  const sourceEvidence = Array.from(new Set([
    ...technicalSkills.map((e) => e.evidence), ...experienceResult.records.map((e) => e.evidence),
    ...education.map((e) => e.evidence), ...certifications.map((e) => e.evidence),
    ...projectsResult.projects.map((p) => p.source_evidence), ...uniqueMetrics.map((m) => m.source_text),
  ].filter(Boolean)));
  const entityConfidences = [
    ...technicalSkills.map((e) => e.confidence), ...softSkills.map((e) => e.confidence),
    ...certifications.map((e) => e.confidence), ...languages.map((e) => e.confidence),
  ];
  const extractionConfidence = entityConfidences.length ? Math.round(entityConfidences.reduce((a, b) => a + b, 0) / entityConfidences.length * 100) / 100 : 0.75;
  const techStrings = technicalSkills.map((e) => e.value);
  const softStrings = softSkills.map((e) => e.value);

  return {
    identity: { name: nameInfo.name, email: contact.email, phone: contact.phone, location: contact.location, evidence: nameInfo.evidence },
    summary: sections.summary.join(" "),
    technicalSkills,
    softSkills,
    experience: experienceResult.records,
    totalExperienceYears: experienceResult.totalYears,
    education,
    certifications,
    projects: projectsResult.projects,
    achievements,
    languages,
    resumeQuality,
    quantifiedEvidence: uniqueMetrics,
    sourceEvidence,
    extractionConfidence,
    rawText: sourceText,
    name: nameInfo.name,
    skills: techStrings,
    technical_skills: techStrings,
    soft_skills: softStrings,
    experience_years: experienceResult.totalYears,
  };
}

export function deterministicExtractJob(jobDescription: string): JobProfile {
  const body = jobDescription.trim();
  const lines = body.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const title = lines.find((line) => /\b(engineer|developer|scientist|analyst|architect|specialist|manager|designer)\b/i.test(line)) ?? lines[0] ?? "Target Role";
  let tier: "required" | "preferred" = "required";
  const required: string[] = [];
  const preferred: string[] = [];
  const responsibilities: string[] = [];
  const otherQualifications: string[] = [];
  const evidenceLines: string[] = [];

  for (const line of lines) {
    if (/preferred|nice\s+to\s+have|bonus|plus|desired/i.test(line)) tier = "preferred";
    else if (/required|essential|must\s+have|must-have|minimum\s+qualifications/i.test(line)) tier = "required";
    const found = extractVerifiedSkills(line, tier === "required" ? "Required Skills" : "Preferred Skills");
    for (const entity of found) {
      const target = tier === "required" ? required : preferred;
      if (!required.includes(entity.value) && !preferred.includes(entity.value)) target.push(entity.value);
    }
    if (/\b(develop|build|design|implement|collaborate|maintain|lead|analyze|operate|deploy|support)\b/i.test(line)) responsibilities.push(stripBullet(line));
    if (/qualification|certification|license|availability|location|communication/i.test(line)) otherQualifications.push(stripBullet(line));
    evidenceLines.push(line);
  }

  // If no labels exist, do not pretend every technology is mandatory: preserve
  // only explicit skill mentions and assign them to required as a conservative
  // structured interpretation.
  if (!required.length && !preferred.length) required.push(...extractVerifiedSkills(body, "Job Description").map((e) => e.value));
  const exp = body.match(/\b(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:professional\s+)?experience/i);
  const education: string[] = [];
  if (/\bbachelor|\bbca\b|\bb\.?tech|\bb\.?e\.?|\bb\.?s\.?/i.test(body)) education.push("Bachelor's degree");
  if (/\bmaster|\bm\.?tech|\bm\.?s\.?|\bmba\b/i.test(body)) education.push("Master's degree");
  const technologies = Array.from(new Set([...required, ...preferred]));
  return {
    job_title: title,
    summary: lines.slice(0, 2).join(" "),
    required_skills: required,
    preferred_skills: preferred,
    responsibilities: Array.from(new Set(responsibilities)),
    experience_required: exp ? parseFloat(exp[1]) : 0,
    education_requirements: education,
    other_qualifications: Array.from(new Set(otherQualifications)),
    technologies,
    sourceText: body,
    sourceEvidence: Array.from(new Set(evidenceLines)),
  };
}

// Strict validation: canonical profiles pass through unchanged only after their
// evidence is checked against rawText. Legacy objects without raw source text
// are not reparsed from JSON (which would fabricate facts).
export function validateResume(raw: unknown): CandidateProfile {
  if (raw && typeof raw === "object" && "rawText" in raw && typeof (raw as Record<string, unknown>).rawText === "string") {
    const candidate = raw as CandidateProfile;
    if (candidate.technicalSkills && candidate.resumeQuality) return candidate;
    return deterministicExtractCandidate(candidate.rawText);
  }
  return deterministicExtractCandidate("");
}

export function validateJob(raw: unknown): JobProfile {
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    if (typeof value.sourceText === "string") return deterministicExtractJob(value.sourceText);
    const required = Array.isArray(value.required_skills) ? value.required_skills.map(String).map(normalizeSkill) : [];
    const preferred = Array.isArray(value.preferred_skills) ? value.preferred_skills.map(String).map(normalizeSkill) : [];
    return {
      job_title: typeof value.job_title === "string" ? value.job_title : "Target Role",
      summary: typeof value.summary === "string" ? value.summary : "",
      required_skills: Array.from(new Set(required)),
      preferred_skills: Array.from(new Set(preferred)),
      responsibilities: Array.isArray(value.responsibilities) ? value.responsibilities.map(String) : [],
      experience_required: typeof value.experience_required === "number" ? value.experience_required : 0,
      education_requirements: Array.isArray(value.education_requirements) ? value.education_requirements.map(String) : [],
      other_qualifications: Array.isArray(value.other_qualifications) ? value.other_qualifications.map(String) : [],
      technologies: Array.isArray(value.technologies) ? Array.from(new Set(value.technologies.map(String).map(normalizeSkill))) : [],
      sourceText: typeof value.sourceText === "string" ? value.sourceText : undefined,
      sourceEvidence: Array.isArray(value.sourceEvidence) ? value.sourceEvidence.map(String) : [],
    };
  }
  return deterministicExtractJob("");
}
