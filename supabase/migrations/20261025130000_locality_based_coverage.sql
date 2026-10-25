-- Pending explicit deployment approval. Exact locality IDs become valid coverage authority.
-- No locality, professional or genuine booking is activated/modified by this migration.
alter table public.service_areas add column locality_id uuid unique references public.marketplace_localities(id) on delete restrict;
alter table public.customer_addresses drop constraint customer_addresses_postal_code_check;
alter table public.customer_addresses add constraint customer_addresses_postal_code_check check (postal_code ~ '^[1-9][0-9]{5}$' or (postal_code='' and locality_id is not null and service_area_id is not null));

create function private.booking_coverage_key(snapshot jsonb) returns text language sql immutable set search_path='' as $$
 select case when snapshot->>'locality_id' is not null then 'locality:'||(snapshot->>'locality_id') else snapshot->>'postal_code' end;
$$;
revoke all on function private.booking_coverage_key(jsonb) from public,anon,authenticated;

create or replace function private.professional_serves_locality(p_professional uuid,p_locality uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.marketplace_localities l where l.id=p_locality and l.region_code='IN-DL' and l.verified and l.is_active)
  and exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
    where m.locality_id=p_locality and a.is_active and (a.postal_code is not null or a.locality_id=p_locality))
  and not exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
    where m.locality_id=p_locality and a.is_active and (a.postal_code is not null or a.locality_id=p_locality) and not exists(
      select 1 from public.professional_service_areas p where p.professional_id=p_professional and p.service_area_id=m.service_area_id));
$$;

create or replace function private.professional_booking_issue(p_professional uuid, p_service uuid, p_pin text)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.list_public_professionals() p where p.professional_id = p_professional) then
    return 'Professional must be currently verified, visible, and eligible';
  end if;
  if not exists(select 1 from public.services s join public.service_categories c on c.id=s.category_id
    where s.id=p_service and s.is_active and s.is_published and c.is_active) then
    return 'Service/category is not currently published and active';
  end if;
  if not exists(select 1 from public.professional_services ps
    where ps.professional_id=p_professional and ps.service_id=p_service) then
    return 'Professional has no approved association with this service';
  end if;
  if p_pin like 'locality:%' then
    if substring(p_pin from 10) !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return 'Invalid locality coverage key'; end if;
    if not private.professional_serves_locality(p_professional,substring(p_pin from 10)::uuid) then return 'No approved active coverage for this exact locality'; end if;
    return null;
  end if;
  if not exists(select 1 from public.professional_service_areas pa
    join public.service_areas sa on sa.id=pa.service_area_id
    where pa.professional_id=p_professional and sa.is_active and sa.postal_code=p_pin) then
    return 'No approved active coverage for the exact delivery PIN; configure coverage first';
  end if;
  return null;
end;
$$;

-- Preserve existing authorization, lifecycle and conflict logic; use snapshot locality key when present.
create or replace function private.assignment_proposal_issue(p_booking public.booking_requests,
  p_professional uuid,p_start timestamptz,p_duration integer,p_exclude uuid default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare issue text; finish timestamptz;
begin
  issue := private.professional_booking_issue(p_professional,p_booking.service_id,private.booking_coverage_key(p_booking.address_snapshot));
  if issue is not null then return issue; end if;
  if p_duration is null or p_duration not between 1 and 1440 then return 'Approved offering duration is required'; end if;
  if p_start is null or not isfinite(p_start) or p_start<=clock_timestamp() then return 'Choose a future appointment start'; end if;
  finish := p_start+p_duration*interval '1 minute';
  if not private.slot_within_schedule(p_professional,p_start,finish) then return 'Slot is outside weekly availability or overlaps time off'; end if;
  if exists(select 1 from public.booking_assignments a where a.professional_id=p_professional
    and a.state in ('proposed','accepted','in_progress') and (p_exclude is null or a.id<>p_exclude)
    and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_start,finish,'[)')) then
    return 'Professional has a conflicting reserved or accepted appointment'; end if;
  return null;
end;
$$;

-- Preserve existing authorization, lifecycle and conflict logic; use snapshot locality key when present.
create or replace function public.advance_booking_appointment(p_assignment_id uuid,p_stage text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare a public.booking_assignments; b public.booking_requests; issue text;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  select * into a from public.booking_assignments where id=p_assignment_id and professional_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  if p_stage not in ('in_progress','completed') or p_stage is null then raise exception 'Unsupported stage' using errcode='22023'; end if;
  if a.state=p_stage then return a.id; end if;
  select * into b from public.booking_requests where id=a.booking_id for update;
  issue := private.professional_booking_issue(a.professional_id,b.service_id,private.booking_coverage_key(b.address_snapshot));
  if issue is not null then raise exception '%',issue using errcode='22023'; end if;
  if b.cancellation_requested_at is not null then
    raise exception 'Customer cancellation request requires administrator resolution first' using errcode='22023'; end if;
  if p_stage='in_progress' and (a.state<>'accepted' or clock_timestamp()<a.starts_at or b.cancellation_requested_at is not null) then
    raise exception 'Appointment cannot start yet; check state, start time, and cancellation requests' using errcode='22023'; end if;
  if p_stage='completed' and (a.state<>'in_progress' or clock_timestamp()<a.ends_at) then
    raise exception 'Completion requires an in-progress visit at or after its scheduled end' using errcode='22023'; end if;
  perform set_config('app.fulfillment_reason','Professional visit lifecycle transition',true);
  update public.booking_assignments set state=p_stage,
    completed_at=case when p_stage='completed' then clock_timestamp() else completed_at end where id=a.id;
  return a.id;
end;
$$;

-- Preserve existing authorization, lifecycle and conflict logic; use snapshot locality key when present.
create or replace function public.booking_assignment_candidates(p_booking_id uuid,p_starts_at timestamptz default null,
  p_duration_minutes integer default null)
returns table(professional_id uuid,display_name text,issue text)
language plpgsql stable security definer set search_path = '' as $$
declare b public.booking_requests; duration integer; current_id uuid;
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  select * into b from public.booking_requests where id=p_booking_id;
  if not found then raise exception 'Booking unavailable' using errcode='22023'; end if;
  select coalesce(s.duration_minutes,p_duration_minutes) into duration from public.services s where s.id=b.service_id;
  select a.id into current_id from public.booking_assignments a where a.booking_id=b.id and a.state in ('proposed','accepted','in_progress');
  return query select p.professional_id,p.display_name,
    case when p_starts_at is null then coalesce(
      private.professional_booking_issue(p.professional_id,b.service_id,private.booking_coverage_key(b.address_snapshot)),
      'Choose an exact time and duration to check availability and conflicts')
    else private.assignment_proposal_issue(b,p.professional_id,p_starts_at,duration,current_id) end
    from public.list_public_professionals() p;
end;
$$;

-- Preserve existing authorization, lifecycle and conflict logic; use snapshot locality key when present.
create or replace function public.professional_assignment_details(p_assignment_id uuid)
returns table(assignment_id uuid,booking_id uuid,service_name text,state text,starts_at timestamptz,
  ends_at timestamptz,address_details jsonb,customer_notes text,cancellation_requested boolean)
language plpgsql stable security definer set search_path = '' as $$
declare a public.booking_assignments; b public.booking_requests; eligible boolean;
begin
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  select x.* into a from public.booking_assignments x where x.id=p_assignment_id and x.professional_id=auth.uid();
  if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  select x.* into b from public.booking_requests x where x.id=a.booking_id;
  eligible := private.professional_booking_issue(a.professional_id,b.service_id,private.booking_coverage_key(b.address_snapshot)) is null;
  return query select a.id,b.id,b.service_name,a.state,a.starts_at,a.ends_at,
    case when eligible and a.state in ('accepted','in_progress') then b.address_snapshot
      when eligible and a.state='proposed' then jsonb_build_object('locality',b.address_snapshot->>'locality',
        'city',b.address_snapshot->>'city','state',b.address_snapshot->>'state','postal_code',private.booking_coverage_key(b.address_snapshot))
      else null end,
    case when eligible and a.state in ('accepted','in_progress') then b.customer_notes else null end,
    b.cancellation_requested_at is not null;
end;
$$;

-- Preserve existing authorization, lifecycle and conflict logic; use snapshot locality key when present.
create or replace function private.assignment_offering_issue(p_assignment public.booking_assignments)
returns text language plpgsql stable security definer set search_path = '' as $$
declare o public.professional_offerings; r public.professional_offering_revisions; b public.booking_requests; issue text;
begin
  select * into b from public.booking_requests where id=p_assignment.booking_id;
  issue := private.professional_booking_issue(p_assignment.professional_id,b.service_id,private.booking_coverage_key(b.address_snapshot));
  if issue is not null then return issue; end if;
  select * into o from public.professional_offerings where id=p_assignment.offering_id;
  if not found or o.suspended or o.professional_id<>p_assignment.professional_id or o.service_id<>b.service_id then
    return 'Selected offering is unavailable, suspended, or incompatible'; end if;
  select * into r from public.professional_offering_revisions where id=p_assignment.offering_revision_id and offering_id=o.id;
  if not found or r.state<>'approved' or r.duration_minutes<>p_assignment.duration_minutes then
    return 'Selected offering revision is not approved for these appointment terms'; end if;
  if p_assignment.customer_terms_state<>'accepted' and o.approved_revision_id is distinct from r.id then
    return 'Offering terms changed before customer agreement; propose current approved terms'; end if;
  -- A previously agreed immutable revision remains valid after a newer price is approved.
  return null;
end;
$$;

-- Preserve existing authorization, lifecycle and conflict logic; use snapshot locality key when present.
create or replace function public.booking_offering_candidates(p_booking_id uuid,p_starts_at timestamptz default null)
returns table(offering_id uuid,revision_id uuid,professional_id uuid,display_name text,title text,
  offering_type text,price_minor bigint,currency text,duration_minutes integer,issue text)
language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests; current_id uuid;
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
  select * into b from public.booking_requests where id=p_booking_id;
  if not found then raise exception 'Booking unavailable' using errcode='22023'; end if;
  select a.id into current_id from public.booking_assignments a where a.booking_id=b.id and a.state in ('proposed','accepted','in_progress');
  return query select p.offering_id,p.revision_id,p.professional_id,p.display_name,p.title,p.offering_type,p.price_minor,p.currency,p.duration_minutes,
    case when p_starts_at is null then coalesce(private.professional_booking_issue(p.professional_id,b.service_id,private.booking_coverage_key(b.address_snapshot)),
      'Choose an exact time to check availability and conflicts')
    else private.assignment_proposal_issue(b,p.professional_id,p_starts_at,p.duration_minutes,current_id) end
    from public.list_public_offerings(null) p where p.service_id=b.service_id;
end;
$$;

create or replace function public.marketplace_locations()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'district',l.district,
    'service_areas',(select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name) order by a.name,a.id)
      from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
      where m.locality_id=l.id and a.is_active and (a.postal_code is not null or a.locality_id=l.id))) order by l.name,l.district,l.id),'[]'::jsonb)
  from public.marketplace_localities l where l.region_code='IN-DL' and l.verified and l.is_active
    and exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
      where m.locality_id=l.id and a.is_active and (a.postal_code is not null or a.locality_id=l.id));
$$;

create or replace function public.request_professional_coverage(p_service_area_id uuid,p_remove boolean default false)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_remove is null or not exists(select 1 from public.service_areas where id=p_service_area_id and is_active and (postal_code is not null or (locality_id is not null and exists(select 1 from public.marketplace_localities l where l.id=service_areas.locality_id and l.verified and l.is_active and l.region_code='IN-DL')))) then
    raise exception 'Choose a configured active service area with a PIN' using errcode='22023'; end if;
  insert into public.professional_coverage_requests(professional_id,service_area_id,action)
    values(auth.uid(),p_service_area_id,case when p_remove then 'remove' else 'add' end) returning id into result;
  insert into public.professional_offering_events(coverage_request_id,professional_id,actor_user_id,event)
    values(result,auth.uid(),auth.uid(),'coverage_requested');
  return result;
end;
$$;

create or replace function public.review_professional_coverage(p_request_id uuid,p_approve boolean,p_feedback text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare r public.professional_coverage_requests;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_approve is null or p_feedback is null or char_length(btrim(p_feedback))=0 or char_length(p_feedback)>1000 then
    raise exception 'Coverage decision and reason required' using errcode='22023'; end if;
  select * into r from public.professional_coverage_requests where id=p_request_id for update;
  if not found or r.state<>'submitted' then raise exception 'Open coverage request unavailable' using errcode='22023'; end if;
  if p_approve then
    if not private.has_role('admin') or not exists(select 1 from public.user_roles where user_id=r.professional_id and role='professional') then
      raise exception 'Professional role unavailable' using errcode='22023'; end if;
    if r.action='add' then
      if not exists(select 1 from public.service_areas where id=r.service_area_id and is_active and (postal_code is not null or (locality_id is not null and exists(select 1 from public.marketplace_localities l where l.id=service_areas.locality_id and l.verified and l.is_active and l.region_code='IN-DL')))) then
        raise exception 'Configure active PIN coverage first' using errcode='22023'; end if;
      insert into public.professional_service_areas(professional_id,service_area_id,approved_by)
        values(r.professional_id,r.service_area_id,auth.uid()) on conflict(professional_id,service_area_id) do nothing;
    else
      -- Admin explicitly approves removal; existing eligibility hooks invalidate affected work.
      delete from public.professional_service_areas where professional_id=r.professional_id and service_area_id=r.service_area_id;
    end if;
  end if;
  update public.professional_coverage_requests set state=case when p_approve then 'approved' else 'rejected' end,
    feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=r.id;
  insert into public.professional_offering_events(coverage_request_id,professional_id,actor_user_id,event,reason)
    values(r.id,r.professional_id,auth.uid(),case when p_approve then 'coverage_approved' else 'coverage_rejected' end,p_feedback);
  return r.id;
end;
$$;

create or replace function public.save_locality_address(p_id uuid,p_locality uuid,p_service_area uuid,p_details jsonb)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare l public.marketplace_localities; a public.service_areas; result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  select * into l from public.marketplace_localities where id=p_locality and verified and is_active and region_code='IN-DL';
  select s.* into a from public.service_areas s join public.locality_service_areas m on m.service_area_id=s.id
    where m.locality_id=p_locality and s.id=p_service_area and s.is_active and (s.postal_code is not null or s.locality_id=l.id);
  if l.id is null or a.id is null then raise exception 'Choose a supported locality and delivery area' using errcode='22023'; end if;
  if p_id is not null then
    select id into result from public.customer_addresses where id=p_id and customer_id=auth.uid() for update;
    if not found then raise exception 'Own address required' using errcode='42501'; end if;
    update public.customer_addresses set label=p_details->>'label',recipient_name=p_details->>'recipient_name',phone=p_details->>'phone',
      address_line_1=p_details->>'address_line_1',address_line_2=coalesce(p_details->>'address_line_2',''),locality=l.name,city='Delhi',state='Delhi',
      postal_code=coalesce(a.postal_code,''),landmark=coalesce(p_details->>'landmark',''),locality_id=l.id,service_area_id=a.id where id=result;
  else
    insert into public.customer_addresses(customer_id,label,recipient_name,phone,address_line_1,address_line_2,locality,city,state,postal_code,landmark,locality_id,service_area_id)
    values(auth.uid(),p_details->>'label',p_details->>'recipient_name',p_details->>'phone',p_details->>'address_line_1',coalesce(p_details->>'address_line_2',''),l.name,'Delhi','Delhi',coalesce(a.postal_code,''),coalesce(p_details->>'landmark',''),l.id,a.id) returning id into result;
  end if;
  return result;
end;
$$;

create or replace function public.submit_booking_request(
  p_service_id uuid, p_address_id uuid, p_preferred_date date,
  p_time_window text, p_idempotency_key uuid, p_customer_notes text default ''
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  prior public.booking_requests;
  selected_address public.customer_addresses;
  selected_service_name text;
  chosen_window record;
  snapshot jsonb;
  result uuid;
  local_today date;
  requested_start timestamptz;
  notes text := btrim(coalesce(p_customer_notes, ''));
begin
  if actor is null or not private.has_role('customer') then
    raise exception 'Authenticated customer required' using errcode = '42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Booking submission requires READ COMMITTED isolation' using errcode = '25000';
  end if;
  if p_service_id is null or p_address_id is null or p_preferred_date is null
     or p_time_window is null or p_idempotency_key is null or char_length(notes) > 2000 then
    raise exception 'Invalid booking request' using errcode = '22023';
  end if;

  -- Serialize only retries for the same customer/key. A hash collision merely waits.
  -- The unique constraint is a second, database-enforced duplicate guard.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text || ':' || p_idempotency_key::text, 0)
  );
  select b.* into prior from public.booking_requests b
  where b.customer_id = actor and b.idempotency_key = p_idempotency_key;
  if found then
    if prior.service_id is distinct from p_service_id
       or prior.address_snapshot->>'saved_address_id' is distinct from p_address_id::text
       or prior.preferred_date is distinct from p_preferred_date
       or prior.time_window is distinct from p_time_window
       or prior.customer_notes is distinct from notes then
      raise exception 'Idempotency key already used for different details' using errcode = '22023';
    end if;
    -- An exact retry returns the original request even if time/publication changed.
    return prior.id;
  end if;

  -- Lock publication facts and the address until the request/snapshot commits.
  -- Unpublishing and address edits/deletion cannot race past this boundary.
  select s.name into selected_service_name
  from public.services s join public.service_categories c on c.id = s.category_id
  where s.id = p_service_id and s.is_active and s.is_published and c.is_active
  for share of s, c;
  if not found then
    raise exception 'Published service unavailable' using errcode = '22023';
  end if;
  select a.* into selected_address from public.customer_addresses a
  where a.id = p_address_id and a.customer_id = actor for share;
  if not found then
    raise exception 'Customer address unavailable' using errcode = '42501';
  end if;

  select o.* into chosen_window from public.booking_request_options() o
  where o.window_key = p_time_window;
  if not found then
    raise exception 'Invalid preferred time window' using errcode = '22023';
  end if;
  local_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  requested_start := (p_preferred_date + chosen_window.start_time) at time zone 'Asia/Kolkata';
  if p_preferred_date < local_today
     or p_preferred_date > local_today + chosen_window.booking_horizon_days
     or requested_start <= clock_timestamp() then
    raise exception 'Choose a future time window within the booking horizon' using errcode = '22023';
  end if;

  snapshot := jsonb_build_object(
    'saved_address_id', selected_address.id,
    'locality_id', selected_address.locality_id, 'service_area_id', selected_address.service_area_id,
    'label', selected_address.label,
    'recipient_name', selected_address.recipient_name,
    'phone', selected_address.phone,
    'address_line_1', selected_address.address_line_1,
    'address_line_2', selected_address.address_line_2,
    'locality', selected_address.locality,
    'city', selected_address.city,
    'state', selected_address.state,
    'postal_code', selected_address.postal_code,
    'landmark', selected_address.landmark
  );
  insert into public.booking_requests(customer_id, service_id, service_name, address_id,
    address_snapshot, preferred_date, time_window, customer_notes, idempotency_key)
  values (actor, p_service_id, selected_service_name, selected_address.id,
    snapshot, p_preferred_date, p_time_window, notes, p_idempotency_key)
  returning id into result;
  return result;
end;
$$;

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
    where m.locality_id=p_locality and a.id=address.service_area_id and a.is_active and (a.postal_code=address.postal_code or (a.locality_id=p_locality and address.postal_code='')) and pa.professional_id=o.professional_id) then
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

-- Catalog deactivation must invalidate affected native-locality appointments too.
create trigger fulfillment_localities_changed after update on public.marketplace_localities
for each statement execute function private.invalidate_ineligible_booking_assignments();

create function public.admin_approve_locality_coverage(p_localities uuid[],p_professional uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare selected uuid; l public.marketplace_localities; area uuid; request_id uuid; mapping record; total integer:=0;
begin
 perform private.lock_administrator_roles();
 if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 perform private.lock_booking_fulfillment();
 if p_localities is null or cardinality(p_localities) not between 1 and 20 or array_position(p_localities,null) is not null
   or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Choose 1–20 Delhi localities and give a decision reason' using errcode='22023'; end if;
 if p_professional is not null and not exists(select 1 from public.list_public_professionals() p where p.professional_id=p_professional) then
   raise exception 'Choose a currently verified, visible, eligible professional' using errcode='22023'; end if;
 for selected in select distinct id from unnest(p_localities) selected(id) order by id loop
  select * into l from public.marketplace_localities where id=selected and region_code='IN-DL' for update;
  if not found then raise exception 'Delhi catalog locality required' using errcode='22023'; end if;
  -- This explicitly approves operating by the selected name; it asserts no postal mapping.
  update public.marketplace_localities set verified=true,is_active=true,updated_at=clock_timestamp() where id=l.id;
  if not exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
    where m.locality_id=l.id and a.is_active and (a.postal_code is not null or a.locality_id=l.id)) then
   select id into area from public.service_areas where locality_id=l.id;
   if area is null then
    insert into public.service_areas(name,postal_code,is_active,locality_id)
     values(left(l.name,90)||' ('||left(l.district,25)||')',null,true,l.id) returning id into area;
   else update public.service_areas set is_active=true,updated_at=clock_timestamp() where id=area; end if;
   insert into public.locality_service_areas(locality_id,service_area_id,approved_by) values(l.id,area,auth.uid()) on conflict do nothing;
  end if;
  if p_professional is not null then
   for mapping in select a.id from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
    where m.locality_id=l.id and a.is_active and (a.postal_code is not null or a.locality_id=l.id) order by a.id loop
    if not exists(select 1 from public.professional_service_areas where professional_id=p_professional and service_area_id=mapping.id) then
     select id into request_id from public.professional_coverage_requests where professional_id=p_professional and service_area_id=mapping.id and state='submitted';
     if request_id is null then
      insert into public.professional_coverage_requests(professional_id,service_area_id,action) values(p_professional,mapping.id,'add') returning id into request_id;
      insert into public.professional_offering_events(coverage_request_id,professional_id,actor_user_id,event,reason)
       values(request_id,p_professional,auth.uid(),'coverage_requested','Administrator initiated explicit locality approval: '||left(p_reason,900));
     elsif exists(select 1 from public.professional_coverage_requests where id=request_id and action<>'add') then
      raise exception 'Resolve the pending coverage-removal request before approving this locality' using errcode='22023'; end if;
     perform public.review_professional_coverage(request_id,true,p_reason);
    end if;
   end loop;
  end if;
  insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
   values('locality',l.id,auth.uid(),to_jsonb(l),jsonb_build_object('locality_id',l.id,'coverage_authority','exact_locality','professional_id',p_professional,'active',true),p_reason);
  total:=total+1;
 end loop;
 return jsonb_build_object('localities',total,'professional_id',p_professional);
end;
$$;
revoke all on function public.admin_approve_locality_coverage(uuid[],uuid,text) from public,anon,authenticated;
grant execute on function public.admin_approve_locality_coverage(uuid[],uuid,text) to authenticated;

create function public.admin_locality_coverage_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return jsonb_build_object('professionals',(select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.professional_id,'name',p.display_name,
  'requested_localities',coalesce((select to_jsonb(a.requested_locality_ids) from public.professional_applications a where a.applicant_id=p.professional_id),'[]'::jsonb),
  'approved_localities',(select coalesce(jsonb_agg(l.id),'[]'::jsonb) from public.marketplace_localities l where private.professional_serves_locality(p.professional_id,l.id)),
  'approved_offerings',(select count(*) from public.list_public_offerings() o where o.professional_id=p.professional_id),
  'availability_windows',(select count(*) from public.professional_weekly_availability w where w.professional_id=p.professional_id)) order by p.display_name),'[]'::jsonb) from public.list_public_professionals() p));
end;
$$;
revoke all on function public.admin_locality_coverage_overview() from public,anon,authenticated;
grant execute on function public.admin_locality_coverage_overview() to authenticated;

create or replace function public.admin_save_marketplace_locality(p_id uuid,p_name text,p_district text,p_region text,p_source text,
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
    if area is null or not exists(select 1 from public.service_areas where id=area and (postal_code is not null or locality_id=result) and (not p_active or is_active)) then
      raise exception 'Mapped service area must have a verified PIN and be active before publication' using errcode='22023'; end if;
    insert into public.locality_service_areas(locality_id,service_area_id,approved_by) values(result,area,auth.uid()) on conflict do nothing;
  end loop;
  insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
    values('locality',result,auth.uid(),before_value,jsonb_build_object('name',p_name,'district',p_district,'region',p_region,
      'source',p_source,'verified',p_verified,'active',p_active,'areas',p_area_ids),p_reason);
  return result;
end;
$$;
create trigger fulfillment_locality_mappings_changed after insert or update or delete on public.locality_service_areas for each statement execute function private.invalidate_ineligible_booking_assignments();
