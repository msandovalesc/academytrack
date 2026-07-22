// Imports db/sources/java-learning-path.md into the app as a "Java Learning Path".
// Mapping: each "### Module X.Y" -> app module; top-level checklist items -> topics
// (with resource link); nested items -> tasks; the "## Quizzes" section -> a quiz on the
// matching module. Idempotent: skips if the path already exists.
//   Dry run (parse + print, no DB writes): DRY=1 node --env-file-if-exists=.env db/seed-java.mjs
//   Import:                                 node --env-file-if-exists=.env db/seed-java.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSql } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const md = fs.readFileSync(path.join(__dirname, 'sources', 'java-learning-path.md'), 'utf8').replace(/\r/g, '');
const lines = md.split('\n');

const SECTION_ICONS = {
  Java: '☕', Spring: '🌱', Git: '🔀', SQL: '🗃️', Algorithms: '🧮',
  Security: '🔒', Utils: '🧰', Microservices: '🧩', Cloud: '☁️',
};
function sectionIcon(name) {
  const key = Object.keys(SECTION_ICONS).find((k) => name.toLowerCase().startsWith(k.toLowerCase()));
  return key ? SECTION_ICONS[key] : '📦';
}
function mdLink(text) {
  const m = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  return m ? { name: m[1].trim(), url: m[2].trim() } : null;
}

// ---------- parse ----------
const modules = [];         // { code, name, icon, topics:[{name,link,tasks:[str]}] }
const quizzes = [];         // { code, title, questions:[{text, options:[{text,correct}]}] }
let inQuizzes = false;
let section = null, sectionIco = '📦';
let mod = null, topic = null, resourceUrl = null;
let curQuiz = null, curQuestion = null;

const checkbox = /^(\s*)-\s*\[([ xX])\]\s*(.*)$/;

for (const raw of lines) {
  const line = raw.replace(/\s+$/, '');
  if (/^##\s+Quizzes\s*$/.test(line)) { inQuizzes = true; mod = null; topic = null; continue; }

  if (!inQuizzes) {
    let m;
    if ((m = line.match(/^##\s+\d+\.\s+(.+)$/))) { section = m[1].trim(); sectionIco = sectionIcon(section); mod = topic = null; resourceUrl = null; continue; }
    if ((m = line.match(/^###\s+Module\s+(\d+\.\d+):?\s*(.+?)\s*$/))) {
      mod = { code: m[1], name: `${section} — ${m[2].trim()}`, icon: sectionIco, topics: [] };
      modules.push(mod); topic = null; resourceUrl = null; continue;
    }
    if (/\*\*Resource:\*\*/.test(line)) { const l = line.match(/\[([^\]]+)\]\(([^)]+)\)/); resourceUrl = l ? l[2].trim() : null; continue; }
    if ((m = line.match(checkbox))) {
      if (!mod) continue;
      const indent = m[1].length;
      const link = mdLink(m[3].trim());
      const text = link ? link.name : m[3].trim();
      if (indent >= 2 && topic) {
        topic.tasks.push(text);
      } else {
        topic = { name: text, link: link ? link.url : resourceUrl, tasks: [] };
        mod.topics.push(topic);
      }
    }
    continue;
  }

  // ---------- quizzes section ----------
  let m;
  if ((m = line.match(/^###\s+Module\s+(\d+\.\d+)\s*(.*)$/))) {
    curQuiz = { code: m[1], title: `${(m[2] || '').trim() || 'Module ' + m[1]} Quiz`, questions: [] };
    quizzes.push(curQuiz); curQuestion = null; continue;
  }
  if (!curQuiz) continue;
  if ((m = line.match(checkbox))) {
    if (!curQuestion) continue; // option with no preceding question
    const correct = m[2].toLowerCase() === 'x';
    const text = m[3].trim().replace(/^[a-hA-H]\)\s*/, ''); // strip "a) " prefix
    if (text) curQuestion.options.push({ text, correct });
  } else if (line.trim()) {
    // a question stem
    curQuestion = { text: line.trim(), options: [] };
    curQuiz.questions.push(curQuestion);
  }
}

// keep only quiz questions that have >=2 options and >=1 correct
for (const q of quizzes) q.questions = q.questions.filter((qq) => qq.options.length >= 2 && qq.options.some((o) => o.correct));

// ---------- report ----------
const totalTopics = modules.reduce((s, m) => s + m.topics.length, 0);
const totalTasks = modules.reduce((s, m) => s + m.topics.reduce((a, t) => a + t.tasks.length, 0), 0);
const totalQ = quizzes.reduce((s, q) => s + q.questions.length, 0);
console.log(`Parsed: ${modules.length} modules, ${totalTopics} topics, ${totalTasks} tasks; ${quizzes.length} quiz block(s), ${totalQ} questions.`);
console.log('First module:', modules[0]?.code, modules[0]?.name, '| topics:', modules[0]?.topics.length);
console.log('Quiz blocks:', quizzes.map((q) => `${q.code} (${q.questions.length}q)`).join(', ') || 'none');

if (process.env.DRY) { console.log('DRY run — no DB writes.'); process.exit(0); }

// ---------- insert ----------
const sql = getSql();
const PATH_NAME = 'Java Learning Path';
const [existing] = await sql`SELECT id FROM learning_paths WHERE name = ${PATH_NAME}`;
if (existing) { console.log(`"${PATH_NAME}" already exists (path #${existing.id}). Nothing to do.`); process.exit(0); }

const [admin] = await sql`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`;
const [p] = await sql`
  INSERT INTO learning_paths (name, description, icon, color, created_by)
  VALUES (${PATH_NAME}, ${'Backend Java engineering path: Java, Spring, Git, SQL, Algorithms, Security, Utils, Microservices, AWS.'}, ${'☕'}, ${'#5382a1'}, ${admin ? admin.id : null})
  RETURNING id`;
console.log(`Created path #${p.id}`);

const codeToModuleId = {};
let mi = 0, tCount = 0, kCount = 0;
for (const m of modules) {
  const [row] = await sql`INSERT INTO modules (path_id, position, name, icon, color) VALUES (${p.id}, ${mi}, ${m.name}, ${m.icon}, ${'#5382a1'}) RETURNING id`;
  codeToModuleId[m.code] = row.id;
  mi++;
  let ti = 0;
  for (const t of m.topics) {
    const [tr] = await sql`INSERT INTO topics (module_id, position, name, link) VALUES (${row.id}, ${ti}, ${t.name}, ${t.link || null}) RETURNING id`;
    ti++; tCount++;
    let ki = 0;
    for (const task of t.tasks) { await sql`INSERT INTO tasks (topic_id, position, description) VALUES (${tr.id}, ${ki}, ${task})`; ki++; kCount++; }
  }
}

let quizCount = 0, qCount = 0;
for (const q of quizzes) {
  const moduleId = codeToModuleId[q.code];
  if (!moduleId || !q.questions.length) continue;
  const [qz] = await sql`INSERT INTO quizzes (module_id, position, title) VALUES (${moduleId}, 0, ${q.title}) RETURNING id`;
  quizCount++;
  let qi = 0;
  for (const question of q.questions) {
    const [qq] = await sql`INSERT INTO quiz_questions (quiz_id, position, text) VALUES (${qz.id}, ${qi}, ${question.text}) RETURNING id`;
    qi++; qCount++;
    let oi = 0;
    for (const o of question.options) { await sql`INSERT INTO quiz_options (question_id, position, text, is_correct) VALUES (${qq.id}, ${oi}, ${o.text}, ${o.correct})`; oi++; }
  }
}

if (admin) await sql`INSERT INTO enrollments (user_id, path_id) VALUES (${admin.id}, ${p.id}) ON CONFLICT (user_id, path_id) DO NOTHING`;
console.log(`✅ Imported ${mi} modules, ${tCount} topics, ${kCount} tasks, ${quizCount} quiz(zes) with ${qCount} questions.`);
process.exit(0);
