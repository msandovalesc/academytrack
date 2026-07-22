/* AcademyTrack front-end — API-backed SPA.
   Talks to /api/* (Netlify Function). No more localStorage; progress is shared + persisted.
   Screens: Auth -> Path picker -> Path tracker (My Progress / Leaderboard / Team) + Admin editor. */

// ---------------------------------------------------------------- API client
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------- cosmetic helpers (client-only)
const AVATARS = ['🦊','🐼','🦁','🐸','🦋','🐺','🦅','🐬','🦄','🐯','🦉','🐙','🐲','🦈'];
const MOTIVATIONAL = [
  'Streak growing! Keep it up!','Topic unlocked! You\'re on a roll!','Great progress! The team is watching!',
  'One step closer!','Crushing it! Keep the momentum!','Knowledge +1! Nice work!','Another one down! You\'re unstoppable!'
];
function getLevel(pct) {
  if (pct < 10) return { level: 1, name: 'Newcomer', color: '#6b7280' };
  if (pct < 25) return { level: 2, name: 'Explorer', color: '#3b82f6' };
  if (pct < 40) return { level: 3, name: 'Practitioner', color: '#8b5cf6' };
  if (pct < 60) return { level: 4, name: 'Rising', color: '#06b6d4' };
  if (pct < 80) return { level: 5, name: 'Advanced', color: '#22c55e' };
  if (pct < 100) return { level: 6, name: 'Expert', color: '#f59e0b' };
  return { level: 7, name: 'Master', color: '#ef4444' };
}
function progressColor(pct) {
  if (pct >= 100) return 'var(--green)';
  if (pct >= 60) return 'var(--blue)';
  if (pct >= 30) return 'var(--yellow)';
  return 'var(--text-dim)';
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function twoDigit(n) { return String(n).padStart(2, '0'); }

// ---------------------------------------------------------------- toast + celebration
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
}
function showCongrats(title, sub, badge) {
  document.getElementById('congratsIcon').textContent = '🎉';
  document.getElementById('congratsTitle').textContent = title;
  document.getElementById('congratsSub').textContent = sub;
  document.getElementById('congratsBadge').textContent = badge || '';
  document.getElementById('congratsOverlay').classList.add('show');
  spawnConfetti();
}
function closeCongrats() { document.getElementById('congratsOverlay').classList.remove('show'); }
function spawnConfetti() {
  const modal = document.getElementById('congratsModal');
  const emojis = ['🎉', '⭐', '🏅', '✨', '🎊'];
  for (let i = 0; i < 24; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.textContent = emojis[i % emojis.length];
    c.style.left = Math.random() * 100 + '%';
    c.style.top = '0';
    c.style.animationDelay = Math.random() * 0.5 + 's';
    modal.appendChild(c);
    setTimeout(() => c.remove(), 2500);
  }
}

// ---------------------------------------------------------------- modal helpers
function openModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalRoot').classList.add('show');
}
function closeModal() { document.getElementById('modalRoot').classList.remove('show'); }

/* Generic form modal. fields: [{name,label,type,value,placeholder,textarea,options,required}] */
function formModal({ title, fields, submitLabel = 'Save', onSubmit }) {
  const inputs = fields.map((f) => {
    const val = esc(f.value ?? '');
    let control;
    if (f.textarea) {
      control = `<textarea class="form-input" id="f_${f.name}" placeholder="${esc(f.placeholder || '')}">${val}</textarea>`;
    } else if (f.options) {
      control = `<select class="form-input" id="f_${f.name}">` +
        f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('') +
        `</select>`;
    } else {
      control = `<input class="form-input" id="f_${f.name}" type="${f.type || 'text'}" value="${val}" placeholder="${esc(f.placeholder || '')}" />`;
    }
    return `<div class="form-group"><label class="form-label">${esc(f.label)}</label>${control}</div>`;
  }).join('');

  openModal(`
    <h2>${esc(title)}</h2>
    ${inputs}
    <div class="form-error" id="modalErr"></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modalSubmit">${esc(submitLabel)}</button>
    </div>`);

  document.getElementById('modalSubmit').onclick = async () => {
    const values = {};
    for (const f of fields) values[f.name] = document.getElementById('f_' + f.name).value.trim();
    for (const f of fields) {
      if (f.required && !values[f.name]) {
        document.getElementById('modalErr').textContent = `${f.label} is required.`;
        return;
      }
    }
    const btn = document.getElementById('modalSubmit');
    btn.disabled = true;
    try {
      await onSubmit(values);
      closeModal();
    } catch (e) {
      document.getElementById('modalErr').textContent = e.message;
      btn.disabled = false;
    }
  };
}

function confirmModal(title, message, confirmLabel, onConfirm) {
  openModal(`
    <h2 style="color:var(--red)">${esc(title)}</h2>
    <p style="font-size:14px;color:var(--text-muted)">${esc(message)}</p>
    <div class="form-error" id="modalErr"></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="modalSubmit">${esc(confirmLabel)}</button>
    </div>`);
  document.getElementById('modalSubmit').onclick = async () => {
    const btn = document.getElementById('modalSubmit');
    btn.disabled = true;
    try { await onConfirm(); closeModal(); }
    catch (e) { document.getElementById('modalErr').textContent = e.message; btn.disabled = false; }
  };
}

// ---------------------------------------------------------------- global state
const state = {
  user: null,
  view: 'loading',      // 'auth' | 'paths' | 'path' | 'admin' | 'users'
  authMode: 'login',
  paths: [],
  pathId: null,
  path: null,           // { path, modules[], deliverables[] }
  done: { topics: new Set(), tasks: new Set(), deliverables: new Set() },
  tab: 'me',            // 'me' | 'leaderboard' | 'team'
  members: null,
  totals: null,
  activity: null,
  team: null,           // rich team dashboard payload
  openModules: new Set(),
  openTasks: new Set(),   // topic ids whose task list is expanded (persists across re-render)
  celebrated: new Set(),  // module ids already celebrated (avoids repeat pop-ups)
  users: [],            // admin Users screen
  viewingMember: null,  // { user, done:{topics,tasks,deliverables} } read-only drill-down
};
const isAdmin = () => state.user && state.user.role === 'admin';
const isMentor = () => state.user && state.user.role === 'mentor';
const isStaff = () => isAdmin() || isMentor();          // admin or mentor: read-only oversight
const isEnrolled = () => !!state.paths.find((p) => p.id === state.pathId && p.enrolled);

// ---------------------------------------------------------------- boot + routing
async function boot() {
  try {
    const me = await api('GET', '/auth/me');
    state.user = me.user;
    await goPaths();
  } catch {
    state.user = null;
    state.view = 'auth';
    render();
  }
}

function render() {
  renderNav();
  const app = document.getElementById('app');
  if (state.view === 'auth') return renderAuth(app);
  if (state.view === 'paths') return renderPaths(app);
  if (state.view === 'path') return renderPath(app);
  if (state.view === 'admin') return renderAdmin(app);
  if (state.view === 'users') return renderUsers(app);
}

function renderNav() {
  const nav = document.getElementById('navActions');
  if (!state.user) { nav.innerHTML = ''; return; }
  const parts = [];
  if (state.view !== 'paths') {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="goPaths()">← All paths</button>`);
  }
  if ((state.view === 'path' || state.view === 'admin') && isStaff()) {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="openReport(${state.pathId})">📊 Weekly report</button>`);
  }
  if (state.view === 'path' && isAdmin()) {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="goAdmin(${state.pathId})">✎ Manage content</button>`);
  }
  if (state.view === 'admin') {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="openPath(${state.pathId})">👁 View as learner</button>`);
  }
  if (isAdmin() && state.view !== 'users') {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="goUsers()">👥 Users</button>`);
  }
  const roleBadge = isAdmin() ? ' <span class="badge badge-purple">admin</span>'
    : isMentor() ? ' <span class="badge badge-blue">mentor</span>' : '';
  parts.push(`<span style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:6px">${state.user.avatar || '🙂'} ${esc(state.user.name)}${roleBadge}</span>`);
  parts.push(`<button class="btn btn-outline btn-sm" onclick="logout()">Log out</button>`);
  nav.innerHTML = parts.join('');
}

// ---------------------------------------------------------------- AUTH
function renderAuth(app) {
  const login = state.authMode === 'login';
  app.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <h1>${login ? 'Welcome back' : 'Create your account'}</h1>
      <div class="sub">${login ? 'Log in to track your learning paths.' : 'Sign up to start tracking. The first account becomes the admin.'}</div>
      ${login ? '' : `<div class="form-group"><label class="form-label">Full name</label><input class="form-input" id="au_name" placeholder="e.g. Ana Garcia" /></div>`}
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="au_email" type="email" placeholder="you@company.com" /></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="au_pass" type="password" placeholder="${login ? 'Your password' : 'At least 6 characters'}" /></div>
      <div class="form-error" id="au_err"></div>
      <button class="btn btn-primary" style="width:100%" id="au_submit">${login ? 'Log in' : 'Sign up'}</button>
      <div class="auth-switch">
        ${login ? "Don't have an account?" : 'Already have an account?'}
        <button onclick="toggleAuthMode()">${login ? 'Sign up' : 'Log in'}</button>
      </div>
    </div></div>`;
  const submit = document.getElementById('au_submit');
  const go = () => (login ? doLogin() : doRegister());
  submit.onclick = go;
  ['au_email', 'au_pass', 'au_name'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}
function toggleAuthMode() { state.authMode = state.authMode === 'login' ? 'register' : 'login'; render(); }

async function doLogin() {
  const email = document.getElementById('au_email').value.trim();
  const password = document.getElementById('au_pass').value;
  await authRequest('/auth/login', { email, password });
}
async function doRegister() {
  const name = document.getElementById('au_name').value.trim();
  const email = document.getElementById('au_email').value.trim();
  const password = document.getElementById('au_pass').value;
  await authRequest('/auth/register', { name, email, password });
}
async function authRequest(path, body) {
  const btn = document.getElementById('au_submit');
  const err = document.getElementById('au_err');
  err.textContent = '';
  btn.disabled = true;
  try {
    const { user } = await api('POST', path, body);
    state.user = user;
    await goPaths();
    toast(`Welcome, ${user.name.split(' ')[0]}!`);
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
  }
}
async function logout() {
  await api('POST', '/auth/logout').catch(() => {});
  state.user = null;
  state.view = 'auth';
  render();
}

// ---------------------------------------------------------------- PATH PICKER
async function goPaths() {
  const { paths } = await api('GET', '/paths');
  state.paths = paths;
  state.view = 'paths';
  render();
}

function renderPaths(app) {
  const admin = isAdmin();
  const cards = state.paths.map((p) => {
    const color = p.color || 'var(--blue)';
    return `
      <div class="path-card">
        <div class="path-icon" style="background:${color}22;color:${color}">${esc(p.icon || '📚')}</div>
        <div class="path-title">${esc(p.name)}</div>
        <div class="path-desc">${esc(p.description || '')}</div>
        <div class="path-meta">
          <span>📦 ${p.module_count} modules</span>
          <span>📘 ${p.topic_count} topics</span>
          <span>🎯 ${p.deliverable_count} deliverables</span>
          <span>👥 ${p.member_count}</span>
        </div>
        <div class="path-actions">
          <button class="btn btn-primary btn-sm" onclick="openPath(${p.id})">Open</button>
          ${isMentor() ? '' : (p.enrolled
            ? `<button class="btn btn-outline btn-sm" onclick="unenroll(${p.id})">Leave</button>`
            : `<button class="btn btn-green btn-sm" onclick="enroll(${p.id})">Join</button>`)}
          ${admin ? `<button class="icon-btn" onclick="editPath(${p.id})">✎</button>
                     <button class="icon-btn danger" onclick="deletePath(${p.id})">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="view">
      <div class="hero"><h1>Learning Paths</h1><p>${isMentor() ? 'Open any path to review progress, leaderboard and activity.' : 'Pick a path to track your progress, or join a new one.'}</p></div>
      <div class="section-header">
        <span class="section-title">All Paths</span>
        ${admin ? `<button class="btn btn-primary btn-sm" onclick="newPath()">+ New Path</button>` : ''}
      </div>
      ${state.paths.length ? `<div class="path-grid">${cards}</div>`
        : `<div class="empty"><div class="empty-icon">🧭</div><h3>No learning paths yet</h3><p>${admin ? 'Create the first one to get started.' : 'Ask an admin to create one.'}</p></div>`}
    </div>`;
}

async function enroll(id) { await api('POST', `/paths/${id}/enroll`); toast('Joined!'); await goPaths(); }
async function unenroll(id) { await api('DELETE', `/paths/${id}/enroll`); toast('Left path.'); await goPaths(); }

function newPath() {
  formModal({
    title: 'New learning path',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Frontend Engineering' },
      { name: 'description', label: 'Description', textarea: true, placeholder: 'What this path covers' },
      { name: 'icon', label: 'Icon (emoji)', placeholder: '📚', value: '📚' },
      { name: 'color', label: 'Accent color (hex)', placeholder: '#2563eb', value: '#2563eb' },
    ],
    submitLabel: 'Create path',
    onSubmit: async (v) => { await api('POST', '/paths', v); toast('Path created.'); await goPaths(); },
  });
}
function editPath(id) {
  const p = state.paths.find((x) => x.id === id);
  formModal({
    title: 'Edit path',
    fields: [
      { name: 'name', label: 'Name', required: true, value: p.name },
      { name: 'description', label: 'Description', textarea: true, value: p.description },
      { name: 'icon', label: 'Icon (emoji)', value: p.icon },
      { name: 'color', label: 'Accent color (hex)', value: p.color },
    ],
    onSubmit: async (v) => { await api('PUT', `/paths/${id}`, v); toast('Saved.'); await goPaths(); },
  });
}
function deletePath(id) {
  const p = state.paths.find((x) => x.id === id);
  confirmModal('Delete path', `Delete "${p.name}" and all its modules, tasks, deliverables and everyone's progress? This cannot be undone.`, 'Delete path',
    async () => { await api('DELETE', `/paths/${id}`); toast('Path deleted.'); await goPaths(); });
}

// ---------------------------------------------------------------- PATH TRACKER
async function openPath(id) {
  state.pathId = id;
  state.viewingMember = null;
  state.openModules = new Set();
  state.openTasks = new Set();
  await loadPath();
  state.celebrated = new Set(completedModuleIds()); // already-complete modules never re-celebrate
  state.tab = isEnrolled() ? 'me' : 'leaderboard'; // mentors aren't enrolled -> oversight
  state.view = 'path';
  render();
  if (state.tab !== 'me') {
    try { await loadMembersIfNeeded(state.tab); renderTab(); } catch (e) { toast(e.message, true); }
  }
}
async function loadMembersIfNeeded(tab) {
  if (tab === 'leaderboard') {
    const m = await api('GET', `/paths/${state.pathId}/members`);
    state.members = m.members; state.totals = m.totals;
  } else if (tab === 'team') {
    state.team = await api('GET', `/paths/${state.pathId}/team`);
  }
}
async function loadPath() {
  const data = await api('GET', `/paths/${state.pathId}`);
  state.path = data;
  state.done.topics = new Set(data.progress.topics);
  state.done.tasks = new Set(data.progress.tasks);
  state.done.deliverables = new Set(data.progress.deliverables);
}

function pathTotals() {
  let topics = 0, tasks = 0;
  for (const m of state.path.modules) {
    topics += m.topics.length;
    for (const t of m.topics) tasks += t.tasks.length;
  }
  return { topics, tasks, deliverables: state.path.deliverables.length };
}
function combinedPct() {
  const tot = pathTotals();
  const total = tot.topics + tot.tasks + tot.deliverables;
  const done = state.done.topics.size + state.done.tasks.size + state.done.deliverables.size;
  return total ? Math.round((done / total) * 100) : 0;
}

function renderPath(app) {
  const p = state.path.path;
  if (state.viewingMember) return renderMemberView(app);
  const enrolled = isEnrolled();
  const tabs = [];
  if (enrolled) tabs.push(`<button class="tab ${state.tab === 'me' ? 'active' : ''}" onclick="switchTab('me')">My Progress</button>`);
  tabs.push(`<button class="tab ${state.tab === 'leaderboard' ? 'active' : ''}" onclick="switchTab('leaderboard')">Leaderboard</button>`);
  tabs.push(`<button class="tab ${state.tab === 'team' ? 'active' : ''}" onclick="switchTab('team')">Team Activity</button>`);
  app.innerHTML = `
    <div class="view">
      ${isStaff() && !enrolled ? `<div class="admin-bar" style="background:var(--blue-dim);border-color:var(--blue-border);color:var(--blue-light)">👁 Oversight view — read-only. Click a member to see their detailed progress.</div>` : ''}
      <div class="tabs">${tabs.join('')}</div>
      <div id="tabBody"></div>
    </div>`;
  document.title = `${p.name} · AcademyTrack`;
  renderTab();
}

async function switchTab(tab) {
  state.tab = tab;
  state.viewingMember = null;
  render();
  try { await loadMembersIfNeeded(tab); renderTab(); } catch (e) { toast(e.message, true); }
}

function renderTab() {
  const body = document.getElementById('tabBody');
  if (!body) return;
  if (state.tab === 'me') return renderTracker(body);
  if (state.tab === 'leaderboard') return renderLeaderboard(body);
  if (state.tab === 'team') return renderTeam(body);
}

// ---- My Progress (tracker) ----
function renderTracker(body) {
  renderTrackerFor(body, { avatar: state.user.avatar, name: state.user.name, done: state.done, readOnly: false });
}

// Renders the module/topic/task + deliverable tracker for a "subject" (the current user,
// or — read-only — another member when staff drills in). readOnly hides the toggle handlers.
function renderTrackerFor(body, subject) {
  const p = state.path.path;
  const done = subject.done;
  const ro = subject.readOnly;
  const tot = pathTotals();
  const topicsDone = done.topics.size, tasksDone = done.tasks.size, delivDone = done.deliverables.size;
  const totalAll = tot.topics + tot.tasks + tot.deliverables;
  const pct = totalAll ? Math.round(((topicsDone + tasksDone + delivDone) / totalAll) * 100) : 0;
  const lvl = getLevel(pct);
  const roStyle = ro ? ' style="cursor:default"' : '';
  const modDone = (m) => m.topics.length > 0
    && m.topics.every((t) => done.topics.has(t.id))
    && m.topics.every((t) => t.tasks.every((tk) => done.tasks.has(tk.id)));

  const badgesHtml = state.path.modules.map((m, mi) => {
    const earned = modDone(m);
    return `<div class="mod-badge ${earned ? 'earned' : ''}" title="${esc(m.name)}${earned ? ' — completed' : ''}"><span>${esc(m.icon || '📦')}</span><span class="mb-num">${twoDigit(mi)}</span></div>`;
  }).join('');

  const modulesHtml = state.path.modules.map((m, mi) => {
    const total = m.topics.length;
    const doneCount = m.topics.filter((t) => done.topics.has(t.id)).length;
    const mpct = total ? Math.round((doneCount / total) * 100) : 0;
    const open = state.openModules.has(m.id);
    const color = m.color || 'var(--blue)';
    const topicsHtml = m.topics.map((t) => {
      const tdone = done.topics.has(t.id);
      const tasksOpen = state.openTasks.has(t.id);
      const tasksHtml = t.tasks.length ? `
        <div class="exercise-toggle" onclick="toggleTasks(${t.id})">${tasksOpen ? '▾' : '▸'} ${t.tasks.length} task${t.tasks.length > 1 ? 's' : ''}</div>
        <div class="exercise-group" id="tasks_${t.id}" style="display:${tasksOpen ? 'block' : 'none'}">
          ${t.tasks.map((tk) => {
            const kd = done.tasks.has(tk.id);
            return `<div class="exercise-row ${kd ? 'done' : ''}">
              <div class="exercise-check ${kd ? 'done' : ''}"${ro ? roStyle : ` onclick="toggleTask(${tk.id})"`}></div>
              <div class="exercise-text">${esc(tk.description)}</div></div>`;
          }).join('')}
        </div>` : '';
      const link = t.link ? ` <a href="${esc(t.link)}" target="_blank" rel="noopener" title="Open resource" onclick="event.stopPropagation()" style="color:var(--blue-light);text-decoration:none">↗</a>` : '';
      return `
        <div class="topic-row ${tdone ? 'done' : ''}">
          <div class="topic-check ${tdone ? 'done' : ''}"${ro ? roStyle : ` onclick="toggleTopic(${t.id})"`}></div>
          <div class="topic-info">
            <div class="topic-name">${esc(t.name)}${link}</div>
            ${tasksHtml}
          </div>
        </div>`;
    }).join('');

    const quizzesHtml = (m.quizzes && m.quizzes.length) ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)">
        ${m.quizzes.map((q) => {
          const a = q.attempt;
          const status = a
            ? `<span style="color:${a.passed ? 'var(--green)' : 'var(--yellow)'};font-weight:600">${a.score}/${a.total} ${a.passed ? '✓ passed' : '· keep trying'}</span>`
            : '<span class="dim">not attempted</span>';
          return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
            <span style="font-size:16px">📝</span>
            <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(q.title)}</div>
              <div style="font-size:11px;color:var(--text-muted)">${q.question_count} question${q.question_count !== 1 ? 's' : ''} · ${status}</div></div>
            ${ro || !q.question_count ? '' : `<button class="btn btn-outline btn-sm" onclick="openQuiz(${q.id})">${a ? 'Retake' : 'Take quiz'}</button>`}
          </div>`;
        }).join('')}
      </div>` : '';

    return `
      <div class="module-section ${open ? 'open' : ''}" id="mod_${m.id}">
        <div class="module-header-row" onclick="toggleModule(${m.id})">
          <span class="module-chevron">▶</span>
          <span class="module-num">${twoDigit(mi)}</span>
          <span class="module-name">${esc(m.icon || '')} ${esc(m.name)}</span>
          <span class="module-progress-text">${doneCount}/${total}</span>
          <div class="module-mini-bar"><div class="module-mini-fill" style="width:${mpct}%;background:${color}"></div></div>
        </div>
        <div class="module-body">
          ${topicsHtml || '<div class="dim" style="padding:8px 0;font-size:13px">No topics yet.</div>'}
          ${quizzesHtml}
        </div>
      </div>`;
  }).join('');

  const delivHtml = state.path.deliverables.map((d) => {
    const dd = done.deliverables.has(d.id);
    return `
      <div class="topic-row ${dd ? 'done' : ''}">
        <div class="topic-check ${dd ? 'done' : ''}"${ro ? roStyle : ` onclick="toggleDeliverable(${d.id})"`}></div>
        <div class="topic-info">
          <div class="topic-name">${esc(d.title)}</div>
          ${d.description ? `<div class="topic-module-tag">${esc(d.description)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar" style="background:${lvl.color}22;color:${lvl.color}">${subject.avatar || '🙂'}</div>
      <div style="flex:1;min-width:200px">
        <div class="profile-name">${esc(p.icon || '')} ${esc(p.name)}</div>
        <div class="muted" style="font-size:13px;margin-top:2px">Level ${lvl.level} · ${lvl.name} · ${esc(subject.name)}</div>
        <div class="big-progress"><div class="big-progress-fill" style="width:${pct}%;background:${progressColor(pct)}"></div></div>
        <div class="progress-label"><span>${pct}% complete</span><span>${topicsDone + tasksDone + delivDone} / ${totalAll} items</span></div>
      </div>
    </div>

    ${state.path.modules.length ? `
      <div class="section-header" style="margin-top:20px"><span class="section-title">Module Badges</span></div>
      <div class="mod-badges">${badgesHtml}</div>` : ''}

    <div class="stats-row">
      <div class="stat-card"><div class="stat-num" style="color:var(--green)">${topicsDone}</div><div class="stat-label">/ ${tot.topics} topics</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--yellow)">${tasksDone}</div><div class="stat-label">/ ${tot.tasks} tasks</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#f97316">${delivDone}</div><div class="stat-label">/ ${tot.deliverables} deliverables</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--blue-light)">${pct}%</div><div class="stat-label">overall</div></div>
    </div>

    <div class="section-header">
      <span class="section-title">Modules</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="expandAll(true)">Expand all</button>
        <button class="btn btn-outline btn-sm" onclick="expandAll(false)">Collapse all</button>
      </div>
    </div>
    ${modulesHtml || '<div class="empty"><div class="empty-icon">📦</div><h3>No modules yet</h3></div>'}

    ${state.path.deliverables.length ? `
      <div class="section-header" style="margin-top:28px"><span class="section-title">Deliverables</span></div>
      <div class="module-section open"><div class="module-body" style="padding-top:12px">
        ${ro ? '' : '<div class="dim" style="font-size:12px;margin-bottom:8px">Mark each deliverable as submitted once you finish and send it.</div>'}
        ${delivHtml}
      </div></div>` : ''}`;
}

// Staff drill-down: view a specific member's progress (read-only).
async function viewMember(userId) {
  try {
    const d = await api('GET', `/paths/${state.pathId}/members/${userId}/progress`);
    state.viewingMember = {
      user: d.user,
      done: {
        topics: new Set(d.progress.topics),
        tasks: new Set(d.progress.tasks),
        deliverables: new Set(d.progress.deliverables),
      },
    };
    state.openModules = new Set();
    state.openTasks = new Set();
    render();
  } catch (e) { toast(e.message, true); }
}
function closeMember() { state.viewingMember = null; render(); }

function renderMemberView(app) {
  const vm = state.viewingMember;
  app.innerHTML = `
    <div class="view">
      <button class="back-btn" onclick="closeMember()">← Back to ${esc(state.path.path.name)}</button>
      <div class="admin-bar" style="background:var(--blue-dim);border-color:var(--blue-border);color:var(--blue-light)">👁 Read-only — ${esc(vm.user.name)}'s progress</div>
      <div id="tabBody"></div>
    </div>`;
  renderTrackerFor(document.getElementById('tabBody'), { avatar: vm.user.avatar, name: vm.user.name, done: vm.done, readOnly: true });
}

function toggleModule(id) {
  if (state.openModules.has(id)) state.openModules.delete(id);
  else state.openModules.add(id);
  document.getElementById('mod_' + id).classList.toggle('open');
}
function expandAll(open) {
  state.openModules = open ? new Set(state.path.modules.map((m) => m.id)) : new Set();
  renderTab();
}
// Expand/collapse a topic's task list. Persisted in state so a later re-render (e.g. after
// checking a task) keeps it exactly as the learner left it — nothing auto-collapses.
function toggleTasks(topicId) {
  const nowOpen = !state.openTasks.has(topicId);
  if (nowOpen) state.openTasks.add(topicId); else state.openTasks.delete(topicId);
  const el = document.getElementById('tasks_' + topicId);
  if (el) {
    el.style.display = nowOpen ? 'block' : 'none';
    const tog = el.previousElementSibling;
    if (tog && tog.classList.contains('exercise-toggle')) {
      tog.textContent = (nowOpen ? '▾ ' : '▸ ') + tog.textContent.replace(/^[▸▾]\s*/, '');
    }
  }
}

// Module ids that are fully complete (all topics + all their tasks done) for the current user.
function completedModuleIds() {
  const ids = [];
  for (const m of state.path.modules) {
    if (!m.topics.length) continue;
    const allTopics = m.topics.every((t) => state.done.topics.has(t.id));
    const allTasks = m.topics.every((t) => t.tasks.every((tk) => state.done.tasks.has(tk.id)));
    if (allTopics && allTasks) ids.push(m.id);
  }
  return ids;
}

// ---- optimistic progress toggles ----
async function toggleGeneric(kind, id, apiPath, field) {
  const set = state.done[kind];
  const nowDone = !set.has(id);
  const before = new Set(completedModuleIds()); // modules complete BEFORE this change
  if (nowDone) set.add(id); else set.delete(id);
  renderTab();
  try {
    await api('POST', apiPath, { [field]: id, done: nowDone });
    if (nowDone) {
      toast(MOTIVATIONAL[Math.floor(combinedPct() / 15) % MOTIVATIONAL.length]);
      // Celebrate ONLY a module that just transitioned incomplete -> complete via this toggle.
      const newlyComplete = completedModuleIds().find((mid) => !before.has(mid));
      if (newlyComplete != null && !state.celebrated.has(newlyComplete)) {
        state.celebrated.add(newlyComplete);
        const mod = state.path.modules.find((m) => m.id === newlyComplete);
        if (mod) showCongrats('Module complete!', `You finished "${mod.name}"`, `${mod.icon || '🏅'} ${mod.name}`);
      }
    }
  } catch (e) {
    if (nowDone) set.delete(id); else set.add(id);
    renderTab();
    toast(e.message, true);
  }
}
const toggleTopic = (id) => toggleGeneric('topics', id, '/progress/topic', 'topic_id');
const toggleTask = (id) => toggleGeneric('tasks', id, '/progress/task', 'task_id');
const toggleDeliverable = (id) => toggleGeneric('deliverables', id, '/progress/deliverable', 'deliverable_id');

// ---- Leaderboard ----
function memberPct(m) {
  const total = state.totals.topics + state.totals.tasks + state.totals.deliverables;
  const done = m.topics_done + m.tasks_done + m.deliverables_done;
  return total ? Math.round((done / total) * 100) : 0;
}
function renderLeaderboard(body) {
  if (!state.members) { body.innerHTML = '<div class="spinner">Loading…</div>'; return; }
  const ranked = [...state.members].map((m) => ({ ...m, pct: memberPct(m) })).sort((a, b) => b.pct - a.pct);
  const rows = ranked.map((m, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const topClass = i < 3 ? `top${i + 1}` : '';
    const clickable = isStaff() ? ` onclick="viewMember(${m.id})" style="cursor:pointer"` : '';
    return `
      <div class="lb-row ${topClass}"${clickable}>
        <div class="lb-rank">${medal}</div>
        <div class="lb-avatar" style="background:${progressColor(m.pct)}22">${m.avatar || '🙂'}</div>
        <div class="lb-name">${esc(m.name)}${m.id === state.user.id ? ' <span class="dim">(you)</span>' : ''}${isStaff() ? ' <span class="dim">›</span>' : ''}</div>
        <div class="lb-bar-wrap"><div class="lb-bar"><div class="lb-fill" style="width:${m.pct}%;background:${progressColor(m.pct)}"></div></div></div>
        <div class="lb-pct">${m.pct}%</div>
      </div>`;
  }).join('');
  body.innerHTML = `
    <div class="hero" style="padding:20px 0 24px"><h1>Leaderboard</h1><p>Who's making the most progress?</p></div>
    ${ranked.length ? `<div class="leaderboard">${rows}</div>` : '<div class="empty"><div class="empty-icon">🏁</div><h3>No members enrolled yet</h3></div>'}`;
}

// ---- Team activity ----
function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}
function renderTeam(body) {
  const T = state.team;
  if (!T) { body.innerHTML = '<div class="spinner">Loading…</div>'; return; }
  const { totals, modules, members, activity, path: p } = T;
  const totalItems = totals.topics + totals.tasks + totals.deliverables;
  const pctOf = (m) => (totalItems ? Math.round(((m.topics_done + m.tasks_done + m.deliverables_done) / totalItems) * 100) : 0);
  const moduleById = {}; modules.forEach((m) => (moduleById[m.id] = m));
  const pmOf = (m, modId) => m.perModule.find((x) => x.module_id === modId) || { topics_done: 0, tasks_done: 0 };
  const fullyDone = (m, mod) => pmOf(m, mod.id).topics_done >= mod.topic_total && pmOf(m, mod.id).tasks_done >= mod.task_total;
  const completedModules = (m) => modules.filter((mod) => mod.topic_total > 0 && fullyDone(m, mod));
  const currentModule = (m) => modules.find((mod) => !fullyDone(m, mod)) || null; // modules come ordered by position
  const meId = state.user.id;
  const rn = members.length;
  const avg1 = (fn) => (rn ? Math.round((members.reduce((s, m) => s + fn(m), 0) / rn) * 10) / 10 : 0);
  const avgTopics = avg1((m) => m.topics_done), avgTasks = avg1((m) => m.tasks_done),
        avgDel = avg1((m) => m.deliverables_done), avgMods = avg1((m) => completedModules(m).length);

  const sorted = [...members].sort((a, b) => pctOf(b) - pctOf(a));
  const top3 = sorted.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const buildStep = (m, rank, cls) => {
    const pct = pctOf(m), color = progressColor(pct), lv = getLevel(pct);
    return `<div class="podium-step ${cls}">
      <div class="podium-medal">${medals[rank]}</div>
      <div class="podium-avatar" style="background:${color}22;color:${color}">${m.avatar || '🙂'}</div>
      <div class="podium-name">${esc(m.name)}${m.id === meId ? ' <span style="font-size:10px;color:var(--blue-light)">(you)</span>' : ''}</div>
      <div class="podium-pct" style="color:${color}">${pct}%</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${lv.name}</div>
    </div>`;
  };
  let podiumHtml = '';
  if (top3.length === 1) podiumHtml = buildStep(top3[0], 0, 'gold');
  else if (top3.length === 2) podiumHtml = buildStep(top3[1], 1, 'silver') + buildStep(top3[0], 0, 'gold');
  else if (top3.length >= 3) podiumHtml = buildStep(top3[1], 1, 'silver') + buildStep(top3[0], 0, 'gold') + buildStep(top3[2], 2, 'bronze');

  const modCounts = {};
  members.forEach((m) => { const cm = currentModule(m); if (cm) modCounts[cm.id] = (modCounts[cm.id] || 0) + 1; });
  let mostActiveMod = null, mac = 0;
  Object.entries(modCounts).forEach(([mid, cnt]) => { if (cnt > mac) { mac = cnt; mostActiveMod = moduleById[mid]; } });
  let mostImproved = null, mic = 0;
  members.forEach((m) => { if ((m.week_count || 0) > mic) { mic = m.week_count; mostImproved = m; } });

  const meMember = members.find((m) => m.id === meId);
  const myMod = meMember ? currentModule(meMember) : null;
  const sameMod = myMod ? members.filter((m) => m.id !== meId && currentModule(m) && currentModule(m).id === myMod.id) : [];

  const actIcons = { topic: '📘', task: '🔬', deliverable: '📦', module: '🏅' };
  const actColors = { topic: 'var(--blue-dim)', task: 'var(--yellow-dim)', deliverable: 'rgba(249,115,22,.12)', module: 'rgba(234,179,8,.2)' };
  const acts = (activity || []).slice(0, 15).map((a) => `
    <div class="activity-item">
      <div class="activity-icon" style="background:${actColors[a.type] || 'var(--bg-elevated)'}">${actIcons[a.type] || '📌'}</div>
      <div class="activity-text"><strong>${esc(a.user_name)}${a.user_id === meId ? ' (you)' : ''}</strong> finished <span style="color:var(--text)">${esc(a.detail || a.type)}</span></div>
      <div class="activity-time">${timeAgo(a.created_at)}</div>
    </div>`).join('');

  const milestones = [];
  sorted.forEach((m) => completedModules(m).forEach((mod) => milestones.push({ name: m.name, mod })));
  const milestoneHtml = milestones.slice(0, 12).map((x) => `
    <div class="activity-item">
      <div class="activity-icon" style="background:rgba(234,179,8,.2)">${esc(x.mod.icon || '🏅')}</div>
      <div class="activity-text"><strong>${esc(x.name)}</strong> completed <span style="color:var(--yellow);font-weight:600">${esc(x.mod.name)}</span></div>
    </div>`).join('');

  const moduleProgressHtml = modules.map((mod) => {
    const here = members.filter((m) => { const cm = currentModule(m); return cm && cm.id === mod.id; }).length;
    const completedCount = members.filter((m) => mod.topic_total > 0 && fullyDone(m, mod)).length;
    const denom = mod.topic_total + mod.task_total;
    const avgPct = (rn && denom) ? Math.round(members.reduce((s, m) => { const pm = pmOf(m, mod.id); return s + ((pm.topics_done + pm.tasks_done) / denom) * 100; }, 0) / rn) : 0;
    const isMyMod = myMod && myMod.id === mod.id;
    return `<div class="team-card" style="display:flex;align-items:center;gap:14px;padding:12px 16px;${isMyMod ? 'border-color:var(--blue-border);background:var(--blue-dim)' : ''}">
      <span style="font-size:20px">${esc(mod.icon || '📦')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${String(mod.position).padStart(2, '0')} — ${esc(mod.name)}${isMyMod ? ' <span style="font-size:10px;color:var(--blue-light)">(you are here)</span>' : ''}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <div class="module-mini-bar" style="width:120px"><div class="module-mini-fill" style="width:${avgPct}%;background:${progressColor(avgPct)}"></div></div>
          <span style="font-size:11px;color:var(--text-muted)">${avgPct}% avg · ${completedCount} completed · ${here} here</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const staffMembers = isStaff() ? `
    <div class="section-header" style="margin-top:28px"><span class="section-title">Members — click to view progress</span></div>
    <div class="qa-grid">${sorted.map((m) => {
      const pct = pctOf(m);
      return `<div class="qa-card" onclick="viewMember(${m.id})">
        <div class="qa-card-top">
          <div class="qa-avatar" style="background:${progressColor(pct)}22">${m.avatar || '🙂'}</div>
          <div class="qa-info"><div class="qa-name">${esc(m.name)}</div><div class="qa-role">${m.topics_done}/${totals.topics} topics</div></div>
          <div class="qa-pct">${pct}%</div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${progressColor(pct)}"></div></div>
      </div>`;
    }).join('')}</div>` : '';

  body.innerHTML = `
    <div class="hero" style="padding-top:20px;padding-bottom:16px">
      <h1 style="font-size:1.6rem">${esc(p.icon || '')} ${esc(p.name)}</h1>
      <p>${rn} member${rn !== 1 ? 's' : ''} on this path</p>
    </div>
    ${top3.length ? `<div style="margin-bottom:28px"><div class="section-header"><span class="section-title">Top Performers</span></div><div class="podium">${podiumHtml}</div></div>` : ''}
    <div class="stats-row" style="margin-bottom:28px">
      <div class="stat-card"><div class="stat-num" style="color:var(--blue-light)">${avgTopics}<span style="font-size:.6em;color:var(--text-dim)">/${totals.topics}</span></div><div class="stat-label">Avg Topics</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--yellow)">${avgTasks}<span style="font-size:.6em;color:var(--text-dim)">/${totals.tasks}</span></div><div class="stat-label">Avg Tasks</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#f97316">${avgDel}<span style="font-size:.6em;color:var(--text-dim)">/${totals.deliverables}</span></div><div class="stat-label">Avg Deliverables</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--green)">${avgMods}<span style="font-size:.6em;color:var(--text-dim)">/${totals.modules}</span></div><div class="stat-label">Avg Modules</div></div>
    </div>
    <div class="duo-grid">
      ${mostActiveMod ? `<div class="team-card"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:10px">Most Active Module</div><div style="display:flex;align-items:center;gap:10px"><span style="font-size:24px">${esc(mostActiveMod.icon || '📦')}</span><div><div style="font-size:15px;font-weight:700">${esc(mostActiveMod.name)}</div><div style="font-size:12px;color:var(--text-muted)">${mac} member${mac !== 1 ? 's' : ''} currently here</div></div></div></div>` : '<div></div>'}
      ${mostImproved && mic > 0 ? `<div class="team-card" style="border-color:rgba(239,68,68,.25)"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:10px">Most Improved This Week</div><div style="display:flex;align-items:center;gap:10px"><span style="font-size:24px">🔥</span><div><div style="font-size:15px;font-weight:700">${esc(mostImproved.name)}${mostImproved.id === meId ? ' <span style="font-size:10px;color:var(--blue-light)">(you!)</span>' : ''}</div><div style="font-size:12px;color:var(--text-muted)">${mic} item${mic !== 1 ? 's' : ''} completed this week</div></div></div></div>` : `<div class="team-card"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:10px">Most Improved This Week</div><div style="font-size:13px;color:var(--text-muted);padding:8px 0">No activity recorded this week yet.</div></div>`}
    </div>
    ${myMod ? `<div class="team-card" style="border-color:var(--blue-border);margin-bottom:28px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:10px">You're Currently In</div><div style="display:flex;align-items:center;gap:10px;margin-bottom:${sameMod.length ? 8 : 0}px"><span style="font-size:24px">${esc(myMod.icon || '📦')}</span><div><div style="font-size:15px;font-weight:700">${esc(myMod.name)}</div>${sameMod.length ? `<div style="font-size:12px;color:var(--text-muted)">${sameMod.length} teammate${sameMod.length !== 1 ? 's' : ''} also here</div>` : `<div style="font-size:12px;color:var(--text-muted)">You're the pioneer here!</div>`}</div></div>${sameMod.length ? `<div class="same-mod-avatars">${sameMod.map((sm) => `<div class="same-mod-avatar"><span>${sm.avatar || '🙂'}</span> ${esc(sm.name)}</div>`).join('')}</div>` : ''}</div>` : ''}
    <div class="duo-grid">
      <div><div class="section-header"><span class="section-title">Recent Activity</span></div><div class="team-card" style="padding:12px 16px">${acts ? `<div class="activity-list">${acts}</div>` : '<div style="font-size:13px;color:var(--text-muted);padding:16px 0;text-align:center">No activity yet. Complete a topic to get started!</div>'}</div></div>
      <div><div class="section-header"><span class="section-title">Milestone Wall</span></div><div class="team-card" style="padding:12px 16px">${milestoneHtml ? `<div class="activity-list">${milestoneHtml}</div>` : '<div style="font-size:13px;color:var(--text-muted);padding:16px 0;text-align:center">No modules completed yet.</div>'}</div></div>
    </div>
    <div style="margin-bottom:28px"><div class="section-header"><span class="section-title">Module Progress — Where is everyone?</span></div>${moduleProgressHtml || '<div class="dim">No modules yet.</div>'}</div>
    ${staffMembers}`;
}

// ---------------------------------------------------------------- ADMIN CONTENT EDITOR
async function goAdmin(id) {
  state.pathId = id;
  await loadPath();
  state.view = 'admin';
  render();
}

function renderAdmin(app) {
  const p = state.path.path;
  const modules = state.path.modules.map((m, mi) => {
    const topics = m.topics.map((t) => {
      const tasks = t.tasks.map((tk) => `
        <div class="edit-row">
          <span class="grip">·</span>
          <span class="label">${esc(tk.description)}</span>
          <button class="icon-btn" onclick="editTask(${tk.id})">✎</button>
          <button class="icon-btn danger" onclick="delTask(${tk.id})">🗑</button>
        </div>`).join('');
      return `
        <div class="edit-row">
          <span class="grip">${twoDigit(mi)}·</span>
          <span class="label"><strong>${esc(t.name)}</strong></span>
          <button class="icon-btn" onclick="addTask(${t.id})">+ task</button>
          <button class="icon-btn" onclick="editTopic(${t.id})">✎</button>
          <button class="icon-btn danger" onclick="delTopic(${t.id})">🗑</button>
        </div>
        <div class="nested">${tasks || '<div class="dim" style="font-size:12px;padding:4px 0">No tasks.</div>'}</div>`;
    }).join('');
    return `
      <div class="admin-module">
        <h3>${esc(m.icon || '📦')} ${esc(m.name)}
          <span style="margin-left:auto;display:flex;gap:6px">
            <button class="icon-btn" onclick="addTopic(${m.id})">+ topic</button>
            <button class="icon-btn" onclick="addQuiz(${m.id})">+ quiz</button>
            <button class="icon-btn" onclick="editModule(${m.id})">✎</button>
            <button class="icon-btn danger" onclick="delModule(${m.id})">🗑</button>
          </span>
        </h3>
        <div class="nested">${topics || '<div class="dim" style="font-size:12px;padding:4px 0">No topics.</div>'}</div>
        ${(m.quizzes && m.quizzes.length) ? `<div class="nested" style="margin-top:8px">${m.quizzes.map((q) => `
          <div class="edit-row">
            <span class="grip">📝</span>
            <span class="label">${esc(q.title)} <span class="dim">(${q.question_count} q)</span></span>
            <button class="icon-btn" onclick="manageQuiz(${q.id})">questions</button>
            <button class="icon-btn danger" onclick="delQuiz(${q.id})">🗑</button>
          </div>`).join('')}</div>` : ''}
      </div>`;
  }).join('');

  const delivs = state.path.deliverables.map((d) => `
    <div class="edit-row">
      <span class="grip">🎯</span>
      <span class="label"><strong>${esc(d.title)}</strong>${d.description ? ` <span class="dim">— ${esc(d.description)}</span>` : ''}</span>
      <button class="icon-btn" onclick="editDeliv(${d.id})">✎</button>
      <button class="icon-btn danger" onclick="delDeliv(${d.id})">🗑</button>
    </div>`).join('');

  app.innerHTML = `
    <div class="view">
      <div class="admin-bar">✎ ADMIN — editing content for this path. Learners see changes immediately.</div>
      <div class="hero" style="padding:8px 0 24px"><h1>${esc(p.icon || '')} ${esc(p.name)}</h1><p>${esc(p.description || '')}</p></div>

      <div class="section-header"><span class="section-title">Modules</span><button class="btn btn-primary btn-sm" onclick="addModule()">+ Module</button></div>
      ${modules || '<div class="empty"><div class="empty-icon">📦</div><h3>No modules yet</h3><p>Add the first module.</p></div>'}

      <div class="section-header" style="margin-top:28px"><span class="section-title">Deliverables</span><button class="btn btn-primary btn-sm" onclick="addDeliv()">+ Deliverable</button></div>
      <div class="admin-module">${delivs || '<div class="dim" style="font-size:13px">No deliverables yet.</div>'}</div>
    </div>`;
}

async function reloadAdmin() { await loadPath(); render(); }

// modules
function addModule() {
  formModal({ title: 'New module', fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'icon', label: 'Icon (emoji)', placeholder: '📦' },
    { name: 'color', label: 'Color (hex)', placeholder: '#2563eb' },
  ], onSubmit: async (v) => { await api('POST', `/paths/${state.pathId}/modules`, v); toast('Module added.'); await reloadAdmin(); } });
}
function editModule(id) {
  const m = findModule(id);
  formModal({ title: 'Edit module', fields: [
    { name: 'name', label: 'Name', required: true, value: m.name },
    { name: 'icon', label: 'Icon (emoji)', value: m.icon },
    { name: 'color', label: 'Color (hex)', value: m.color },
  ], onSubmit: async (v) => { await api('PUT', `/modules/${id}`, v); toast('Saved.'); await reloadAdmin(); } });
}
function delModule(id) {
  const m = findModule(id);
  confirmModal('Delete module', `Delete "${m.name}" and all its topics and tasks?`, 'Delete',
    async () => { await api('DELETE', `/modules/${id}`); toast('Deleted.'); await reloadAdmin(); });
}
// topics
function addTopic(moduleId) {
  formModal({ title: 'New topic', fields: [{ name: 'name', label: 'Name', required: true }],
    onSubmit: async (v) => { await api('POST', `/modules/${moduleId}/topics`, v); toast('Topic added.'); await reloadAdmin(); } });
}
function editTopic(id) {
  const t = findTopic(id);
  formModal({ title: 'Edit topic', fields: [{ name: 'name', label: 'Name', required: true, value: t.name }],
    onSubmit: async (v) => { await api('PUT', `/topics/${id}`, v); toast('Saved.'); await reloadAdmin(); } });
}
function delTopic(id) {
  const t = findTopic(id);
  confirmModal('Delete topic', `Delete "${t.name}" and its tasks?`, 'Delete',
    async () => { await api('DELETE', `/topics/${id}`); toast('Deleted.'); await reloadAdmin(); });
}
// tasks
function addTask(topicId) {
  formModal({ title: 'New task', fields: [{ name: 'description', label: 'Task', required: true, textarea: true }],
    onSubmit: async (v) => { await api('POST', `/topics/${topicId}/tasks`, v); toast('Task added.'); await reloadAdmin(); } });
}
function editTask(id) {
  const tk = findTask(id);
  formModal({ title: 'Edit task', fields: [{ name: 'description', label: 'Task', required: true, textarea: true, value: tk.description }],
    onSubmit: async (v) => { await api('PUT', `/tasks/${id}`, v); toast('Saved.'); await reloadAdmin(); } });
}
function delTask(id) {
  confirmModal('Delete task', 'Delete this task?', 'Delete',
    async () => { await api('DELETE', `/tasks/${id}`); toast('Deleted.'); await reloadAdmin(); });
}
// deliverables
function moduleOptions() {
  return [{ value: '', label: '— none —' }].concat(state.path.modules.map((m) => ({ value: m.id, label: m.name })));
}
function addDeliv() {
  formModal({ title: 'New deliverable', fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', textarea: true },
    { name: 'module_id', label: 'Related module (optional)', options: moduleOptions(), value: '' },
  ], onSubmit: async (v) => { v.module_id = v.module_id || null; await api('POST', `/paths/${state.pathId}/deliverables`, v); toast('Deliverable added.'); await reloadAdmin(); } });
}
function editDeliv(id) {
  const d = state.path.deliverables.find((x) => x.id === id);
  formModal({ title: 'Edit deliverable', fields: [
    { name: 'title', label: 'Title', required: true, value: d.title },
    { name: 'description', label: 'Description', textarea: true, value: d.description },
    { name: 'module_id', label: 'Related module (optional)', options: moduleOptions(), value: d.module_id ?? '' },
  ], onSubmit: async (v) => { v.module_id = v.module_id || null; await api('PUT', `/deliverables/${id}`, v); toast('Saved.'); await reloadAdmin(); } });
}
function delDeliv(id) {
  confirmModal('Delete deliverable', 'Delete this deliverable?', 'Delete',
    async () => { await api('DELETE', `/deliverables/${id}`); toast('Deleted.'); await reloadAdmin(); });
}

function findModule(id) { return state.path.modules.find((m) => m.id === id); }
function findTopic(id) { for (const m of state.path.modules) { const t = m.topics.find((x) => x.id === id); if (t) return t; } }
function findTask(id) { for (const m of state.path.modules) for (const t of m.topics) { const tk = t.tasks.find((x) => x.id === id); if (tk) return tk; } }

// ---------------------------------------------------------------- USERS (admin)
async function goUsers() {
  const { users } = await api('GET', '/users');
  state.users = users;
  state.view = 'users';
  render();
}

function renderUsers(app) {
  const rows = state.users.map((u) => {
    const chips = (u.paths || []).map((p) =>
      `<span class="same-mod-avatar">${esc(p.name)} <span onclick="removeFromPath(${u.id}, ${p.id})" title="Remove from ${esc(p.name)}" style="cursor:pointer;color:var(--red);font-weight:800;padding:0 2px">×</span></span>`).join('');
    return `<div class="team-card">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span class="qa-avatar" style="width:36px;height:36px;font-size:16px;background:var(--bg-elevated)">${u.avatar || '🙂'}</span>
        <div style="flex:1;min-width:160px">
          <div style="font-weight:700">${esc(u.name)}</div>
          <div class="dim" style="font-size:12px">${esc(u.email)}</div>
        </div>
        <select class="form-input" style="width:auto;padding:5px 8px" onchange="changeRole(${u.id}, this.value)">
          ${['learner', 'mentor', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <button class="icon-btn" onclick="resetPassword(${u.id})">🔑 Reset password</button>
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="dim" style="font-size:12px">Learning paths:</span>
        ${chips || '<span class="dim" style="font-size:12px">not enrolled in any</span>'}
      </div>
    </div>`;
  }).join('');
  app.innerHTML = `
    <div class="view">
      <div class="hero" style="padding:20px 0 24px"><h1>Users</h1><p>Manage learners, mentors and admins.</p></div>
      <div class="section-header">
        <span class="section-title">People (${state.users.length})</span>
        <button class="btn btn-primary btn-sm" onclick="addMentor()">+ Add mentor</button>
      </div>
      ${rows || '<div class="dim">No users yet.</div>'}
      <p class="dim" style="font-size:12px;margin-top:12px">Change a role with the dropdown, reset a password, or click × on a path to unenroll someone (their progress is kept). Mentors get read-only oversight across all paths.</p>
    </div>`;
}

function resetPassword(id) {
  const u = state.users.find((x) => x.id === id);
  formModal({
    title: `Reset password — ${u ? u.name : ''}`,
    fields: [{ name: 'password', label: 'New password', type: 'password', required: true, placeholder: 'at least 6 characters' }],
    submitLabel: 'Set password',
    onSubmit: async (v) => { await api('PUT', `/users/${id}/password`, { password: v.password }); toast('Password reset.'); },
  });
}

function removeFromPath(userId, pathId) {
  const u = state.users.find((x) => x.id === userId);
  const p = u && (u.paths || []).find((x) => x.id === pathId);
  confirmModal('Remove from path',
    `Remove ${u ? u.name : 'this user'} from "${p ? p.name : ''}"? Their progress is kept, but they'll no longer be enrolled.`,
    'Remove',
    async () => { await api('DELETE', `/users/${userId}/enrollments/${pathId}`); toast('Removed from path.'); await goUsers(); });
}

function addMentor() {
  formModal({
    title: 'Add a mentor',
    fields: [
      { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Sam Rivera' },
      { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'sam@company.com' },
      { name: 'password', label: 'Temporary password', required: true, placeholder: 'they log in with this (min 6 chars)' },
    ],
    submitLabel: 'Create mentor',
    onSubmit: async (v) => { await api('POST', '/users', { ...v, role: 'mentor' }); toast('Mentor added.'); await goUsers(); },
  });
}

async function changeRole(id, role) {
  try { await api('PUT', `/users/${id}/role`, { role }); toast('Role updated.'); }
  catch (e) { toast(e.message, true); }
  await goUsers(); // refresh (also resets the dropdown if the change was rejected)
}

// ---------------------------------------------------------------- WEEKLY REPORT (admin + mentor)
async function openReport(pathId) {
  openModal('<div class="spinner">Building report…</div>');
  try {
    const data = await api('GET', `/paths/${pathId}/report`);
    const html = buildReportHtml(data);
    state._reportHtml = html;
    openModal(`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h2 style="margin:0">Weekly report</h2>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
      </div>
      <p class="dim" style="font-size:13px;margin-bottom:12px">${esc(data.path.name)} · last 7 days. Open in a new tab to print or paste into an email, or copy the HTML.</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-primary btn-sm" onclick="openReportTab()">Open in new tab</button>
        <button class="btn btn-outline btn-sm" onclick="copyReport()">Copy HTML</button>
      </div>
      <textarea class="form-input" style="height:280px;font-family:monospace;font-size:11px" readonly>${esc(html)}</textarea>`);
  } catch (e) { closeModal(); toast(e.message, true); }
}
function openReportTab() {
  const blob = new Blob([state._reportHtml || ''], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
}
function copyReport() {
  navigator.clipboard.writeText(state._reportHtml || '')
    .then(() => toast('Report HTML copied!'))
    .catch(() => toast('Copy failed', true));
}

function buildReportHtml(data) {
  const { path, totals, modules, members } = data;
  const totalItems = totals.topics + totals.tasks + totals.deliverables;
  const pctOf = (m) => (totalItems ? Math.round(((m.topics_done + m.tasks_done + m.deliverables_done) / totalItems) * 100) : 0);
  const moduleById = {}; modules.forEach((m) => (moduleById[m.id] = m));
  const completedModules = (m) => m.perModule.filter((pm) => {
    const mod = moduleById[pm.module_id];
    return mod && mod.topic_total > 0 && pm.topics_done >= mod.topic_total && pm.tasks_done >= mod.task_total;
  }).map((pm) => moduleById[pm.module_id]);

  const sorted = [...members].sort((a, b) => pctOf(b) - pctOf(a));
  const rn = sorted.length;
  const avg1 = (fn) => (rn ? Math.round((sorted.reduce((s, m) => s + fn(m), 0) / rn) * 10) / 10 : 0);
  const avgPct = rn ? Math.round(sorted.reduce((s, m) => s + pctOf(m), 0) / rn) : 0;
  const avgTopics = avg1((m) => m.topics_done);
  const avgTasks = avg1((m) => m.tasks_done);
  const avgDel = avg1((m) => m.deliverables_done);
  const avgMods = avg1((m) => completedModules(m).length);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const medals = ['🥇', '🥈', '🥉'];
  const barColor = (pct) => (pct >= 75 ? '#22c55e' : pct >= 40 ? '#0891b2' : pct >= 20 ? '#7c3aed' : '#2563eb');
  const emailBar = (pct, color, w) => `<table cellpadding="0" cellspacing="0" width="${w || 120}" style="display:inline-table;vertical-align:middle"><tr><td style="background:#e5e7eb;border-radius:4px;height:8px;padding:0"><div style="width:${pct}%;height:8px;background:${color};border-radius:4px"></div></td></tr></table>`;
  const stat = (val, sub, color, denom) => `
    <td width="16.6%" style="padding:20px 8px;text-align:center;border-right:1px solid #e5e7eb">
      <div style="font-size:28px;font-weight:800;color:${color}">${val}${denom ? `<span style="font-size:14px;color:#9ca3af">/${denom}</span>` : ''}</div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-top:2px">${sub}</div>
    </td>`;

  const lbRows = sorted.slice(0, 10).map((m, rank) => {
    const pct = pctOf(m), bc = barColor(pct), lv = getLevel(pct);
    const badges = completedModules(m).map((mod) => mod.icon || '🏅').join(' ');
    return `<tr style="border-bottom:1px solid #e5e7eb;${rank < 3 ? 'background:#fefce8' : ''}">
      <td style="padding:14px 16px;font-size:18px;text-align:center;width:50px">${medals[rank] || rank + 1}</td>
      <td style="padding:14px 16px">
        <div style="font-weight:700;color:#111827;font-size:14px">${esc(m.name)}</div>
        <div style="font-size:11px;color:${lv.color};font-weight:600">Lv.${lv.level} ${lv.name}</div>
      </td>
      <td style="padding:14px 16px">
        ${emailBar(pct, bc, 120)} <span style="font-weight:800;color:${bc};font-size:16px">${pct}%</span>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px">${m.topics_done} topics &middot; ${m.tasks_done} tasks &middot; ${m.deliverables_done}/${totals.deliverables} 📦</div>
      </td>
      <td style="padding:14px 16px;font-size:14px">${badges || '—'}</td>
    </tr>`;
  }).join('');

  const rows = sorted.map((m, rank) => {
    const pct = pctOf(m), bc = barColor(pct), lv = getLevel(pct);
    return `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:12px 16px;font-weight:700;color:#374151">${rank + 1}</td>
      <td style="padding:12px 16px;font-weight:600;color:#111827">${esc(m.name)}</td>
      <td style="padding:12px 16px;color:#6b7280">${esc(m.email || '')}</td>
      <td style="padding:12px 16px">${emailBar(pct, bc, 80)} <span style="font-weight:700;color:${bc}">${pct}%</span></td>
      <td style="padding:12px 16px;color:#374151">${m.topics_done}/${totals.topics}</td>
      <td style="padding:12px 16px;color:#374151">${m.tasks_done}/${totals.tasks}</td>
      <td style="padding:12px 16px;color:#374151">${m.deliverables_done}/${totals.deliverables}</td>
      <td style="padding:12px 16px;color:#374151">${completedModules(m).length}/${totals.modules}</td>
      <td style="padding:12px 16px"><span style="color:${lv.color};font-size:11px;font-weight:700">${lv.name}</span></td>
    </tr>`;
  }).join('');

  const moduleProgress = modules.map((mod) => {
    const denom = rn * mod.topic_total, taskDenom = rn * mod.task_total;
    const topicDone = sorted.reduce((s, m) => s + (m.perModule.find((x) => x.module_id === mod.id)?.topics_done || 0), 0);
    const taskDone = sorted.reduce((s, m) => s + (m.perModule.find((x) => x.module_id === mod.id)?.tasks_done || 0), 0);
    const topicPct = denom ? Math.round((topicDone / denom) * 100) : 0;
    const taskPct = taskDenom ? Math.round((taskDone / taskDenom) * 100) : 0;
    return `<tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:8px 16px;font-size:14px">${esc(mod.icon || '📦')}</td>
      <td style="padding:8px 16px;font-weight:700;color:#6b7280;font-family:monospace;font-size:12px">${String(mod.position).padStart(2, '0')}</td>
      <td style="padding:8px 16px;color:#374151;font-size:13px">${esc(mod.name)}</td>
      <td style="padding:8px 16px">${emailBar(topicPct, '#2563eb', 60)} <span style="font-size:12px;font-weight:600;color:#2563eb">${topicPct}%</span></td>
      <td style="padding:8px 16px">${emailBar(taskPct, '#eab308', 60)} <span style="font-size:12px;font-weight:600;color:#b45309">${taskPct}%</span></td>
    </tr>`;
  }).join('');

  const th = (t, align) => `<th style="padding:10px 16px;text-align:${align || 'left'};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">${t}</th>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${esc(path.name)} — Weekly Report</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f9fafb;margin:0;padding:32px">
  <table width="850" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <tr><td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);background-color:#1e3a8a;padding:32px;color:#fff">
      <div style="font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:.7;margin-bottom:6px">Weekly Progress Report</div>
      <div style="font-size:28px;font-weight:800;margin-bottom:4px">${esc(path.icon || '')} ${esc(path.name)}</div>
      <div style="opacity:.8;font-size:14px">${dateStr}</div>
    </td></tr>
    <tr><td style="padding:0;background:#f8fafc;border-bottom:1px solid #e5e7eb">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${stat(sorted.length, 'Members', '#2563eb')}
        ${stat(avgPct + '%', 'Avg Progress', '#22c55e')}
        ${stat(avgTopics, 'Avg Topics', '#f59e0b', totals.topics)}
        ${stat(avgTasks, 'Avg Tasks', '#8b5cf6', totals.tasks)}
        ${stat(avgDel, 'Avg Deliverables', '#f97316', totals.deliverables)}
        <td width="16.6%" style="padding:20px 8px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#374151">${avgMods}<span style="font-size:14px;color:#9ca3af">/${totals.modules}</span></div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-top:2px">Avg Modules</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:24px">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:14px">Leaderboard</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb">${th('Rank', 'center')}${th('Name')}${th('Progress')}${th('Badges')}</tr></thead>
        <tbody>${lbRows || '<tr><td colspan="4" style="padding:16px;color:#9ca3af">No members enrolled.</td></tr>'}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:0 24px 24px">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:14px">Individual Progress</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb">${th('#')}${th('Name')}${th('Email')}${th('Overall')}${th('Topics')}${th('Tasks')}${th('Deliverables')}${th('Modules')}${th('Level')}</tr></thead>
        <tbody>${rows || '<tr><td colspan="9" style="padding:16px;color:#9ca3af">No members enrolled.</td></tr>'}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:0 24px 24px">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:14px">Module Coverage (Team Average)</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid #e5e7eb">${th('')}${th('#')}${th('Module')}${th('Topics')}${th('Tasks')}</tr></thead>
        <tbody>${moduleProgress}</tbody>
      </table>
    </td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 24px;font-size:12px;color:#9ca3af">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;color:#9ca3af">${esc(path.name)} — Unosquare</td>
        <td style="font-size:12px;color:#9ca3af;text-align:right">Generated ${dateStr}</td>
      </tr></table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------- QUIZ TAKING (learner)
async function openQuiz(id) {
  openModal('<div class="spinner">Loading quiz…</div>');
  try {
    const { quiz, questions } = await api('GET', `/quizzes/${id}`);
    state._quiz = { quiz, questions };
    const qs = questions.map((q, qi) => `
      <div class="quiz-q" data-qid="${q.id}" style="margin-bottom:16px">
        <div style="font-weight:600;font-size:14px;margin-bottom:8px">${qi + 1}. ${esc(q.text)}</div>
        ${q.options.map((o) => `<label class="quiz-opt"><input type="radio" name="q_${q.id}" value="${o.id}"><span>${esc(o.text)}</span></label>`).join('')}
      </div>`).join('');
    openModal(`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h2 style="margin:0">${esc(quiz.title)}</h2>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
      </div>
      <div id="quizBody" style="max-height:60vh;overflow:auto">${qs || '<div class="dim">This quiz has no questions yet.</div>'}</div>
      <div class="form-error" id="quizErr"></div>
      <div class="form-actions">${questions.length ? '<button class="btn btn-primary" id="quizSubmit">Submit answers</button>' : ''}</div>`);
    const btn = document.getElementById('quizSubmit');
    if (btn) btn.onclick = () => submitQuiz(quiz.id);
  } catch (e) { closeModal(); toast(e.message, true); }
}

async function submitQuiz(id) {
  const answers = {};
  document.querySelectorAll('#quizBody .quiz-q').forEach((qEl) => {
    const sel = qEl.querySelector('input[type=radio]:checked');
    if (sel) answers[qEl.getAttribute('data-qid')] = Number(sel.value);
  });
  const btn = document.getElementById('quizSubmit');
  if (btn) btn.disabled = true;
  try {
    const res = await api('POST', `/quizzes/${id}/submit`, { answers });
    const { quiz, questions } = state._quiz;
    const byQ = {}; res.results.forEach((r) => (byQ[r.question_id] = r));
    const qs = questions.map((q, qi) => {
      const r = byQ[q.id] || { correct_option_ids: [], chosen_option_id: null, correct: false };
      const opts = q.options.map((o) => {
        const chosen = r.chosen_option_id === o.id, correct = r.correct_option_ids.includes(o.id);
        const col = correct ? 'var(--green)' : (chosen ? 'var(--red)' : 'var(--text-muted)');
        return `<div style="font-size:13px;color:${col};padding:2px 0">${correct ? '✓' : (chosen ? '✗' : '•')} ${esc(o.text)}</div>`;
      }).join('');
      return `<div style="margin-bottom:14px"><div style="font-weight:600;font-size:14px;margin-bottom:4px">${qi + 1}. ${esc(q.text)} ${r.correct ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>'}</div>${opts}</div>`;
    }).join('');
    openModal(`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <h2 style="margin:0">${esc(quiz.title)} — Result</h2>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
      </div>
      <div style="font-size:20px;font-weight:800;margin-bottom:12px;color:${res.passed ? 'var(--green)' : 'var(--yellow)'}">${res.score} / ${res.total} ${res.passed ? '· Passed 🎉' : '· Keep practicing'}</div>
      <div style="max-height:52vh;overflow:auto">${qs}</div>
      <div class="form-actions"><button class="btn btn-outline btn-sm" onclick="openQuiz(${id})">Retake</button><button class="btn btn-primary btn-sm" onclick="closeModal()">Done</button></div>`);
    await loadPath(); if (state.tab === 'me' && !state.viewingMember) renderTab();
  } catch (e) { const el = document.getElementById('quizErr'); if (el) el.textContent = e.message; if (btn) btn.disabled = false; }
}

// ---------------------------------------------------------------- QUIZ AUTHORING (admin)
function addQuiz(moduleId) {
  formModal({ title: 'New quiz', fields: [{ name: 'title', label: 'Quiz title', required: true, placeholder: 'e.g. Module 1.5 Quiz' }],
    submitLabel: 'Create quiz', onSubmit: async (v) => { await api('POST', `/modules/${moduleId}/quizzes`, v); toast('Quiz created.'); await reloadAdmin(); } });
}
function delQuiz(id) {
  confirmModal('Delete quiz', 'Delete this quiz and all its questions?', 'Delete',
    async () => { await api('DELETE', `/quizzes/${id}`); toast('Deleted.'); await reloadAdmin(); });
}
async function manageQuiz(id) {
  openModal('<div class="spinner">Loading…</div>');
  try {
    const { quiz, questions } = await api('GET', `/quizzes/${id}`);
    const list = questions.map((q, qi) => `
      <div class="edit-row" style="align-items:flex-start">
        <span class="grip">${qi + 1}</span>
        <span class="label"><div>${esc(q.text)}</div>
          <div style="margin-top:2px">${q.options.map((o) => `<span style="font-size:12px;color:${o.is_correct ? 'var(--green)' : 'var(--text-dim)'}">${o.is_correct ? '✓' : '•'} ${esc(o.text)}</span>`).join(' &nbsp; ')}</div>
        </span>
        <button class="icon-btn danger" onclick="delQuestion(${q.id}, ${id})">🗑</button>
      </div>`).join('');
    openModal(`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h2 style="margin:0">${esc(quiz.title)}</h2>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
      </div>
      <div style="max-height:45vh;overflow:auto">${list || '<div class="dim" style="font-size:13px">No questions yet.</div>'}</div>
      <div class="form-actions"><button class="btn btn-primary btn-sm" onclick="addQuestion(${id})">+ Add question</button></div>`);
  } catch (e) { closeModal(); toast(e.message, true); }
}
function addQuestion(quizId) {
  const rows = [0, 1, 2, 3].map((i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <input type="radio" name="correct" value="${i}" ${i === 0 ? 'checked' : ''} title="Mark correct">
      <input class="form-input" id="opt_${i}" placeholder="Option ${i + 1}${i < 2 ? ' (required)' : ' (optional)'}" style="flex:1">
    </div>`).join('');
  openModal(`
    <h2>New question</h2>
    <div class="form-group"><label class="form-label">Question</label><textarea class="form-input" id="q_text" placeholder="Question text"></textarea></div>
    <label class="form-label">Options (select the correct one)</label>
    ${rows}
    <div class="form-error" id="modalErr"></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modalSubmit">Add question</button></div>`);
  document.getElementById('modalSubmit').onclick = async () => {
    const text = document.getElementById('q_text').value.trim();
    const correctIdx = Number((document.querySelector('input[name=correct]:checked') || {}).value);
    const options = [0, 1, 2, 3].map((i) => ({ text: document.getElementById('opt_' + i).value.trim(), is_correct: i === correctIdx })).filter((o) => o.text);
    const err = document.getElementById('modalErr');
    if (!text) { err.textContent = 'Question text is required.'; return; }
    if (options.length < 2) { err.textContent = 'Add at least 2 options.'; return; }
    if (!options.some((o) => o.is_correct)) { err.textContent = 'The correct option must have text.'; return; }
    const btn = document.getElementById('modalSubmit'); btn.disabled = true;
    try { await api('POST', `/quizzes/${quizId}/questions`, { text, options }); toast('Question added.'); manageQuiz(quizId); }
    catch (e) { err.textContent = e.message; btn.disabled = false; }
  };
}
function delQuestion(id, quizId) {
  confirmModal('Delete question', 'Delete this question?', 'Delete',
    async () => { await api('DELETE', `/quiz-questions/${id}`); toast('Deleted.'); manageQuiz(quizId); });
}

// expose handlers used via inline onclick
Object.assign(window, {
  toggleAuthMode, logout, goPaths, openPath, enroll, unenroll, newPath, editPath, deletePath,
  switchTab, toggleModule, expandAll, toggleTasks, toggleTopic, toggleTask, toggleDeliverable,
  goAdmin, addModule, editModule, delModule, addTopic, editTopic, delTopic,
  addTask, editTask, delTask, addDeliv, editDeliv, delDeliv, closeModal, closeCongrats,
  goUsers, addMentor, changeRole, viewMember, closeMember, openReport, openReportTab, copyReport,
  resetPassword, removeFromPath,
  openQuiz, submitQuiz, addQuiz, delQuiz, manageQuiz, addQuestion, delQuestion,
});

boot();
