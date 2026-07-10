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
  view: 'loading',      // 'auth' | 'paths' | 'path' | 'admin'
  authMode: 'login',
  paths: [],
  pathId: null,
  path: null,           // { path, modules[], deliverables[] }
  done: { topics: new Set(), tasks: new Set(), deliverables: new Set() },
  tab: 'me',            // 'me' | 'leaderboard' | 'team'
  members: null,
  totals: null,
  activity: null,
  openModules: new Set(),
};
const isAdmin = () => state.user && state.user.role === 'admin';

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
}

function renderNav() {
  const nav = document.getElementById('navActions');
  if (!state.user) { nav.innerHTML = ''; return; }
  const parts = [];
  if (state.view !== 'paths') {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="goPaths()">← All paths</button>`);
  }
  if (state.view === 'path' && isAdmin()) {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="goAdmin(${state.pathId})">✎ Manage content</button>`);
  }
  if (state.view === 'admin') {
    parts.push(`<button class="btn btn-outline btn-sm" onclick="openPath(${state.pathId})">👁 View as learner</button>`);
  }
  parts.push(`<span style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:6px">${state.user.avatar || '🙂'} ${esc(state.user.name)}${isAdmin() ? ' <span class="badge badge-purple">admin</span>' : ''}</span>`);
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
          <button class="btn btn-primary btn-sm" onclick="openPath(${p.id})">${p.enrolled ? 'Open' : 'Open'}</button>
          ${p.enrolled
            ? `<button class="btn btn-outline btn-sm" onclick="unenroll(${p.id})">Leave</button>`
            : `<button class="btn btn-green btn-sm" onclick="enroll(${p.id})">Join</button>`}
          ${admin ? `<button class="icon-btn" onclick="editPath(${p.id})">✎</button>
                     <button class="icon-btn danger" onclick="deletePath(${p.id})">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="view">
      <div class="hero"><h1>Learning Paths</h1><p>Pick a path to track your progress, or join a new one.</p></div>
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
  state.tab = 'me';
  await loadPath();
  state.view = 'path';
  render();
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
  app.innerHTML = `
    <div class="view">
      <div class="tabs">
        <button class="tab ${state.tab === 'me' ? 'active' : ''}" onclick="switchTab('me')">My Progress</button>
        <button class="tab ${state.tab === 'leaderboard' ? 'active' : ''}" onclick="switchTab('leaderboard')">Leaderboard</button>
        <button class="tab ${state.tab === 'team' ? 'active' : ''}" onclick="switchTab('team')">Team Activity</button>
      </div>
      <div id="tabBody"></div>
    </div>`;
  document.title = `${p.name} · AcademyTrack`;
  renderTab();
}

async function switchTab(tab) {
  state.tab = tab;
  render();
  if (tab === 'leaderboard' || tab === 'team') {
    try {
      const m = await api('GET', `/paths/${state.pathId}/members`);
      state.members = m.members; state.totals = m.totals;
      if (tab === 'team') { const a = await api('GET', `/paths/${state.pathId}/activity`); state.activity = a.activity; }
      renderTab();
    } catch (e) { toast(e.message, true); }
  }
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
  const p = state.path.path;
  const tot = pathTotals();
  const pct = combinedPct();
  const lvl = getLevel(pct);
  const topicsDone = state.done.topics.size;
  const tasksDone = state.done.tasks.size;
  const delivDone = state.done.deliverables.size;

  const modulesHtml = state.path.modules.map((m, mi) => {
    const total = m.topics.length;
    const done = m.topics.filter((t) => state.done.topics.has(t.id)).length;
    const mpct = total ? Math.round((done / total) * 100) : 0;
    const open = state.openModules.has(m.id);
    const color = m.color || 'var(--blue)';
    const topicsHtml = m.topics.map((t) => {
      const tdone = state.done.topics.has(t.id);
      const tasksHtml = t.tasks.length ? `
        <div class="exercise-toggle" onclick="toggleTasks(${t.id})">▸ ${t.tasks.length} task${t.tasks.length > 1 ? 's' : ''}</div>
        <div class="exercise-group" id="tasks_${t.id}" style="display:none">
          ${t.tasks.map((tk) => {
            const kd = state.done.tasks.has(tk.id);
            return `<div class="exercise-row ${kd ? 'done' : ''}">
              <div class="exercise-check ${kd ? 'done' : ''}" onclick="toggleTask(${tk.id})"></div>
              <div class="exercise-text">${esc(tk.description)}</div></div>`;
          }).join('')}
        </div>` : '';
      return `
        <div class="topic-row ${tdone ? 'done' : ''}">
          <div class="topic-check ${tdone ? 'done' : ''}" onclick="toggleTopic(${t.id})"></div>
          <div class="topic-info">
            <div class="topic-name">${esc(t.name)}</div>
            ${tasksHtml}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="module-section ${open ? 'open' : ''}" id="mod_${m.id}">
        <div class="module-header-row" onclick="toggleModule(${m.id})">
          <span class="module-chevron">▶</span>
          <span class="module-num">${twoDigit(mi)}</span>
          <span class="module-name">${esc(m.icon || '')} ${esc(m.name)}</span>
          <span class="module-progress-text">${done}/${total}</span>
          <div class="module-mini-bar"><div class="module-mini-fill" style="width:${mpct}%;background:${color}"></div></div>
        </div>
        <div class="module-body">
          ${topicsHtml || '<div class="dim" style="padding:8px 0;font-size:13px">No topics yet.</div>'}
        </div>
      </div>`;
  }).join('');

  const delivHtml = state.path.deliverables.map((d) => {
    const dd = state.done.deliverables.has(d.id);
    return `
      <div class="topic-row ${dd ? 'done' : ''}">
        <div class="topic-check ${dd ? 'done' : ''}" onclick="toggleDeliverable(${d.id})"></div>
        <div class="topic-info">
          <div class="topic-name">${esc(d.title)}</div>
          ${d.description ? `<div class="topic-module-tag">${esc(d.description)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar" style="background:${lvl.color}22;color:${lvl.color}">${state.user.avatar || '🙂'}</div>
      <div style="flex:1;min-width:200px">
        <div class="profile-name">${esc(p.icon || '')} ${esc(p.name)}</div>
        <div class="muted" style="font-size:13px;margin-top:2px">Level ${lvl.level} · ${lvl.name} · ${esc(state.user.name)}</div>
        <div class="big-progress"><div class="big-progress-fill" style="width:${pct}%;background:${progressColor(pct)}"></div></div>
        <div class="progress-label"><span>${pct}% complete</span><span>${topicsDone + tasksDone + delivDone} / ${tot.topics + tot.tasks + tot.deliverables} items</span></div>
      </div>
    </div>

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
        <div class="dim" style="font-size:12px;margin-bottom:8px">Mark each deliverable as submitted once you finish and send it.</div>
        ${delivHtml}
      </div></div>` : ''}`;
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
function toggleTasks(topicId) {
  const el = document.getElementById('tasks_' + topicId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ---- optimistic progress toggles ----
async function toggleGeneric(kind, id, apiPath, field) {
  const set = state.done[kind];
  const nowDone = !set.has(id);
  if (nowDone) set.add(id); else set.delete(id);
  renderTab();
  try {
    await api('POST', apiPath, { [field]: id, done: nowDone });
    if (nowDone) {
      toast(MOTIVATIONAL[Math.floor(combinedPct() / 15) % MOTIVATIONAL.length]);
      maybeCelebrateModule();
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

function maybeCelebrateModule() {
  for (const m of state.path.modules) {
    if (!m.topics.length) continue;
    const allTopics = m.topics.every((t) => state.done.topics.has(t.id));
    const allTasks = m.topics.every((t) => t.tasks.every((tk) => state.done.tasks.has(tk.id)));
    if (allTopics && allTasks && !state.openModules.has('celebrated_' + m.id)) {
      // Celebrate once per session per module.
      state.openModules.add('celebrated_' + m.id);
      showCongrats('Module complete!', `You finished "${m.name}"`, `${m.icon || '🏅'} ${m.name}`);
      return;
    }
  }
}

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
    return `
      <div class="lb-row ${topClass}">
        <div class="lb-rank">${medal}</div>
        <div class="lb-avatar" style="background:${progressColor(m.pct)}22">${m.avatar || '🙂'}</div>
        <div class="lb-name">${esc(m.name)}${m.id === state.user.id ? ' <span class="dim">(you)</span>' : ''}</div>
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
  if (!state.members) { body.innerHTML = '<div class="spinner">Loading…</div>'; return; }
  const icons = { topic: '📘', task: '🔬', deliverable: '🎯', module: '🏅' };
  const colors = { topic: 'var(--blue-dim)', task: 'var(--yellow-dim)', deliverable: 'rgba(249,115,22,.12)', module: 'rgba(234,179,8,.2)' };
  const acts = (state.activity || []).map((a) => `
    <div class="activity-item">
      <div class="activity-icon" style="background:${colors[a.type] || 'var(--bg-elevated)'}">${icons[a.type] || '•'}</div>
      <div class="activity-text"><strong>${esc(a.user_name)}</strong> completed <span class="muted">${esc(a.detail || a.type)}</span></div>
      <div class="activity-time">${timeAgo(a.created_at)}</div>
    </div>`).join('');
  const members = state.members.map((m) => {
    const pct = memberPct(m);
    return `<div class="qa-card" style="cursor:default">
      <div class="qa-card-top">
        <div class="qa-avatar" style="background:${progressColor(pct)}22">${m.avatar || '🙂'}</div>
        <div class="qa-info"><div class="qa-name">${esc(m.name)}</div><div class="qa-role">${m.topics_done}/${state.totals.topics} topics</div></div>
        <div class="qa-pct">${pct}%</div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${progressColor(pct)}"></div></div>
    </div>`;
  }).join('');
  body.innerHTML = `
    <div class="hero" style="padding:20px 0 24px"><h1>Team Activity</h1><p>${state.members.length} member${state.members.length !== 1 ? 's' : ''} on this path</p></div>
    <div class="section-header"><span class="section-title">Recent Activity</span></div>
    <div class="module-section open"><div class="module-body" style="padding:12px 20px">
      ${acts ? `<div class="activity-list">${acts}</div>` : '<div class="dim" style="font-size:13px">No activity yet — complete something to get started!</div>'}
    </div></div>
    <div class="section-header" style="margin-top:28px"><span class="section-title">Members</span></div>
    <div class="qa-grid">${members || '<div class="dim">No members yet.</div>'}</div>`;
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
            <button class="icon-btn" onclick="editModule(${m.id})">✎</button>
            <button class="icon-btn danger" onclick="delModule(${m.id})">🗑</button>
          </span>
        </h3>
        <div class="nested">${topics || '<div class="dim" style="font-size:12px;padding:4px 0">No topics.</div>'}</div>
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

// expose handlers used via inline onclick
Object.assign(window, {
  toggleAuthMode, logout, goPaths, openPath, enroll, unenroll, newPath, editPath, deletePath,
  switchTab, toggleModule, expandAll, toggleTasks, toggleTopic, toggleTask, toggleDeliverable,
  goAdmin, addModule, editModule, delModule, addTopic, editTopic, delTopic,
  addTask, editTask, delTask, addDeliv, editDeliv, delDeliv, closeModal, closeCongrats,
});

boot();
