// Complete migration compatibility + focused Phase 4E SQL, disposable LOCAL PG only.
import { spawnSync } from 'node:child_process';
import { readFileSync,readdirSync,mkdtempSync,mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:net';
import { parse } from 'pgsql-parser';
const bin=process.env.PG_BIN??'C:/Program Files/PostgreSQL/18/bin';
const environment=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG')));
mkdirSync('node_modules/.cache',{recursive:true});const dir=mkdtempSync(path.resolve('node_modules/.cache/marketplace-db-'));const data=path.join(dir,'data');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
function run(command,args,input){const r=spawnSync(path.join(bin,command+(process.platform==='win32'?'.exe':'')),args,{input,encoding:'utf8',windowsHide:true,env:environment,timeout:60000,stdio:command==='pg_ctl'?'ignore':'pipe',maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw new Error(`${command}: ${r.error??r.stderr}`);return r.stdout??'';}
const sql=s=>run('psql',['-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres'],s);
let started=false;
try{
 run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);started=true;
 run('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);
 sql(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
  const source=readFileSync(`supabase/migrations/${file}`,'utf8');await parse(source);sql(`begin;\n${source}\ncommit;`);
  console.log(`LOCAL compatibility PASS: ${file}`);
 }
 const tests=readFileSync('supabase/tests/security/marketplace.test.sql','utf8');await parse(tests);console.log(sql(tests));
 console.log('PASS: focused Phase 4E SQL on real local PostgreSQL, with minimal Auth/Storage catalog stubs. No hosted access.');
}finally{if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}
