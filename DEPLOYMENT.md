# ReqCore deployment guide

## Recommended topology

Deploy the **whole Next.js application** to [Netlify](https://docs.netlify.com/frameworks/next-js/overview/). The UI calls same-origin
`/api/*` routes, and those routes own authentication, recruitment workflows,
and the TypeScript AI pipeline. Keeping them together preserves the existing
httpOnly session cookie and avoids a cross-origin API rewrite.

Use a [Supabase PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) project for persistent relational data. The database
is already PostgreSQL and the application uses Drizzle; no database-engine
migration is needed. Use Supabase's shared **transaction pooler** URL for
Netlify's serverless runtime and a direct connection (or session pooler, if
direct connectivity is unavailable) for migration and backup commands.

The standalone Python API in `backend/` is not used by the Next.js UI and is
not required for this deployment. Do not point the UI at it unless the
application is deliberately changed to use that API.

## What the current app persists

- User accounts, sessions, profiles, jobs, applications, interviews,
  notifications, and AI-related records are stored in PostgreSQL.
- Resume uploads are parsed by the Next.js API. The filename, extracted text,
  and analysis are stored in PostgreSQL JSONB; the original binary file is
  **not** retained. This does not require object storage for the current
  behavior. If original PDF/DOCX downloads must be retained, implement and
  test object storage (for example, [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/))
  before relying on that capability.
- Notifications are in-app database records. No outbound email provider or
  candidate/company chat transport is configured in this repository.

## 1. Prepare the source repository

The workspace examined for this guide does not contain Git metadata. If the
project is not already in a GitHub repository, create a private repository and
from the project root run the following in PowerShell after reviewing the
files you intend to publish:

```powershell
git init
git add .
git status
git diff --cached
git commit -m "Prepare ReqCore deployment"
git branch -M main
git remote add origin https://github.com/<OWNER>/<REPOSITORY>.git
git push -u origin main
```

Do not add `.env.local`, `.env`, `backend/.env`, `cookies.txt`, API keys, or
database credentials. The provided `.gitignore` excludes these local files,
the local archive, and database dump files; review `git status` before
pushing. If any credential was committed in an earlier version, remove it
from Git history and rotate it in its provider.

## 2. Create Supabase PostgreSQL

1. Create a Supabase project and choose a region near the Netlify deployment.
2. Keep the database password in a password manager.
3. In the project dashboard, open **Connect** and copy the shared
   **Transaction pooler** connection string for the application. Keep the
   **Direct connection** string separately for database migrations and data
   export/import. If the direct endpoint is unreachable from your network,
   use the session pooler for those maintenance commands.
4. URL-encode reserved characters in the database password.

The app's initial migration creates the 18 tables and indexes represented by
`src/db/schema.ts`. To create the schema in a **new, empty** database, run
these commands from the project root, replacing the placeholder with the
Supabase direct connection URL:

```powershell
$env:DATABASE_URL = "<SUPABASE_DIRECT_CONNECTION_URL>"
npm ci
npm run db:migrate
```

This applies the checked-in Drizzle migration; it does not seed demo data.
`npm run db:seed` remains a separate, explicit operation. Use
`npm run db:generate` after intentional schema changes, inspect the generated
SQL, and commit the migration with the corresponding schema change.
`npm run db:push` is available for development only; production deployments
should use reviewed migrations.

### Preserving existing database records

No database was migrated or modified during setup. The old `db:setup` script
that dropped tables has been removed. Never run an old copy of that script or
apply the initial migration to a non-empty schema.

For an existing PostgreSQL database, make and verify a backup first. For a
matching schema, the safer route is to create a **new empty** Supabase
database, apply the migration above, then import a data-only dump:

```powershell
$env:SOURCE_DATABASE_URL = "<EXISTING_POSTGRES_CONNECTION_URL>"
$env:SUPABASE_DIRECT_URL = "<SUPABASE_DIRECT_CONNECTION_URL>"
pg_dump --format=custom --data-only --no-owner --no-acl `
  --file=.\reqcore-data.dump "$env:SOURCE_DATABASE_URL"

$env:DATABASE_URL = $env:SUPABASE_DIRECT_URL
npm run db:migrate
pg_restore --data-only --no-owner --no-acl `
  --dbname="$env:SUPABASE_DIRECT_URL" .\reqcore-data.dump
```

Test the import against a disposable target first and verify account, job,
application, session, and profile counts before switching the app. The dump
can contain personal data; store it securely and delete it only after a
verified backup/restore process. If the source schema differs from this
migration, stop and reconcile the schema explicitly rather than forcing an
import. Do not restore over a database that already contains records.

## 3. Deploy the Next.js application on Netlify

1. In Netlify, choose **Add new site → Import an existing project** and connect
   the GitHub repository and production branch.
2. Use the repository root (`.`) as the base directory. `netlify.toml` sets
   the build command to `npm run build` and Node.js 22.
3. Keep Netlify's Next.js framework detection enabled. Do not use a static
   export or manually route API requests to the Python service. Netlify's
   Next.js adapter supports the App Router and route handlers used here.
4. In **Site configuration → Environment variables**, set:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase shared transaction-pooler URL with SSL required |
   | `PGPOOL_MAX_CONNECTIONS` | `1` |
   | `GEMINI_API_KEY` | Optional server-side Gemini key; omit to use deterministic fallbacks |

   These are server-side variables. Do not name secrets `NEXT_PUBLIC_*`.
   `NEXT_PUBLIC_BACKEND_URL` is not used by this codebase and is not needed.
5. Trigger the production deploy. Subsequent pushes to the production branch
   will build and deploy automatically.

The existing health endpoint is `https://<site-domain>/api/health`; it returns
success only when the configured PostgreSQL database can be queried. Test
registration/login, candidate and company dashboards, job browsing/creation,
applications, resume analysis, matching, roadmaps, and notifications against
the deployed site.

### Netlify request limits

Netlify documents a 60-second synchronous function limit and a 6 MB buffered
request/response limit. Binary request encoding reduces the practical upload
payload to about 4.5 MB ([Netlify function limits](https://docs.netlify.com/build/functions/configuration/)). Large resumes may therefore be rejected before they
reach this application's upload route, and slow external AI calls can exceed
the function timeout. Keep uploaded files below the platform limit. If the
product needs larger uploads or longer-running analysis, use a persistent
Node.js host for the whole Next.js app or implement direct-to-object-storage
uploads and asynchronous processing; do not split the existing portal API
without adapting its session and same-origin behavior.

## 4. Optional Python service

The current UI does not call this service, so do not create it just to deploy
the existing product. If it is intentionally exposed separately later, set
`CORS_ORIGINS` to a comma-separated allowlist containing the exact deployed
browser origin, such as `https://<site>.netlify.app`, and set
`GEMINI_API_KEY` only as a server-side secret. The API currently has no
database dependency and no persistent file storage. Render's free web
services sleep after 15 minutes without traffic, use ephemeral filesystems,
and have resource/usage limits; its free PostgreSQL databases expire after
30 days, so do not use one as the system of record.

## Free-tier expectations

Free plans and quotas change. At the time this guide was written:

- **[Netlify Free](https://www.netlify.com/pricing/)** is credit-based (currently 300 monthly credits). Production
  deploys, function compute, bandwidth, and requests consume credits; reaching
  a limit can affect deploys or service availability.
- **[Supabase Free](https://supabase.com/pricing/)** includes 500 MB of database storage and pauses projects
  after one week of inactivity. Monitor storage and keep independent backups
  of important records.
- **[Render Free](https://render.com/docs/free)**, if used for the optional Python API, spins down after
  inactivity and has no persistent disk. A request after a spin-down has a
  cold start. Its free Postgres expires after 30 days.
- Gemini usage and quotas depend on the Google AI plan/key; a key is optional,
  and deterministic AI fallbacks remain available when it is absent.

This setup can be operated at no charge within each provider's current
allowances, but it is not a guarantee that the platform will remain free or
available indefinitely.
