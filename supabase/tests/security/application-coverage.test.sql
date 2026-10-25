-- Disposable LOCAL PostgreSQL only, minimal Auth/Storage metadata stubs.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.deny(statement text,expected text) returns void language plpgsql as $$begin
 begin execute statement; exception when others then if sqlstate=expected then return; end if; raise; end;
 raise exception 'Expected denial %',expected; end $$;
insert into auth.users(id,email_confirmed_at) select ('66000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now() from generate_series(1,5)i;
select set_config('app.role_change_reason','LOCAL bootstrap fixture',true);
update public.user_roles set role='admin' where user_id='66000000-0000-4000-8000-000000000001';
select set_config('test.locality',(select id::text from public.marketplace_localities where name='Saket' and district='SOUTH'),true);
select set_config('test.other',(select id::text from public.marketplace_localities where name='Hauz Khas' and district='SOUTH'),true);
-- A different professional has a historical shared delivery reference, not a
-- reviewed locality grant. Activating Saket must not grant that trainer coverage.
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000001',true);
select public.change_user_role('66000000-0000-4000-8000-000000000005','professional','LOCAL historical fixture');
select public.review_professional('66000000-0000-4000-8000-000000000005','verified',true,'LOCAL fixture',null,'LOCAL fixture');
insert into public.service_areas(id,name,postal_code,is_active) values('66000000-0000-4000-8000-000000000088','LOCAL historical delivery area','110017',true);
insert into public.locality_service_areas(locality_id,service_area_id,approved_by) values(current_setting('test.locality')::uuid,'66000000-0000-4000-8000-000000000088','66000000-0000-4000-8000-000000000001');
insert into public.professional_service_areas(professional_id,service_area_id,approved_by) values('66000000-0000-4000-8000-000000000005','66000000-0000-4000-8000-000000000088','66000000-0000-4000-8000-000000000001');
-- Real save/submit workflow; private Storage catalog metadata only, not certificates.
create function pg_temp.application(owner_id uuid, locations uuid[]) returns uuid language plpgsql as $$
declare result uuid;
begin
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result:=public.save_application_localities(jsonb_build_object('full_name','LOCAL trainer fixture','phone','9876543210',
  'category_id',(select id from public.service_categories where slug='yoga'),'qualifications','LOCAL qualification fixture',
  'years_experience',2,'biography','LOCAL regression fixture','specializations','','service_locations','','postal_codes','[]'::jsonb),locations);
 insert into storage.objects(bucket_id,name) values('professional-applications',owner_id::text||'/'||result::text||'/66000000-0000-4000-8000-000000000099.pdf');
 perform public.submit_professional_application(result,(select updated_at from public.professional_applications where id=result),true);
 return result;
end $$;
select set_config('test.app',pg_temp.application('66000000-0000-4000-8000-000000000002',array[current_setting('test.locality')::uuid,current_setting('test.other')::uuid])::text,true);
select set_config('test.old',pg_temp.application('66000000-0000-4000-8000-000000000003',array[current_setting('test.other')::uuid])::text,true);
select set_config('test.hidden',pg_temp.application('66000000-0000-4000-8000-000000000004',array[current_setting('test.other')::uuid])::text,true);
select set_config('test.version',(select updated_at::text from public.professional_applications where id=current_setting('test.app')::uuid),true);
select set_config('test.reviews',(select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at,'decision',case when id=current_setting('test.locality')::uuid then 'authorize' else 'exclude' end))::text from public.marketplace_localities where id in (current_setting('test.locality')::uuid,current_setting('test.other')::uuid)),true);
select pg_temp.ok(not exists(select 1 from public.professional_service_areas where professional_id in ('66000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000003','66000000-0000-4000-8000-000000000004')),'submission grants no coverage');
set local role authenticated;
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000002',true);
select pg_temp.deny(format('select public.review_application_with_localities(%L,%L,%L,%L,true,%L::jsonb)',current_setting('test.app'),current_setting('test.version'),'approve','LOCAL decision',current_setting('test.reviews')),'42501');
select pg_temp.deny(format('select public.admin_application_localities(%L)',current_setting('test.app')),'42501');
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(jsonb_array_length(public.admin_application_localities(current_setting('test.app')::uuid))=2,'admin sees all requested names');
select pg_temp.deny(format('select public.review_application_with_localities(%L,%L,%L,%L,true,%L::jsonb)',current_setting('test.app'),current_setting('test.version'),'approve','LOCAL incomplete review','[]'),'22023');
select pg_temp.deny(format('select public.review_application_with_localities(%L,%L,%L,%L,true,%L::jsonb)',current_setting('test.app'),current_setting('test.version'),'approve','LOCAL unreviewed decision',replace(current_setting('test.reviews'),'exclude','unreviewed')),'22023');
select pg_temp.deny(format('select public.review_application_with_localities(%L,%L,%L,%L,true,%L::jsonb)',current_setting('test.app'),current_setting('test.version'),'approve','LOCAL injected non-requested locality',replace(current_setting('test.reviews'),current_setting('test.other'),'66000000-0000-4000-8000-000000000099')),'22023');
reset role;
select pg_temp.ok((select role='customer' from public.user_roles where user_id='66000000-0000-4000-8000-000000000002'),'failed reviews never promote');
set local role authenticated;
select public.review_application_with_localities(current_setting('test.app')::uuid,current_setting('test.version')::timestamptz,'approve','LOCAL approved Saket; Hauz Khas excluded as unsupported by operations',true,current_setting('test.reviews')::jsonb);
reset role;
select pg_temp.ok((select role='professional' from public.user_roles where user_id='66000000-0000-4000-8000-000000000002'),'one decision promotes trainer');
select pg_temp.ok(private.professional_serves_locality('66000000-0000-4000-8000-000000000002',current_setting('test.locality')::uuid),'same decision approves exact location without second approval');
select pg_temp.ok(not private.professional_serves_locality('66000000-0000-4000-8000-000000000002',current_setting('test.other')::uuid),'excluded location not bookable');
select pg_temp.ok(not exists(select 1 from public.marketplace_localities where id=current_setting('test.other')::uuid and is_active),'excluded location not activated');
select pg_temp.ok((select count(*)=1 from public.professional_service_areas where professional_id<>'66000000-0000-4000-8000-000000000002'),'other trainer associations unchanged');
select pg_temp.ok(not private.professional_serves_locality('66000000-0000-4000-8000-000000000005',current_setting('test.locality')::uuid),'shared postal association does not grant another trainer new locality coverage');
select pg_temp.ok(exists(select 1 from public.professional_application_events where application_id=current_setting('test.app')::uuid and event='approved'),'application audit retained');
select pg_temp.ok(exists(select 1 from public.professional_offering_events where professional_id='66000000-0000-4000-8000-000000000002' and event='coverage_approved'),'coverage approval audit retained');
select pg_temp.ok((select count(*)=2 from public.marketplace_audit where new_details->>'application_id'=current_setting('test.app')),'authorization and exclusion audited');
select pg_temp.ok(not exists(select 1 from public.service_areas where locality_id is not null and postal_code is not null),'no invented postal references');
set local role anon;
select pg_temp.ok(jsonb_array_length(public.marketplace_directory())=1,'anonymous All Delhi shows approved trainer before offerings');
select pg_temp.ok(jsonb_array_length(public.marketplace_directory(p_service_slug=>'personal-yoga'))=0,'service filter still requires approved offering');
reset role;
-- Legacy approval followed by one-step remediation, without re-promotion.
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000001',true);
select public.review_professional_application(current_setting('test.old')::uuid,(select updated_at from public.professional_applications where id=current_setting('test.old')::uuid),'approve','LOCAL original workflow',true);
select set_config('test.old_version',(select updated_at::text from public.professional_applications where id=current_setting('test.old')::uuid),true);
select set_config('test.old_reviews',(select jsonb_build_array(jsonb_build_object('id',id,'updated_at',updated_at,'decision','authorize'))::text from public.marketplace_localities where id=current_setting('test.other')::uuid),true);
-- Unsupported region must fail closed, rolling back all promotion/coverage.
update public.marketplace_localities set region_code='IN-NCR' where id=current_setting('test.other')::uuid;
select pg_temp.deny(format('select public.review_application_with_localities(%L,%L,%L,%L,false,%L::jsonb)',current_setting('test.old'),current_setting('test.old_version'),'approve_locations','LOCAL unsupported',current_setting('test.old_reviews')),'22023');
select pg_temp.ok(not exists(select 1 from public.professional_service_areas where professional_id='66000000-0000-4000-8000-000000000003'),'unsupported attempt grants nothing');
update public.marketplace_localities set region_code='IN-DL' where id=current_setting('test.other')::uuid;
select set_config('test.old_reviews',(select jsonb_build_array(jsonb_build_object('id',id,'updated_at',updated_at,'decision','authorize'))::text from public.marketplace_localities where id=current_setting('test.other')::uuid),true);
set local role authenticated;
select public.review_application_with_localities(current_setting('test.old')::uuid,current_setting('test.old_version')::timestamptz,'approve_locations','LOCAL reviewed existing trainer locations',false,current_setting('test.old_reviews')::jsonb);
reset role;
select pg_temp.ok(private.professional_serves_locality('66000000-0000-4000-8000-000000000003',current_setting('test.other')::uuid),'existing trainer remediation succeeds in one operation');
-- Publication remains optional: verified unpublished trainer can get coverage, but stays private.
select set_config('test.hidden_reviews',(select jsonb_build_array(jsonb_build_object('id',id,'updated_at',updated_at,'decision','authorize'))::text from public.marketplace_localities where id=current_setting('test.other')::uuid),true);
select public.review_application_with_localities(current_setting('test.hidden')::uuid,(select updated_at from public.professional_applications where id=current_setting('test.hidden')::uuid),'approve','LOCAL unpublished approval',false,current_setting('test.hidden_reviews')::jsonb);
select pg_temp.ok(private.professional_serves_locality('66000000-0000-4000-8000-000000000004',current_setting('test.other')::uuid),'unpublished verified trainer receives explicitly authorized coverage');
select pg_temp.ok(jsonb_array_length(public.marketplace_directory())=2,'publication choice still enforced');
select pg_temp.ok(not has_function_privilege('anon','public.review_application_with_localities(uuid,timestamptz,text,text,boolean,jsonb)','EXECUTE'),'anonymous review execute denied');
select pg_temp.ok(not has_function_privilege('anon','public.admin_application_localities(uuid)','EXECUTE'),'private application location review not public');
select 'PASS: combined approval, exclusions, authorization, audits, publication, directory and existing trainer remediation' as result;
rollback;
