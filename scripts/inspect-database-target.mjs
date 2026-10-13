import nextEnv from '@next/env';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Never print configured values, credentials, response bodies, or error URLs.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.log('Public Supabase configuration missing; hosted inspection unavailable.');
  process.exit(0);
}
const hostname = new URL(url).hostname;
const fingerprint = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);
console.log(`Configured project hostname fingerprint: ${fingerprint(hostname)}`);
let linked;
try { linked = (await readFile('supabase/.temp/project-ref', 'utf8')).trim(); } catch { /* No CLI link. */ }
console.log(linked ? `CLI link matches configured standard project hostname: ${hostname === `${linked}.supabase.co`}` : 'CLI project link absent; target not independently verified.');
if (key.startsWith('sb_secret_')) throw new Error('Refusing privileged key in a public-key variable.');
if (key.split('.').length === 3) {
  let claims;
  try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { /* Legacy non-JWT public value. */ }
  if (claims?.role === 'service_role') throw new Error('Refusing privileged key in a public-key variable.');
}
for (const table of ['services', 'profiles', 'user_roles']) {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      headers: { apikey: key }, signal: AbortSignal.timeout(5000),
    });
    console.log(`${table}: HTTP ${response.status()}, read-only zero-record request.`);
  } catch { console.log(`${table}: unavailable; no schema-state inference made.`); }
}
console.log('Public credentials cannot inspect remote migration history; trusted CLI/database access is required.');
