begin;
\ir ../fixtures.sql
select no_plan();
select is((select public from storage.buckets where id = 'professional-documents'), false, 'Document bucket private');
select is((select file_size_limit from storage.buckets where id = 'professional-documents'), 10485760::bigint, '10 MiB size limit configured');
select is((select allowed_mime_types from storage.buckets where id = 'professional-documents'), array['application/pdf','image/jpeg','image/png'], 'Only PDF/JPEG/PNG configured');
create function pg_temp.visible_document_count() returns bigint language plpgsql as $$
begin
  return (select count(*) from storage.objects where bucket_id = 'professional-documents');
exception when insufficient_privilege then
  -- Either absent table grants or zero RLS-visible rows satisfies denial.
  return 0;
end; $$;

-- Disposable SQL metadata fixtures exercise policies, not Storage HTTP/MIME enforcement.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('professional-documents','10000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000010.pdf')$$, '42501', null, 'Customer matching owner folder still cannot upload');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select lives_ok($$insert into storage.objects(bucket_id,name) values('professional-documents','10000000-0000-4000-8000-000000000005/00000000-0000-4000-8000-000000000010.pdf')$$, 'Professional may upload to own UUID path');
select throws_ok($$insert into storage.objects(bucket_id,name) values('professional-documents','10000000-0000-4000-8000-000000000006/00000000-0000-4000-8000-000000000010.pdf')$$, '42501', null, 'Cross-owner upload forbidden');
select throws_ok($$insert into storage.objects(bucket_id,name) values('professional-documents','10000000-0000-4000-8000-000000000005/../00000000-0000-4000-8000-000000000010.pdf')$$, '42501', null, 'Traversal/nested path forbidden');
select throws_ok($$insert into storage.objects(bucket_id,name) values('professional-documents','10000000-0000-4000-8000-000000000005/arbitrary.pdf')$$, '42501', null, 'UUID filename required');
select throws_ok($$insert into storage.objects(bucket_id,name) values('professional-documents','10000000-0000-4000-8000-000000000005/00000000-0000-4000-8000-000000000011.exe')$$, '42501', null, 'Disallowed extension forbidden');
select is((select count(*) from storage.objects where bucket_id = 'professional-documents'), 1::bigint, 'Owner can read own document');
set local role anon;
select is(pg_temp.visible_document_count(), 0::bigint, 'Anonymous document access is denied or returns no rows');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', true);
select is((select count(*) from storage.objects where bucket_id = 'professional-documents'), 0::bigint, 'Another professional cannot read document');
select lives_ok($$delete from storage.objects where bucket_id = 'professional-documents'$$, 'Cross-owner delete affects no rows');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*) from storage.objects where bucket_id = 'professional-documents'), 1::bigint, 'Authoritative admin can review documents');
select lives_ok($$select public.change_user_role('10000000-0000-4000-8000-000000000005','customer')$$, 'Document owner can be demoted');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select is((select count(*) from storage.objects where bucket_id = 'professional-documents'), 0::bigint, 'Demotion immediately revokes owner document access');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select lives_ok($$delete from storage.objects where bucket_id = 'professional-documents'$$, 'Authorized admin may delete documents');
reset role;
select is((select count(*) from storage.objects where bucket_id = 'professional-documents'), 0::bigint, 'Admin deletion took effect');
select ok(not exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'professional_documents%' and cmd = 'UPDATE'), 'No overwrite policy');
select * from finish();
rollback;
