-- Disposable local schema only; never execute against hosted Supabase.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
create function pg_temp.reject(statement text,expected text,label text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'FAIL: %, expected %, got %: %',label,expected,sqlstate,sqlerrm;
  end;
  raise exception 'FAIL: % was allowed',label;
end; $$;
select pg_temp.assert_true((select count(*)=2258 from public.marketplace_localities),'complete extracted catalog imported');
select pg_temp.assert_true((select count(*)=0 from public.marketplace_localities where verified or is_active),'catalog import creates no service coverage');
insert into auth.users(id,email_confirmed_at) select ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now() from generate_series(1,5) i;
update public.user_roles set role='admin' where user_id='50000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select public.change_user_role('50000000-0000-4000-8000-000000000004','professional','Local fixture');
select public.change_user_role('50000000-0000-4000-8000-000000000005','professional','Local fixture');
update public.professional_profiles set display_name='Local fixture professional',qualifications_description='Local-only qualification fixture',experience_description='Local-only experience',specializations='Fixture practice';
select public.review_professional('50000000-0000-4000-8000-000000000004','verified',true,'',null,'Local fixture review');
select public.review_professional('50000000-0000-4000-8000-000000000005','verified',true,'',null,'Local fixture review');
insert into public.service_areas(id,name,postal_code,is_active) values
 ('51000000-0000-4000-8000-000000000001','LOCAL fixture delivery A','110001',true),
 ('51000000-0000-4000-8000-000000000002','LOCAL fixture delivery B','110001',true);
select set_config('test.area_a',public.admin_save_marketplace_locality(null,'LOCAL fixture locality A','LOCAL source grouping','IN-DL','https://example.invalid/local-fixture',true,true,array['51000000-0000-4000-8000-000000000001']::uuid[],null,'Local fixture')::text,true);
select set_config('test.area_b',public.admin_save_marketplace_locality(null,'LOCAL fixture locality B','LOCAL source grouping','IN-DL','https://example.invalid/local-fixture',true,true,array['51000000-0000-4000-8000-000000000002']::uuid[],null,'Local fixture')::text,true);
insert into public.professional_service_areas(professional_id,service_area_id,approved_by) values
 ('50000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000001',auth.uid()),
 ('50000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000002',auth.uid());
insert into public.professional_services(professional_id,service_id,approved_by)
 select r.user_id,s.id,auth.uid() from public.user_roles r cross join public.services s where r.role='professional' and s.slug='personal-yoga';
insert into public.professional_offerings(id,professional_id,service_id)
 select ('52000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('50000000-0000-4000-8000-'||lpad((i+3)::text,12,'0'))::uuid,s.id
 from generate_series(1,2)i cross join public.services s where s.slug='personal-yoga';
insert into public.professional_offering_revisions(id,offering_id,revision_number,state,offering_type,title,duration_minutes,price_minor,reviewed_by,reviewed_at)
 select ('53000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('52000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,'approved','single_session','LOCAL fixture offering',60,10000,auth.uid(),now() from generate_series(1,2)i;
update public.professional_offerings set approved_revision_id=('53000000-0000-4000-8000-'||right(id::text,12))::uuid;
insert into public.professional_weekly_availability(professional_id,iso_weekday,start_time,end_time)
 select user_id,d,'00:01','23:59' from public.user_roles cross join generate_series(1,7)d where role='professional';
select pg_temp.assert_true(jsonb_array_length(public.marketplace_directory())=2,'All Delhi includes both eligible configured professionals');
select pg_temp.assert_true(jsonb_array_length(public.marketplace_directory(current_setting('test.area_a')::uuid,'personal-yoga','Fixture',10000))=1,'combined area/service/specialty/price filters');
select pg_temp.assert_true(jsonb_array_length(public.marketplace_directory(null,null,null,9999))=0,'approved price filter');
select pg_temp.assert_true(jsonb_array_length(public.marketplace_directory())=2,'clearing area restores directory');
select pg_temp.assert_true(not private.professional_serves_locality('50000000-0000-4000-8000-000000000004',current_setting('test.area_b')::uuid),'same PIN does not authorize another mapped locality');
select pg_temp.assert_true(not (public.marketplace_directory()->0 ?| array['phone','email','internal_notes','document_paths']),'public projection omits private fields');
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000004',true);
select public.request_locality_coverage(array[current_setting('test.area_b')::uuid]);
select public.request_locality_coverage(array[current_setting('test.area_b')::uuid]);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.professional_coverage_requests where professional_id='50000000-0000-4000-8000-000000000004'),'coverage requests deduplicate');
select pg_temp.assert_true(not private.professional_serves_locality('50000000-0000-4000-8000-000000000004',current_setting('test.area_b')::uuid),'pending coverage does not grant filtering eligibility');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
select set_config('test.address',public.save_locality_address(null,current_setting('test.area_a')::uuid,'51000000-0000-4000-8000-000000000001',
 '{"label":"LOCAL fixture","recipient_name":"Local fixture customer","phone":"9876543210","address_line_1":"Local-only test address"}')::text,true);
select set_config('test.start',(((now() at time zone 'Asia/Kolkata')::date+2+time '10:00') at time zone 'Asia/Kolkata')::text,true);
select set_config('test.hash',public.marketplace_booking_preview('52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',current_setting('test.start')::timestamptz)->>'review_hash',true);
select set_config('test.call',format('select public.submit_direct_booking(%L,%L,%L,%L,%L,%L,%L,%L,true)',
 '52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',current_setting('test.address'),current_setting('test.area_a'),current_setting('test.start'),'54000000-0000-4000-8000-000000000001',current_setting('test.hash'),'Local fixture'),true);
select pg_temp.reject(replace(current_setting('test.call'),current_setting('test.hash'),'invalid'),'40001','stale/tampered commercial review rejected');
select pg_temp.reject(replace(current_setting('test.call'),'true)','false)'),'22023','consent is mandatory');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
select pg_temp.reject(current_setting('test.call'),'42501','foreign address rejected');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
do $$ declare booking uuid; begin execute current_setting('test.call') into booking; perform set_config('test.booking',booking::text,true); end $$;
select pg_temp.assert_true((select status='assignment_proposed' from public.booking_requests where id=current_setting('test.booking')::uuid),'customer consent does not confirm appointment');
do $$ declare booking uuid; begin execute current_setting('test.call') into booking; perform pg_temp.assert_true(booking=current_setting('test.booking')::uuid,'exact direct retry idempotent'); end $$;
select pg_temp.reject(replace(current_setting('test.call'),'54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002'),'22023','overlapping direct request rejected');
select pg_temp.assert_true((select count(*)=1 from public.booking_requests),'conflict rolls back entire request');
select pg_temp.assert_true((select customer_terms_state='accepted' and agreed_terms=proposed_terms from public.booking_assignments where booking_id=current_setting('test.booking')::uuid),'direct agreement stored immutably');
select pg_temp.reject($s$select public.admin_marketplace_bundles()$s$,'42501','customer cannot administer bundles');
select pg_temp.reject(format('select public.propose_booking_offering(%L,%L,%L,%L,%L,%L)',current_setting('test.booking'),'52000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',current_setting('test.start'),'55000000-0000-4000-8000-000000000001','Local fixture alternative'),'42501','customer cannot use admin proposal RPC');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select pg_temp.reject(format('select public.propose_booking_offering(%L,%L,%L,%L,%L,%L)',current_setting('test.booking'),'52000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',current_setting('test.start'),'55000000-0000-4000-8000-000000000001','Local fixture alternative'),'42501','admin cannot silently substitute another trainer');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000004',true);
select public.respond_booking_assignment(id,false,'Local fixture decline') from public.booking_assignments where booking_id=current_setting('test.booking')::uuid;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
select public.allow_booking_alternative(current_setting('test.booking')::uuid);
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select public.propose_booking_offering(current_setting('test.booking')::uuid,'52000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',current_setting('test.start')::timestamptz,'55000000-0000-4000-8000-000000000002','Explicitly authorized alternative');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000005',true);
select pg_temp.reject(format('select public.respond_booking_assignment(%L,true,%L)',(select id from public.booking_assignments where booking_id=current_setting('test.booking')::uuid and state='proposed'),'Local fixture'),'22023','alternative still requires fresh customer agreement');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select set_config('test.bundle',public.admin_save_marketplace_bundle(null,jsonb_build_object('title','LOCAL fixture bundle','description','Local fixture only','locality_id',current_setting('test.area_a'),'price_minor',10000,'discount_terms','No complimentary claims','starts_at',now()-interval '1 day','ends_at',now()+interval '1 day','state','published'),
 '[{"offering_id":"52000000-0000-4000-8000-000000000001","revision_id":"53000000-0000-4000-8000-000000000001","quantity":1}]',null,'Local fixture publication')::text,true);
select pg_temp.assert_true(jsonb_array_length(public.marketplace_public_bundles())=1,'eligible genuine bundle projection');
select public.set_professional_offering_suspended('52000000-0000-4000-8000-000000000001',true,'Local fixture suspension');
select pg_temp.assert_true(jsonb_array_length(public.marketplace_public_bundles())=0,'suspended component suppresses bundle immediately');
select public.admin_save_marketplace_bundle(current_setting('test.bundle')::uuid,
 (select to_jsonb(b)||'{"state":"suspended"}'::jsonb from public.marketplace_bundles b where b.id=current_setting('test.bundle')::uuid),
 '[{"offering_id":"52000000-0000-4000-8000-000000000001","revision_id":"53000000-0000-4000-8000-000000000001","quantity":1}]',
 (select updated_at from public.marketplace_bundles where id=current_setting('test.bundle')::uuid),'Suspend a stale component bundle');
select pg_temp.assert_true((select state='suspended' from public.marketplace_bundles where id=current_setting('test.bundle')::uuid),'admin can suspend a bundle even when component is no longer eligible');
select pg_temp.reject(format('select public.admin_save_marketplace_bundle(null,%L::jsonb,%L::jsonb,null,%L)',
 jsonb_build_object('title','Invalid LOCAL fixture','description','','locality_id',current_setting('test.area_a'),'price_minor',10000,'discount_terms','Local fixture','starts_at',now()-interval '1 day','ends_at',now()+interval '1 day','state','published')::text,
 '[{"offering_id":"52000000-0000-4000-8000-000000000002","revision_id":"53000000-0000-4000-8000-000000000002","quantity":1}]','Invalid coverage fixture'),'22023','bundle cannot publish a provider without exact locality coverage');
select public.review_professional('50000000-0000-4000-8000-000000000005','suspended',false,'',null,'Local fixture suspension');
select pg_temp.assert_true(jsonb_array_length(public.marketplace_directory())=1,'suspended professional disappears from public directory');
select public.review_professional('50000000-0000-4000-8000-000000000005','verified',true,'',null,'Restore local fixture');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
select public.save_application_localities('{"full_name":"Local applicant","phone":"","category_id":null,"qualifications":"","years_experience":null,"biography":"","specializations":"","service_locations":"","postal_codes":[]}',array[current_setting('test.area_a')::uuid]);
select pg_temp.assert_true((select role='customer' from public.user_roles where user_id=auth.uid()),'locality application choices never promote role');
select pg_temp.assert_true((select postal_codes=array['110001'] and requested_locality_ids=array[current_setting('test.area_a')::uuid] from public.professional_applications where applicant_id=auth.uid()),'onboarding resolves authoritative postal mapping and retains stable locality IDs');
set local role anon;
select pg_temp.assert_true(jsonb_array_length(public.marketplace_directory())=2,'anonymous directory read is public');
select pg_temp.reject('select public.admin_marketplace_bundles()','42501','anonymous bundle admin denied');
select pg_temp.reject('select private.bundle_eligible(null)','42501','private helper not executable by anonymous');
reset role;
select pg_temp.assert_true((select count(*)=6 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relname in ('marketplace_localities','locality_service_areas','marketplace_audit','customer_booking_choices','marketplace_bundles','marketplace_bundle_items')),'all new tables have RLS');
select 'PASS: locality import, exact-area filters, coverage review, own-address direct booking, consent, immutable agreement, conflict rollback, choice binding, alternative consent, bundle suppression and anonymous/admin boundaries' as result;
rollback;
