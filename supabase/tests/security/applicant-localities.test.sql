-- Disposable local PostgreSQL test only. No hosted accounts or coverage.
begin;
create function pg_temp.check_true(ok boolean) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'Applicant locality regression'; end if; end $$;
create function pg_temp.denied(statement text,code text) returns void language plpgsql as $$begin
 begin execute statement; exception when others then if sqlstate=code then return; end if; raise; end;
 raise exception 'Expected denial: %',code; end $$;
insert into auth.users(id,email_confirmed_at) values
 ('64000000-0000-4000-8000-000000000001',now()),('64000000-0000-4000-8000-000000000002',now());
select set_config('test.locality',(select id::text from public.marketplace_localities where name='Saket' and district='SOUTH'),true);
select set_config('test.details',jsonb_build_object('full_name','LOCAL applicant fixture','phone','9876543210',
 'category_id',(select id from public.service_categories where slug='yoga'),'qualifications','LOCAL test qualification, not verified',
 'years_experience',2,'biography','LOCAL regression fixture','specializations','','service_locations','','postal_codes','[]'::jsonb)::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','64000000-0000-4000-8000-000000000001',true);
select pg_temp.denied(format('select public.save_application_localities(%L::jsonb,array[null]::uuid[])',current_setting('test.details')),'22023');
select set_config('test.application',public.save_application_localities(current_setting('test.details')::jsonb,
 array[current_setting('test.locality')::uuid,current_setting('test.locality')::uuid])::text,true);
select pg_temp.check_true((select requested_locality_ids=array[current_setting('test.locality')::uuid]
 and postal_codes='{}'::text[] and service_locations='Saket (SOUTH)' and state='draft'
 from public.professional_applications where id=current_setting('test.application')::uuid));
select pg_temp.denied(format('select public.submit_professional_application(%L,(select updated_at from public.professional_applications where id=%L),true)',current_setting('test.application'),current_setting('test.application')),'22023');
select set_config('request.jwt.claim.sub','64000000-0000-4000-8000-000000000002',true);
select pg_temp.denied(format('select public.save_application_localities(%L::jsonb,array[%L]::uuid[],%L,now())',current_setting('test.details'),current_setting('test.locality'),current_setting('test.application')),'42501');
reset role;
-- Storage metadata stub only: no actual certificate or Auth account is created.
insert into storage.objects(bucket_id,name) values('professional-applications',
 '64000000-0000-4000-8000-000000000001/'||current_setting('test.application')||'/64000000-0000-4000-8000-000000000003.pdf');
set local role authenticated;
select set_config('request.jwt.claim.sub','64000000-0000-4000-8000-000000000001',true);
select pg_temp.denied(format('select public.submit_professional_application(%L,(select updated_at from public.professional_applications where id=%L),false)',current_setting('test.application'),current_setting('test.application')),'22023');
select public.submit_professional_application(current_setting('test.application')::uuid,
 (select updated_at from public.professional_applications where id=current_setting('test.application')::uuid),true);
select pg_temp.check_true((select state='submitted' and cardinality(requested_locality_ids)=1
 from public.professional_applications where id=current_setting('test.application')::uuid));
reset role;
select pg_temp.check_true((select role='customer' from public.user_roles where user_id='64000000-0000-4000-8000-000000000001'));
select pg_temp.check_true(not exists(select 1 from public.professional_service_areas));
select pg_temp.check_true(not exists(select 1 from public.marketplace_localities where verified or is_active));
select pg_temp.check_true(jsonb_array_length(public.marketplace_directory(current_setting('test.locality')::uuid))=0);
select pg_temp.check_true(not has_function_privilege('anon','public.save_application_localities(jsonb,uuid[],uuid,timestamptz)','EXECUTE'));
select 'PASS: unmapped names save and submit; private ownership, consent, credentials, role and coverage guards remain' as result;
rollback;
