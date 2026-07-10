# AcademyTrack

Track **any** learning path — paths → modules → topics → tasks, plus deliverables — with
per-user login, shared progress, a leaderboard, a team activity feed, and an in-app admin
editor for building paths. Runs entirely on **Netlify** (Functions + Netlify DB / Neon Postgres).

Originally an SDET-only, browser-`localStorage` tracker; now a real backed app. The original
SDET curriculum ships as the first seeded path ("SDET Journey").

## Architecture

| Layer     | Tech |
|-----------|------|
| Frontend  | Static SPA in `public/` (`index.html`, `app.js`, `styles.css`) — no build step |
| Backend   | One Netlify Function `netlify/functions/api.mts` (Hono router) serving `/api/*` |
| Database  | Netlify DB (Neon Postgres) via `@netlify/neon` |
| Auth      | Self-hosted email/password (`bcryptjs`) + JWT session cookie (`jose`) |

```
public/            index.html, app.js, styles.css      (the app)
netlify/functions/ api.mts                              (all /api/* routes)
db/                schema.sql, migrate.mjs, seed.mjs, curriculum-data.mjs
netlify.toml       build + routing config
```

Roles: the **first account to register becomes `admin`** (can create/edit paths and content);
everyone after is a `learner`.

## One-time setup

Requires a Netlify account. Run these from the `academytrack/` folder:

```bash
npm install

# Log in and create/link the Netlify site (opens a browser)
npx netlify login
npx netlify init

# Provision the Neon database (sets NETLIFY_DATABASE_URL in the site env)
npx netlify db init

# Set the session-signing secret
npx netlify env:set JWT_SECRET "$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
```

Create the tables and seed the SDET path + an initial admin. For local runs, copy
`.env.example` to `.env` and fill in `NETLIFY_DATABASE_URL` (from `netlify env:get NETLIFY_DATABASE_URL`)
plus the `SEED_ADMIN_*` values, then:

```bash
npm run migrate   # applies db/schema.sql
npm run seed      # inserts "SDET Journey" (13 modules / 89 topics / 269 tasks / 12 deliverables) + admin
```

> **Heads-up:** a database created by `netlify db init` without claiming expires after 7 days.
> Claim it to your account from the Netlify dashboard (Extensions → Neon) to keep it.

## Run locally

```bash
npm run dev        # netlify dev — serves public/ + functions + DB on http://localhost:8888
```

## Deploy

```bash
git push           # if the repo is connected to the Netlify site (auto-deploy)
# or
npm run deploy     # netlify deploy --prod
```

## API summary (all under `/api`, JSON, session cookie)

- `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`
- `GET /paths` · `GET /paths/:id` · `POST /paths` · `PUT /paths/:id` · `DELETE /paths/:id` *(writes: admin)*
- `POST /paths/:id/modules` · `PUT|DELETE /modules/:id`
- `POST /modules/:id/topics` · `PUT|DELETE /topics/:id`
- `POST /topics/:id/tasks` · `PUT|DELETE /tasks/:id`
- `POST /paths/:id/deliverables` · `PUT|DELETE /deliverables/:id`
- `POST|DELETE /paths/:id/enroll` · `GET /paths/:id/members`
- `POST /progress/topic` · `POST /progress/task` · `POST /progress/deliverable`
- `GET /paths/:id/activity`

## Verify it works

1. Open the app, **Sign up** — this first user becomes admin.
2. Confirm the seeded **SDET Journey** path shows 13 modules / 89 topics / 12 deliverables.
3. Tick a topic, a task, and a deliverable → reload → progress persists (it's in the DB, not the browser).
4. As admin, use **Manage content** to create a new path/module/topic/task — learners see it immediately.
5. Register a second user in another browser → both appear on the Leaderboard / Team Activity.
