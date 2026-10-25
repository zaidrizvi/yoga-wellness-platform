-- Disposable local database only. Real existing RPCs; Auth/Storage catalog stubs.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.deny(statement text,expected text) returns void language plpgsql as $$begin
 begin execute statement; exception when others then if sqlstate=expected then return; end if; raise; end;
 raise exception 'Expected denial %',expected; end $$;
insert into auth.users(id,email_confirmed_at) select ('65000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now() from generate_series(1,5)i;
select set_config('app.role_change_reason','LOCAL explicit bootstrap fixture',true);
update public.user_roles set role='admin' where user_id='65000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select public.change_user_role('65000000-0000-4000-8000-000000000003','professional','LOCAL fixture');
select public.change_user_role('65000000-0000-4000-8000-000000000004','professional','LOCAL fixture');
update public.professional_profiles set display_name='TEST — locality coverage fixture',qualifications_description='LOCAL test qualification — not verified';
select public.review_professional(user_id,'verified',true,'LOCAL fixture',null,'LOCAL fixture') from public.professional_profiles;
select set_config('test.locality',(select id::text from public.marketplace_localities where name='Saket' and district='SOUTH'),true);
select set_config('test.other',(select id::text from public.marketplace_localities where name='Hauz Khas' and district='SOUTH'),true);
select set_config('test.service',(select id::text from public.services where slug='personal-yoga'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
select pg_temp.deny(format('select public.admin_approve_locality_coverage(array[%L]::uuid[],null,%L)',current_setting('test.locality'),'LOCAL fixture'),'42501');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select public.admin_approve_locality_coverage(array[current_setting('test.locality')::uuid],'65000000-0000-4000-8000-000000000003','LOCAL explicit area approval');
select public.admin_approve_locality_coverage(array[current_setting('test.locality')::uuid],'65000000-0000-4000-8000-000000000003','LOCAL repeat approval');
select pg_temp.ok(jsonb_array_length(public.marketplace_directory())=1,'approved trainer discoverable without fabricated postal data');
reset role;
select set_config('test.area',(select id::text from public.service_areas where locality_id=current_setting('test.locality')::uuid),true);
select pg_temp.ok((select count(*)=1 and bool_and(postal_code is null) from public.service_areas),'idempotent native area has no invented PIN');
select pg_temp.ok((select count(*)=1 from public.professional_service_areas),'idempotent explicit professional authorization');
select pg_temp.ok(not private.professional_serves_locality('65000000-0000-4000-8000-000000000003',current_setting('test.other')::uuid),'no adjacent-locality authorization');
set local role authenticated;
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000004',true);
select public.request_locality_coverage(array[current_setting('test.locality')::uuid]);
select pg_temp.ok(jsonb_array_length(public.marketplace_directory())=1,'pending coverage remains hidden');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000003',true);
select set_config('test.revision',public.save_professional_offering(current_setting('test.service')::uuid,
 '{"offering_type":"single_session","title":"TEST — locality session","description":"LOCAL regression fixture","duration_minutes":60,"price_minor":50000,"delivery_notes":"LOCAL fixture"}')::text,true);
reset role;
select set_config('test.offering',(select offering_id::text from public.professional_offering_revisions where id=current_setting('test.revision')::uuid),true);
set local role authenticated;
select public.submit_professional_offering(current_setting('test.revision')::uuid,(select updated_at from public.professional_offering_revisions where id=current_setting('test.revision')::uuid));
select public.save_weekly_availability((select jsonb_agg(jsonb_build_object('iso_weekday',d,'start_time','09:00','end_time','18:00')) from generate_series(1,7)d));
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select public.review_professional_offering(current_setting('test.revision')::uuid,true,'LOCAL price approval');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
select set_config('test.address',public.save_locality_address(null,current_setting('test.locality')::uuid,current_setting('test.area')::uuid,
 '{"label":"LOCAL fixture","recipient_name":"TEST — customer","phone":"9876543210","address_line_1":"LOCAL only address"}')::text,true);
select pg_temp.ok((select postal_code='' and locality_id=current_setting('test.locality')::uuid from public.customer_addresses where id=current_setting('test.address')::uuid),'owned address uses exact locality without fake PIN');
select set_config('test.start',(((now() at time zone 'Asia/Kolkata')::date+2+time '10:00') at time zone 'Asia/Kolkata')::text,true);
select set_config('test.hash',public.marketplace_booking_preview(current_setting('test.offering')::uuid,current_setting('test.revision')::uuid,current_setting('test.start')::timestamptz)->>'review_hash',true);
select set_config('test.call',format('select public.submit_direct_booking(%L,%L,%L,%L,%L,%L,%L,%L,true)',current_setting('test.offering'),current_setting('test.revision'),current_setting('test.address'),current_setting('test.locality'),current_setting('test.start'),'65000000-0000-4000-8000-000000000010',current_setting('test.hash'),'LOCAL request'),true);
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000005',true);
select pg_temp.deny(current_setting('test.call'),'42501');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
do $$ declare booking uuid; begin execute current_setting('test.call') into booking; perform set_config('test.booking',booking::text,true); end $$;
reset role;
select set_config('test.assignment',(select id::text from public.booking_assignments where booking_id=current_setting('test.booking')::uuid),true);
select pg_temp.ok((select address_snapshot->>'locality_id'=current_setting('test.locality') and status='assignment_proposed' from public.booking_requests where id=current_setting('test.booking')::uuid),'immutable locality snapshot and pending professional acceptance');
set local role authenticated;
select pg_temp.deny(replace(current_setting('test.call'),'65000000-0000-4000-8000-000000000010','65000000-0000-4000-8000-000000000011'),'22023');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000003',true);
select public.respond_booking_assignment(current_setting('test.assignment')::uuid,true,'LOCAL acceptance');
reset role;
select pg_temp.ok((select status='confirmed' from public.booking_requests where id=current_setting('test.booking')::uuid),'exact-locality direct booking confirms with existing agreement guards');
-- Legacy PIN eligibility still works and is not inferred from locality names.
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
insert into public.service_areas(name,postal_code,is_active) values('LOCAL legacy PIN fixture','110001',true);
insert into public.professional_service_areas(professional_id,service_area_id,approved_by)
 select '65000000-0000-4000-8000-000000000003',id,auth.uid() from public.service_areas where name='LOCAL legacy PIN fixture';
select pg_temp.ok(private.professional_booking_issue('65000000-0000-4000-8000-000000000003',current_setting('test.service')::uuid,'110001') is null,'legacy postal authority preserved');
select public.admin_save_marketplace_locality(l.id,l.name,l.district,l.region_code,l.source_url,true,false,
 array[current_setting('test.area')::uuid],l.updated_at,'LOCAL deactivation regression') from public.marketplace_localities l where l.id=current_setting('test.locality')::uuid;
select pg_temp.ok((select status='requires_rescheduling' from public.booking_requests where id=current_setting('test.booking')::uuid),'locality deactivation invalidates affected assignment');
select pg_temp.ok(private.professional_booking_issue('65000000-0000-4000-8000-000000000003',current_setting('test.service')::uuid,'110001') is null,'legacy route remains independent after native deactivation');
select pg_temp.ok(not has_function_privilege('anon','public.admin_approve_locality_coverage(uuid[],uuid,text)','EXECUTE'),'anonymous admin writes denied');
select 'PASS: explicit locality approval, no fabricated PIN, pending exclusion, ownership, agreement, conflicts, native booking, legacy routing and deactivation' as result;
rollback;
