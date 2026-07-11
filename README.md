# AcademyTrack

Track **any** learning path — paths → modules → topics → tasks, plus deliverables — with
per-user login, shared progress, a leaderboard, a team activity feed, and an in-app admin
editor for building paths. Frontend + serverless API run on **Netlify**; data lives in
**Neon Postgres** (Netlify's own database offering is Neon under the hood).

Originally an SDET-only, browser-`localStorage` tracker; now a real backed app. The original
SDET curriculum ships as the first seeded path ("SDET Journey").

**Live:** https://myacademyunosquare.netlify.app

## Architecture

| Layer     | Tech |
|-----------|------|
| Frontend  | Static SPA in `public/` (`index.html`, `app.js`, `styles.css`) — no build step |
| Backend   | One Netlify Function `netlify/functions/api.mts` (Hono router) serving `/api/*` |
| Database  | Neon Postgres, reached with the `@neondatabase/serverless` HTTP driver |
| Auth      | Self-hosted email/password (`bcryptjs`) + JWT session cookie (`jose`) |

```
public/            index.html, app.js, styles.css      (the app)
netlify/functions/ api.mts                              (all /api/* routes)
db/                schema.sql, migrate.mjs, seed.mjs, curriculum-data.mjs, db.mjs
netlify.toml       publish + functions config (NO build command — must stay empty)
```

Roles: the **first account to register becomes `admin`** (can create/edit paths and content);
everyone after is a `learner`. The seed also creates an initial admin (see below).

The app connects to the database through one environment variable, **`NETLIFY_DATABASE_URL`**
(a Neon `postgresql://…` connection string). It's read by the deployed function and by the
migrate/seed scripts.

## One-time setup

Requires a Netlify account and a Neon database. Run from the `academytrack/` folder.

### 1. Install + link the Netlify site
```bash
npm install
npx netlify login
npx netlify init      # Create & configure a new project; connect the GitHub repo for auto-deploy
```
> **Build command must be empty.** This is a static site with no build. If `netlify init`
> saved a build command (it once saved the literal `# no build command`, which breaks builds),
> clear it in the dashboard: Project → Project configuration → Build & deploy → Build settings →
> clear **Build command** → Save.

### 2. Create the Neon database
- Go to **https://neon.tech**, sign up (free), **Create project**.
- Copy the connection string from the **Connect** dialog — looks like
  `postgresql://<user>:<pass>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require`.

> Netlify's built-in "Netlify Database" is also Neon; you can use it instead by claiming it to a
> Neon account and copying its connection string. Using Neon directly is simpler and identical.

### 3. Wire up the connection string + secrets
Create `.env` in the project root (gitignored) for the local scripts:
```
NETLIFY_DATABASE_URL=postgresql://…            # no quotes, no leading space
SEED_ADMIN_EMAIL=you@company.com
SEED_ADMIN_PASSWORD=choose-a-strong-password
SEED_ADMIN_NAME=Your Name
```
Give the deployed site the same DB URL plus a session secret:
```bash
npx netlify env:set NETLIFY_DATABASE_URL "postgresql://…"
npx netlify env:set JWT_SECRET "$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
```

### 4. Create tables + seed the SDET curriculum
```bash
npm run migrate    # applies db/schema.sql to Neon  -> "Migration complete."
npm run seed       # loads SDET Journey (13 modules / 89 topics / 269 tasks / 12 deliverables) + admin
```
Both read `.env` and talk to Neon directly — no local database needed. Re-running is safe
(schema uses `IF NOT EXISTS`; seed skips content that already exists).

## Run locally
```bash
npm run dev        # netlify dev — serves public/ + functions on http://localhost:8888
```
`netlify dev` injects the site's env vars (including `NETLIFY_DATABASE_URL`), so the local
functions hit the same Neon database.

## Deploy
```bash
git push           # GitHub repo is connected -> Netlify auto-deploys (build command must be empty)
# or, on demand:
npx netlify deploy --prod
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

## Admin operations

### Reset the admin password
The seed only creates the admin if it doesn't already exist, so changing `SEED_ADMIN_PASSWORD`
and re-seeding won't update an existing account. To reset a password, run a one-off script that
hashes a new password with bcrypt and updates the row (from the project folder, with `.env` set):
```bash
node --env-file-if-exists=.env -e "import('bcryptjs').then(async ({default:b})=>{const {neon}=await import('@neondatabase/serverless');const sql=neon(process.env.NETLIFY_DATABASE_URL);const hash=await b.hash('NEW_PASSWORD_HERE',10);await sql\`UPDATE users SET password_hash=\${hash} WHERE email=\${'you@company.com'}\`;console.log('password updated');})"
```

### Make someone an admin
```bash
node --env-file-if-exists=.env -e "import('@neondatabase/serverless').then(async ({neon})=>{const sql=neon(process.env.NETLIFY_DATABASE_URL);await sql\`UPDATE users SET role='admin' WHERE email=\${'person@company.com'}\`;console.log('done');})"
```

## Verify it works

1. Open the site, **log in** (seeded admin) or **sign up** (first-ever signup becomes admin).
2. Confirm the **SDET Journey** path shows 13 modules / 89 topics / 12 deliverables.
3. Tick a topic, a task, and a deliverable → reload → progress persists (it's in Neon, not the browser).
4. As admin, use **Manage content** to create a new path/module/topic/task — learners see it immediately.
5. Register a second user in another browser → both appear on the Leaderboard / Team Activity.
