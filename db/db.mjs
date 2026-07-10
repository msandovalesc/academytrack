// Shared Neon connection for the migrate/seed scripts (run with plain `node`).
// The deployed API function uses @netlify/neon instead, which auto-reads the same env var.
import { neon } from '@neondatabase/serverless';

export function getSql() {
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'No database URL found. Run `netlify db init` (which sets NETLIFY_DATABASE_URL), ' +
      'or copy .env.example to .env and fill in NETLIFY_DATABASE_URL.'
    );
  }
  return neon(url);
}
