import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'COMPANY' | 'CANDIDATE'
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    website: text("website"),
    industry: text("industry"),
    company_size: text("company_size"),
    location: text("location"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({ userIdx: index("companies_user_idx").on(table.userId) })
);

export const company_members = pgTable("company_members", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberRole: text("member_role").notNull().default("OWNER"), // 'OWNER' | 'MEMBER'
  createdAt: timestamp("created_at").defaultNow(),
});

export const candidate_profiles = pgTable("candidate_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  location: text("location"),
  experience_years: integer("experience_years").default(0),
  profile_data: jsonb("profile_data").$type<any>(),
  resume_quality: integer("resume_quality").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const JOB_STATUSES = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").references(() => companies.id),
    title: text("title").notNull(),
    slug: text("slug").unique(),
    department: text("department"),
    location: text("location"),
    work_mode: text("work_mode"), // 'Remote' | 'Hybrid' | 'On-site'
    employment_type: text("employment_type"),
    salary_range: text("salary_range"),
    status: text("status").default("OPEN"), // 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED'
    deadline: timestamp("deadline"),
    description: text("description"),
    responsibilities: text("responsibilities"),
    education_requirements: text("education_requirements"),
    custom_questions: jsonb("custom_questions").$type<{ id: string; label: string; required: boolean }[]>().default([]),
    required_skills: jsonb("required_skills").$type<string[]>().default([]),
    preferred_skills: jsonb("preferred_skills").$type<string[]>().default([]),
    experience_required: integer("experience_required").default(0),
    profile_data: jsonb("profile_data").$type<any>(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    companyIdx: index("jobs_company_idx").on(table.companyId),
    statusIdx: index("jobs_status_idx").on(table.status),
  })
);

export const applications = pgTable(
  "applications",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id").references(() => candidate_profiles.id),
    jobId: integer("job_id").references(() => jobs.id),
    status: text("status").default("APPLIED"), // 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'
    match_score: integer("match_score").default(0),
    match_data: jsonb("match_data").$type<any>(),
    cover_letter: text("cover_letter"),
    answers: jsonb("answers").$type<Record<string, string>>().default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    // Duplicate application prevention at the database level.
    candidateJobUnique: uniqueIndex("applications_candidate_job_unique").on(
      table.candidateId,
      table.jobId
    ),
    jobIdx: index("applications_job_idx").on(table.jobId),
    candidateIdx: index("applications_candidate_idx").on(table.candidateId),
  })
);

export const application_status_history = pgTable(
  "application_status_history",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedById: integer("changed_by_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({ appIdx: index("status_history_app_idx").on(table.applicationId) })
);

export const interviews = pgTable(
  "interviews",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id").references(() => applications.id),
    type: text("type").notNull(), // 'Technical', 'Behavioral', etc.
    scheduled_date: timestamp("scheduled_date"),
    interviewers: text("interviewers"),
    meeting_link: text("meeting_link"),
    status: text("status").default("SCHEDULED"), // 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
    result: text("result"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({ appIdx: index("interviews_app_idx").on(table.applicationId) })
);

export const activity_history = pgTable("activity_history", {
  id: serial("id").primaryKey(),
  actorType: text("actor_type"), // 'COMPANY' | 'CANDIDATE'
  actorId: integer("actor_id"),
  action: text("action").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Keeping the old tables for compatibility if needed, but we will mostly use the new ones.
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  skills: jsonb("skills").$type<string[]>().default([]),
  experience_years: integer("experience_years").default(0),
  profile: jsonb("profile").$type<any>(),
  engine: text("engine").default("deterministic"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id"),
  jobId: integer("job_id"),
  overall_score: integer("overall_score").default(0),
  cosine_similarity: integer("cosine_similarity").default(0),
  knn_score: integer("knn_score").default(0),
  xgboost_score: integer("xgboost_score").default(0),
  features: jsonb("features").$type<any>(),
  match: jsonb("match").$type<any>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roadmaps = pgTable("roadmaps", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id"),
  target_role: text("target_role"),
  readiness: integer("readiness").default(0),
  items: jsonb("items").$type<any>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 1 additions: bookmarks, recruiter notes, cached match scores,
// notifications, and vector metadata. Company-owned rows always carry
// company_id so tenant isolation can be enforced with a single predicate.
// ---------------------------------------------------------------------------

export const saved_jobs = pgTable(
  "saved_jobs",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidate_profiles.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    candidateJobUnique: uniqueIndex("saved_jobs_candidate_job_unique").on(
      table.candidateId,
      table.jobId
    ),
  })
);

export const candidate_notes = pgTable(
  "candidate_notes",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidate_profiles.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("candidate_notes_company_idx").on(table.companyId, table.candidateId),
  })
);

export const match_scores = pgTable(
  "match_scores",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidate_profiles.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    overall: integer("overall").notNull().default(0),
    components: jsonb("components").$type<any>(),
    modelVersion: text("model_version").default("deterministic-v1"),
    computedAt: timestamp("computed_at").defaultNow(),
  },
  (table) => ({
    pairUnique: uniqueIndex("match_scores_pair_unique").on(table.candidateId, table.jobId),
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId, table.read),
  })
);

// Vector metadata. Vectors are stored as jsonb float arrays so the first
// implementation stays plain-PostgreSQL compatible; swapping to pgvector or
// an external vector store later only requires replacing the repository
// layer in lib/services/semanticService.ts.
export const embeddings = pgTable(
  "embeddings",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(), // 'CANDIDATE' | 'JOB'
    entityId: integer("entity_id").notNull(),
    model: text("model").notNull().default("hashed-tf-300"),
    dim: integer("dim").notNull(),
    vector: jsonb("vector").$type<number[]>().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    entityUnique: uniqueIndex("embeddings_entity_unique").on(table.entityType, table.entityId),
  })
);
