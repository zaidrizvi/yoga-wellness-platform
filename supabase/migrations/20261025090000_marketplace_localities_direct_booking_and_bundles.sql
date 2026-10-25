-- Phase 4E proposal. NOT deployed. Requires explicit approval.
-- Catalog presence never implies active coverage. Existing PIN relations remain authoritative.
create table public.marketplace_localities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  district text not null check (char_length(btrim(district)) between 1 and 120),
  region_code text not null default 'IN-DL' check (char_length(region_code) between 2 and 40),
  source_url text not null check (source_url ~ '^https://'),
  source_keys text[] not null default '{}',
  verified boolean not null default false,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not is_active or verified)
);
create unique index marketplace_locality_name on public.marketplace_localities(region_code,lower(btrim(district)),lower(btrim(name)));
create table public.locality_service_areas (
  locality_id uuid not null references public.marketplace_localities(id) on delete restrict,
  service_area_id uuid not null references public.service_areas(id) on delete restrict,
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(locality_id,service_area_id)
);
create table public.marketplace_audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check(entity_type in ('locality','bundle','booking_choice')),
  entity_id uuid not null,
  actor_user_id uuid,
  previous_details jsonb,
  new_details jsonb not null,
  reason text not null check(char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create trigger immutable_marketplace_audit before update or delete on public.marketplace_audit
for each row execute function private.prevent_audit_mutation();
alter table public.customer_addresses add column locality_id uuid references public.marketplace_localities(id) on delete restrict;
alter table public.customer_addresses add column service_area_id uuid references public.service_areas(id) on delete restrict;
create table public.customer_booking_choices (
  booking_id uuid primary key references public.booking_requests(id) on delete restrict,
  customer_id uuid not null references auth.users(id),
  professional_id uuid not null references auth.users(id),
  offering_id uuid not null references public.professional_offerings(id),
  revision_id uuid not null references public.professional_offering_revisions(id),
  locality_id uuid not null references public.marketplace_localities(id),
  starts_at timestamptz not null,
  review_hash text not null,
  request_fingerprint text not null,
  allow_alternative boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.marketplace_bundles (
  id uuid primary key default gen_random_uuid(), title text not null check(char_length(btrim(title)) between 1 and 160),
  description text not null check(char_length(description)<=4000),
  locality_id uuid not null references public.marketplace_localities(id),
  price_minor bigint not null check(price_minor between 0 and 100000000),
  discount_terms text not null check(char_length(discount_terms) between 1 and 2000),
  starts_at timestamptz not null, ends_at timestamptz not null,
  state text not null default 'draft' check(state in ('draft','published','suspended')),
  updated_at timestamptz not null default now(),
  check(isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at)
);
create table public.marketplace_bundle_items (
  bundle_id uuid not null references public.marketplace_bundles(id) on delete cascade,
  offering_id uuid not null references public.professional_offerings(id),
  revision_id uuid not null references public.professional_offering_revisions(id),
  quantity integer not null check(quantity between 1 and 366),
  primary key(bundle_id,offering_id)
);
-- New data writes are controlled RPCs only. Public reads are explicit projections.
do $$ declare t text; begin
  foreach t in array array['marketplace_localities','locality_service_areas','marketplace_audit','customer_booking_choices','marketplace_bundles','marketplace_bundle_items'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy marketplace_admin_read on public.%I for select to authenticated using(private.is_admin())',t);
  end loop;
end $$;
create policy booking_choice_owner on public.customer_booking_choices for select to authenticated
using(customer_id=auth.uid() and private.has_role('customer'));

create function private.professional_serves_locality(p_professional uuid,p_locality uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.marketplace_localities l where l.id=p_locality and l.region_code='IN-DL' and l.verified and l.is_active)
  and exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
    where m.locality_id=p_locality and a.is_active and a.postal_code is not null)
  and not exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
    where m.locality_id=p_locality and a.is_active and a.postal_code is not null and not exists(
      select 1 from public.professional_service_areas p where p.professional_id=p_professional and p.service_area_id=m.service_area_id));
$$;
create function public.marketplace_locations()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'district',l.district,
    'service_areas',(select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name) order by a.name,a.id)
      from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
      where m.locality_id=l.id and a.is_active and a.postal_code is not null)) order by l.name,l.district,l.id),'[]'::jsonb)
  from public.marketplace_localities l where l.region_code='IN-DL' and l.verified and l.is_active
    and exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
      where m.locality_id=l.id and a.is_active and a.postal_code is not null);
$$;
create function public.marketplace_directory(p_locality_id uuid default null,p_service_slug text default null,
  p_specialization text default null,p_max_price bigint default null,p_professional_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name,x.professional_id),'[]'::jsonb) from (
    select p.*,pr.specializations,
      (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'district',l.district) order by l.name),'[]'::jsonb)
       from public.marketplace_localities l where private.professional_serves_locality(p.professional_id,l.id)) as localities,
      (select coalesce(jsonb_agg(to_jsonb(o) order by o.price_minor,o.offering_id),'[]'::jsonb)
       from public.list_public_offerings(p_service_slug) o where o.professional_id=p.professional_id
         and (p_max_price is null or o.price_minor<=p_max_price)) as offerings,
      (select coalesce(jsonb_agg(jsonb_build_object('weekday',a.iso_weekday,'from',a.start_time,'until',a.end_time)
        order by a.iso_weekday,a.start_time),'[]'::jsonb) from public.professional_weekly_availability a where a.professional_id=p.professional_id) as weekly_hours
    from public.list_public_professionals() p join public.professional_profiles pr on pr.user_id=p.professional_id
    where (p_professional_id is null or p.professional_id=p_professional_id)
      and exists(select 1 from public.marketplace_localities l where private.professional_serves_locality(p.professional_id,l.id))
      and (p_locality_id is null or private.professional_serves_locality(p.professional_id,p_locality_id))
      and (p_specialization is null or pr.specializations ilike '%'||left(p_specialization,120)||'%')
      and ((p_service_slug is null and p_max_price is null) or exists(select 1 from public.list_public_offerings(p_service_slug) o
        where o.professional_id=p.professional_id and (p_max_price is null or o.price_minor<=p_max_price)))
  ) x;
$$;
create function public.admin_marketplace_localities(p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select l.*,
    array(select service_area_id from public.locality_service_areas where locality_id=l.id order by service_area_id) as service_area_ids
    from public.marketplace_localities l where l.name ilike '%'||left(coalesce(p_search,''),120)||'%' or l.district ilike '%'||left(coalesce(p_search,''),120)||'%'
    order by l.name,l.district,l.id limit 50 offset greatest(0,least(coalesce(p_offset,0),100000))) x);
end;
$$;
create function public.admin_save_marketplace_locality(p_id uuid,p_name text,p_district text,p_region text,p_source text,
 p_verified boolean,p_active boolean,p_area_ids uuid[],p_expected_updated_at timestamptz,p_reason text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare l public.marketplace_localities; result uuid; area uuid; before_value jsonb;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.lock_booking_fulfillment();
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 or p_verified is null or p_active is null
    or p_area_ids is null or cardinality(p_area_ids)>30 or (p_active and (not p_verified or cardinality(p_area_ids)=0)) then
    raise exception 'Verified mapping, explicit coverage choice and reason required' using errcode='22023'; end if;
  if p_id is not null then
    select * into l from public.marketplace_localities where id=p_id for update;
    if not found or l.updated_at is distinct from p_expected_updated_at then raise exception 'Locality changed; reload' using errcode='40001'; end if;
    before_value:=to_jsonb(l); result:=l.id;
    -- Existing mappings are append-only. Corrections require deactivation and a
    -- separately reviewed new locality; references/snapshots are never rewritten.
    if exists(select 1 from public.locality_service_areas m where m.locality_id=l.id and not(m.service_area_id=any(p_area_ids))) then
      raise exception 'Existing geographic mappings cannot be removed; deactivate instead' using errcode='22023'; end if;
    update public.marketplace_localities set name=btrim(p_name),district=btrim(p_district),region_code=p_region,
      source_url=p_source,verified=p_verified,is_active=p_active,updated_at=clock_timestamp() where id=l.id;
  else
    insert into public.marketplace_localities(name,district,region_code,source_url,verified,is_active)
      values(btrim(p_name),btrim(p_district),p_region,p_source,p_verified,p_active) returning id into result;
  end if;
  foreach area in array p_area_ids loop
    if area is null or not exists(select 1 from public.service_areas where id=area and postal_code is not null and (not p_active or is_active)) then
      raise exception 'Mapped service area must have a verified PIN and be active before publication' using errcode='22023'; end if;
    insert into public.locality_service_areas(locality_id,service_area_id,approved_by) values(result,area,auth.uid()) on conflict do nothing;
  end loop;
  insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
    values('locality',result,auth.uid(),before_value,jsonb_build_object('name',p_name,'district',p_district,'region',p_region,
      'source',p_source,'verified',p_verified,'active',p_active,'areas',p_area_ids),p_reason);
  return result;
end;
$$;
create function public.request_locality_coverage(p_locality_ids uuid[])
returns void language plpgsql volatile security definer set search_path='' as $$
declare selected_locality uuid; area uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_locality_ids is null or cardinality(p_locality_ids) not between 1 and 20 then raise exception 'Select 1 to 20 active localities' using errcode='22023'; end if;
  foreach selected_locality in array p_locality_ids loop
    if not exists(select 1 from jsonb_array_elements(public.marketplace_locations()) l where l->>'id'=selected_locality::text) then
      raise exception 'Active verified locality required' using errcode='22023'; end if;
    for area in select m.service_area_id from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id where m.locality_id=selected_locality and a.is_active loop
      if not exists(select 1 from public.professional_service_areas where professional_id=auth.uid() and service_area_id=area)
        and not exists(select 1 from public.professional_coverage_requests where professional_id=auth.uid() and service_area_id=area and state='submitted') then
        perform public.request_professional_coverage(area,false);
      end if;
    end loop;
  end loop;
end;
$$;
create function public.save_locality_address(p_id uuid,p_locality uuid,p_service_area uuid,p_details jsonb)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare l public.marketplace_localities; a public.service_areas; result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  select * into l from public.marketplace_localities where id=p_locality and verified and is_active and region_code='IN-DL';
  select s.* into a from public.service_areas s join public.locality_service_areas m on m.service_area_id=s.id
    where m.locality_id=p_locality and s.id=p_service_area and s.is_active and s.postal_code is not null;
  if l.id is null or a.id is null then raise exception 'Choose a supported locality and delivery area' using errcode='22023'; end if;
  if p_id is not null then
    select id into result from public.customer_addresses where id=p_id and customer_id=auth.uid() for update;
    if not found then raise exception 'Own address required' using errcode='42501'; end if;
    update public.customer_addresses set label=p_details->>'label',recipient_name=p_details->>'recipient_name',phone=p_details->>'phone',
      address_line_1=p_details->>'address_line_1',address_line_2=coalesce(p_details->>'address_line_2',''),locality=l.name,city='Delhi',state='Delhi',
      postal_code=a.postal_code,landmark=coalesce(p_details->>'landmark',''),locality_id=l.id,service_area_id=a.id where id=result;
  else
    insert into public.customer_addresses(customer_id,label,recipient_name,phone,address_line_1,address_line_2,locality,city,state,postal_code,landmark,locality_id,service_area_id)
    values(auth.uid(),p_details->>'label',p_details->>'recipient_name',p_details->>'phone',p_details->>'address_line_1',coalesce(p_details->>'address_line_2',''),l.name,'Delhi','Delhi',a.postal_code,coalesce(p_details->>'landmark',''),l.id,a.id) returning id into result;
  end if;
  return result;
end;
$$;

create function public.marketplace_booking_preview(p_offering uuid,p_revision uuid,p_start timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o record; terms jsonb;
begin
  select * into o from public.list_public_offerings() where offering_id=p_offering and revision_id=p_revision;
  if not found or p_start is null or not isfinite(p_start) or p_start<=now() then raise exception 'Current approved offering and future time required' using errcode='22023'; end if;
  terms:=to_jsonb(o)||jsonb_build_object('starts_at',p_start,'ends_at',p_start+o.duration_minutes*interval '1 minute',
    'scope','Only this appointment is scheduled; agreement does not purchase a package or issue session credits');
  return jsonb_build_object('terms',terms,'review_hash',md5(terms::text));
end;
$$;
create function private.guard_customer_booking_choice()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.customer_booking_choices c where c.booking_id=new.booking_id and not c.allow_alternative
    and (c.professional_id is distinct from new.professional_id or c.offering_id is distinct from new.offering_id)) then
    raise exception 'Customer must explicitly authorize an alternative professional or offering' using errcode='42501'; end if;
  return new;
end;
$$;
create trigger guard_customer_booking_choice before insert on public.booking_assignments
for each row execute function private.guard_customer_booking_choice();

-- The private proposal implementation and customer submit RPC are added below.

create function public.allow_booking_alternative(p_booking uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  if not exists(select 1 from public.booking_requests where id=p_booking and customer_id=auth.uid() and status in ('pending','requires_rescheduling')) then
    raise exception 'Own unassigned request required' using errcode='42501'; end if;
  update public.customer_booking_choices set allow_alternative=true where booking_id=p_booking and customer_id=auth.uid() and not allow_alternative;
  if found then insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,new_details,reason)
    values('booking_choice',p_booking,auth.uid(),'{"allow_alternative":true}','Customer explicitly requested administrator assistance with an alternative'); end if;
end;
$$;
create function private.bundle_eligible(p_bundle uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.marketplace_bundle_items where bundle_id=p_bundle)
  and not exists(select 1 from public.marketplace_bundle_items i join public.marketplace_bundles b on b.id=i.bundle_id
    where b.id=p_bundle and not exists(select 1 from public.list_public_offerings() o where o.offering_id=i.offering_id and o.revision_id=i.revision_id
      and private.professional_serves_locality(o.professional_id,b.locality_id)));
$$;
create function public.marketplace_public_bundles(p_locality uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at,x.id),'[]'::jsonb) from (
    select b.*,l.name as locality_name,l.district,
      (select jsonb_agg(to_jsonb(o)||jsonb_build_object('quantity',i.quantity)) from public.marketplace_bundle_items i
        join public.list_public_offerings() o on o.offering_id=i.offering_id and o.revision_id=i.revision_id where i.bundle_id=b.id) as items
    from public.marketplace_bundles b join public.marketplace_localities l on l.id=b.locality_id
    where b.state='published' and b.starts_at<=now() and b.ends_at>now() and private.bundle_eligible(b.id)
      and (p_locality is null or b.locality_id=p_locality)
  ) x;
$$;
create function public.admin_save_marketplace_bundle(p_id uuid,p_details jsonb,p_items jsonb,p_expected_updated_at timestamptz,p_reason text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare b public.marketplace_bundles; result uuid; item jsonb;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.lock_booking_fulfillment();
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Genuine components and decision reason required' using errcode='22023'; end if;
  if p_id is not null then
    select * into b from public.marketplace_bundles where id=p_id for update;
    if not found or b.updated_at is distinct from p_expected_updated_at then raise exception 'Bundle changed; reload' using errcode='40001'; end if;
    result:=b.id;
    update public.marketplace_bundles set title=p_details->>'title',description=p_details->>'description',locality_id=(p_details->>'locality_id')::uuid,
      price_minor=(p_details->>'price_minor')::bigint,discount_terms=p_details->>'discount_terms',starts_at=(p_details->>'starts_at')::timestamptz,
      ends_at=(p_details->>'ends_at')::timestamptz,state=p_details->>'state',updated_at=clock_timestamp() where id=result;
    delete from public.marketplace_bundle_items where bundle_id=result;
  else
    insert into public.marketplace_bundles(title,description,locality_id,price_minor,discount_terms,starts_at,ends_at,state)
      values(p_details->>'title',p_details->>'description',(p_details->>'locality_id')::uuid,(p_details->>'price_minor')::bigint,
      p_details->>'discount_terms',(p_details->>'starts_at')::timestamptz,(p_details->>'ends_at')::timestamptz,p_details->>'state') returning id into result;
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    if p_details->>'state'<>'suspended' and not exists(select 1 from public.list_public_offerings() o where o.offering_id=(item->>'offering_id')::uuid and o.revision_id=(item->>'revision_id')::uuid) then
      raise exception 'Every component needs a current approved offering and eligible provider' using errcode='22023'; end if;
    insert into public.marketplace_bundle_items values(result,(item->>'offering_id')::uuid,(item->>'revision_id')::uuid,(item->>'quantity')::integer);
  end loop;
  if p_details->>'state'='published' and not private.bundle_eligible(result) then
    raise exception 'All component providers need approved active coverage for the bundle locality' using errcode='22023'; end if;
  insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
    values('bundle',result,auth.uid(),to_jsonb(b),p_details||jsonb_build_object('items',p_items),p_reason);
  return result;
end;
$$;

-- Reuse the deployed proposal algorithm verbatim in a private helper; only
-- the admin check moves to its original public wrapper. No role impersonation.
create function private.marketplace_propose_offering(p_booking_id uuid,p_offering_id uuid,p_revision_id uuid,
  p_starts_at timestamptz,p_idempotency_key uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests; o public.professional_offerings; r public.professional_offering_revisions;
  prior public.booking_assignments; current_id uuid; fingerprint text; issue text; result uuid;
  profile jsonb; terms jsonb; finish timestamptz; pref_start time; pref_end time; proposal_time timestamptz;
begin
  perform private.lock_booking_fulfillment();
  perform private.expire_booking_proposals();
  if p_reason is null or char_length(btrim(p_reason))=0 or char_length(p_reason)>1000 or p_idempotency_key is null then
    raise exception 'Decision reason and retry key required' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=p_booking_id for update;
  if not found then raise exception 'Booking unavailable' using errcode='22023'; end if;
  fingerprint := md5(jsonb_build_array(p_offering_id,p_revision_id,extract(epoch from p_starts_at),p_reason)::text);
  select * into prior from public.booking_assignments where booking_id=b.id and idempotency_key=p_idempotency_key;
  if found then
    if prior.request_fingerprint<>fingerprint then raise exception 'Retry key used for different proposal' using errcode='22023'; end if;
    return prior.id;
  end if;
  if b.status not in ('pending','requires_rescheduling','awaiting_customer_agreement','assignment_proposed','confirmed')
    or b.cancellation_requested_at is not null then raise exception 'Resolve the current booking state/cancellation before assignment' using errcode='22023'; end if;
  select * into o from public.professional_offerings where id=p_offering_id;
  if not found or o.suspended or o.approved_revision_id is distinct from p_revision_id or o.service_id<>b.service_id then
    raise exception 'Choose a compatible current approved offering' using errcode='22023'; end if;
  select * into r from public.professional_offering_revisions where id=p_revision_id and offering_id=o.id and state='approved';
  if not found then raise exception 'Approved offering revision unavailable' using errcode='22023'; end if;
  select id into current_id from public.booking_assignments where booking_id=b.id and state in ('proposed','accepted','in_progress');
  issue := private.assignment_proposal_issue(b,o.professional_id,p_starts_at,r.duration_minutes,current_id);
  if issue is not null then raise exception '%',issue using errcode='22023'; end if;
  finish := p_starts_at+r.duration_minutes*interval '1 minute';
  select to_jsonb(p) into profile from public.list_public_professionals() p where p.professional_id=o.professional_id;
  select start_time,end_time into pref_start,pref_end from public.booking_request_options() where window_key=b.time_window;
  terms := jsonb_build_object('offering_id',o.id,'revision_id',r.id,'professional_id',o.professional_id,
    'professional_display_name',profile->>'display_name','service_id',b.service_id,'service_name',b.service_name,
    'offering_type',r.offering_type,'title',r.title,'description',r.description,'duration_minutes',r.duration_minutes,
    'price_minor',r.price_minor,'currency',r.currency,'price_basis',case when r.offering_type='single_session' then 'per_session' else 'package_total' end,
    'total_sessions',r.total_sessions,'sessions_per_week',r.sessions_per_week,'package_duration_value',r.package_duration_value,
    'package_duration_unit',r.package_duration_unit,'delivery_notes',r.delivery_notes,
    'starts_at',p_starts_at,'ends_at',finish,'original_preferred_date',b.preferred_date,'original_time_window',b.time_window,
    'outside_preference',p_starts_at<((b.preferred_date+pref_start) at time zone 'Asia/Kolkata')
      or finish>((b.preferred_date+pref_end) at time zone 'Asia/Kolkata'),
    'scope','Only this appointment is scheduled; agreement does not purchase a package or issue session credits');
  proposal_time := clock_timestamp();
  perform set_config('app.fulfillment_reason',p_reason,true);
  if current_id is not null then update public.booking_assignments set state='reassigned' where id=current_id; end if;
  insert into public.booking_assignments(booking_id,professional_id,starts_at,ends_at,duration_minutes,duration_source,
    professional_public_snapshot,proposal_actor,idempotency_key,request_fingerprint,offering_id,offering_revision_id,
    proposed_terms,terms_hash,proposal_expires_at,created_at)
  values(b.id,o.professional_id,p_starts_at,finish,r.duration_minutes,'offering_approved',profile,auth.uid(),p_idempotency_key,
    fingerprint,o.id,r.id,terms,md5(terms::text),least(proposal_time+interval '24 hours',p_starts_at),proposal_time)
  returning id into result;
  return result;
end;
$$;
create or replace function public.propose_booking_offering(p_booking_id uuid,p_offering_id uuid,p_revision_id uuid,
  p_starts_at timestamptz,p_idempotency_key uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return private.marketplace_propose_offering(p_booking_id,p_offering_id,p_revision_id,p_starts_at,p_idempotency_key,p_reason);
end;
$$;
create function public.submit_direct_booking(p_offering uuid,p_revision uuid,p_address uuid,p_locality uuid,
  p_start timestamptz,p_key uuid,p_review_hash text,p_notes text,p_accept boolean)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare choice public.customer_booking_choices; preview jsonb; o record; address public.customer_addresses;
  booking uuid; assignment uuid; fingerprint text; time_window text; selected_hash text;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  if p_accept is distinct from true or p_key is null then raise exception 'Explicit agreement and retry key required' using errcode='22023'; end if;
  fingerprint:=md5(jsonb_build_array(p_offering,p_revision,p_address,p_locality,extract(epoch from p_start),p_review_hash,btrim(coalesce(p_notes,'')))::text);
  select c.* into choice from public.customer_booking_choices c join public.booking_requests b on b.id=c.booking_id
    where b.customer_id=auth.uid() and b.idempotency_key=p_key;
  if found then
    if choice.request_fingerprint is distinct from fingerprint then raise exception 'Retry key already used for different direct booking details' using errcode='22023'; end if;
    return choice.booking_id;
  end if;
  if exists(select 1 from public.booking_requests where customer_id=auth.uid() and idempotency_key=p_key) then
    raise exception 'Retry key belongs to an existing service request' using errcode='22023'; end if;
  preview:=public.marketplace_booking_preview(p_offering,p_revision,p_start);
  if p_review_hash is distinct from preview->>'review_hash' then raise exception 'Terms changed; reload and agree the current offering' using errcode='40001'; end if;
  select * into o from public.list_public_offerings() where offering_id=p_offering and revision_id=p_revision;
  if not private.professional_serves_locality(o.professional_id,p_locality) then raise exception 'Professional is not approved for this exact locality' using errcode='22023'; end if;
  select * into address from public.customer_addresses where id=p_address and customer_id=auth.uid() for share;
  if not found then raise exception 'Own service address required' using errcode='42501'; end if;
  if address.locality_id is distinct from p_locality or not exists(select 1 from public.locality_service_areas m
    join public.service_areas a on a.id=m.service_area_id join public.professional_service_areas pa on pa.service_area_id=a.id
    where m.locality_id=p_locality and a.id=address.service_area_id and a.is_active and a.postal_code=address.postal_code and pa.professional_id=o.professional_id) then
    raise exception 'Address must use this locality and an approved delivery area; update the saved address first' using errcode='22023'; end if;
  select window_key into time_window from public.booking_request_options()
    where (p_start at time zone 'Asia/Kolkata')::time>=start_time and (p_start at time zone 'Asia/Kolkata')::time<end_time;
  booking:=public.submit_booking_request(o.service_id,address.id,(p_start at time zone 'Asia/Kolkata')::date,time_window,p_key,p_notes);
  insert into public.customer_booking_choices(booking_id,customer_id,professional_id,offering_id,revision_id,locality_id,starts_at,review_hash,request_fingerprint)
    values(booking,auth.uid(),o.professional_id,p_offering,p_revision,p_locality,p_start,p_review_hash,fingerprint);
  assignment:=private.marketplace_propose_offering(booking,p_offering,p_revision,p_start,p_key,'Customer selected this professional, approved offering and exact schedule');
  select terms_hash into selected_hash from public.booking_assignments where id=assignment;
  perform public.respond_booking_terms(assignment,selected_hash,true);
  return booking;
end;
$$;
-- Explicit ACLs, including private helpers and the replaced existing RPC.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname in ('marketplace_locations','marketplace_directory','admin_marketplace_localities',
      'admin_save_marketplace_locality','request_locality_coverage','save_locality_address','marketplace_booking_preview',
      'allow_booking_alternative','marketplace_public_bundles','admin_save_marketplace_bundle','submit_direct_booking','propose_booking_offering'))
    or (n.nspname='private' and p.proname in ('professional_serves_locality','guard_customer_booking_choice','bundle_eligible','marketplace_propose_offering')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.marketplace_locations(),public.marketplace_directory(uuid,text,text,bigint,uuid),
 public.marketplace_booking_preview(uuid,uuid,timestamptz),public.marketplace_public_bundles(uuid) to anon,authenticated;
grant execute on function public.admin_marketplace_localities(text,integer),
 public.admin_save_marketplace_locality(uuid,text,text,text,text,boolean,boolean,uuid[],timestamptz,text),
 public.request_locality_coverage(uuid[]),public.save_locality_address(uuid,uuid,uuid,jsonb),public.allow_booking_alternative(uuid),
 public.admin_save_marketplace_bundle(uuid,jsonb,jsonb,timestamptz,text),public.submit_direct_booking(uuid,uuid,uuid,uuid,timestamptz,uuid,text,text,boolean),
 public.propose_booking_offering(uuid,uuid,uuid,timestamptz,uuid,text) to authenticated;
create function public.admin_marketplace_bundles()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) from (
    select b.*,(select jsonb_agg(to_jsonb(i)) from public.marketplace_bundle_items i where i.bundle_id=b.id) as items
    from public.marketplace_bundles b) x);
end;
$$;
revoke all on function public.admin_marketplace_bundles() from public,anon,authenticated;
grant execute on function public.admin_marketplace_bundles() to authenticated;
alter table public.professional_applications add column requested_locality_ids uuid[] not null default '{}';
create function public.save_application_localities(p_details jsonb,p_locality_ids uuid[],p_application_id uuid default null,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare result uuid; resolved jsonb; names text;
begin
  perform private.lock_administrator_roles();
  if not private.has_role('customer') then raise exception 'Applicant customer required' using errcode='42501'; end if;
  if p_locality_ids is null or cardinality(p_locality_ids)>20 or exists(select 1 from unnest(p_locality_ids) id
    where not exists(select 1 from jsonb_array_elements(public.marketplace_locations()) l where l->>'id'=id::text)) then
    raise exception 'Choose up to 20 active named Delhi localities' using errcode='22023'; end if;
  if cardinality(p_locality_ids)>0 then
    select jsonb_agg(pin order by pin) into resolved from (select distinct a.postal_code as pin from public.locality_service_areas m
      join public.service_areas a on a.id=m.service_area_id where m.locality_id=any(p_locality_ids) and a.is_active and a.postal_code is not null) x;
    if jsonb_array_length(resolved)>20 then raise exception 'Choose fewer localities: application postal routing supports at most 20 distinct PINs' using errcode='22023'; end if;
    select string_agg(name||' ('||district||')',', ' order by name) into names from public.marketplace_localities where id=any(p_locality_ids);
    p_details:=p_details||jsonb_build_object('postal_codes',resolved,'service_locations',names);
  end if;
  result:=public.save_professional_application(p_details,p_application_id,p_expected_updated_at);
  update public.professional_applications set requested_locality_ids=p_locality_ids where id=result;
  return result;
end;
$$;
revoke all on function public.save_application_localities(jsonb,uuid[],uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.save_application_localities(jsonb,uuid[],uuid,timestamptz) to authenticated;
create function public.admin_marketplace_audit()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select * from public.marketplace_audit order by created_at desc,id limit 100) x);
end;
$$;
revoke all on function public.admin_marketplace_audit() from public,anon,authenticated;
grant execute on function public.admin_marketplace_audit() to authenticated;
