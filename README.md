# ReqCore AI Lab

[Deployment instructions](./DEPLOYMENT.md)

A functional end-to-end AI/ML prototype for candidate intelligence and job
matching. It is **not** a UI mockup: the frontend visualises real outputs
computed by the backend pipeline (structured extraction, embeddings, cosine
similarity, KNN, gradient-boosted trees, deterministic feature engineering,
skill-gap detection and career roadmaps).

---

## 1. System Architecture

```
                    ┌─────────────────────────────────────────┐
                    │            NEXT.JS FRONTEND             │
                    │   AI Lab · AI Pipeline · Candidate      │
                    └───────────────┬─────────────────────────┘
                                    │  HTTP (API routes)
                    ┌───────────────▼─────────────────────────┐
                    │        NEXT.JS API LAYER (server)       │
                    │   /api/resume/analyze, /api/job/analyze │
                    │   /api/embedding, /api/match/*          │
                    │   /api/skills/gaps, /api/roadmap        │
                    └───────┬───────────────────┬─────────────┘
                            │                   │
              ┌─────────────▼───────────┐   ┌───▼──────────────────┐
              │   TS AI/ML SERVICES    │   │  Python FastAPI      │
              │  (runs in preview)     │   │  backend/ (standalone)│
              │  embedding · KNN ·     │   │  scikit-learn · XGB   │
              │  GBDT · features       │   │  · Gemini · pdfminer  │
              └─────────────┬──────────┘   └───┬──────────────────┘
                            │                  │
                            └──────► PostgreSQL (Drizzle ORM)
```

The project includes two API implementations:

- **Next.js server API layer** — the application API used by the UI. It
  contains candidate/company authentication and portal workflows as well as
  the AI pipeline (hashed embeddings, cosine similarity, KNN,
  gradient-boosted regression trees, deterministic feature engineering) with
  optional Gemini calls and a deterministic fallback.
- **Python FastAPI backend** (`backend/`) — a standalone implementation of
  the AI endpoints using scikit-learn (KNN) and XGBoost. The Next.js UI does
  not call this service.

For the current deployment setup, keep the Next.js UI and its API routes on
the same host so session cookies and relative `/api/*` requests continue to
work without cross-origin changes.

---

## 2. AI Models Used

| Layer | Models |
|-------|--------|
| Generative AI | Gemini 1.5 Flash (`@google/generative-ai` / REST) for structured extraction, explanation, roadmap narrative |
| Machine Learning | KNN (scikit-learn `KNeighborsRegressor`) baseline · Gradient-Boosted Decision Trees (XGBoost / from-scratch TS GBDT) proposed model |
| Semantic NLP | Hashed TF word/bigram + char-trigram embeddings, cosine similarity |
| Deterministic | Skill coverage, experience/education/project/certification match, feature engineering, skill-gap classification |

## 3. ML Algorithms

### KNN (Baseline)
`knnPredict` (TS) and `KNeighborsRegressor` (Python). Finds the `k` nearest
reference candidate vectors by cosine distance and predicts the match score as
an inverse-distance-weighted mean of neighbour labels.

### XGBoost / GBDT (Proposed)
A gradient-boosted regression tree ensemble fit to the negative gradient of a
squared-error loss with shrinkage. In TS the model is implemented from scratch
(`src/lib/ml/gbdt.ts`); in Python it uses `xgboost.XGBRegressor`. Feature
importance is gain-based and is **not** causal reasoning.

### Embeddings
`embedText` hashes words, bigrams and character trigrams into a fixed 300-dim
vector, TF-weighted and L2-normalised. Cosine similarity:
`(a·b) / (||a||·||b||)`. The embedding service is modular so a learned model
(e.g. Gemini text-embedding) can be swapped in.

## 4. Scoring
Feature-based, deterministic, weighted composite:
```
overall = semantic*0.30 + skills*0.25 + experience*0.15
        + project*0.10 + education*0.10 + skill-coverage*0.10
```
Every sub-score is computed from extracted evidence.

## 5. Research Integrity
No fabricated accuracy. Both models run in **development mode** on a small
development calibration set. The UI shows **"Model evaluation pending"** and
does **not** claim KNN is worse/better than XGBoost without a validated,
real labelled dataset.

## 6. Configure Gemini
Frontend/Next: add to `.env`:
```
GEMINI_API_KEY=...
```
Backend: `cp backend/.env.example backend/.env` and fill the key.
Without a key, everything falls back to the deterministic engine and still works.

## 7. Start the database with Docker
```
docker compose up -d db
```
This starts PostgreSQL on `localhost:5434` with the defaults used by Compose:
`postgres/postgres` and `app_db`. Compose also defines the optional Python
backend; it does not start the Next.js app.

For a new local database, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/app_db`
in `.env.local`, then create the schema with the reviewed migrations:
```
npm run db:migrate
```
Do not use schema-reset scripts on a database containing records.

## 8. Run the Frontend
```
npm ci
npm run dev          # http://localhost:3000
```

## 9. Run the Python Backend
```
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

If you prefer containerized backend execution, you can also start it with:
```
docker compose up -d backend
```

## 9. Load Demo Data
On the AI Lab page, click **Load Demo Data** (clearly labelled "Demo Dataset").
It runs the complete pipeline end-to-end. Results are development-mode, not a
scientific evaluation.

## 10. Replace Demo Data With a Real Dataset
- Frontend: replace the calibration rows in `src/lib/services/matchingService.ts`
  and re-run `trainGBDT`.
- Backend: replace `_CALIBRATION` in `backend/services/matching.py`.
- A real labelled set of `(features → match_score)` lets you train both models,
  compute honest accuracy, and flip `model_evaluation` from `"pending"` to
  `"validated"`.

## Endpoints
`POST /api/resume/analyze`, `/api/job/analyze`, `/api/embedding`,
`/api/match/knn`, `/api/match/xgboost`, `/api/match/compare`,
`/api/match/explain`, `/api/skills/gaps`, `/api/roadmap`.

## Portal and integrations

Candidate/company accounts, profiles, job listings, applications, interviews,
candidate discovery, matching, roadmaps, and in-app notifications are
implemented in the Next.js application. Outbound email delivery, candidate
company chat, and storage of original resume binaries are not configured.
