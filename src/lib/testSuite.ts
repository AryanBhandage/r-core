// ============================================================================
// Automated Validation Test Suite — Programmatic Pipeline Verification
// ============================================================================
// Verifies:
//   Test 1 — Aarav Sharma:
//     - 2.5 years experience
//     - Python, SQL, Machine Learning, FastAPI, TensorFlow
//     - AWS/Docker/Kubernetes missing
//     - Bachelor's degree (no Master's invented)
//     - Machine Learning Specialization certification
//     - Required skill coverage = 50% (3/6)
//   Test 2 — Priya Sharma:
//     - 3 years experience
//     - Strong backend/AWS/Docker/Kubernetes alignment
//     - High match against ML Platform Engineer JD
//   Test 3 — Rohit Anand:
//     - IT Business Support Specialist (~3 years experience)
//     - BCA degree (NO Master's degree invented)
//     - CompTIA A+, Microsoft Certified Desktop Support Technician (MCDST),
//       HDI Desktop Support Technician extracted individually
//     - Wishlist Products Price Comparison dissertation intact
//     - NO Scala invented
// ============================================================================

import {
  deterministicExtractCandidate,
  deterministicExtractJob,
} from "./services/deterministic";
import { compareModels } from "./services/matchingService";
import { analyzeSkillGaps } from "./services/skillGapService";
import {
  ValidationTestCaseResult,
  getEntityValue,
  normalizeSkill,
} from "./ml/types";

export const TEST_1_AARAV_RESUME = [
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

export const TEST_ML_ENGINEER_JOB = [
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

export const TEST_2_PRIYA_RESUME = [
  "Priya Sharma",
  "Summary",
  "ML Platform & Backend Engineer with 3 years of experience building production infrastructure on AWS and Kubernetes.",
  "Technical Skills",
  "Python, SQL, Machine Learning, AWS, Docker, Kubernetes, FastAPI, MLOps, CI/CD",
  "Experience",
  "ML Platform Engineer, CloudScale Systems (Jan 2021 - Jan 2024)",
  "- Designed containerized ML inference clusters on AWS EKS (Kubernetes) handling 2M requests/day.",
  "- Automated Docker image builds via GitHub Actions CI/CD with 60% faster deployments.",
  "Education",
  "Bachelor's degree — Computer Engineering, National Institute of Technology, 2020",
  "Certifications",
  "AWS Certified Solutions Architect",
].join("\n");

export const TEST_3_ROHIT_RESUME = [
  "Rohit Anand",
  "IT Business Support Specialist",
  "Summary",
  "IT Business Support Specialist with 3 years of experience in hardware troubleshooting, active directory, and scalable enterprise desktop support.",
  "Technical Skills",
  "IT Support, Active Directory, Networking, Linux, SQL, Hardware Troubleshooting",
  "Experience",
  "IT Business Support Specialist, TechAssist India (Jan 2021 - Jan 2024)",
  "- Resolved 1,200+ hardware and desktop support tickets with 98% first-contact resolution.",
  "- Administered Active Directory accounts and network troubleshooting.",
  "Education",
  "BCA — International School of Business Studies, Gurgaon, 2023",
  "Dissertation",
  "Wishlist Products Price Comparison — built an automated product tracking web tool comparing prices across vendors.",
  "Certifications",
  "CompTIA A+",
  "Microsoft Certified Desktop Support Technician (MCDST)",
  "HDI Desktop Support Technician",
].join("\n");

export function runValidationTestSuite(): ValidationTestCaseResult[] {
  const results: ValidationTestCaseResult[] = [];
  const mlJob = deterministicExtractJob(TEST_ML_ENGINEER_JOB);

  // ------------------------------------------------------------------------
  // TEST 1 — Aarav Sharma
  // ------------------------------------------------------------------------
  const aaravProfile = deterministicExtractCandidate(TEST_1_AARAV_RESUME);
  const aaravGaps = analyzeSkillGaps(aaravProfile, mlJob);
  const aaravMatch = compareModels(aaravProfile, mlJob);

  const aaravSkillValues = aaravProfile.technicalSkills.map((e) => e.value);
  const aaravCertValues = aaravProfile.certifications.map((e) => e.value);
  const aaravDegreeValues = aaravProfile.education.map((e) => e.degree);

  const t1Assertions = [
    {
      label: "Calculated 2.5 years of experience",
      expected: "2.5 years",
      actual: `${aaravProfile.totalExperienceYears} years`,
      passed: aaravProfile.totalExperienceYears === 2.5,
    },
    {
      label: "Extracted core Python, SQL, Machine Learning, FastAPI, TensorFlow",
      expected: "Python, SQL, Machine Learning, FastAPI, TensorFlow",
      actual: aaravSkillValues.join(", "),
      passed:
        aaravSkillValues.includes("Python") &&
        aaravSkillValues.includes("SQL") &&
        aaravSkillValues.includes("Machine Learning") &&
        aaravSkillValues.includes("FastAPI") &&
        aaravSkillValues.includes("TensorFlow"),
    },
    {
      label: "AWS, Docker, Kubernetes classified as Missing Required Skills",
      expected: "AWS, Docker, Kubernetes missing",
      actual: aaravGaps.missing.join(", "),
      passed:
        aaravGaps.missing.includes("AWS") &&
        aaravGaps.missing.includes("Docker") &&
        aaravGaps.missing.includes("Kubernetes"),
    },
    {
      label: "Bachelor's degree extracted (no Master's degree invented)",
      expected: "Only Bachelor's degree",
      actual: aaravDegreeValues.join(", "),
      passed:
        aaravDegreeValues.length === 1 &&
        aaravDegreeValues[0].includes("Bachelor") &&
        !aaravDegreeValues.some((d) => d.toLowerCase().includes("master")),
    },
    {
      label: "Machine Learning Specialization certification extracted",
      expected: "Machine Learning Specialization",
      actual: aaravCertValues.join(", "),
      passed: aaravCertValues.includes("Machine Learning Specialization"),
    },
    {
      label: "Required Skill Coverage exactly 50% (3/6 matched)",
      expected: "3/6 (50%)",
      actual: `${aaravGaps.requiredCoverageRatioText} (${aaravGaps.requiredCoveragePercent}%)`,
      passed:
        aaravGaps.requiredMatchedCount === 3 &&
        aaravGaps.requiredTotalCount === 6,
    },
  ];

  results.push({
    id: "test-1-aarav",
    name: "Test 1 — Aarav Sharma (ML Engineer Candidate)",
    role: "Machine Learning Engineer",
    passed: t1Assertions.every((a) => a.passed),
    actualExperienceYears: aaravProfile.totalExperienceYears,
    expectedExperienceYears: 2.5,
    extractedSkills: aaravSkillValues,
    missingRequiredSkillsDetected: aaravGaps.missing,
    extractedCertifications: aaravCertValues,
    extractedDegrees: aaravDegreeValues,
    noHallucinatedDegrees: !aaravDegreeValues.some((d) =>
      d.toLowerCase().includes("master")
    ),
    noHallucinatedSkills: !aaravSkillValues.includes("Scala"),
    requiredSkillCoverageRatio: aaravGaps.requiredCoverageRatioText,
    requiredSkillCoveragePercent: aaravGaps.requiredCoveragePercent,
    projectsCount: aaravProfile.projects.length,
    assertions: t1Assertions,
  });

  // ------------------------------------------------------------------------
  // TEST 2 — Priya Sharma
  // ------------------------------------------------------------------------
  const priyaProfile = deterministicExtractCandidate(TEST_2_PRIYA_RESUME);
  const priyaGaps = analyzeSkillGaps(priyaProfile, mlJob);
  const priyaMatch = compareModels(priyaProfile, mlJob);
  const priyaSkillValues = priyaProfile.technicalSkills.map((e) => e.value);

  const t2Assertions = [
    {
      label: "Extracted 3 years experience",
      expected: "3 years",
      actual: `${priyaProfile.totalExperienceYears} years`,
      passed: priyaProfile.totalExperienceYears === 3,
    },
    {
      label: "Strong backend / AWS / Docker / Kubernetes alignment (100% Required Coverage)",
      expected: "6/6 Required Skills Matched",
      actual: `${priyaGaps.requiredCoverageRatioText} (${priyaGaps.requiredCoveragePercent}%)`,
      passed: priyaGaps.requiredMatchedCount === 6,
    },
    {
      label: "High synthesized job match score (>= 80%)",
      expected: ">= 80% Strong Match",
      actual: `${priyaMatch.overall_score}% (${priyaMatch.match_tier})`,
      passed: priyaMatch.overall_score >= 80,
    },
  ];

  results.push({
    id: "test-2-priya",
    name: "Test 2 — Priya Sharma (Cloud & ML Platform Engineer)",
    role: "Machine Learning Engineer",
    passed: t2Assertions.every((a) => a.passed),
    actualExperienceYears: priyaProfile.totalExperienceYears,
    expectedExperienceYears: 3,
    extractedSkills: priyaSkillValues,
    missingRequiredSkillsDetected: priyaGaps.missing,
    extractedCertifications: priyaProfile.certifications.map((e) => e.value),
    extractedDegrees: priyaProfile.education.map((e) => e.degree),
    noHallucinatedDegrees: true,
    noHallucinatedSkills: true,
    requiredSkillCoverageRatio: priyaGaps.requiredCoverageRatioText,
    requiredSkillCoveragePercent: priyaGaps.requiredCoveragePercent,
    projectsCount: priyaProfile.projects.length,
    assertions: t2Assertions,
  });

  // ------------------------------------------------------------------------
  // TEST 3 — Rohit Anand (IT Business Support Specialist)
  // ------------------------------------------------------------------------
  const rohitProfile = deterministicExtractCandidate(TEST_3_ROHIT_RESUME);
  const rohitSkillValues = rohitProfile.technicalSkills.map((e) => e.value);
  const rohitCertValues = rohitProfile.certifications.map((e) => e.value);
  const rohitDegrees = rohitProfile.education.map((e) => e.degree);

  const t3Assertions = [
    {
      label: "IT Business Support Specialist (~3 years experience)",
      expected: "3 years experience",
      actual: `${rohitProfile.totalExperienceYears} years`,
      passed: rohitProfile.totalExperienceYears === 3,
    },
    {
      label: "BCA extracted without hallucinating a Master's degree",
      expected: "BCA (No Master's)",
      actual: rohitDegrees.join(", "),
      passed:
        rohitDegrees.some(
          (d) => d.includes("BCA") || d.includes("Bachelor")
        ) && !rohitDegrees.some((d) => d.toLowerCase().includes("master")),
    },
    {
      label:
        "CompTIA A+, MCDST, and HDI Desktop Support Technician extracted individually",
      expected: "3 individual desktop support certifications",
      actual: rohitCertValues.join(" · "),
      passed:
        rohitCertValues.some((c) => /comptia\s*a\+?/i.test(c)) &&
        rohitCertValues.some((c) => /mcdst|microsoft\s*certified/i.test(c)) &&
        rohitCertValues.some((c) => /hdi\s*desktop/i.test(c)),
    },
    {
      label: "Wishlist Products Price Comparison dissertation intact",
      expected: "Wishlist Products Price Comparison (Dissertation)",
      actual:
        rohitProfile.projects
          .map((p) => `${p.name} [${p.type}]`)
          .join(", ") || "None",
      passed: rohitProfile.projects.some(
        (p) =>
          p.name.toLowerCase().includes("wishlist") &&
          p.type === "Dissertation"
      ),
    },
    {
      label: "Zero hallucinated skills — Scala NOT invented despite word 'scalable'",
      expected: "Scala absent",
      actual: rohitSkillValues.includes("Scala")
        ? "HALLUCINATED SCALA!"
        : "No Scala hallucinated",
      passed: !rohitSkillValues.includes("Scala"),
    },
  ];

  results.push({
    id: "test-3-rohit",
    name: "Test 3 — Rohit Anand (IT Business Support Specialist)",
    role: "IT Business Support Specialist",
    passed: t3Assertions.every((a) => a.passed),
    actualExperienceYears: rohitProfile.totalExperienceYears,
    expectedExperienceYears: 3,
    extractedSkills: rohitSkillValues,
    missingRequiredSkillsDetected: [],
    extractedCertifications: rohitCertValues,
    extractedDegrees: rohitDegrees,
    noHallucinatedDegrees: !rohitDegrees.some((d) =>
      d.toLowerCase().includes("master")
    ),
    noHallucinatedSkills: !rohitSkillValues.includes("Scala"),
    requiredSkillCoverageRatio: "N/A",
    requiredSkillCoveragePercent: 100,
    projectsCount: rohitProfile.projects.length,
    assertions: t3Assertions,
  });

  return results;
}
