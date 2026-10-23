-- Phase 4B proposal: requires explicit approval before hosted application.
-- Preserves every 3A/4A migration file, booking, preference, and address snapshot.
-- Pending proposals reserve time. No payments, travel-time assumptions or notifications.
create extension if not exists btree_gist with schema extensions;

alter table public.booking_requests drop constraint booking_requests_status_check;
alter table public.booking_requests add constraint booking_requests_status_check
  check (status in ('pending','assignment_proposed','confirmed','in_progress','completed','cancelled','requires_rescheduling'));
alter table public.booking_requests drop constraint booking_cancellation_state;
alter table public.booking_requests add constraint booking_cancellation_state
  check ((status = 'cancelled') = (cancelled_at is not null));
alter table public.booking_requests add column cancellation_requested_at timestamptz;
alter table public.booking_requests add column cancellation_reason text
  check (char_length(cancellation_reason) <= 1000);

create table public.professional_weekly_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  unique (professional_id, iso_weekday, start_time, end_time)
);
create table public.professional_time_off (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 500),
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at)
);
create index professional_time_off_owner_idx on public.professional_time_off(professional_id, starts_at);

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  duration_source text not null check (duration_source in ('configured','admin_approved')),
  state text not null default 'proposed' check (state in
    ('proposed','accepted','declined','in_progress','completed','cancelled','reassigned','invalidated')),
  -- Only the six already-public listing fields; never professional private contact/documents.
  professional_public_snapshot jsonb not null check (jsonb_typeof(professional_public_snapshot) = 'object'),
  proposal_actor uuid not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  responded_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, idempotency_key),
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  check (ends_at = starts_at + duration_minutes * interval '1 minute'),
  constraint professional_active_appointment_no_overlap exclude using gist (
    professional_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (state in ('proposed','accepted','in_progress'))
);
create unique index booking_one_active_assignment_idx on public.booking_assignments(booking_id)
  where state in ('proposed','accepted','in_progress');
create index booking_assignments_history_idx on public.booking_assignments(booking_id, created_at desc);
create index booking_assignments_professional_idx on public.booking_assignments(professional_id, starts_at);

create table public.booking_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  -- Bare immutable IDs retain non-PII history after identity/request deletion, like 3A audit.
  booking_id uuid not null,
  assignment_id uuid,
  actor_user_id uuid,
  event text not null check (event in ('booking_state','assignment_state','cancellation_request')),
  previous_state text,
  new_state text not null,
  reason text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index booking_fulfillment_events_booking_idx on public.booking_fulfillment_events(booking_id, created_at, id);

alter table public.professional_weekly_availability enable row level security;
alter table public.professional_time_off enable row level security;
alter table public.booking_assignments enable row level security;
alter table public.booking_fulfillment_events enable row level security;
revoke all on public.professional_weekly_availability, public.professional_time_off,
  public.booking_assignments, public.booking_fulfillment_events from public, anon, authenticated;
grant select on public.professional_weekly_availability, public.professional_time_off,
  public.booking_fulfillment_events to authenticated;
-- Private retry fingerprints and administrator identities are not professional UI data.
grant select(id,booking_id,professional_id,starts_at,ends_at,duration_minutes,duration_source,
  state,responded_at,accepted_at,completed_at,created_at,updated_at) on public.booking_assignments to authenticated;
create policy availability_owner_admin on public.professional_weekly_availability for select to authenticated
using (private.is_admin() or (professional_id = auth.uid() and private.has_role('professional')));
create policy time_off_owner_admin on public.professional_time_off for select to authenticated
using (private.is_admin() or (professional_id = auth.uid() and private.has_role('professional')));
create policy assignment_owner_admin on public.booking_assignments for select to authenticated
using (private.is_admin() or (professional_id = auth.uid() and private.has_role('professional')));
create policy fulfillment_audit_admin on public.booking_fulfillment_events for select to authenticated
using (private.is_admin());
create policy booking_admin_read on public.booking_requests for select to authenticated using (private.is_admin());
-- No professional SELECT policy on customer bookings or saved addresses is added.

create trigger immutable_fulfillment_events before update or delete on public.booking_fulfillment_events
for each row execute function private.prevent_audit_mutation();
create trigger booking_assignments_updated_at before update on public.booking_assignments
for each row execute function private.touch_updated_at();

-- Coarse serialization is intentional for this small managed marketplace.
-- Every fulfillment/schedule RPC takes this BEFORE row locks. Eligibility hooks
-- take it before touching assignments. Exclusion/unique constraints remain the
-- independent hard protection against overlapping/duplicate active reservations.
create function private.lock_booking_fulfillment()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Fulfillment requires READ COMMITTED isolation' using errcode = '25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(41042026);
end;
$$;
revoke all on function private.lock_booking_fulfillment() from public, anon, authenticated;

create function private.professional_booking_issue(p_professional uuid, p_service uuid, p_pin text)
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
  if not exists(select 1 from public.professional_service_areas pa
    join public.service_areas sa on sa.id=pa.service_area_id
    where pa.professional_id=p_professional and sa.is_active and sa.postal_code=p_pin) then
    return 'No approved active coverage for the exact delivery PIN; configure coverage first';
  end if;
  return null;
end;
$$;
revoke all on function private.professional_booking_issue(uuid,uuid,text) from public, anon, authenticated;

create function private.slot_within_schedule(p_professional uuid, p_start timestamptz, p_end timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.professional_weekly_availability w
    where w.professional_id=p_professional
      and w.iso_weekday=extract(isodow from (p_start at time zone 'Asia/Kolkata'))
      and p_start >= (((p_start at time zone 'Asia/Kolkata')::date + w.start_time) at time zone 'Asia/Kolkata')
      and p_end <= (((p_start at time zone 'Asia/Kolkata')::date + w.end_time) at time zone 'Asia/Kolkata'))
    and not exists(select 1 from public.professional_time_off t where t.professional_id=p_professional
      and tstzrange(t.starts_at,t.ends_at,'[)') && tstzrange(p_start,p_end,'[)'));
$$;
revoke all on function private.slot_within_schedule(uuid,timestamptz,timestamptz) from public, anon, authenticated;

create function private.assignment_proposal_issue(p_booking public.booking_requests,
  p_professional uuid, p_start timestamptz, p_duration integer, p_exclude uuid default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare issue text; configured_duration integer; window_start time; window_end time; finish timestamptz;
begin
  issue := private.professional_booking_issue(p_professional,p_booking.service_id,p_booking.address_snapshot->>'postal_code');
  if issue is not null then return issue; end if;
  select s.duration_minutes into configured_duration from public.services s where s.id=p_booking.service_id;
  if p_duration is null or p_duration not between 1 and 1440 then
    return 'A valid configured or explicitly administrator-approved duration is required';
  end if;
  if configured_duration is not null and configured_duration <> p_duration then
    return 'Appointment duration must match the configured service duration';
  end if;
  if p_start is null or not isfinite(p_start) or p_start <= clock_timestamp() then
    return 'Choose a future appointment start';
  end if;
  finish := p_start + p_duration * interval '1 minute';
  select o.start_time,o.end_time into window_start,window_end from public.booking_request_options() o
    where o.window_key=p_booking.time_window;
  if window_start is null
    or p_start < ((p_booking.preferred_date + window_start) at time zone 'Asia/Kolkata')
    or finish > ((p_booking.preferred_date + window_end) at time zone 'Asia/Kolkata') then
    return 'Proposals must fit entirely inside the original customer preference window';
  end if;
  if not private.slot_within_schedule(p_professional,p_start,finish) then
    return 'Slot is outside weekly availability or overlaps time off';
  end if;
  if exists(select 1 from public.booking_assignments a where a.professional_id=p_professional
    and a.state in ('proposed','accepted','in_progress') and (p_exclude is null or a.id<>p_exclude)
    and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_start,finish,'[)')) then
    return 'Professional has a conflicting reserved or accepted appointment';
  end if;
  return null;
end;
$$;
revoke all on function private.assignment_proposal_issue(public.booking_requests,uuid,timestamptz,integer,uuid) from public, anon, authenticated;

-- Keep 4A's immutable request facts, while permitting only actual 4B states.
create or replace function private.guard_booking_request_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id,new.customer_id,new.service_id,new.service_name,new.address_snapshot,
    new.preferred_date,new.time_window,new.customer_notes,new.idempotency_key,new.created_at)
    is distinct from (old.id,old.customer_id,old.service_id,old.service_name,old.address_snapshot,
    old.preferred_date,old.time_window,old.customer_notes,old.idempotency_key,old.created_at) then
    raise exception 'Submitted booking details are immutable' using errcode = '42501';
  end if;
  if new.address_id is distinct from old.address_id and new.address_id is not null then
    raise exception 'Submitted address reference cannot be replaced' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status in ('cancelled','completed') then
      raise exception 'Terminal booking cannot be reopened' using errcode = '42501';
    end if;
    if new.status in ('assignment_proposed','confirmed','in_progress','completed') and not exists(
      select 1 from public.booking_assignments a where a.booking_id=new.id and a.state=
        case new.status when 'assignment_proposed' then 'proposed' when 'confirmed' then 'accepted'
          when 'in_progress' then 'in_progress' when 'completed' then 'completed' end) then
      raise exception 'Booking state requires the matching assignment transition' using errcode = '42501';
    end if;
    if new.status in ('pending','requires_rescheduling','cancelled') and exists(
      select 1 from public.booking_assignments a where a.booking_id=new.id
        and a.state in ('proposed','accepted','in_progress')) then
      raise exception 'Release active assignment before changing booking state' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_request_update() from public, anon, authenticated;

create function private.guard_booking_assignment_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id,new.booking_id,new.professional_id,new.starts_at,new.ends_at,new.duration_minutes,
    new.duration_source,new.professional_public_snapshot,new.proposal_actor,new.idempotency_key,
    new.request_fingerprint,new.created_at) is distinct from
    (old.id,old.booking_id,old.professional_id,old.starts_at,old.ends_at,old.duration_minutes,
    old.duration_source,old.professional_public_snapshot,old.proposal_actor,old.idempotency_key,
    old.request_fingerprint,old.created_at) then
    raise exception 'Assignment facts are immutable; propose a reassignment' using errcode = '42501';
  end if;
  if new.state is distinct from old.state and not (
    (old.state='proposed' and new.state in ('accepted','declined','cancelled','reassigned','invalidated')) or
    (old.state='accepted' and new.state in ('in_progress','cancelled','reassigned','invalidated')) or
    (old.state='in_progress' and new.state in ('completed','cancelled','invalidated'))) then
    raise exception 'Unsupported assignment transition' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_assignment_update() from public, anon, authenticated;
create trigger guard_booking_assignment_update before update on public.booking_assignments
for each row execute function private.guard_booking_assignment_update();

create function private.audit_booking_fulfillment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.booking_fulfillment_events(booking_id,actor_user_id,event,previous_state,new_state,reason)
    values(new.id,auth.uid(),'booking_state',old.status,new.status,
      left(nullif(current_setting('app.fulfillment_reason',true),''),1000));
  end if;
  if new.cancellation_requested_at is distinct from old.cancellation_requested_at then
    insert into public.booking_fulfillment_events(booking_id,actor_user_id,event,previous_state,new_state,reason)
    values(new.id,auth.uid(),'cancellation_request',
      case when old.cancellation_requested_at is not null then 'requested' else null end,
      case when new.cancellation_requested_at is null then 'declined' else 'requested' end,
      case when new.cancellation_requested_at is null then left(nullif(current_setting('app.fulfillment_reason',true),''),1000)
        else new.cancellation_reason end);
  end if;
  return new;
end;
$$;
revoke all on function private.audit_booking_fulfillment() from public, anon, authenticated;
create trigger audit_booking_fulfillment after update on public.booking_requests
for each row execute function private.audit_booking_fulfillment();

create function private.sync_booking_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_status text; previous text;
begin
  if tg_op='UPDATE' and new.state is not distinct from old.state then return new; end if;
  previous := case when tg_op='UPDATE' then old.state else null end;
  insert into public.booking_fulfillment_events(booking_id,assignment_id,actor_user_id,event,previous_state,new_state,reason)
  values(new.booking_id,new.id,auth.uid(),'assignment_state',previous,new.state,
    left(nullif(current_setting('app.fulfillment_reason',true),''),1000));
  next_status := case new.state when 'proposed' then 'assignment_proposed' when 'accepted' then 'confirmed'
    when 'in_progress' then 'in_progress' when 'completed' then 'completed' else 'requires_rescheduling' end;
  update public.booking_requests set status=next_status where id=new.booking_id;
  return new;
end;
$$;
revoke all on function private.sync_booking_assignment() from public, anon, authenticated;
create trigger sync_booking_assignment after insert or update on public.booking_assignments
for each row execute function private.sync_booking_assignment();

create function public.propose_booking_assignment(p_booking_id uuid,p_professional_id uuid,
  p_starts_at timestamptz,p_idempotency_key uuid,p_reason text,p_duration_minutes integer default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests; prior public.booking_assignments; current_id uuid;
  duration integer; configured integer; fingerprint text; issue text; public_profile jsonb; result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_idempotency_key is null or p_reason is null or char_length(btrim(p_reason))=0
    or char_length(p_reason)>1000 then raise exception 'Request key and decision reason required' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode='22023'; end if;
  fingerprint := md5(jsonb_build_array(p_professional_id,extract(epoch from p_starts_at),p_duration_minutes,p_reason)::text);
  select * into prior from public.booking_assignments where booking_id=p_booking_id and idempotency_key=p_idempotency_key;
  if found then
    if prior.request_fingerprint<>fingerprint then raise exception 'Retry key used for different proposal' using errcode='22023'; end if;
    return prior.id;
  end if;
  if b.status not in ('pending','requires_rescheduling','assignment_proposed','confirmed') then
    raise exception 'Booking cannot be assigned in its current state' using errcode='22023'; end if;
  if b.cancellation_requested_at is not null then
    raise exception 'Resolve customer cancellation request before assignment' using errcode='22023'; end if;
  select id into current_id from public.booking_assignments where booking_id=b.id and state in ('proposed','accepted','in_progress');
  select duration_minutes into configured from public.services where id=b.service_id;
  duration := coalesce(configured,p_duration_minutes);
  if configured is not null and p_duration_minutes is not null and configured<>p_duration_minutes then
    raise exception 'Configured service duration cannot be overridden' using errcode='22023'; end if;
  issue := private.assignment_proposal_issue(b,p_professional_id,p_starts_at,duration,current_id);
  if issue is not null then raise exception '%',issue using errcode='22023'; end if;
  select to_jsonb(p) into public_profile from public.list_public_professionals() p where p.professional_id=p_professional_id;
  perform set_config('app.fulfillment_reason',p_reason,true);
  if current_id is not null then update public.booking_assignments set state='reassigned' where id=current_id; end if;
  insert into public.booking_assignments(booking_id,professional_id,starts_at,ends_at,duration_minutes,
    duration_source,professional_public_snapshot,proposal_actor,idempotency_key,request_fingerprint)
  values(b.id,p_professional_id,p_starts_at,p_starts_at+duration*interval '1 minute',duration,
    case when configured is null then 'admin_approved' else 'configured' end,
    public_profile,auth.uid(),p_idempotency_key,fingerprint) returning id into result;
  return result;
end;
$$;
revoke all on function public.propose_booking_assignment(uuid,uuid,timestamptz,uuid,text,integer) from public, anon, authenticated;

create function public.respond_booking_assignment(p_assignment_id uuid,p_accept boolean,p_reason text default '')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare a public.booking_assignments; b public.booking_requests; issue text;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  select * into a from public.booking_assignments where id=p_assignment_id and professional_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  if p_accept is null or char_length(coalesce(p_reason,''))>1000 then raise exception 'Invalid response' using errcode='22023'; end if;
  if (p_accept and a.state='accepted') or (not p_accept and a.state='declined') then return a.id; end if;
  if a.state<>'proposed' then raise exception 'Proposal no longer active' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=a.booking_id for update;
  if p_accept then
    if b.cancellation_requested_at is not null then raise exception 'Customer cancellation needs admin review' using errcode='22023'; end if;
    issue := private.assignment_proposal_issue(b,a.professional_id,a.starts_at,a.duration_minutes,a.id);
    if issue is not null then raise exception '%',issue using errcode='22023'; end if;
  end if;
  perform set_config('app.fulfillment_reason',coalesce(p_reason,''),true);
  update public.booking_assignments set state=case when p_accept then 'accepted' else 'declined' end,
    responded_at=clock_timestamp(),accepted_at=case when p_accept then clock_timestamp() else null end where id=a.id;
  return a.id;
end;
$$;
revoke all on function public.respond_booking_assignment(uuid,boolean,text) from public, anon, authenticated;

create function public.advance_booking_appointment(p_assignment_id uuid,p_stage text)
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
  issue := private.professional_booking_issue(a.professional_id,b.service_id,b.address_snapshot->>'postal_code');
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
revoke all on function public.advance_booking_appointment(uuid,text) from public, anon, authenticated;

create function public.cancel_booking_fulfillment(p_booking_id uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_reason is null or char_length(btrim(p_reason))=0 or char_length(p_reason)>1000 then
    raise exception 'Cancellation reason required' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=p_booking_id for update;
  if not found then raise exception 'Booking unavailable' using errcode='22023'; end if;
  if b.status='cancelled' then return b.id; end if;
  if b.status='completed' then raise exception 'Completed booking cannot be cancelled' using errcode='22023'; end if;
  perform set_config('app.fulfillment_reason',p_reason,true);
  update public.booking_assignments set state='cancelled' where booking_id=b.id and state in ('proposed','accepted','in_progress');
  update public.booking_requests set status='cancelled',cancelled_at=clock_timestamp() where id=b.id;
  return b.id;
end;
$$;
revoke all on function public.cancel_booking_fulfillment(uuid,text) from public, anon, authenticated;

create function public.request_booking_cancellation(p_booking_id uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  if p_reason is null or char_length(btrim(p_reason))=0 or char_length(p_reason)>1000 then
    raise exception 'Cancellation request reason required' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=p_booking_id and customer_id=auth.uid() for update;
  if not found then raise exception 'Booking unavailable' using errcode='42501'; end if;
  if b.status not in ('assignment_proposed','confirmed','in_progress','requires_rescheduling') then
    raise exception 'Use pending cancellation, or contact administration for this state' using errcode='22023'; end if;
  if b.cancellation_requested_at is not null then return b.id; end if;
  update public.booking_requests set cancellation_requested_at=clock_timestamp(),cancellation_reason=p_reason where id=b.id;
  return b.id;
end;
$$;
revoke all on function public.request_booking_cancellation(uuid,text) from public, anon, authenticated;

create function public.resolve_booking_cancellation(p_booking_id uuid,p_cancel boolean,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_cancel is null or p_reason is null or char_length(btrim(p_reason))=0 or char_length(p_reason)>1000 then
    raise exception 'Resolution and reason required' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=p_booking_id for update;
  if not found or b.cancellation_requested_at is null or b.status in ('cancelled','completed') then
    raise exception 'Open cancellation request unavailable' using errcode='22023'; end if;
  if p_cancel then return public.cancel_booking_fulfillment(b.id,p_reason); end if;
  perform set_config('app.fulfillment_reason',p_reason,true);
  update public.booking_requests set cancellation_requested_at=null,cancellation_reason=null where id=b.id;
  return b.id;
end;
$$;
revoke all on function public.resolve_booking_cancellation(uuid,boolean,text) from public, anon, authenticated;

-- Same signature/owner-scoped behavior as 4A, now serialized with fulfillment.
create or replace function public.cancel_pending_booking_request(p_booking_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Authenticated customer required' using errcode='42501'; end if;
  perform set_config('app.fulfillment_reason','Customer cancelled pending request',true);
  update public.booking_requests set status='cancelled',cancelled_at=clock_timestamp()
    where id=p_booking_id and customer_id=auth.uid() and status='pending' returning id into result;
  if not found then raise exception 'Pending request unavailable or no longer cancellable' using errcode='42501'; end if;
  return result;
end;
$$;
revoke all on function public.cancel_pending_booking_request(uuid) from public, anon, authenticated;

create function public.save_weekly_availability(p_windows jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_windows is null or jsonb_typeof(p_windows)<>'array' then raise exception 'Expected schedule array' using errcode='22023'; end if;
  if jsonb_array_length(p_windows)>28 then raise exception 'Schedule has too many windows' using errcode='22023'; end if;
  delete from public.professional_weekly_availability where professional_id=auth.uid();
  insert into public.professional_weekly_availability(professional_id,iso_weekday,start_time,end_time)
  select auth.uid(),w.iso_weekday,w.start_time,w.end_time
  from jsonb_to_recordset(p_windows) as w(iso_weekday smallint,start_time time,end_time time);
  if exists(select 1 from public.professional_weekly_availability a join public.professional_weekly_availability b
    on a.professional_id=b.professional_id and a.iso_weekday=b.iso_weekday and a.id<b.id
    where a.professional_id=auth.uid() and a.start_time<b.end_time and b.start_time<a.end_time) then
    raise exception 'Weekly windows must not overlap' using errcode='22023'; end if;
  if exists(select 1 from public.booking_assignments a where a.professional_id=auth.uid()
    and a.state in ('proposed','accepted','in_progress') and not private.slot_within_schedule(a.professional_id,a.starts_at,a.ends_at)) then
    raise exception 'Schedule change conflicts with reserved/confirmed work; ask administration to resolve it first' using errcode='22023'; end if;
end;
$$;
revoke all on function public.save_weekly_availability(jsonb) from public, anon, authenticated;

create function public.save_professional_time_off(p_starts_at timestamptz,p_ends_at timestamptz,
  p_reason text default '',p_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_starts_at>=p_ends_at or p_ends_at<=clock_timestamp() or char_length(coalesce(p_reason,''))>500 then
    raise exception 'Invalid time off interval' using errcode='22023'; end if;
  if exists(select 1 from public.booking_assignments a where a.professional_id=auth.uid()
    and a.state in ('proposed','accepted','in_progress')
    and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')) then
    raise exception 'Time off conflicts with reserved/confirmed work; ask administration first' using errcode='22023'; end if;
  if p_id is null then
    insert into public.professional_time_off(professional_id,starts_at,ends_at,reason)
    values(auth.uid(),p_starts_at,p_ends_at,coalesce(p_reason,'')) returning id into result;
  else
    update public.professional_time_off set starts_at=p_starts_at,ends_at=p_ends_at,reason=coalesce(p_reason,'')
    where id=p_id and professional_id=auth.uid() returning id into result;
    if not found then raise exception 'Time off unavailable' using errcode='42501'; end if;
  end if;
  return result;
end;
$$;
revoke all on function public.save_professional_time_off(timestamptz,timestamptz,text,uuid) from public, anon, authenticated;

create function public.delete_professional_time_off(p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  delete from public.professional_time_off where id=p_id and professional_id=auth.uid();
  if not found then raise exception 'Time off unavailable' using errcode='42501'; end if;
end;
$$;
revoke all on function public.delete_professional_time_off(uuid) from public, anon, authenticated;

create function public.booking_assignment_candidates(p_booking_id uuid,p_starts_at timestamptz default null,
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
      private.professional_booking_issue(p.professional_id,b.service_id,b.address_snapshot->>'postal_code'),
      'Choose an exact time and duration to check availability and conflicts')
    else private.assignment_proposal_issue(b,p.professional_id,p_starts_at,duration,current_id) end
    from public.list_public_professionals() p;
end;
$$;
revoke all on function public.booking_assignment_candidates(uuid,timestamptz,integer) from public, anon, authenticated;

create function public.professional_assignment_details(p_assignment_id uuid)
returns table(assignment_id uuid,booking_id uuid,service_name text,state text,starts_at timestamptz,
  ends_at timestamptz,address_details jsonb,customer_notes text,cancellation_requested boolean)
language plpgsql stable security definer set search_path = '' as $$
declare a public.booking_assignments; b public.booking_requests; eligible boolean;
begin
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  select x.* into a from public.booking_assignments x where x.id=p_assignment_id and x.professional_id=auth.uid();
  if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  select x.* into b from public.booking_requests x where x.id=a.booking_id;
  eligible := private.professional_booking_issue(a.professional_id,b.service_id,b.address_snapshot->>'postal_code') is null;
  return query select a.id,b.id,b.service_name,a.state,a.starts_at,a.ends_at,
    case when eligible and a.state in ('accepted','in_progress') then b.address_snapshot
      when eligible and a.state='proposed' then jsonb_build_object('locality',b.address_snapshot->>'locality',
        'city',b.address_snapshot->>'city','state',b.address_snapshot->>'state','postal_code',b.address_snapshot->>'postal_code')
      else null end,
    case when eligible and a.state in ('accepted','in_progress') then b.customer_notes else null end,
    b.cancellation_requested_at is not null;
end;
$$;
revoke all on function public.professional_assignment_details(uuid) from public, anon, authenticated;

create function public.customer_booking_appointment(p_booking_id uuid)
returns table(assignment_id uuid,state text,starts_at timestamptz,ends_at timestamptz,
  professional_id uuid,display_name text,qualifications_description text,experience_description text)
language plpgsql stable security definer set search_path = '' as $$
declare b public.booking_requests;
begin
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  select * into b from public.booking_requests where id=p_booking_id and customer_id=auth.uid();
  if not found then raise exception 'Booking unavailable' using errcode='42501'; end if;
  return query select a.id,a.state,a.starts_at,a.ends_at,
    case when a.state in ('accepted','in_progress','completed') then a.professional_id else null end,
    case when a.state in ('accepted','in_progress','completed') then a.professional_public_snapshot->>'display_name' else null end,
    case when a.state in ('accepted','in_progress','completed') then a.professional_public_snapshot->>'qualifications_description' else null end,
    case when a.state in ('accepted','in_progress','completed') then a.professional_public_snapshot->>'experience_description' else null end
    from public.booking_assignments a where a.booking_id=b.id and a.state in ('proposed','accepted','in_progress','completed')
    order by a.created_at desc limit 1;
end;
$$;
revoke all on function public.customer_booking_appointment(uuid) from public, anon, authenticated;

-- Eligibility mutations from the existing 3A routes/trusted Auth operations
-- cannot leave an active invalid assignment or keep exposing its customer PII.
create function private.invalidate_ineligible_booking_assignments()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare a record; issue text; duration integer;
begin
  perform private.lock_booking_fulfillment();
  for a in select x.*,b.service_id,b.address_snapshot from public.booking_assignments x
    join public.booking_requests b on b.id=x.booking_id where x.state in ('proposed','accepted','in_progress')
    order by x.id for update of x loop
    issue := private.professional_booking_issue(a.professional_id,a.service_id,a.address_snapshot->>'postal_code');
    select s.duration_minutes into duration from public.services s where s.id=a.service_id;
    if issue is null and ((duration is not null and duration<>a.duration_minutes)
      or (duration is null and a.duration_source='configured')) then issue := 'Service duration configuration changed'; end if;
    if issue is not null then
      perform set_config('app.fulfillment_reason',left('Eligibility revoked: '||issue,1000),true);
      update public.booking_assignments set state='invalidated' where id=a.id;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.invalidate_ineligible_booking_assignments() from public, anon, authenticated;
create trigger fulfillment_roles_changed after insert or update or delete on public.user_roles
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_verification_changed after insert or update or delete on public.professional_verifications
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_profile_visibility_changed after update on public.professional_profiles
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_auth_eligibility_changed after update of banned_until,deleted_at on auth.users
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_services_changed after update or delete on public.services
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_categories_changed after update or delete on public.service_categories
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_service_approvals_changed after insert or update or delete on public.professional_services
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_area_approvals_changed after insert or update or delete on public.professional_service_areas
for each statement execute function private.invalidate_ineligible_booking_assignments();
create trigger fulfillment_coverage_changed after update or delete on public.service_areas
for each statement execute function private.invalidate_ineligible_booking_assignments();

-- Execution grants are listed explicitly below. Internal helpers are never RPCs.
grant execute on function public.propose_booking_assignment(uuid,uuid,timestamptz,uuid,text,integer),
  public.respond_booking_assignment(uuid,boolean,text),public.advance_booking_appointment(uuid,text),
  public.cancel_booking_fulfillment(uuid,text),public.request_booking_cancellation(uuid,text),
  public.resolve_booking_cancellation(uuid,boolean,text),
  public.cancel_pending_booking_request(uuid),public.save_weekly_availability(jsonb),
  public.save_professional_time_off(timestamptz,timestamptz,text,uuid),public.delete_professional_time_off(uuid),
  public.booking_assignment_candidates(uuid,timestamptz,integer),public.professional_assignment_details(uuid),
  public.customer_booking_appointment(uuid) to authenticated;
