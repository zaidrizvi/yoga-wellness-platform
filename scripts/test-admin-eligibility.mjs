// Focused real-PostgreSQL guard regression, always a new disposable LOCAL cluster.
// No environment files, hosted connection strings, Docker or external accounts.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'pgsql-parser';

const bin = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name) => path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
const cache = path.resolve('node_modules/.cache');
mkdirSync(cache, { recursive: true });
const directory = mkdtempSync(path.join(cache, 'admin-eligibility-'));
const data = path.join(directory, 'data');
const migration = readFileSync('supabase/migrations/20261024020000_admin_operations_and_customer_history.sql', 'utf8');
const previous = readFileSync('supabase/migrations/20261013154856_security_policies.sql', 'utf8');
const regression = readFileSync('supabase/tests/security/admin-eligibility.sql', 'utf8');
await parse(migration);
await parse(regression);
const definitions = (source, names) => names.map((name) => {
  const escaped = name.replaceAll('.', '\\.');
  const definition = source.match(new RegExp(`create function ${escaped}\\(\\)[\\s\\S]*?\\$\\$;`))?.[0];
  assert.ok(definition, name);
  return definition;
}).join('\n');
const listener = createServer();
await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
// Explicit connection args and scrubbed libpq environment prevent ambient
// PGHOST/PGSERVICE/PGOPTIONS from redirecting the test to an existing database.
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('PG')));
const args = ['-X', '-q', '-A', '-t', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
const run = (name, argv, input) => {
  // pg_ctl's server child must not inherit capture pipes on Windows, otherwise
  // spawnSync waits for the long-lived server even after pg_ctl has exited.
  const result = spawnSync(executable(name), argv, { input, encoding: 'utf8', windowsHide: true, env: environment,
    stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(`${name}: ${result.error ?? result.stderr ?? result.stdout}`);
  return result.stdout?.trim() ?? '';
};
const sql = (statement) => run('psql', args, statement);
const a = '40000000-0000-4000-8000-000000000001';
const b = '40000000-0000-4000-8000-000000000002';
const sessions = [];
function session(name) {
  const child = spawn(executable('psql'), args, { windowsHide: true, env: { ...environment, PGAPPNAME: name } });
  let output = ''; let error = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { error += chunk; });
  const ended = new Promise((resolve) => child.on('close', (code) => resolve({ code, error })));
  const result = {
    child, ended,
    send(statement) { child.stdin.write(`${statement}\n`); },
    async until(marker) {
      const deadline = Date.now() + 10000;
      while (!output.includes(marker)) {
        if (child.exitCode !== null || Date.now() > deadline) throw new Error(`${name}: ${error || `missing ${marker}`}`);
        await delay(20);
      }
    },
  };
  sessions.push(result);
  return result;
}
async function waitForLock(name) {
  const deadline = Date.now() + 10000;
  while (sql(`select exists(select 1 from pg_stat_activity where application_name='${name}' and wait_event_type='Lock');`) !== 't') {
    if (Date.now() > deadline) throw new Error(`No observed lock wait for ${name}`);
    await delay(20);
  }
}
const eligible = `select count(*) from public.user_roles r join auth.users u on u.id=r.user_id where r.role='admin'
  and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now());`;
function seed(banned = false) {
  // Reset only this disposable harness schema between independent schedules.
  sql(`truncate public.user_roles,auth.users;
    insert into auth.users(id,email_confirmed_at,banned_until) values ('${a}',now(),null),
      ('${b}',now(),${banned ? "now()+interval '1 day'" : 'null'});
    insert into public.user_roles(user_id,role) values ('${a}','admin'),('${b}','admin');`);
}
async function race(label, first, second, { banned = false, rollback = false, allowed = false } = {}) {
  seed(banned);
  const holder = session(`${label}_holder`);
  const waiter = session(`${label}_waiter`);
  holder.send(`begin; ${first}; \n\\echo holder_ready`);
  await holder.until('holder_ready');
  waiter.send(`\\set VERBOSITY verbose\nbegin; ${second}; commit;\n\\q`);
  await waitForLock(`${label}_waiter`);
  holder.send(`${rollback ? 'rollback' : 'commit'};\n\\q`);
  const [held, waited] = await Promise.all([holder.ended, waiter.ended]);
  assert.equal(held.code, 0, `${label}: holder ${held.error}`);
  if (allowed) assert.equal(waited.code, 0, `${label}: ${waited.error}`);
  else {
    assert.notEqual(waited.code, 0, `${label}: unsafe second transition succeeded`);
    assert.match(waited.error, /23514.*Cannot remove the last eligible administrator/, label);
  }
  assert.equal(sql(eligible), '1', `${label}: final eligible count`);
  console.log(`PASS concurrency: ${label} (observed database lock wait)`);
}
let started = false;
try {
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  started = true;
  run('pg_ctl', ['-D', data, '-l', path.join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start']);
  sql(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.user_roles(user_id uuid primary key references auth.users(id) on delete cascade,
      role text not null check(role in ('customer','professional','admin')));
    ${definitions(previous, ['private.lock_administrator_roles', 'private.guard_role_mutation', 'private.guard_admin_soft_delete'])}
    ${definitions(migration, ['private.guard_last_eligible_administrator', 'private.guard_administrator_eligibility'])}
    create trigger guard_role_mutation before insert or update or delete on public.user_roles for each row execute function private.guard_role_mutation();
    create trigger guard_admin_soft_delete before update of deleted_at on auth.users for each row execute function private.guard_admin_soft_delete();
    ${migration.match(/create trigger guard_last_eligible_administrator[\s\S]*?;/)[0]}
    ${migration.match(/create trigger guard_administrator_eligibility[\s\S]*?;/)[0]}
    revoke all on function private.guard_administrator_eligibility() from public,anon,authenticated;`);
  sql(regression);
  console.log('PASS SQL: eligibility loss/restoration, role/cascade guards, bulk rollback, ordinary Auth updates, private grants/search path');
  const ban = (id) => `update auth.users set banned_until=now()+interval '1 day' where id='${id}'`;
  const demote = (id) => `update public.user_roles set role='customer' where user_id='${id}'`;
  await race('ban_vs_ban', ban(a), ban(b));
  await race('ban_vs_soft_delete', ban(a), `update auth.users set deleted_at=now() where id='${b}'`);
  await race('ban_vs_role', ban(a), demote(b));
  await race('role_vs_ban', demote(a), ban(b));
  await race('unban_commit_vs_role', `update auth.users set banned_until=null where id='${b}'`, demote(a), { banned: true, allowed: true });
  await race('unban_rollback_vs_ban', `update auth.users set banned_until=null where id='${b}'`, ban(a), { banned: true, rollback: true });
  seed();
  const rejected = spawnSync(executable('psql'), args, { input: `begin isolation level repeatable read; ${ban(a)};`, encoding: 'utf8', windowsHide: true, env: environment });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Role mutations require READ COMMITTED isolation/);
  console.log('PASS isolation: unsupported snapshot isolation fails closed');
  console.log('Focused local guard checks passed. Full Supabase/Auth API integration and hosted migration remain unexecuted.');
} finally {
  for (const item of sessions) if (item.child.exitCode === null) item.child.kill();
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
}
