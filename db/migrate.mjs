// Applies db/schema.sql to the Neon database. Idempotent (schema uses IF NOT EXISTS).
// Run: npm run migrate   (or: node --env-file-if-exists=.env db/migrate.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSql } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = getSql();

// The Neon HTTP driver is tagged-template-only. Run a raw statement string by
// handing it a value shaped exactly like a no-interpolation template-strings array.
const runRaw = (stmt) => sql(Object.assign([stmt], { raw: [stmt] }));

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Split into individual statements. The schema intentionally contains no semicolons
// inside string literals or function bodies, so splitting on ';' is safe here.
const statements = schema
  .split(';')
  .map((s) => s.trim())
  .filter((s) => {
    // Drop chunks that are empty or only SQL comments.
    const code = s
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
    return code.length > 0;
  });

console.log(`Applying ${statements.length} statements...`);
for (const stmt of statements) {
  await runRaw(stmt);
}
console.log('✅ Migration complete.');
