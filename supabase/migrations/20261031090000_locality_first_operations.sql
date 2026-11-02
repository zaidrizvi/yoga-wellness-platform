-- Locality-first operations. Forward-only; legacy service-area rows remain for history.
-- Depends on 20261026090000_unified_trainer_locality_approval.sql.

create table public.professional_localities (
  professional_id uuid not null references auth.users(id) on delete cascade,
  locality_id uuid not null references public.marketplace_localities(id) on delete restrict,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  primary key (professional_id, locality_id)
);
create index professional_localities_locality_idx on public.professional_localities(locality_id,professional_id);

create table public.professional_locality_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  locality_id uuid not null references public.marketplace_localities(id) on delete restrict,
  action text not null check(action in ('add','remove')),
  state text not null default 'submitted' check(state in ('submitted','approved','rejected')),
  feedback text not null default '' check(char_length(feedback)<=1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check((state='submitted' and reviewed_by is null and reviewed_at is null) or
        (state<>'submitted' and reviewed_by is not null and reviewed_at is not null))
);
create unique index professional_locality_request_open
  on public.professional_locality_requests(professional_id,locality_id) where state='submitted';

alter table public.professional_localities enable row level security;
alter table public.professional_locality_requests enable row level security;
revoke all on public.professional_localities,public.professional_locality_requests from public,anon,authenticated;
grant select on public.professional_localities,public.professional_locality_requests to authenticated;
create policy professional_localities_owner_admin on public.professional_localities for select to authenticated
  using(professional_id=auth.uid() or private.is_admin());
create policy professional_locality_requests_owner_admin on public.professional_locality_requests for select to authenticated
  using(professional_id=auth.uid() or private.is_admin());

-- Preserve already-authorized exact-locality coverage. No new authorization is inferred.
insert into public.professional_localities(professional_id,locality_id,approved_by,approved_at)
select distinct pa.professional_id,l.id,pa.approved_by,pa.approved_at
from public.marketplace_localities l
join public.locality_service_areas m on m.locality_id=l.id
join public.professional_service_areas pa on pa.service_area_id=m.service_area_id
where l.region_code='IN-DL' and l.verified and l.is_active
and not exists(
  select 1 from public.locality_service_areas all_m
  join public.service_areas a on a.id=all_m.service_area_id
  where all_m.locality_id=l.id and a.is_active
  and not exists(select 1 from public.professional_service_areas all_pa
    where all_pa.professional_id=pa.professional_id and all_pa.service_area_id=all_m.service_area_id)
)
on conflict do nothing;

create or replace function private.professional_serves_locality(p_professional uuid,p_locality uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.professional_localities pl
    join public.marketplace_localities l on l.id=pl.locality_id
    where pl.professional_id=p_professional and pl.locality_id=p_locality
      and l.region_code='IN-DL' and l.verified and l.is_active
  );
$$;

create or replace function public.marketplace_locations()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'district',l.district,
    'service_areas','[]'::jsonb) order by l.name,l.district,l.id),'[]'::jsonb)
  from public.marketplace_localities l
  where l.region_code='IN-DL' and l.verified and l.is_active;
$$;

create or replace function public.marketplace_catalog_locations()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'district',l.district,
    'service_areas','[]'::jsonb) order by l.name,l.district,l.id),'[]'::jsonb)
  from public.marketplace_localities l where l.region_code='IN-DL';
$$;

create or replace function public.admin_save_marketplace_locality(p_id uuid,p_name text,p_district text,p_region text,p_source text,
 p_verified boolean,p_active boolean,p_area_ids uuid[],p_expected_updated_at timestamptz,p_reason text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare l public.marketplace_localities; result uuid; before_value jsonb;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.lock_booking_fulfillment();
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 or p_verified is null or p_active is null
    or p_region<>'IN-DL' or (p_active and not p_verified) then
    raise exception 'Verified Delhi locality, status and reason required' using errcode='22023'; end if;
  if p_id is null then
    insert into public.marketplace_localities(name,district,region_code,source_url,verified,is_active)
    values(btrim(p_name),btrim(p_district),p_region,p_source,p_verified,p_active) returning id into result;
  else
    select * into l from public.marketplace_localities where id=p_id for update;
    if not found or l.updated_at is distinct from p_expected_updated_at then raise exception 'Locality changed; reload' using errcode='40001'; end if;
    before_value:=to_jsonb(l); result:=l.id;
    update public.marketplace_localities set name=btrim(p_name),district=btrim(p_district),region_code=p_region,
      source_url=p_source,verified=p_verified,is_active=p_active,updated_at=clock_timestamp() where id=result;
  end if;
  insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
  values('locality',result,auth.uid(),before_value,jsonb_build_object('name',p_name,'district',p_district,
    'region',p_region,'source',p_source,'verified',p_verified,'active',p_active),p_reason);
  return result;
end $$;

create or replace function public.admin_approve_locality_coverage(p_localities uuid[],p_professional uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare selected uuid; l public.marketplace_localities; total integer:=0;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.lock_booking_fulfillment();
  if p_professional is null or p_localities is null or cardinality(p_localities) not between 1 and 20
    or array_position(p_localities,null) is not null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Professional, 1-20 Delhi localities and reason required' using errcode='22023'; end if;
  if not exists(select 1 from public.professional_profiles p join public.professional_verifications v on v.professional_id=p.user_id
    join public.user_roles r on r.user_id=p.user_id join auth.users u on u.id=p.user_id
    where p.user_id=p_professional and r.role='professional' and v.status='verified' and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
    raise exception 'Eligible verified professional required' using errcode='22023'; end if;
  for selected in select distinct id from unnest(p_localities) selected(id) order by id loop
    select * into l from public.marketplace_localities where id=selected and region_code='IN-DL' for update;
    if not found then raise exception 'Delhi catalog locality required' using errcode='22023'; end if;
    update public.marketplace_localities set verified=true,is_active=true,updated_at=clock_timestamp() where id=l.id;
    insert into public.professional_localities(professional_id,locality_id,approved_by)
      values(p_professional,l.id,auth.uid()) on conflict do nothing;
    insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
      values('locality',l.id,auth.uid(),to_jsonb(l),jsonb_build_object('professional_id',p_professional,
        'decision','authorized','authority','professional_localities'),p_reason);
    total:=total+1;
  end loop;
  return jsonb_build_object('localities',total,'professional_id',p_professional);
end $$;

create or replace function public.admin_application_localities(p_application uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',coalesce(l.name,'Unavailable locality'),
    'district',coalesce(l.district,''),'supported',coalesce(l.region_code='IN-DL',false),
    'active',coalesce(l.is_active and l.verified,false),'updated_at',l.updated_at,'source',l.source_url,
    'approved',exists(select 1 from public.professional_localities pl where pl.professional_id=a.applicant_id and pl.locality_id=x.id))
    order by l.name,x.id),'[]'::jsonb)
    from public.professional_applications a cross join lateral unnest(a.requested_locality_ids) x(id)
    left join public.marketplace_localities l on l.id=x.id where a.id=p_application);
end $$;

create or replace function public.request_locality_coverage(p_locality_ids uuid[])
returns void language plpgsql volatile security definer set search_path='' as $$
declare selected uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_locality_ids is null or cardinality(p_locality_ids) not between 1 and 20 or array_position(p_locality_ids,null) is not null then
    raise exception 'Choose 1-20 Delhi localities' using errcode='22023'; end if;
  for selected in select distinct id from unnest(p_locality_ids) selected(id) loop
    if not exists(select 1 from public.marketplace_localities where id=selected and region_code='IN-DL') then
      raise exception 'Delhi catalog locality required' using errcode='22023'; end if;
    if exists(select 1 from public.professional_localities where professional_id=auth.uid() and locality_id=selected) then
      raise exception 'Locality is already approved' using errcode='22023'; end if;
    insert into public.professional_locality_requests(professional_id,locality_id,action)
      values(auth.uid(),selected,'add');
  end loop;
end $$;

create function public.review_professional_locality_request(p_request uuid,p_approve boolean,p_feedback text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare r public.professional_locality_requests; l public.marketplace_localities;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.lock_booking_fulfillment();
  if p_approve is null or p_feedback is null or char_length(btrim(p_feedback)) not between 1 and 1000 then
    raise exception 'Decision and feedback required' using errcode='22023'; end if;
  select * into r from public.professional_locality_requests where id=p_request for update;
  if not found or r.state<>'submitted' then raise exception 'Pending location request unavailable' using errcode='22023'; end if;
  select * into l from public.marketplace_localities where id=r.locality_id and region_code='IN-DL' for update;
  if not found then raise exception 'Delhi locality unavailable' using errcode='22023'; end if;
  if p_approve and r.action='add' then
    perform public.admin_approve_locality_coverage(array[r.locality_id],r.professional_id,p_feedback);
  elsif p_approve then
    delete from public.professional_localities where professional_id=r.professional_id and locality_id=r.locality_id;
  end if;
  update public.professional_locality_requests set state=case when p_approve then 'approved' else 'rejected' end,
    feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=r.id;
  return r.id;
end $$;

create function public.professional_locality_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  return jsonb_build_object(
    'approved',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'district',l.district) order by l.name),'[]')
      from public.professional_localities pl join public.marketplace_localities l on l.id=pl.locality_id where pl.professional_id=auth.uid()),
    'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'locality_id',l.id,'name',l.name,'district',l.district,
      'action',r.action,'state',r.state,'feedback',r.feedback,'created_at',r.created_at) order by r.created_at desc),'[]')
      from public.professional_locality_requests r join public.marketplace_localities l on l.id=r.locality_id where r.professional_id=auth.uid())
  );
end $$;

create function public.admin_professional_locality_requests()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'professional_id',r.professional_id,
    'professional_name',p.display_name,'locality_id',l.id,'locality_name',l.name,'district',l.district,
    'action',r.action,'state',r.state,'created_at',r.created_at) order by r.created_at),'[]')
    from public.professional_locality_requests r join public.marketplace_localities l on l.id=r.locality_id
    join public.professional_profiles p on p.user_id=r.professional_id where r.state='submitted');
end $$;

create or replace function public.save_locality_address(p_id uuid,p_locality uuid,p_service_area uuid,p_details jsonb)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare l public.marketplace_localities; result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  select * into l from public.marketplace_localities where id=p_locality and verified and is_active and region_code='IN-DL';
  if not found then raise exception 'Choose an active Delhi locality' using errcode='22023'; end if;
  if p_id is not null then
    select id into result from public.customer_addresses where id=p_id and customer_id=auth.uid() for update;
    if not found then raise exception 'Own address required' using errcode='42501'; end if;
    update public.customer_addresses set label=p_details->>'label',recipient_name=p_details->>'recipient_name',phone=p_details->>'phone',
      address_line_1=p_details->>'address_line_1',address_line_2=coalesce(p_details->>'address_line_2',''),locality=l.name,
      city='Delhi',state='Delhi',postal_code='',landmark=coalesce(p_details->>'landmark',''),locality_id=l.id,service_area_id=null where id=result;
  else
    insert into public.customer_addresses(customer_id,label,recipient_name,phone,address_line_1,address_line_2,locality,city,state,postal_code,landmark,locality_id,service_area_id)
    values(auth.uid(),p_details->>'label',p_details->>'recipient_name',p_details->>'phone',p_details->>'address_line_1',
      coalesce(p_details->>'address_line_2',''),l.name,'Delhi','Delhi','',coalesce(p_details->>'landmark',''),l.id,null) returning id into result;
  end if;
  return result;
end $$;

create or replace function private.professional_booking_issue(p_professional uuid,p_service uuid,p_pin text)
returns text language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.list_public_professionals() p where p.professional_id=p_professional) then return 'Professional must be currently verified, visible, and eligible'; end if;
  if not exists(select 1 from public.services s join public.service_categories c on c.id=s.category_id where s.id=p_service and s.is_active and s.is_published and c.is_active) then return 'Service is not available'; end if;
  if not exists(select 1 from public.professional_services ps where ps.professional_id=p_professional and ps.service_id=p_service) then return 'Professional has no approved association with this service'; end if;
  if p_pin like 'locality:%' then
    if substring(p_pin from 10) !~ '^[0-9a-fA-F-]{36}$' or not private.professional_serves_locality(p_professional,substring(p_pin from 10)::uuid) then return 'No approved active coverage for this locality'; end if;
    return null;
  end if;
  -- Historical booking snapshots may still contain a PIN. New workflows never use it.
  if not exists(select 1 from public.professional_service_areas pa join public.service_areas a on a.id=pa.service_area_id
    where pa.professional_id=p_professional and a.is_active and a.postal_code=p_pin) then return 'Historical delivery coverage is no longer eligible'; end if;
  return null;
end $$;

create or replace function public.submit_direct_booking(p_offering uuid,p_revision uuid,p_address uuid,p_locality uuid,
  p_start timestamptz,p_key uuid,p_review_hash text,p_notes text,p_accept boolean)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare choice public.customer_booking_choices; preview jsonb; o record; address public.customer_addresses;
  booking uuid; assignment uuid; fingerprint text; time_window text; selected_hash text;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  if p_accept is distinct from true or p_key is null then raise exception 'Explicit agreement and retry key required' using errcode='22023'; end if;
  fingerprint:=md5(jsonb_build_array(p_offering,p_revision,p_address,p_locality,extract(epoch from p_start),p_review_hash,btrim(coalesce(p_notes,'')))::text);
  select c.* into choice from public.customer_booking_choices c join public.booking_requests b on b.id=c.booking_id where b.customer_id=auth.uid() and b.idempotency_key=p_key;
  if found then
    if choice.request_fingerprint is distinct from fingerprint then raise exception 'Retry key already used for different direct booking details' using errcode='22023'; end if;
    return choice.booking_id;
  end if;
  if exists(select 1 from public.booking_requests where customer_id=auth.uid() and idempotency_key=p_key) then raise exception 'Retry key belongs to an existing service request' using errcode='22023'; end if;
  preview:=public.marketplace_booking_preview(p_offering,p_revision,p_start);
  if p_review_hash is distinct from preview->>'review_hash' then raise exception 'Terms changed; reload and agree the current offering' using errcode='40001'; end if;
  select * into o from public.list_public_offerings() where offering_id=p_offering and revision_id=p_revision;
  if not found or not private.professional_serves_locality(o.professional_id,p_locality) then raise exception 'Professional is not approved for this locality' using errcode='22023'; end if;
  select * into address from public.customer_addresses where id=p_address and customer_id=auth.uid() for share;
  if not found then raise exception 'Own service address required' using errcode='42501'; end if;
  if address.locality_id is distinct from p_locality then raise exception 'Address must use the selected locality' using errcode='22023'; end if;
  select window_key into time_window from public.booking_request_options() where (p_start at time zone 'Asia/Kolkata')::time>=start_time and (p_start at time zone 'Asia/Kolkata')::time<end_time;
  if time_window is null then raise exception 'Choose a supported appointment time' using errcode='22023'; end if;
  booking:=public.submit_booking_request(o.service_id,address.id,(p_start at time zone 'Asia/Kolkata')::date,time_window,p_key,p_notes);
  insert into public.customer_booking_choices(booking_id,customer_id,professional_id,offering_id,revision_id,locality_id,starts_at,review_hash,request_fingerprint)
    values(booking,auth.uid(),o.professional_id,p_offering,p_revision,p_locality,p_start,p_review_hash,fingerprint);
  assignment:=private.marketplace_propose_offering(booking,p_offering,p_revision,p_start,p_key,'Customer selected this professional, offering and schedule');
  select terms_hash into selected_hash from public.booking_assignments where id=assignment;
  perform public.respond_booking_terms(assignment,selected_hash,true);
  return booking;
end $$;

revoke all on function public.review_professional_locality_request(uuid,boolean,text),public.professional_locality_overview(),
  public.admin_professional_locality_requests() from public,anon,authenticated;
grant execute on function public.review_professional_locality_request(uuid,boolean,text),public.professional_locality_overview(),
  public.admin_professional_locality_requests() to authenticated;
-- Existing RPC ACLs remain explicit; replaced functions retain their prior grants.
