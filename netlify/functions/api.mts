// AcademyTrack API — single Netlify Function routing all of /api/* via Hono.
// Auth: self-hosted email/password (bcrypt) + JWT session in an httpOnly cookie.
// DB:   Netlify DB (Neon Postgres) via @netlify/neon (auto-reads NETLIFY_DATABASE_URL).
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

type User = { id: number; email: string; name: string; avatar: string | null; role: string };
type Vars = { sql: ReturnType<typeof neon>; user: User | null };

const COOKIE = 'at_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const app = new Hono<{ Variables: Vars }>().basePath('/api');

// ---------- helpers ----------
function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(s);
}

async function signSession(userId: number) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

async function setSession(c: any, userId: number) {
  const token = await signSession(userId);
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: MAX_AGE,
  });
}

const publicUser = (u: any): User => ({
  id: u.id, email: u.email, name: u.name, avatar: u.avatar, role: u.role,
});

// ---------- middleware: attach db + resolve current user from cookie ----------
app.use('*', async (c, next) => {
  const sql = neon();
  c.set('sql', sql);
  c.set('user', null);
  const token = getCookie(c, COOKIE);
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      const rows = await sql`SELECT id, email, name, avatar, role FROM users WHERE id = ${payload.uid as number}`;
      if (rows[0]) c.set('user', publicUser(rows[0]));
    } catch {
      /* invalid/expired token — treat as anonymous */
    }
  }
  await next();
});

const requireAuth = async (c: any, next: any) => {
  if (!c.get('user')) return c.json({ error: 'Not authenticated' }, 401);
  await next();
};
const requireAdmin = async (c: any, next: any) => {
  const u = c.get('user');
  if (!u) return c.json({ error: 'Not authenticated' }, 401);
  if (u.role !== 'admin') return c.json({ error: 'Admin only' }, 403);
  await next();
};
// Staff = admin or mentor (read-only oversight of everyone).
const requireStaff = async (c: any, next: any) => {
  const u = c.get('user');
  if (!u) return c.json({ error: 'Not authenticated' }, 401);
  if (u.role !== 'admin' && u.role !== 'mentor') return c.json({ error: 'Staff only' }, 403);
  await next();
};

// =====================================================================
// AUTH
// =====================================================================
app.get('/health', (c) => c.json({ ok: true }));

app.post('/auth/register', async (c) => {
  const sql = c.get('sql');
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const password = String(body.password || '');
  if (!email || !name || password.length < 6) {
    return c.json({ error: 'Name, email, and a password of at least 6 characters are required.' }, 400);
  }
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing[0]) return c.json({ error: 'An account with that email already exists.' }, 409);

  const hash = await bcrypt.hash(password, 10);
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
  const role = count === 0 ? 'admin' : 'learner'; // first-ever user is the admin
  const avatars = ['🦊', '🐼', '🦁', '🐸', '🦋', '🐺', '🦅', '🐬', '🦄', '🐯', '🦉', '🐙'];
  const avatar = role === 'admin' ? '❤️' : avatars[count % avatars.length];

  const [u] = await sql`
    INSERT INTO users (email, password_hash, name, role, avatar)
    VALUES (${email}, ${hash}, ${name}, ${role}, ${avatar})
    RETURNING id, email, name, avatar, role`;
  await setSession(c, u.id);
  return c.json({ user: publicUser(u) });
});

app.post('/auth/login', async (c) => {
  const sql = c.get('sql');
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const [u] = await sql`SELECT * FROM users WHERE email = ${email}`;
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }
  await setSession(c, u.id);
  return c.json({ user: publicUser(u) });
});

app.post('/auth/logout', (c) => {
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

app.get('/auth/me', requireAuth, (c) => c.json({ user: c.get('user') }));

// =====================================================================
// USERS (admin) — manage learners, mentors, admins
// =====================================================================
const VALID_ROLES = ['admin', 'mentor', 'learner'];

app.get('/users', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const rows = await sql`
    SELECT id, email, name, avatar, role, created_at,
      (SELECT count(*)::int FROM enrollments e WHERE e.user_id = users.id) AS path_count,
      (SELECT coalesce(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name), '[]'::json)
         FROM enrollments e JOIN learning_paths p ON p.id = e.path_id WHERE e.user_id = users.id) AS paths
    FROM users
    ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'mentor' THEN 1 ELSE 2 END, name`;
  return c.json({ users: rows });
});

// Create an account directly (used to add mentors without them signing up).
app.post('/users', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const password = String(b.password || '');
  const role = VALID_ROLES.includes(b.role) ? b.role : 'learner';
  if (!email || !name || password.length < 6) {
    return c.json({ error: 'Name, email, and a password of at least 6 characters are required.' }, 400);
  }
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing[0]) return c.json({ error: 'An account with that email already exists.' }, 409);
  const hash = await bcrypt.hash(password, 10);
  const avatar = role === 'mentor' ? '🧑‍🏫' : role === 'admin' ? '❤️' : '🙂';
  const [u] = await sql`
    INSERT INTO users (email, password_hash, name, role, avatar)
    VALUES (${email}, ${hash}, ${name}, ${role}, ${avatar})
    RETURNING id, email, name, avatar, role, created_at`;
  return c.json({ user: u });
});

app.put('/users/:id/role', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  if (!VALID_ROLES.includes(b.role)) return c.json({ error: 'Invalid role' }, 400);
  if (b.role !== 'admin') {
    const [target] = await sql`SELECT role FROM users WHERE id = ${id}`;
    const [{ admins }] = await sql`SELECT count(*)::int AS admins FROM users WHERE role = 'admin'`;
    if (target && target.role === 'admin' && admins <= 1) {
      return c.json({ error: 'Cannot change the role of the last admin.' }, 400);
    }
  }
  const [u] = await sql`UPDATE users SET role = ${b.role} WHERE id = ${id} RETURNING id, email, name, avatar, role`;
  if (!u) return c.json({ error: 'User not found' }, 404);
  return c.json({ user: u });
});

// Admin resets a user's password.
app.put('/users/:id/password', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const password = String(b.password || '');
  if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters.' }, 400);
  const hash = await bcrypt.hash(password, 10);
  const [u] = await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id} RETURNING id`;
  if (!u) return c.json({ error: 'User not found' }, 404);
  return c.json({ ok: true });
});

// Admin removes a user from a learning path (deletes their enrollment; progress rows remain).
app.delete('/users/:id/enrollments/:pathId', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM enrollments WHERE user_id = ${Number(c.req.param('id'))} AND path_id = ${Number(c.req.param('pathId'))}`;
  return c.json({ ok: true });
});

// =====================================================================
// PATHS + CONTENT
// =====================================================================

// List all paths with totals + whether current user is enrolled + member count.
app.get('/paths', requireAuth, async (c) => {
  const sql = c.get('sql');
  const uid = c.get('user')!.id;
  const rows = await sql`
    SELECT p.*,
      (SELECT count(*)::int FROM modules m WHERE m.path_id = p.id) AS module_count,
      (SELECT count(*)::int FROM topics t JOIN modules m ON m.id = t.module_id WHERE m.path_id = p.id) AS topic_count,
      (SELECT count(*)::int FROM tasks tk JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id WHERE m.path_id = p.id) AS task_count,
      (SELECT count(*)::int FROM deliverables d WHERE d.path_id = p.id) AS deliverable_count,
      (SELECT count(*)::int FROM enrollments e WHERE e.path_id = p.id) AS member_count,
      EXISTS (SELECT 1 FROM enrollments e WHERE e.path_id = p.id AND e.user_id = ${uid}) AS enrolled
    FROM learning_paths p
    ORDER BY p.created_at ASC, p.id ASC`;
  return c.json({ paths: rows });
});

// Full content tree for a path + current user's progress (done ids).
app.get('/paths/:id', requireAuth, async (c) => {
  const sql = c.get('sql');
  const uid = c.get('user')!.id;
  const id = Number(c.req.param('id'));
  const [path] = await sql`SELECT * FROM learning_paths WHERE id = ${id}`;
  if (!path) return c.json({ error: 'Path not found' }, 404);

  const modules = await sql`SELECT * FROM modules WHERE path_id = ${id} ORDER BY position, id`;
  const topics = await sql`
    SELECT t.* FROM topics t JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} ORDER BY t.position, t.id`;
  const tasks = await sql`
    SELECT tk.* FROM tasks tk
    JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} ORDER BY tk.position, tk.id`;
  const deliverables = await sql`SELECT * FROM deliverables WHERE path_id = ${id} ORDER BY position, id`;

  const tasksByTopic: Record<number, any[]> = {};
  for (const tk of tasks) (tasksByTopic[tk.topic_id] ||= []).push(tk);
  const topicsByModule: Record<number, any[]> = {};
  for (const t of topics) {
    t.tasks = tasksByTopic[t.id] || [];
    (topicsByModule[t.module_id] ||= []).push(t);
  }
  for (const m of modules) m.topics = topicsByModule[m.id] || [];

  // Quizzes per module, with question count + this user's latest attempt.
  const quizzes = await sql`
    SELECT q.id, q.module_id, q.title, q.position,
      (SELECT count(*)::int FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
      (SELECT row_to_json(a) FROM (SELECT score, total, passed FROM quiz_attempts WHERE quiz_id = q.id AND user_id = ${uid}) a) AS attempt
    FROM quizzes q JOIN modules m ON m.id = q.module_id
    WHERE m.path_id = ${id} ORDER BY q.position, q.id`;
  const quizzesByModule: Record<number, any[]> = {};
  for (const q of quizzes) (quizzesByModule[q.module_id] ||= []).push(q);
  for (const m of modules) m.quizzes = quizzesByModule[m.id] || [];

  const doneTopics = await sql`
    SELECT tp.topic_id FROM topic_progress tp
    JOIN topics t ON t.id = tp.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.user_id = ${uid} AND tp.done`;
  const doneTasks = await sql`
    SELECT tp.task_id FROM task_progress tp
    JOIN tasks tk ON tk.id = tp.task_id JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.user_id = ${uid} AND tp.done`;
  const doneDelivs = await sql`
    SELECT dp.deliverable_id FROM deliverable_progress dp
    JOIN deliverables d ON d.id = dp.deliverable_id
    WHERE d.path_id = ${id} AND dp.user_id = ${uid} AND dp.done`;

  return c.json({
    path,
    modules,
    deliverables,
    progress: {
      topics: doneTopics.map((r: any) => r.topic_id),
      tasks: doneTasks.map((r: any) => r.task_id),
      deliverables: doneDelivs.map((r: any) => r.deliverable_id),
    },
  });
});

app.post('/paths', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: 'Name is required' }, 400);
  const [p] = await sql`
    INSERT INTO learning_paths (name, description, icon, color, created_by)
    VALUES (${b.name}, ${b.description ?? null}, ${b.icon ?? null}, ${b.color ?? null}, ${c.get('user')!.id})
    RETURNING *`;
  return c.json({ path: p });
});

app.put('/paths/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const [p] = await sql`
    UPDATE learning_paths SET
      name = COALESCE(${b.name ?? null}, name),
      description = COALESCE(${b.description ?? null}, description),
      icon = COALESCE(${b.icon ?? null}, icon),
      color = COALESCE(${b.color ?? null}, color)
    WHERE id = ${id} RETURNING *`;
  if (!p) return c.json({ error: 'Path not found' }, 404);
  return c.json({ path: p });
});

app.delete('/paths/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM learning_paths WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// ---- Modules ----
app.post('/paths/:id/modules', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const pathId = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: 'Name is required' }, 400);
  const [{ next }] = await sql`SELECT COALESCE(max(position) + 1, 0)::int AS next FROM modules WHERE path_id = ${pathId}`;
  const [m] = await sql`
    INSERT INTO modules (path_id, position, name, icon, color)
    VALUES (${pathId}, ${b.position ?? next}, ${b.name}, ${b.icon ?? null}, ${b.color ?? null})
    RETURNING *`;
  return c.json({ module: m });
});

app.put('/modules/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const [m] = await sql`
    UPDATE modules SET
      name = COALESCE(${b.name ?? null}, name),
      icon = COALESCE(${b.icon ?? null}, icon),
      color = COALESCE(${b.color ?? null}, color),
      position = COALESCE(${b.position ?? null}, position)
    WHERE id = ${id} RETURNING *`;
  if (!m) return c.json({ error: 'Module not found' }, 404);
  return c.json({ module: m });
});

app.delete('/modules/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM modules WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// ---- Topics ----
app.post('/modules/:id/topics', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const moduleId = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: 'Name is required' }, 400);
  const [{ next }] = await sql`SELECT COALESCE(max(position) + 1, 0)::int AS next FROM topics WHERE module_id = ${moduleId}`;
  const [t] = await sql`
    INSERT INTO topics (module_id, position, name)
    VALUES (${moduleId}, ${b.position ?? next}, ${b.name}) RETURNING *`;
  return c.json({ topic: t });
});

app.put('/topics/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const [t] = await sql`
    UPDATE topics SET
      name = COALESCE(${b.name ?? null}, name),
      position = COALESCE(${b.position ?? null}, position)
    WHERE id = ${id} RETURNING *`;
  if (!t) return c.json({ error: 'Topic not found' }, 404);
  return c.json({ topic: t });
});

app.delete('/topics/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM topics WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// ---- Tasks ----
app.post('/topics/:id/tasks', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const topicId = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  if (!b.description) return c.json({ error: 'Description is required' }, 400);
  const [{ next }] = await sql`SELECT COALESCE(max(position) + 1, 0)::int AS next FROM tasks WHERE topic_id = ${topicId}`;
  const [t] = await sql`
    INSERT INTO tasks (topic_id, position, description)
    VALUES (${topicId}, ${b.position ?? next}, ${b.description}) RETURNING *`;
  return c.json({ task: t });
});

app.put('/tasks/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const [t] = await sql`
    UPDATE tasks SET
      description = COALESCE(${b.description ?? null}, description),
      position = COALESCE(${b.position ?? null}, position)
    WHERE id = ${id} RETURNING *`;
  if (!t) return c.json({ error: 'Task not found' }, 404);
  return c.json({ task: t });
});

app.delete('/tasks/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM tasks WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// ---- Deliverables ----
app.post('/paths/:id/deliverables', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const pathId = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  if (!b.title) return c.json({ error: 'Title is required' }, 400);
  const [{ next }] = await sql`SELECT COALESCE(max(position) + 1, 0)::int AS next FROM deliverables WHERE path_id = ${pathId}`;
  const [d] = await sql`
    INSERT INTO deliverables (path_id, module_id, position, title, description)
    VALUES (${pathId}, ${b.module_id ?? null}, ${b.position ?? next}, ${b.title}, ${b.description ?? null})
    RETURNING *`;
  return c.json({ deliverable: d });
});

app.put('/deliverables/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const [d] = await sql`
    UPDATE deliverables SET
      title = COALESCE(${b.title ?? null}, title),
      description = COALESCE(${b.description ?? null}, description),
      module_id = COALESCE(${b.module_id ?? null}, module_id),
      position = COALESCE(${b.position ?? null}, position)
    WHERE id = ${id} RETURNING *`;
  if (!d) return c.json({ error: 'Deliverable not found' }, 404);
  return c.json({ deliverable: d });
});

app.delete('/deliverables/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM deliverables WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// =====================================================================
// QUIZZES
// =====================================================================

// Full quiz for taking. Learners get options WITHOUT the answer key; admins get is_correct.
app.get('/quizzes/:id', requireAuth, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const isAdmin = c.get('user')!.role === 'admin';
  const [quiz] = await sql`SELECT id, module_id, title FROM quizzes WHERE id = ${id}`;
  if (!quiz) return c.json({ error: 'Quiz not found' }, 404);
  const questions = await sql`SELECT id, text, position FROM quiz_questions WHERE quiz_id = ${id} ORDER BY position, id`;
  const options = await sql`
    SELECT o.id, o.question_id, o.text, o.position, o.is_correct
    FROM quiz_options o JOIN quiz_questions q ON q.id = o.question_id
    WHERE q.quiz_id = ${id} ORDER BY o.position, o.id`;
  const byQ: Record<number, any[]> = {};
  for (const o of options) {
    (byQ[o.question_id] ||= []).push(isAdmin ? o : { id: o.id, question_id: o.question_id, text: o.text, position: o.position });
  }
  for (const q of questions) q.options = byQ[q.id] || [];
  return c.json({ quiz, questions });
});

// Submit answers; scored server-side; latest attempt saved. Returns per-question correctness.
app.post('/quizzes/:id/submit', requireAuth, async (c) => {
  const sql = c.get('sql');
  const uid = c.get('user')!.id;
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const answers = body.answers || {}; // { questionId: optionId }
  const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${id}`;
  if (!quiz) return c.json({ error: 'Quiz not found' }, 404);
  const questions = await sql`SELECT id FROM quiz_questions WHERE quiz_id = ${id}`;
  const correctRows = await sql`
    SELECT o.question_id, o.id AS option_id FROM quiz_options o
    JOIN quiz_questions q ON q.id = o.question_id
    WHERE q.quiz_id = ${id} AND o.is_correct`;
  const correctByQ: Record<number, number[]> = {};
  for (const r of correctRows) (correctByQ[r.question_id] ||= []).push(r.option_id);

  let score = 0;
  const results = questions.map((q: any) => {
    const chosen = Number(answers[q.id]);
    const correctIds = correctByQ[q.id] || [];
    const correct = correctIds.includes(chosen);
    if (correct) score++;
    return { question_id: q.id, chosen_option_id: chosen || null, correct_option_ids: correctIds, correct };
  });
  const total = questions.length;
  const passed = total > 0 && score / total >= 0.7;
  await sql`
    INSERT INTO quiz_attempts (user_id, quiz_id, score, total, passed, updated_at)
    VALUES (${uid}, ${id}, ${score}, ${total}, ${passed}, now())
    ON CONFLICT (user_id, quiz_id) DO UPDATE SET score = ${score}, total = ${total}, passed = ${passed}, updated_at = now()`;
  return c.json({ score, total, passed, results });
});

// ---- Quiz authoring (admin) ----
app.post('/modules/:id/quizzes', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const moduleId = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  if (!b.title) return c.json({ error: 'Title is required' }, 400);
  const [{ next }] = await sql`SELECT COALESCE(max(position) + 1, 0)::int AS next FROM quizzes WHERE module_id = ${moduleId}`;
  const [q] = await sql`INSERT INTO quizzes (module_id, position, title) VALUES (${moduleId}, ${b.position ?? next}, ${b.title}) RETURNING *`;
  return c.json({ quiz: q });
});

app.put('/quizzes/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const b = await c.req.json().catch(() => ({}));
  const [q] = await sql`UPDATE quizzes SET title = COALESCE(${b.title ?? null}, title) WHERE id = ${Number(c.req.param('id'))} RETURNING *`;
  if (!q) return c.json({ error: 'Quiz not found' }, 404);
  return c.json({ quiz: q });
});

app.delete('/quizzes/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM quizzes WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// Create a question with its options in one call. options: [{ text, is_correct }]
app.post('/quizzes/:id/questions', requireAdmin, async (c) => {
  const sql = c.get('sql');
  const quizId = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const text = String(b.text || '').trim();
  const options = Array.isArray(b.options) ? b.options.filter((o: any) => String(o.text || '').trim()) : [];
  if (!text) return c.json({ error: 'Question text is required' }, 400);
  if (options.length < 2) return c.json({ error: 'At least 2 options are required' }, 400);
  if (!options.some((o: any) => o.is_correct)) return c.json({ error: 'Mark at least one correct option' }, 400);
  const [{ next }] = await sql`SELECT COALESCE(max(position) + 1, 0)::int AS next FROM quiz_questions WHERE quiz_id = ${quizId}`;
  const [q] = await sql`INSERT INTO quiz_questions (quiz_id, position, text) VALUES (${quizId}, ${next}, ${text}) RETURNING *`;
  for (let i = 0; i < options.length; i++) {
    await sql`INSERT INTO quiz_options (question_id, position, text, is_correct)
      VALUES (${q.id}, ${i}, ${String(options[i].text).trim()}, ${!!options[i].is_correct})`;
  }
  return c.json({ question: q });
});

app.delete('/quiz-questions/:id', requireAdmin, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM quiz_questions WHERE id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// =====================================================================
// ENROLLMENT + MEMBER PROGRESS
// =====================================================================
app.post('/paths/:id/enroll', requireAuth, async (c) => {
  const sql = c.get('sql');
  await sql`
    INSERT INTO enrollments (user_id, path_id) VALUES (${c.get('user')!.id}, ${Number(c.req.param('id'))})
    ON CONFLICT (user_id, path_id) DO NOTHING`;
  return c.json({ ok: true });
});

app.delete('/paths/:id/enroll', requireAuth, async (c) => {
  const sql = c.get('sql');
  await sql`DELETE FROM enrollments WHERE user_id = ${c.get('user')!.id} AND path_id = ${Number(c.req.param('id'))}`;
  return c.json({ ok: true });
});

// Every enrolled user's aggregated progress for a path (dashboard + leaderboard).
app.get('/paths/:id/members', requireAuth, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const [totals] = await sql`
    SELECT
      (SELECT count(*)::int FROM topics t JOIN modules m ON m.id = t.module_id WHERE m.path_id = ${id}) AS topics,
      (SELECT count(*)::int FROM tasks tk JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id WHERE m.path_id = ${id}) AS tasks,
      (SELECT count(*)::int FROM deliverables d WHERE d.path_id = ${id}) AS deliverables`;
  const members = await sql`
    SELECT u.id, u.name, u.email, u.avatar,
      (SELECT count(*)::int FROM topic_progress tp JOIN topics t ON t.id = tp.topic_id JOIN modules m ON m.id = t.module_id
        WHERE m.path_id = ${id} AND tp.user_id = u.id AND tp.done) AS topics_done,
      (SELECT count(*)::int FROM task_progress tp JOIN tasks tk ON tk.id = tp.task_id JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id
        WHERE m.path_id = ${id} AND tp.user_id = u.id AND tp.done) AS tasks_done,
      (SELECT count(*)::int FROM deliverable_progress dp JOIN deliverables d ON d.id = dp.deliverable_id
        WHERE d.path_id = ${id} AND dp.user_id = u.id AND dp.done) AS deliverables_done
    FROM users u JOIN enrollments e ON e.user_id = u.id
    WHERE e.path_id = ${id}
    ORDER BY u.name`;
  return c.json({ totals, members });
});

// Rich team dashboard data for any enrolled user: modules + per-member per-module progress
// + recent activity. Powers the "Team Activity" tab (podium, module coverage, activity feed).
app.get('/paths/:id/team', requireAuth, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const [path] = await sql`SELECT * FROM learning_paths WHERE id = ${id}`;
  if (!path) return c.json({ error: 'Path not found' }, 404);
  const modules = await sql`
    SELECT m.id, m.name, m.icon, m.position,
      (SELECT count(*)::int FROM topics t WHERE t.module_id = m.id) AS topic_total,
      (SELECT count(*)::int FROM tasks tk JOIN topics t ON t.id = tk.topic_id WHERE t.module_id = m.id) AS task_total
    FROM modules m WHERE m.path_id = ${id} ORDER BY m.position, m.id`;
  const [{ deliverable_total }] = await sql`SELECT count(*)::int AS deliverable_total FROM deliverables WHERE path_id = ${id}`;
  const memberRows = await sql`
    SELECT u.id, u.name, u.email, u.avatar FROM users u JOIN enrollments e ON e.user_id = u.id
    WHERE e.path_id = ${id} ORDER BY u.name`;
  const topicByUserMod = await sql`
    SELECT tp.user_id, t.module_id, count(*)::int AS c FROM topic_progress tp
    JOIN topics t ON t.id = tp.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.done GROUP BY tp.user_id, t.module_id`;
  const taskByUserMod = await sql`
    SELECT tp.user_id, t.module_id, count(*)::int AS c FROM task_progress tp
    JOIN tasks tk ON tk.id = tp.task_id JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.done GROUP BY tp.user_id, t.module_id`;
  const delivByUser = await sql`
    SELECT dp.user_id, count(*)::int AS c FROM deliverable_progress dp
    JOIN deliverables d ON d.id = dp.deliverable_id WHERE d.path_id = ${id} AND dp.done GROUP BY dp.user_id`;
  const weekByUser = await sql`
    SELECT user_id, count(*)::int AS c FROM activity
    WHERE path_id = ${id} AND created_at > now() - interval '7 days' GROUP BY user_id`;
  const activity = await sql`
    SELECT a.user_id, u.name AS user_name, u.avatar AS user_avatar, a.type, a.detail, a.created_at
    FROM activity a JOIN users u ON u.id = a.user_id
    WHERE a.path_id = ${id} ORDER BY a.created_at DESC LIMIT 30`;

  const tMap: any = {}, kMap: any = {}, dMap: any = {}, wMap: any = {};
  for (const r of topicByUserMod) (tMap[r.user_id] ||= {})[r.module_id] = r.c;
  for (const r of taskByUserMod) (kMap[r.user_id] ||= {})[r.module_id] = r.c;
  for (const r of delivByUser) dMap[r.user_id] = r.c;
  for (const r of weekByUser) wMap[r.user_id] = r.c;
  const members = memberRows.map((u: any) => {
    const perModule = modules.map((m: any) => ({
      module_id: m.id,
      topics_done: (tMap[u.id] && tMap[u.id][m.id]) || 0,
      tasks_done: (kMap[u.id] && kMap[u.id][m.id]) || 0,
    }));
    return {
      id: u.id, name: u.name, email: u.email, avatar: u.avatar,
      topics_done: perModule.reduce((s: number, x: any) => s + x.topics_done, 0),
      tasks_done: perModule.reduce((s: number, x: any) => s + x.tasks_done, 0),
      deliverables_done: dMap[u.id] || 0,
      week_count: wMap[u.id] || 0,
      perModule,
    };
  });
  const totals = {
    modules: modules.length,
    topics: modules.reduce((s: number, m: any) => s + m.topic_total, 0),
    tasks: modules.reduce((s: number, m: any) => s + m.task_total, 0),
    deliverables: deliverable_total,
  };
  return c.json({ path, totals, modules, members, activity });
});

// A specific member's detailed progress on a path (staff-only oversight, read-only).
app.get('/paths/:id/members/:userId/progress', requireStaff, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const userId = Number(c.req.param('userId'));
  const [u] = await sql`SELECT id, name, email, avatar, role FROM users WHERE id = ${userId}`;
  if (!u) return c.json({ error: 'User not found' }, 404);
  const doneTopics = await sql`
    SELECT tp.topic_id FROM topic_progress tp
    JOIN topics t ON t.id = tp.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.user_id = ${userId} AND tp.done`;
  const doneTasks = await sql`
    SELECT tp.task_id FROM task_progress tp
    JOIN tasks tk ON tk.id = tp.task_id JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.user_id = ${userId} AND tp.done`;
  const doneDelivs = await sql`
    SELECT dp.deliverable_id FROM deliverable_progress dp
    JOIN deliverables d ON d.id = dp.deliverable_id
    WHERE d.path_id = ${id} AND dp.user_id = ${userId} AND dp.done`;
  return c.json({
    user: u,
    progress: {
      topics: doneTopics.map((r: any) => r.topic_id),
      tasks: doneTasks.map((r: any) => r.task_id),
      deliverables: doneDelivs.map((r: any) => r.deliverable_id),
    },
  });
});

// Weekly report data for a path (staff-only): modules with totals, and per-member
// per-module done counts + deliverables + last-7-days activity count. The client renders
// the full email-styled report (leaderboard, individual table, module coverage).
app.get('/paths/:id/report', requireStaff, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const [path] = await sql`SELECT * FROM learning_paths WHERE id = ${id}`;
  if (!path) return c.json({ error: 'Path not found' }, 404);

  const modules = await sql`
    SELECT m.id, m.name, m.icon, m.position,
      (SELECT count(*)::int FROM topics t WHERE t.module_id = m.id) AS topic_total,
      (SELECT count(*)::int FROM tasks tk JOIN topics t ON t.id = tk.topic_id WHERE t.module_id = m.id) AS task_total
    FROM modules m WHERE m.path_id = ${id} ORDER BY m.position, m.id`;
  const [{ deliverable_total }] = await sql`SELECT count(*)::int AS deliverable_total FROM deliverables WHERE path_id = ${id}`;
  const memberRows = await sql`
    SELECT u.id, u.name, u.email, u.avatar FROM users u JOIN enrollments e ON e.user_id = u.id
    WHERE e.path_id = ${id} ORDER BY u.name`;
  const topicByUserMod = await sql`
    SELECT tp.user_id, t.module_id, count(*)::int AS c FROM topic_progress tp
    JOIN topics t ON t.id = tp.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.done GROUP BY tp.user_id, t.module_id`;
  const taskByUserMod = await sql`
    SELECT tp.user_id, t.module_id, count(*)::int AS c FROM task_progress tp
    JOIN tasks tk ON tk.id = tp.task_id JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id
    WHERE m.path_id = ${id} AND tp.done GROUP BY tp.user_id, t.module_id`;
  const delivByUser = await sql`
    SELECT dp.user_id, count(*)::int AS c FROM deliverable_progress dp
    JOIN deliverables d ON d.id = dp.deliverable_id WHERE d.path_id = ${id} AND dp.done GROUP BY dp.user_id`;
  const weekByUser = await sql`
    SELECT user_id, count(*)::int AS c FROM activity
    WHERE path_id = ${id} AND created_at > now() - interval '7 days' GROUP BY user_id`;

  const tMap: any = {}, kMap: any = {}, dMap: any = {}, wMap: any = {};
  for (const r of topicByUserMod) (tMap[r.user_id] ||= {})[r.module_id] = r.c;
  for (const r of taskByUserMod) (kMap[r.user_id] ||= {})[r.module_id] = r.c;
  for (const r of delivByUser) dMap[r.user_id] = r.c;
  for (const r of weekByUser) wMap[r.user_id] = r.c;

  const members = memberRows.map((u: any) => {
    const perModule = modules.map((m: any) => ({
      module_id: m.id,
      topics_done: (tMap[u.id] && tMap[u.id][m.id]) || 0,
      tasks_done: (kMap[u.id] && kMap[u.id][m.id]) || 0,
    }));
    return {
      id: u.id, name: u.name, email: u.email, avatar: u.avatar,
      topics_done: perModule.reduce((s: number, x: any) => s + x.topics_done, 0),
      tasks_done: perModule.reduce((s: number, x: any) => s + x.tasks_done, 0),
      deliverables_done: dMap[u.id] || 0,
      week_count: wMap[u.id] || 0,
      perModule,
    };
  });
  const totals = {
    modules: modules.length,
    topics: modules.reduce((s: number, m: any) => s + m.topic_total, 0),
    tasks: modules.reduce((s: number, m: any) => s + m.task_total, 0),
    deliverables: deliverable_total,
  };
  return c.json({ path, totals, modules, members });
});

// =====================================================================
// PROGRESS TOGGLES
// =====================================================================
async function logActivity(sql: any, pathId: number, userId: number, type: string, detail: string) {
  await sql`INSERT INTO activity (path_id, user_id, type, detail) VALUES (${pathId}, ${userId}, ${type}, ${detail})`;
}

app.post('/progress/topic', requireAuth, async (c) => {
  const sql = c.get('sql');
  const uid = c.get('user')!.id;
  const b = await c.req.json().catch(() => ({}));
  const topicId = Number(b.topic_id);
  const done = !!b.done;
  const [info] = await sql`
    SELECT m.path_id, t.name FROM topics t JOIN modules m ON m.id = t.module_id WHERE t.id = ${topicId}`;
  if (!info) return c.json({ error: 'Topic not found' }, 404);
  await sql`
    INSERT INTO topic_progress (user_id, topic_id, done, updated_at) VALUES (${uid}, ${topicId}, ${done}, now())
    ON CONFLICT (user_id, topic_id) DO UPDATE SET done = ${done}, updated_at = now()`;
  if (done) await logActivity(sql, info.path_id, uid, 'topic', info.name);
  return c.json({ ok: true });
});

app.post('/progress/task', requireAuth, async (c) => {
  const sql = c.get('sql');
  const uid = c.get('user')!.id;
  const b = await c.req.json().catch(() => ({}));
  const taskId = Number(b.task_id);
  const done = !!b.done;
  const [info] = await sql`
    SELECT m.path_id, tk.description FROM tasks tk
    JOIN topics t ON t.id = tk.topic_id JOIN modules m ON m.id = t.module_id WHERE tk.id = ${taskId}`;
  if (!info) return c.json({ error: 'Task not found' }, 404);
  await sql`
    INSERT INTO task_progress (user_id, task_id, done, updated_at) VALUES (${uid}, ${taskId}, ${done}, now())
    ON CONFLICT (user_id, task_id) DO UPDATE SET done = ${done}, updated_at = now()`;
  if (done) await logActivity(sql, info.path_id, uid, 'task', (info.description || '').slice(0, 80));
  return c.json({ ok: true });
});

app.post('/progress/deliverable', requireAuth, async (c) => {
  const sql = c.get('sql');
  const uid = c.get('user')!.id;
  const b = await c.req.json().catch(() => ({}));
  const delivId = Number(b.deliverable_id);
  const done = !!b.done;
  const [info] = await sql`SELECT path_id, title FROM deliverables WHERE id = ${delivId}`;
  if (!info) return c.json({ error: 'Deliverable not found' }, 404);
  await sql`
    INSERT INTO deliverable_progress (user_id, deliverable_id, done, updated_at) VALUES (${uid}, ${delivId}, ${done}, now())
    ON CONFLICT (user_id, deliverable_id) DO UPDATE SET done = ${done}, updated_at = now()`;
  if (done) await logActivity(sql, info.path_id, uid, 'deliverable', info.title);
  return c.json({ ok: true });
});

// =====================================================================
// ACTIVITY FEED
// =====================================================================
app.get('/paths/:id/activity', requireAuth, async (c) => {
  const sql = c.get('sql');
  const id = Number(c.req.param('id'));
  const limit = Math.min(Number(c.req.query('limit')) || 30, 100);
  const rows = await sql`
    SELECT a.id, a.type, a.detail, a.created_at, u.name AS user_name, u.avatar AS user_avatar
    FROM activity a JOIN users u ON u.id = a.user_id
    WHERE a.path_id = ${id}
    ORDER BY a.created_at DESC LIMIT ${limit}`;
  return c.json({ activity: rows });
});

// ---------- Netlify Function entry ----------
export const config = { path: '/api/*' };
export default async (req: Request) => app.fetch(req);
