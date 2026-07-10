// Seeds the "SDET Journey" learning path (the original hardcoded curriculum) and an
// initial admin user. Idempotent: re-running skips content that already exists.
// Run: npm run seed   (or: node --env-file-if-exists=.env db/seed.mjs)
import bcrypt from 'bcryptjs';
import { getSql } from './db.mjs';
import { CURRICULUM, MODULE_COLORS, MODULE_ICONS, DELIVERABLES } from './curriculum-data.mjs';

const sql = getSql();

const PATH_NAME = 'SDET Journey';
const PATH_DESC = 'Track your journey from QA to SDET. 13 modules, 89 topics, 269 tasks, 12 deliverables.';
const PATH_ICON = '🧭';
const PATH_COLOR = '#f97316';

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@academytrack.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'change-me-now';
const adminName = process.env.SEED_ADMIN_NAME || 'Admin';

// ---------- Admin user ----------
let [admin] = await sql`SELECT id FROM users WHERE email = ${adminEmail}`;
if (!admin) {
  const hash = await bcrypt.hash(adminPassword, 10);
  [admin] = await sql`
    INSERT INTO users (email, password_hash, name, role, avatar)
    VALUES (${adminEmail}, ${hash}, ${adminName}, 'admin', '🦉')
    RETURNING id`;
  console.log(`Created admin user: ${adminEmail}`);
} else {
  console.log(`Admin user already exists: ${adminEmail}`);
}

// ---------- Learning path (skip if already seeded) ----------
const [existingPath] = await sql`SELECT id FROM learning_paths WHERE name = ${PATH_NAME}`;
if (existingPath) {
  console.log(`"${PATH_NAME}" already seeded (path #${existingPath.id}). Nothing to do.`);
  process.exit(0);
}

const [path] = await sql`
  INSERT INTO learning_paths (name, description, icon, color, created_by)
  VALUES (${PATH_NAME}, ${PATH_DESC}, ${PATH_ICON}, ${PATH_COLOR}, ${admin.id})
  RETURNING id`;
console.log(`Created path #${path.id} "${PATH_NAME}"`);

// ---------- Modules -> topics -> tasks ----------
const moduleIdByCode = {}; // 'm0' -> new module id
let mCount = 0, tCount = 0, taskCount = 0;

for (let mi = 0; mi < CURRICULUM.length; mi++) {
  const mod = CURRICULUM[mi];
  const [m] = await sql`
    INSERT INTO modules (path_id, position, name, icon, color)
    VALUES (${path.id}, ${mi}, ${mod.name}, ${MODULE_ICONS[mi] || null}, ${MODULE_COLORS[mi] || null})
    RETURNING id`;
  moduleIdByCode[mod.id] = m.id;
  mCount++;

  for (let ti = 0; ti < mod.topics.length; ti++) {
    const topic = mod.topics[ti];
    const [t] = await sql`
      INSERT INTO topics (module_id, position, name)
      VALUES (${m.id}, ${ti}, ${topic.name})
      RETURNING id`;
    tCount++;

    const exercises = topic.exercises || [];
    for (let ei = 0; ei < exercises.length; ei++) {
      await sql`
        INSERT INTO tasks (topic_id, position, description)
        VALUES (${t.id}, ${ei}, ${exercises[ei]})`;
      taskCount++;
    }
  }
}

// ---------- Deliverables ----------
let dCount = 0;
for (let di = 0; di < DELIVERABLES.length; di++) {
  const d = DELIVERABLES[di];
  const moduleId = d.modId ? (moduleIdByCode[d.modId] ?? null) : null;
  await sql`
    INSERT INTO deliverables (path_id, module_id, position, title, description)
    VALUES (${path.id}, ${moduleId}, ${di}, ${d.title}, ${d.desc})`;
  dCount++;
}

// ---------- Enroll admin in the seeded path ----------
await sql`
  INSERT INTO enrollments (user_id, path_id)
  VALUES (${admin.id}, ${path.id})
  ON CONFLICT (user_id, path_id) DO NOTHING`;

console.log(`✅ Seeded ${mCount} modules, ${tCount} topics, ${taskCount} tasks, ${dCount} deliverables.`);
console.log(`   Admin ${adminEmail} enrolled in "${PATH_NAME}".`);
process.exit(0);
