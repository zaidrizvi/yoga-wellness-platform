import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'pgsql-parser';

const migrationFiles = (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
const migrations = [];
for (const file of migrationFiles) {
  assert.match(file, /^\d{14}_[a-z_]+\.sql$/);
  const sql = await readFile(`supabase/migrations/${file}`, 'utf8');
  await parse(sql);
  migrations.push(sql);
  console.log(`PostgreSQL outer SQL parsed: ${file}`);
}
await parse(await readFile('supabase/tests/fixtures.sql', 'utf8'));
for (const file of (await readdir('supabase/tests/database')).filter((file) => file.endsWith('.test.sql')).sort()) {
  const sql = await readFile(`supabase/tests/database/${file}`, 'utf8');
  // psql include commands are handled by pg_prove, not the SQL grammar.
  await parse(sql.replace(/^\\ir .*$/gm, ''));
  assert.match(sql, /^begin;/);
  assert.match(sql, /rollback;\s*$/);
  console.log(`Test SQL parsed (not executed): ${file}`);
}

const sql = migrations.join('\n');
const config = await readFile('supabase/config.toml', 'utf8');
const exposed = config.match(/^schemas\s*=\s*\[([^\]]+)\]/m)?.[1];
assert.ok(exposed && !exposed.includes('private'), 'private must not be Data API exposed');
assert.ok(!/create\s+(?:or\s+replace\s+)?view\b/i.test(sql), 'No parallel professional view');
assert.equal((sql.match(/create function public\.list_public_professionals\(/g) ?? []).length, 1);
const listing = sql.match(/create function public\.list_public_professionals\(\)[\s\S]*?\$\$;/)?.[0];
assert.ok(listing);
assert.match(listing, /r\.role = 'professional' and v\.status = 'verified' and p\.public_visible/);
assert.match(listing, /u\.deleted_at is null/);
assert.match(listing, /u\.banned_until/);
const returned = listing.slice(listing.indexOf('returns table'), listing.indexOf('language sql'));
assert.ok(!/phone|internal_notes|document|metadata|reviewed_by/.test(returned));
for (const definition of sql.matchAll(/create function ([a-z_.]+)\([\s\S]*?\$\$;/g)) {
  if (definition[0].includes('security definer')) assert.ok(definition[0].includes("set search_path = ''"), definition[1]);
}
for (const grant of sql.matchAll(/grant\s+select\s+on\s+([^;]+?)\s+to\s+anon\b/gi)) {
  assert.ok(!/public\.(profiles|user_roles|professional_profiles|professional_verifications)\b/.test(grant[1]), 'No direct anon SELECT');
}
assert.match(sql, /pg_advisory_xact_lock\(31032026\)/);
assert.match(sql, /order by r\.user_id for update/);
assert.match(sql, /Role mutations require READ COMMITTED isolation/);
assert.match(sql, /target_user = auth\.uid\(\)/);
assert.match(sql, /Cannot remove the last administrator/);
assert.ok(!/raw_user_meta_data/.test(sql), 'Signup privileges cannot depend on editable metadata');
console.log('Static access-contract checks: PASS.');
console.log('This validates outer SQL grammar and source contracts only. It does NOT execute migrations, PL/pgSQL bodies, RLS, pgTAP, Storage APIs, or concurrent transactions.');
