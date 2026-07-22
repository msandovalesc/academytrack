-- AcademyTrack database schema (Neon Postgres).
-- Generalizes the old single-hardcoded-SDET-curriculum app into arbitrary learning paths.
-- Safe to re-run: every object uses IF NOT EXISTS.

-- ---------- Users & auth ----------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  avatar        TEXT,
  role          TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('admin', 'learner', 'mentor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Content: paths -> modules -> topics -> tasks, plus deliverables ----------
CREATE TABLE IF NOT EXISTS learning_paths (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id       SERIAL PRIMARY KEY,
  path_id  INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name     TEXT NOT NULL,
  icon     TEXT,
  color    TEXT
);
CREATE INDEX IF NOT EXISTS idx_modules_path ON modules(path_id);

CREATE TABLE IF NOT EXISTS topics (
  id        SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  name      TEXT NOT NULL,
  link      TEXT
);
CREATE INDEX IF NOT EXISTS idx_topics_module ON topics(module_id);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);

CREATE TABLE IF NOT EXISTS deliverables (
  id          SERIAL PRIMARY KEY,
  path_id     INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  module_id   INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_deliverables_path ON deliverables(path_id);

-- ---------- Enrollment (who is tracking which path) ----------
CREATE TABLE IF NOT EXISTS enrollments (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id     INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, path_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_path ON enrollments(path_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);

-- ---------- Per-user progress ----------
CREATE TABLE IF NOT EXISTS topic_progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id   INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  done       BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS task_progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  done       BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS deliverable_progress (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deliverable_id INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  done           BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deliverable_id)
);

-- ---------- Activity feed ----------
CREATE TABLE IF NOT EXISTS activity (
  id         SERIAL PRIMARY KEY,
  path_id    INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,          -- 'topic' | 'task' | 'deliverable' | 'module'
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_path ON activity(path_id, created_at DESC);

-- ---------- Quizzes (attached to a module) ----------
CREATE TABLE IF NOT EXISTS quizzes (
  id        SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  title     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quizzes_module ON quizzes(module_id);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id       SERIAL PRIMARY KEY,
  quiz_id  INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  text     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_options (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options(question_id);

-- Latest quiz result per user per quiz
CREATE TABLE IF NOT EXISTS quiz_attempts (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id    INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL DEFAULT 0,
  total      INTEGER NOT NULL DEFAULT 0,
  passed     BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quiz_id)
);
