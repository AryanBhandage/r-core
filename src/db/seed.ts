import { db } from "./index";
import {
  users,
  companies,
  company_members,
  candidate_profiles,
  jobs,
  applications,
  application_status_history,
  interviews,
  activity_history,
} from "./schema";
import { hashPassword } from "../lib/passwords";
import { candidateRowToProfile, jobRowToProfile } from "../lib/services/portalProfile";
import { buildMatchResult } from "../lib/services/matchingService";

/** Compute a real match score using the production matching engine. */
function scoreFor(candidate: any, job: any): number {
  try {
    return buildMatchResult(candidateRowToProfile(candidate), jobRowToProfile(job)).overall_score;
  } catch {
    return 0;
  }
}

const slug = (title: string, suffix: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${suffix}`;

async function seed() {
  await db.delete(application_status_history);
  await db.delete(interviews);
  await db.delete(applications);
  await db.delete(activity_history);
  await db.delete(jobs);
  await db.delete(company_members);
  await db.delete(candidate_profiles);
  await db.delete(companies);
  await db.delete(users);

  // ------------------------------------------------------------------ users
  const [recruiter] = await db
    .insert(users)
    .values({
      role: "COMPANY",
      email: "recruiter@acme.test",
      name: "Sarah Chen",
      passwordHash: hashPassword("demo1234"),
    })
    .returning();

  const [candidateUser] = await db
    .insert(users)
    .values({
      role: "CANDIDATE",
      email: "aarav@demo.test",
      name: "Aarav Sharma",
      passwordHash: hashPassword("demo1234"),
    })
    .returning();

  const [recruiterB] = await db
    .insert(users)
    .values({
      role: "COMPANY",
      email: "recruiter@nova.test",
      name: "Dev Patel",
      passwordHash: hashPassword("demo1234"),
    })
    .returning();

  const [recruiterC] = await db
    .insert(users)
    .values({
      role: "COMPANY",
      email: "nina@northstar.test",
      name: "Nina Rodriguez",
      passwordHash: hashPassword("demo1234"),
    })
    .returning();

  const [recruiterD] = await db
    .insert(users)
    .values({
      role: "COMPANY",
      email: "alex@orbit.test",
      name: "Alex Morgan",
      passwordHash: hashPassword("demo1234"),
    })
    .returning();

  // -------------------------------------------------------------- companies
  const [acme] = await db
    .insert(companies)
    .values({ userId: recruiter.id, name: "Acme Hiring", location: "San Francisco, CA" })
    .returning();

  const [nova] = await db
    .insert(companies)
    .values({ userId: recruiterB.id, name: "Nova Systems", location: "Berlin, DE" })
    .returning();

  const [northstar] = await db
    .insert(companies)
    .values({ userId: recruiterC.id, name: "Northstar Labs", location: "New York, NY" })
    .returning();

  const [orbit] = await db
    .insert(companies)
    .values({ userId: recruiterD.id, name: "OrbitAI", location: "Austin, TX" })
    .returning();

  await db.insert(company_members).values([
    { companyId: acme.id, userId: recruiter.id, memberRole: "OWNER" },
    { companyId: nova.id, userId: recruiterB.id, memberRole: "OWNER" },
    { companyId: northstar.id, userId: recruiterC.id, memberRole: "OWNER" },
    { companyId: orbit.id, userId: recruiterD.id, memberRole: "OWNER" },
  ]);

  // ------------------------------------------------------------- candidates
  const [aarav] = await db
    .insert(candidate_profiles)
    .values({
      userId: candidateUser.id,
      name: "Aarav Sharma",
      email: "aarav@demo.test",
      title: "Machine Learning Engineer",
      location: "San Francisco, CA",
      experience_years: 3,
      resume_quality: 82,
      profile_data: {
        technical_skills: ["Python", "SQL", "Machine Learning", "FastAPI", "TensorFlow", "Docker", "AWS"],
        soft_skills: ["Communication", "Mentoring", "Problem Solving"],
        education: [{ degree: "Bachelor's degree", field: "Computer Science", institution: "State University", year: "2022" }],
        experience: [
          {
            title: "Machine Learning Engineer",
            company: "Northstar Labs",
            location: "San Francisco, CA",
            startDate: "2023-01",
            endDate: "Present",
            durationYears: 2,
            description: "Built recommendation and forecasting models with Python, SQL, and feature pipelines; deployed services in Docker and AWS."
          },
          {
            title: "Data Analyst",
            company: "Signal Forge",
            location: "Remote",
            startDate: "2022-01",
            endDate: "2022-12",
            durationYears: 1,
            description: "Created dashboards and validated model performance for customer growth and retention." 
          }
        ],
        rawText: `Aarav Sharma\nMachine Learning Engineer\nSan Francisco, CA | aarav@demo.test | +1 (415) 555-0137\n\nSUMMARY\nMachine Learning Engineer with 3 years of experience designing predictive models, production ML APIs, and data pipelines for product and growth teams.\n\nSKILLS\nPython, SQL, Machine Learning, FastAPI, TensorFlow, Docker, AWS, Model Deployment, Feature Engineering\n\nEXPERIENCE\nMachine Learning Engineer | Northstar Labs | 2023 - Present\n- Built recommendation and forecasting systems using Python and SQL to improve customer retention.\n- Containerized ML services with Docker and deployed to AWS.\n- Partnered with product teams to validate ML experiments and monitor model quality.\n\nData Analyst | Signal Forge | 2022 - 2022\n- Built dashboards and performed A/B analysis for acquisition funnels and churn.\n- Automated data quality checks with SQL and Python workflows.\n\nEDUCATION\nB.S. in Computer Science | State University | 2022`,
        resume: {
          filename: "aarav-sharma-resume.txt",
          text: `Aarav Sharma\nMachine Learning Engineer\nSan Francisco, CA | aarav@demo.test | +1 (415) 555-0137\n\nSUMMARY\nMachine Learning Engineer with 3 years of experience designing predictive models, production ML APIs, and data pipelines for product and growth teams.\n\nSKILLS\nPython, SQL, Machine Learning, FastAPI, TensorFlow, Docker, AWS, Model Deployment, Feature Engineering\n\nEXPERIENCE\nMachine Learning Engineer | Northstar Labs | 2023 - Present\n- Built recommendation and forecasting systems using Python and SQL to improve customer retention.\n- Containerized ML services with Docker and deployed to AWS.\n- Partnered with product teams to validate ML experiments and monitor model quality.\n\nData Analyst | Signal Forge | 2022 - 2022\n- Built dashboards and performed A/B analysis for acquisition funnels and churn.\n- Automated data quality checks with SQL and Python workflows.\n\nEDUCATION\nB.S. in Computer Science | State University | 2022`,
          uploadedAt: new Date().toISOString(),
          quality: 88,
        },
      },
    })
    .returning();

  const [priya] = await db
    .insert(candidate_profiles)
    .values({
      name: "Priya Sharma",
      email: "priya@example.com",
      title: "ML Platform Engineer",
      location: "Remote",
      experience_years: 4,
      resume_quality: 91,
      profile_data: {
        technical_skills: ["Python", "AWS", "Kubernetes", "Docker", "CI/CD"],
        education: [{ degree: "Bachelor's degree", field: "Computer Engineering", institution: "NIT" }],
      },
    })
    .returning();

  const [rohit] = await db
    .insert(candidate_profiles)
    .values({
      name: "Rohit Anand",
      email: "rohit@example.com",
      title: "IT Business Support",
      location: "Gurgaon",
      experience_years: 3,
      resume_quality: 48,
      profile_data: {
        technical_skills: ["IT Support", "Active Directory", "Hardware Troubleshooting"],
        education: [{ degree: "BCA", institution: "ISBS Gurgaon", year: "2023" }],
      },
    })
    .returning();

  const [maya] = await db
    .insert(candidate_profiles)
    .values({
      name: "Maya Patel",
      email: "maya@demo.test",
      title: "Senior Product Analyst",
      location: "Seattle, WA",
      experience_years: 5,
      resume_quality: 90,
      profile_data: {
        technical_skills: ["SQL", "Python", "Tableau", "Statistics", "Experiment Design"],
        education: [{ degree: "Master's degree", field: "Analytics", institution: "University of Washington", year: "2021" }],
        resume: {
          filename: "maya-patel-resume.txt",
          text: "Maya Patel\nSenior Product Analyst\nSeattle, WA\n\nSkills: SQL, Python, Tableau, Experiment Design\n\nExperience: Senior Product Analyst at Helio Labs...",
          uploadedAt: new Date().toISOString(),
          quality: 90,
        },
      },
    })
    .returning();

  const [daniel] = await db
    .insert(candidate_profiles)
    .values({
      name: "Daniel Brooks",
      email: "daniel@demo.test",
      title: "Frontend Engineer",
      location: "Chicago, IL",
      experience_years: 4,
      resume_quality: 85,
      profile_data: {
        technical_skills: ["React", "TypeScript", "Next.js", "CSS", "Accessibility"],
        education: [{ degree: "Bachelor's degree", field: "Computer Science", institution: "University of Illinois", year: "2020" }],
        resume: {
          filename: "daniel-brooks-resume.txt",
          text: "Daniel Brooks\nFrontend Engineer\nChicago, IL\n\nSkills: React, TypeScript, Next.js, CSS\n\nExperience: Frontend Engineer at Bluebird Studio...",
          uploadedAt: new Date().toISOString(),
          quality: 85,
        },
      },
    })
    .returning();

  const [sofia] = await db
    .insert(candidate_profiles)
    .values({
      name: "Sofia Nguyen",
      email: "sofia@demo.test",
      title: "Data Engineer",
      location: "Austin, TX",
      experience_years: 6,
      resume_quality: 92,
      profile_data: {
        technical_skills: ["Python", "Spark", "Airflow", "Kafka", "Terraform"],
        education: [{ degree: "Master's degree", field: "Data Engineering", institution: "UT Austin", year: "2019" }],
        resume: {
          filename: "sofia-nguyen-resume.txt",
          text: "Sofia Nguyen\nData Engineer\nAustin, TX\n\nSkills: Python, Spark, Airflow, Kafka, Terraform\n\nExperience: Data Engineer at Cloudline...",
          uploadedAt: new Date().toISOString(),
          quality: 92,
        },
      },
    })
    .returning();

  // ------------------------------------------------------------------- jobs
  const [job1] = await db
    .insert(jobs)
    .values({
      companyId: acme.id,
      title: "Senior Machine Learning Engineer",
      slug: slug("Senior Machine Learning Engineer", "acme"),
      department: "AI Infrastructure",
      location: "San Francisco, CA / Remote",
      employment_type: "Full-time",
      salary_range: "$150k - $190k",
      status: "OPEN",
      required_skills: ["Python", "SQL", "Machine Learning", "AWS", "Docker", "Kubernetes"],
      preferred_skills: ["TensorFlow", "MLOps", "CI/CD"],
      experience_required: 2,
      profile_data: {
        description: "Design and deploy ML models to production at scale.",
        responsibilities: "Build training pipelines. Operate containerized services on Kubernetes.",
      },
    })
    .returning();

  const [job2] = await db
    .insert(jobs)
    .values({
      companyId: acme.id,
      title: "Lead AI Research Scientist",
      slug: slug("Lead AI Research Scientist", "acme"),
      department: "Core Research",
      location: "New York, NY",
      employment_type: "Full-time",
      salary_range: "$180k - $240k",
      status: "OPEN",
      required_skills: ["Python", "PyTorch", "Deep Learning", "NLP"],
      preferred_skills: ["LLMs", "C++"],
      experience_required: 5,
      profile_data: { description: "Lead research on applied language models." },
    })
    .returning();

  const [job3] = await db
    .insert(jobs)
    .values({
      companyId: acme.id,
      title: "Data Engineer",
      slug: slug("Data Engineer", "acme"),
      department: "Data Platform",
      location: "Remote",
      employment_type: "Full-time",
      salary_range: "$130k - $160k",
      status: "CLOSED",
      required_skills: ["Python", "SQL", "Spark", "AWS"],
      preferred_skills: ["Airflow", "Terraform"],
      experience_required: 3,
      profile_data: { description: "Own our batch and streaming data platform." },
    })
    .returning();

  const [job4] = await db
    .insert(jobs)
    .values({
      companyId: northstar.id,
      title: "Senior Data Engineer",
      slug: slug("Senior Data Engineer", "northstar"),
      department: "Data Platform",
      location: "New York, NY",
      employment_type: "Full-time",
      salary_range: "$170k - $210k",
      status: "OPEN",
      required_skills: ["Python", "SQL", "Spark", "Airflow", "AWS"],
      preferred_skills: ["Terraform", "Kafka"],
      experience_required: 4,
      profile_data: { description: "Build scalable data ingestion and warehouse systems." },
    })
    .returning();

  const [job5] = await db
    .insert(jobs)
    .values({
      companyId: orbit.id,
      title: "Frontend Platform Engineer",
      slug: slug("Frontend Platform Engineer", "orbit"),
      department: "Engineering",
      location: "Austin, TX",
      employment_type: "Hybrid",
      salary_range: "$140k - $180k",
      status: "OPEN",
      required_skills: ["React", "TypeScript", "Next.js", "CSS", "Testing"],
      preferred_skills: ["Accessibility", "Design Systems"],
      experience_required: 3,
      profile_data: { description: "Ship high-quality frontend tooling and internal web platforms." },
    })
    .returning();

  // Second company's job — proves tenant isolation on the public board.
  await db
    .insert(jobs)
    .values({
      companyId: nova.id,
      title: "Platform Engineer",
      slug: slug("Platform Engineer", "nova"),
      department: "Infrastructure",
      location: "Berlin, DE",
      employment_type: "Full-time",
      status: "OPEN",
      required_skills: ["Go", "Kubernetes", "Terraform"],
      preferred_skills: ["AWS"],
      experience_required: 3,
      profile_data: { description: "Build internal developer platform tooling." },
    })
    .returning();

  // ----------------------------------------------------------- applications
  const [app1] = await db
    .insert(applications)
    .values({
      candidateId: aarav.id,
      jobId: job1.id,
      status: "INTERVIEW",
      match_score: scoreFor(aarav, job1),
      match_data: {},
    })
    .returning();

  const [app2] = await db
    .insert(applications)
    .values({
      candidateId: priya.id,
      jobId: job1.id,
      status: "OFFER",
      match_score: scoreFor(priya, job1),
      match_data: {},
    })
    .returning();

  const [app3] = await db
    .insert(applications)
    .values({
      candidateId: rohit.id,
      jobId: job3.id,
      status: "REJECTED",
      match_score: scoreFor(rohit, job3),
      match_data: {},
    })
    .returning();

  const [app4] = await db
    .insert(applications)
    .values({
      candidateId: maya.id,
      jobId: job4.id,
      status: "SCREENING",
      match_score: 91,
      match_data: {},
    })
    .returning();

  const [app5] = await db
    .insert(applications)
    .values({
      candidateId: daniel.id,
      jobId: job5.id,
      status: "INTERVIEW",
      match_score: 88,
      match_data: {},
    })
    .returning();

  const [app6] = await db
    .insert(applications)
    .values({
      candidateId: sofia.id,
      jobId: job1.id,
      status: "OFFER",
      match_score: 94,
      match_data: {},
    })
    .returning();

  // ------------------------------------------------------- status histories
  await db.insert(application_status_history).values([
    { applicationId: app1.id, fromStatus: null, toStatus: "APPLIED", note: "Application received" },
    { applicationId: app1.id, fromStatus: "APPLIED", toStatus: "SCREENING", note: "Resume passed initial screen" },
    { applicationId: app1.id, fromStatus: "SCREENING", toStatus: "INTERVIEW", note: "Technical interview scheduled" },
    { applicationId: app2.id, fromStatus: null, toStatus: "APPLIED", note: "Application received" },
    { applicationId: app2.id, fromStatus: "APPLIED", toStatus: "OFFER", note: "Strong match, offer extended" },
    { applicationId: app3.id, fromStatus: null, toStatus: "APPLIED", note: "Application received" },
    { applicationId: app3.id, fromStatus: "APPLIED", toStatus: "REJECTED", note: "Missing core platform skills" },
    { applicationId: app4.id, fromStatus: null, toStatus: "APPLIED", note: "Application received" },
    { applicationId: app4.id, fromStatus: "APPLIED", toStatus: "SCREENING", note: "Resume reviewed for analytics work" },
    { applicationId: app5.id, fromStatus: null, toStatus: "APPLIED", note: "Application received" },
    { applicationId: app5.id, fromStatus: "APPLIED", toStatus: "INTERVIEW", note: "Portfolio reviewed" },
    { applicationId: app6.id, fromStatus: null, toStatus: "APPLIED", note: "Application received" },
    { applicationId: app6.id, fromStatus: "APPLIED", toStatus: "OFFER", note: "Strong ML and platform background" },
  ]);

  // ------------------------------------------------------------- interviews
  await db.insert(interviews).values([
    {
      applicationId: app1.id,
      type: "Technical Interview",
      scheduled_date: new Date(Date.now() + 86400000),
      interviewers: "Sarah Chen",
      status: "SCHEDULED",
    },
    {
      applicationId: app5.id,
      type: "Portfolio Review",
      scheduled_date: new Date(Date.now() + 172800000),
      interviewers: "Alex Morgan",
      status: "SCHEDULED",
    },
  ]);

  // ---------------------------------------------------------------- activity
  await db.insert(activity_history).values([
    { actorType: "CANDIDATE", actorId: aarav.id, action: "APPLICATION_SUBMITTED", description: "Aarav Sharma applied for Senior Machine Learning Engineer" },
    { actorType: "COMPANY", actorId: acme.id, action: "STATUS_CHANGE", description: "Priya Sharma moved to OFFER for Senior Machine Learning Engineer" },
    { actorType: "COMPANY", actorId: acme.id, action: "JOB_POSTED", description: "Senior Machine Learning Engineer published" },
    { actorType: "CANDIDATE", actorId: maya.id, action: "PROFILE_UPDATED", description: "Maya Patel updated analytics profile" },
    { actorType: "COMPANY", actorId: northstar.id, action: "JOB_POSTED", description: "Senior Data Engineer published" },
    { actorType: "COMPANY", actorId: orbit.id, action: "JOB_POSTED", description: "Frontend Platform Engineer published" },
  ]);

  console.log("Seed complete.");
  console.log("  recruiter:  recruiter@acme.test / demo1234");
  console.log("  candidate:  aarav@demo.test     / demo1234");
  console.log("  recruiterB: recruiter@nova.test / demo1234");
  console.log("  recruiterC: nina@northstar.test / demo1234");
  console.log("  recruiterD: alex@orbit.test / demo1234");
  console.log("  additional candidates: maya@demo.test, daniel@demo.test, sofia@demo.test");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
