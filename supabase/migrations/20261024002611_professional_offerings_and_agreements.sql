-- Phase 4B extension. Apply only with the user's explicit combined approval.
-- Depends on, and does not rewrite, 20261023101357_booking_fulfillment.sql.
-- No seeded offerings/prices, payments, purchased packages, or session entitlements.

alter table public.professional_profiles add column specializations text not null default ''
  check (char_length(specializations)<=1500);
-- Existing pending/rejected-profile RLS continues to protect this material claim.
grant update(specializations) on public.professional_profiles to authenticated;

create table public.professional_offerings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  approved_revision_id uuid,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index professional_offerings_owner_idx on public.professional_offerings(professional_id,created_at);
create index professional_offerings_service_idx on public.professional_offerings(service_id);

create table public.professional_offering_revisions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.professional_offerings(id) on delete cascade,
  revision_number integer not null check (revision_number>0),
  state text not null default 'draft' check (state in ('draft','submitted','approved','rejected')),
  offering_type text not null check (offering_type in ('single_session','recurring_package')),
  title text not null check (char_length(btrim(title))>0 and char_length(title)<=160),
  description text not null default '' check (char_length(description)<=4000),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  price_minor bigint not null check (price_minor between 0 and 100000000),
  currency text not null default 'INR' check (currency='INR'),
  total_sessions integer,
  sessions_per_week integer,
  package_duration_value integer,
  package_duration_unit text,
  delivery_notes text not null default '' check (char_length(delivery_notes)<=1000),
  feedback text not null default '' check (char_length(feedback)<=1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offering_id,revision_number),
  check (
    (offering_type='single_session' and total_sessions is null and sessions_per_week is null
      and package_duration_value is null and package_duration_unit is null)
    or
    (offering_type='recurring_package' and total_sessions is not null and total_sessions between 1 and 366
      and (sessions_per_week is null or sessions_per_week between 1 and 21)
      and package_duration_value is not null and package_duration_value between 1 and 365
      and package_duration_unit is not null and package_duration_unit in ('days','weeks','calendar_months')
      and (package_duration_unit<>'weeks' or sessions_per_week is null
        or total_sessions=package_duration_value*sessions_per_week))
  ),
  check (state not in ('approved','rejected') or (reviewed_by is not null and reviewed_at is not null))
);
create unique index professional_offering_one_working_revision_idx
  on public.professional_offering_revisions(offering_id) where state in ('draft','submitted','rejected');
alter table public.professional_offerings add constraint professional_offerings_approved_revision_fkey
  foreign key (approved_revision_id) references public.professional_offering_revisions(id) on delete restrict;

create table public.professional_coverage_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  service_area_id uuid not null references public.service_areas(id) on delete restrict,
  action text not null check (action in ('add','remove')),
  state text not null default 'submitted' check (state in ('submitted','approved','rejected')),
  feedback text not null default '' check (char_length(feedback)<=1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index professional_coverage_one_request_idx
  on public.professional_coverage_requests(professional_id,service_area_id) where state='submitted';

create table public.professional_offering_events (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid,
  revision_id uuid,
  coverage_request_id uuid,
  professional_id uuid not null,
  actor_user_id uuid,
  event text not null check (event in ('draft_saved','submitted','approved','rejected','suspended','resumed','coverage_requested','coverage_approved','coverage_rejected')),
  reason text not null default '' check (char_length(reason)<=1000),
  created_at timestamptz not null default now()
);
create index professional_offering_events_history_idx on public.professional_offering_events(offering_id,created_at);
create index professional_offering_events_owner_idx on public.professional_offering_events(professional_id,created_at);
create trigger immutable_professional_offering_events before update or delete on public.professional_offering_events
for each row execute function private.prevent_audit_mutation();

alter table public.professional_offerings enable row level security;
alter table public.professional_offering_revisions enable row level security;
alter table public.professional_coverage_requests enable row level security;
alter table public.professional_offering_events enable row level security;
revoke all on public.professional_offerings,public.professional_offering_revisions,
  public.professional_coverage_requests,public.professional_offering_events from public,anon,authenticated;
grant select on public.professional_offerings,public.professional_offering_revisions,
  public.professional_coverage_requests,public.professional_offering_events to authenticated;
create policy offering_owner_admin on public.professional_offerings for select to authenticated
using (private.is_admin() or (professional_id=auth.uid() and private.has_role('professional')));
create policy offering_revision_owner_admin on public.professional_offering_revisions for select to authenticated
using (private.is_admin() or exists(select 1 from public.professional_offerings o
  where o.id=offering_id and o.professional_id=auth.uid() and private.has_role('professional')));
create policy coverage_request_owner_admin on public.professional_coverage_requests for select to authenticated
using (private.is_admin() or (professional_id=auth.uid() and private.has_role('professional')));
create policy offering_event_owner_admin on public.professional_offering_events for select to authenticated
using (private.is_admin() or (professional_id=auth.uid() and private.has_role('professional')));

create function private.guard_offering_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.state='approved' and new is distinct from old then
    raise exception 'Approved offering revisions are immutable; create a new draft' using errcode='42501'; end if;
  if (new.id,new.offering_id,new.revision_number,new.created_at) is distinct from
    (old.id,old.offering_id,old.revision_number,old.created_at) then
    raise exception 'Revision identity is immutable' using errcode='42501'; end if;
  if old.state='submitted' and (to_jsonb(new)-array['state','feedback','reviewed_by','reviewed_at','updated_at'])
    is distinct from (to_jsonb(old)-array['state','feedback','reviewed_by','reviewed_at','updated_at']) then
    raise exception 'Submitted terms are frozen during review' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.guard_offering_revision() from public, anon, authenticated;

create trigger guard_offering_revision before update on public.professional_offering_revisions
for each row execute function private.guard_offering_revision();

create function public.save_professional_offering(p_service_id uuid,p_terms jsonb,
  p_offering_id uuid default null,p_revision_id uuid default null,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare o public.professional_offerings; r public.professional_offering_revisions; next_revision integer; result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_terms is null or jsonb_typeof(p_terms)<>'object' or octet_length(p_terms::text)>16000 then
    raise exception 'Invalid offering terms' using errcode='22023'; end if;
  if not exists(select 1 from public.services s join public.service_categories c on c.id=s.category_id
    where s.id=p_service_id and s.is_active and s.is_published and c.is_active) then
    raise exception 'Choose an active published Aara service' using errcode='22023'; end if;
  if p_terms->>'offering_type'='recurring_package' and not exists(
    select 1 from public.services s join public.service_categories c on c.id=s.category_id
    where s.id=p_service_id and c.slug='yoga') then
    raise exception 'Recurring packages currently require a Yoga service' using errcode='22023'; end if;
  if p_offering_id is null then
    if p_revision_id is not null then raise exception 'Offering ID required' using errcode='22023'; end if;
    insert into public.professional_offerings(professional_id,service_id) values(auth.uid(),p_service_id) returning * into o;
  else
    select * into o from public.professional_offerings where id=p_offering_id and professional_id=auth.uid() for update;
    if not found then raise exception 'Offering unavailable' using errcode='42501'; end if;
    if o.service_id<>p_service_id then raise exception 'Create a different offering to change the platform service' using errcode='22023'; end if;
  end if;
  if p_revision_id is null then
    if exists(select 1 from public.professional_offering_revisions where offering_id=o.id and state in ('draft','submitted','rejected')) then
      raise exception 'Edit the existing working revision instead' using errcode='22023'; end if;
    select coalesce(max(revision_number),0)+1 into next_revision from public.professional_offering_revisions where offering_id=o.id;
    insert into public.professional_offering_revisions(offering_id,revision_number,offering_type,title,description,
      duration_minutes,price_minor,total_sessions,sessions_per_week,package_duration_value,package_duration_unit,delivery_notes)
    select o.id,next_revision,t.offering_type,btrim(t.title),coalesce(t.description,''),t.duration_minutes,
      t.price_minor,t.total_sessions,t.sessions_per_week,t.package_duration_value,t.package_duration_unit,coalesce(t.delivery_notes,'')
    from jsonb_to_record(p_terms) t(offering_type text,title text,description text,duration_minutes integer,
      price_minor bigint,total_sessions integer,sessions_per_week integer,package_duration_value integer,package_duration_unit text,delivery_notes text)
    returning id into result;
  else
    select * into r from public.professional_offering_revisions where id=p_revision_id and offering_id=o.id for update;
    if not found or r.state not in ('draft','rejected') then raise exception 'Only own draft/rejected revisions can be edited' using errcode='42501'; end if;
    if r.updated_at is distinct from p_expected_updated_at then raise exception 'Revision changed; reload before saving' using errcode='40001'; end if;
    update public.professional_offering_revisions x set offering_type=t.offering_type,title=btrim(t.title),
      description=coalesce(t.description,''),duration_minutes=t.duration_minutes,price_minor=t.price_minor,
      total_sessions=t.total_sessions,sessions_per_week=t.sessions_per_week,package_duration_value=t.package_duration_value,
      package_duration_unit=t.package_duration_unit,delivery_notes=coalesce(t.delivery_notes,''),
      state='draft',feedback='',reviewed_by=null,reviewed_at=null,updated_at=clock_timestamp()
    from jsonb_to_record(p_terms) t(offering_type text,title text,description text,duration_minutes integer,
      price_minor bigint,total_sessions integer,sessions_per_week integer,package_duration_value integer,package_duration_unit text,delivery_notes text)
    where x.id=r.id returning x.id into result;
  end if;
  insert into public.professional_offering_events(offering_id,revision_id,professional_id,actor_user_id,event)
    values(o.id,result,auth.uid(),auth.uid(),'draft_saved');
  return result;
end;
$$;
revoke all on function public.save_professional_offering(uuid,jsonb,uuid,uuid,timestamptz) from public, anon, authenticated;

create function public.submit_professional_offering(p_revision_id uuid,p_expected_updated_at timestamptz)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare r public.professional_offering_revisions; o public.professional_offerings;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  select x.* into r from public.professional_offering_revisions x join public.professional_offerings y on y.id=x.offering_id
    where x.id=p_revision_id and y.professional_id=auth.uid() for update of x;
  if not found then raise exception 'Revision unavailable' using errcode='42501'; end if;
  if r.state='submitted' then return r.id; end if;
  if r.state not in ('draft','rejected') or r.updated_at is distinct from p_expected_updated_at then
    raise exception 'Revision changed or cannot be submitted' using errcode='22023'; end if;
  select * into o from public.professional_offerings where id=r.offering_id;
  if not exists(select 1 from public.services s join public.service_categories c on c.id=s.category_id
    where s.id=o.service_id and s.is_active and s.is_published and c.is_active
      and (r.offering_type='single_session' or c.slug='yoga')) then
    raise exception 'Platform service is unavailable for these terms' using errcode='22023'; end if;
  update public.professional_offering_revisions set state='submitted',updated_at=clock_timestamp() where id=r.id;
  insert into public.professional_offering_events(offering_id,revision_id,professional_id,actor_user_id,event)
    values(o.id,r.id,auth.uid(),auth.uid(),'submitted');
  return r.id;
end;
$$;
revoke all on function public.submit_professional_offering(uuid,timestamptz) from public, anon, authenticated;

create function public.review_professional_offering(p_revision_id uuid,p_approve boolean,p_feedback text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare r public.professional_offering_revisions; o public.professional_offerings;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_approve is null or p_feedback is null or char_length(btrim(p_feedback))=0 or char_length(p_feedback)>1000 then
    raise exception 'Decision and review reason required' using errcode='22023'; end if;
  select * into r from public.professional_offering_revisions where id=p_revision_id for update;
  if not found or r.state<>'submitted' then raise exception 'Submitted revision unavailable' using errcode='22023'; end if;
  select * into o from public.professional_offerings where id=r.offering_id for update;
  if p_approve then
    if not exists(select 1 from public.list_public_professionals() p where p.professional_id=o.professional_id) then
      raise exception 'Verify the professional independently before approving an offering' using errcode='22023'; end if;
    if not exists(select 1 from public.services s join public.service_categories c on c.id=s.category_id
      where s.id=o.service_id and s.is_active and s.is_published and c.is_active
        and (r.offering_type='single_session' or c.slug='yoga')) then
      raise exception 'Platform service is unavailable for these terms' using errcode='22023'; end if;
    -- This review explicitly authorizes the professional for the referenced Aara service.
    insert into public.professional_services(professional_id,service_id,approved_by)
      values(o.professional_id,o.service_id,auth.uid()) on conflict(professional_id,service_id) do nothing;
  end if;
  update public.professional_offering_revisions set state=case when p_approve then 'approved' else 'rejected' end,
    feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id;
  if p_approve then update public.professional_offerings set approved_revision_id=r.id,updated_at=clock_timestamp() where id=o.id; end if;
  insert into public.professional_offering_events(offering_id,revision_id,professional_id,actor_user_id,event,reason)
    values(o.id,r.id,o.professional_id,auth.uid(),case when p_approve then 'approved' else 'rejected' end,p_feedback);
  return o.id;
end;
$$;
revoke all on function public.review_professional_offering(uuid,boolean,text) from public, anon, authenticated;

create function public.set_professional_offering_suspended(p_offering_id uuid,p_suspended boolean,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare o public.professional_offerings;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_suspended is null or p_reason is null or char_length(btrim(p_reason))=0 or char_length(p_reason)>1000 then
    raise exception 'Suspension decision and reason required' using errcode='22023'; end if;
  select * into o from public.professional_offerings where id=p_offering_id for update;
  if not found then raise exception 'Offering unavailable' using errcode='22023'; end if;
  update public.professional_offerings set suspended=p_suspended,updated_at=clock_timestamp() where id=o.id;
  insert into public.professional_offering_events(offering_id,revision_id,professional_id,actor_user_id,event,reason)
    values(o.id,o.approved_revision_id,o.professional_id,auth.uid(),case when p_suspended then 'suspended' else 'resumed' end,p_reason);
  return o.id;
end;
$$;
revoke all on function public.set_professional_offering_suspended(uuid,boolean,text) from public, anon, authenticated;

create function public.request_professional_coverage(p_service_area_id uuid,p_remove boolean default false)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  if p_remove is null or not exists(select 1 from public.service_areas where id=p_service_area_id and is_active and postal_code is not null) then
    raise exception 'Choose a configured active service area with a PIN' using errcode='22023'; end if;
  insert into public.professional_coverage_requests(professional_id,service_area_id,action)
    values(auth.uid(),p_service_area_id,case when p_remove then 'remove' else 'add' end) returning id into result;
  insert into public.professional_offering_events(coverage_request_id,professional_id,actor_user_id,event)
    values(result,auth.uid(),auth.uid(),'coverage_requested');
  return result;
end;
$$;
revoke all on function public.request_professional_coverage(uuid,boolean) from public, anon, authenticated;

create function public.review_professional_coverage(p_request_id uuid,p_approve boolean,p_feedback text)
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
      if not exists(select 1 from public.service_areas where id=r.service_area_id and is_active and postal_code is not null) then
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
revoke all on function public.review_professional_coverage(uuid,boolean,text) from public, anon, authenticated;

create function public.list_public_offerings(p_service_slug text default null)
returns table(offering_id uuid,revision_id uuid,professional_id uuid,display_name text,service_id uuid,
  service_slug text,service_name text,offering_type text,title text,description text,duration_minutes integer,
  price_minor bigint,currency text,total_sessions integer,sessions_per_week integer,
  package_duration_value integer,package_duration_unit text,delivery_notes text)
language sql stable security definer set search_path = '' as $$
  select o.id,r.id,o.professional_id,p.display_name,s.id,s.slug,s.name,r.offering_type,r.title,r.description,
    r.duration_minutes,r.price_minor,r.currency,r.total_sessions,r.sessions_per_week,
    r.package_duration_value,r.package_duration_unit,r.delivery_notes
  from public.professional_offerings o join public.professional_offering_revisions r on r.id=o.approved_revision_id and r.offering_id=o.id
  join public.list_public_professionals() p on p.professional_id=o.professional_id
  join public.professional_services ps on ps.professional_id=o.professional_id and ps.service_id=o.service_id
  join public.services s on s.id=o.service_id join public.service_categories c on c.id=s.category_id
  where not o.suspended and r.state='approved' and s.is_published and s.is_active and c.is_active
    and (p_service_slug is null or s.slug=p_service_slug);
$$;
revoke all on function public.list_public_offerings(text) from public, anon, authenticated;

-- Both pending migrations are approved/deployed together before 4B accepts work.
-- Never fabricate commercial terms for an unexpected pre-existing assignment.
do $$ begin
  if exists(select 1 from public.booking_assignments) then
    raise exception 'Existing assignments need an explicitly reviewed commercial-terms backfill; no data was rewritten';
  end if;
end; $$;
alter table public.booking_requests drop constraint booking_requests_status_check;
alter table public.booking_requests add constraint booking_requests_status_check check (status in
  ('pending','awaiting_customer_agreement','assignment_proposed','confirmed','in_progress','completed','cancelled','requires_rescheduling'));
alter table public.booking_assignments drop constraint booking_assignments_state_check;
alter table public.booking_assignments add constraint booking_assignments_state_check check (state in
  ('proposed','accepted','declined','in_progress','completed','cancelled','reassigned','invalidated','expired'));
alter table public.booking_assignments drop constraint booking_assignments_duration_source_check;
alter table public.booking_assignments add constraint booking_assignments_duration_source_check
  check (duration_source in ('configured','admin_approved','offering_approved'));
alter table public.booking_fulfillment_events drop constraint booking_fulfillment_events_event_check;
alter table public.booking_fulfillment_events add constraint booking_fulfillment_events_event_check
  check (event in ('booking_state','assignment_state','cancellation_request','commercial_agreement'));

alter table public.booking_assignments
  add column offering_id uuid not null references public.professional_offerings(id) on delete restrict,
  add column offering_revision_id uuid not null references public.professional_offering_revisions(id) on delete restrict,
  add column proposed_terms jsonb not null check (jsonb_typeof(proposed_terms)='object' and octet_length(proposed_terms::text)<=20000),
  add column terms_hash text not null,
  add column customer_terms_state text not null default 'pending' check (customer_terms_state in ('pending','accepted','declined')),
  add column customer_agreed_at timestamptz,
  add column customer_agreed_by uuid,
  add column agreed_terms jsonb,
  add column proposal_expires_at timestamptz not null,
  add constraint booking_assignment_agreement_state check (
    (customer_terms_state='accepted' and customer_agreed_at is not null and customer_agreed_by is not null and agreed_terms is not null and agreed_terms=proposed_terms)
    or (customer_terms_state<>'accepted' and customer_agreed_at is null and customer_agreed_by is null and agreed_terms is null)),
  add constraint booking_assignment_confirmation_needs_agreement check (
    state not in ('accepted','in_progress','completed') or customer_terms_state='accepted'),
  add constraint booking_assignment_expiry_bound check (
    isfinite(proposal_expires_at) and proposal_expires_at<=starts_at and proposal_expires_at<=created_at+interval '24 hours');
create index booking_assignment_expiry_idx on public.booking_assignments(proposal_expires_at) where state='proposed';
grant select(offering_id,offering_revision_id,customer_terms_state,proposal_expires_at)
  on public.booking_assignments to authenticated;

-- Retire the platform-duration-only proposal path: no authenticated caller can bypass offerings.
revoke all on function public.propose_booking_assignment(uuid,uuid,timestamptz,uuid,text,integer)
  from public,anon,authenticated;
revoke all on function public.booking_assignment_candidates(uuid,timestamptz,integer)
  from public,anon,authenticated;
-- Preserve the already-written response implementation as an internal core.
alter function public.respond_booking_assignment(uuid,boolean,text) set schema private;
revoke all on function private.respond_booking_assignment(uuid,boolean,text) from public,anon,authenticated;

-- Keep the original schedule and exclusion design. Duration now comes from the
-- approved trainer revision. Exact proposed time is shown for customer agreement,
-- so the original preference need not be overwritten or silently assumed accepted.
create or replace function private.assignment_proposal_issue(p_booking public.booking_requests,
  p_professional uuid,p_start timestamptz,p_duration integer,p_exclude uuid default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare issue text; finish timestamptz;
begin
  issue := private.professional_booking_issue(p_professional,p_booking.service_id,p_booking.address_snapshot->>'postal_code');
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
revoke all on function private.assignment_proposal_issue(public.booking_requests,uuid,timestamptz,integer,uuid) from public, anon, authenticated;

create function private.assignment_offering_issue(p_assignment public.booking_assignments)
returns text language plpgsql stable security definer set search_path = '' as $$
declare o public.professional_offerings; r public.professional_offering_revisions; b public.booking_requests; issue text;
begin
  select * into b from public.booking_requests where id=p_assignment.booking_id;
  issue := private.professional_booking_issue(p_assignment.professional_id,b.service_id,b.address_snapshot->>'postal_code');
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
revoke all on function private.assignment_offering_issue(public.booking_assignments) from public, anon, authenticated;

create or replace function private.guard_booking_assignment_update()
returns trigger language plpgsql set search_path = '' as $$
declare owner_id uuid;
begin
  if (new.id,new.booking_id,new.professional_id,new.starts_at,new.ends_at,new.duration_minutes,
    new.duration_source,new.professional_public_snapshot,new.proposal_actor,new.idempotency_key,
    new.request_fingerprint,new.created_at,new.offering_id,new.offering_revision_id,new.proposed_terms,
    new.terms_hash,new.proposal_expires_at) is distinct from
    (old.id,old.booking_id,old.professional_id,old.starts_at,old.ends_at,old.duration_minutes,
    old.duration_source,old.professional_public_snapshot,old.proposal_actor,old.idempotency_key,
    old.request_fingerprint,old.created_at,old.offering_id,old.offering_revision_id,old.proposed_terms,
    old.terms_hash,old.proposal_expires_at) then
    raise exception 'Assignment and quoted terms are immutable; propose a reassignment' using errcode='42501'; end if;
  if new.state is distinct from old.state and not (
    (old.state='proposed' and new.state in ('accepted','declined','cancelled','reassigned','invalidated','expired')) or
    (old.state='accepted' and new.state in ('in_progress','cancelled','reassigned','invalidated')) or
    (old.state='in_progress' and new.state in ('completed','cancelled','invalidated'))) then
    raise exception 'Unsupported assignment transition' using errcode='42501'; end if;
  if (new.customer_terms_state,new.customer_agreed_at,new.customer_agreed_by,new.agreed_terms) is distinct from
    (old.customer_terms_state,old.customer_agreed_at,old.customer_agreed_by,old.agreed_terms) then
    select customer_id into owner_id from public.booking_requests where id=new.booking_id;
    if old.customer_terms_state<>'pending' or new.customer_terms_state not in ('accepted','declined')
      or old.state<>'proposed' or owner_id is distinct from auth.uid() or not private.has_role('customer') then
      raise exception 'Only the owning customer may agree or decline a live quote' using errcode='42501'; end if;
    if new.customer_terms_state='accepted' and
      (new.customer_agreed_by is distinct from owner_id or new.customer_agreed_at is null or new.agreed_terms is distinct from new.proposed_terms) then
      raise exception 'Agreement must preserve the exact quoted terms and customer identity' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_assignment_update() from public, anon, authenticated;

create or replace function private.guard_booking_request_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id,new.customer_id,new.service_id,new.service_name,new.address_snapshot,
    new.preferred_date,new.time_window,new.customer_notes,new.idempotency_key,new.created_at) is distinct from
    (old.id,old.customer_id,old.service_id,old.service_name,old.address_snapshot,
    old.preferred_date,old.time_window,old.customer_notes,old.idempotency_key,old.created_at) then
    raise exception 'Submitted booking details are immutable' using errcode='42501'; end if;
  if new.address_id is distinct from old.address_id and new.address_id is not null then
    raise exception 'Submitted address reference cannot be replaced' using errcode='42501'; end if;
  if new.status is distinct from old.status then
    if old.status in ('cancelled','completed') then raise exception 'Terminal booking cannot be reopened' using errcode='42501'; end if;
    if new.status in ('awaiting_customer_agreement','assignment_proposed','confirmed','in_progress','completed') and not exists(
      select 1 from public.booking_assignments a where a.booking_id=new.id
      and a.state=case new.status when 'awaiting_customer_agreement' then 'proposed' when 'assignment_proposed' then 'proposed'
        when 'confirmed' then 'accepted' when 'in_progress' then 'in_progress' when 'completed' then 'completed' end
      and a.customer_terms_state=case when new.status='awaiting_customer_agreement' then 'pending' else 'accepted' end) then
      raise exception 'Booking state requires the matching assignment and customer agreement' using errcode='42501'; end if;
    if new.status in ('pending','requires_rescheduling','cancelled') and exists(select 1 from public.booking_assignments a
      where a.booking_id=new.id and a.state in ('proposed','accepted','in_progress')) then
      raise exception 'Release active assignment before changing booking state' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_request_update() from public, anon, authenticated;

create or replace function private.sync_booking_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_status text; previous text;
begin
  if tg_op='INSERT' or new.state is distinct from old.state then
    previous := case when tg_op='UPDATE' then old.state else null end;
    insert into public.booking_fulfillment_events(booking_id,assignment_id,actor_user_id,event,previous_state,new_state,reason)
      values(new.booking_id,new.id,auth.uid(),'assignment_state',previous,new.state,
        left(nullif(current_setting('app.fulfillment_reason',true),''),1000));
  end if;
  if tg_op='UPDATE' and new.customer_terms_state is distinct from old.customer_terms_state then
    insert into public.booking_fulfillment_events(booking_id,assignment_id,actor_user_id,event,previous_state,new_state,reason)
      values(new.booking_id,new.id,auth.uid(),'commercial_agreement',old.customer_terms_state,new.customer_terms_state,
        'Customer responded to immutable quote including price, package terms, and exact schedule');
  end if;
  next_status := case new.state when 'proposed' then
    case when new.customer_terms_state='accepted' then 'assignment_proposed' else 'awaiting_customer_agreement' end
    when 'accepted' then 'confirmed' when 'in_progress' then 'in_progress' when 'completed' then 'completed' else 'requires_rescheduling' end;
  update public.booking_requests set status=next_status where id=new.booking_id;
  return new;
end;
$$;
revoke all on function private.sync_booking_assignment() from public, anon, authenticated;

create function private.expire_booking_proposals()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.lock_booking_fulfillment();
  perform set_config('app.fulfillment_reason','Unanswered proposal expired; reserved interval released',true);
  update public.booking_assignments set state='expired' where state='proposed' and proposal_expires_at<=clock_timestamp();
end;
$$;
revoke all on function private.expire_booking_proposals() from public, anon, authenticated;

-- Opportunistic expiry: successful work-area refreshes and scheduling operations
-- release expired reservations. Errors roll back cleanup along with the operation.
-- No time-dependent partial index or external scheduler is assumed.
create function public.refresh_expired_booking_proposals()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (private.has_role('customer') or private.has_role('professional') or private.is_admin()) then
    raise exception 'Authenticated application account required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
end;
$$;
revoke all on function public.refresh_expired_booking_proposals() from public, anon, authenticated;

create or replace function private.invalidate_ineligible_booking_assignments()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare a public.booking_assignments; issue text;
begin
  perform private.lock_booking_fulfillment();
  for a in select * from public.booking_assignments where state in ('proposed','accepted','in_progress') order by id for update loop
    issue := private.assignment_offering_issue(a);
    if issue is not null then
      perform set_config('app.fulfillment_reason',left('Eligibility/offering revoked: '||issue,1000),true);
      update public.booking_assignments set state='invalidated' where id=a.id;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.invalidate_ineligible_booking_assignments() from public, anon, authenticated;
create trigger fulfillment_offering_approval_changed after update or delete on public.professional_offerings
for each statement execute function private.invalidate_ineligible_booking_assignments();

create function public.propose_booking_offering(p_booking_id uuid,p_offering_id uuid,p_revision_id uuid,
  p_starts_at timestamptz,p_idempotency_key uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests; o public.professional_offerings; r public.professional_offering_revisions;
  prior public.booking_assignments; current_id uuid; fingerprint text; issue text; result uuid;
  profile jsonb; terms jsonb; finish timestamptz; pref_start time; pref_end time; proposal_time timestamptz;
begin
  perform private.lock_booking_fulfillment();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
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
revoke all on function public.propose_booking_offering(uuid,uuid,uuid,timestamptz,uuid,text) from public, anon, authenticated;

create function public.respond_booking_terms(p_assignment_id uuid,p_terms_hash text,p_accept boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare a public.booking_assignments; b public.booking_requests; issue text;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
  select x.* into a from public.booking_assignments x join public.booking_requests y on y.id=x.booking_id
    where x.id=p_assignment_id and y.customer_id=auth.uid() for update of x;
  if not found then raise exception 'Proposal unavailable' using errcode='42501'; end if;
  if p_accept is null or p_terms_hash is distinct from a.terms_hash then raise exception 'Reload and review the exact quoted terms' using errcode='22023'; end if;
  if a.state='expired' then return jsonb_build_object('outcome','expired'); end if;
  if (p_accept and a.customer_terms_state='accepted') or (not p_accept and a.customer_terms_state='declined') then
    return jsonb_build_object('outcome',a.customer_terms_state,'assignment_state',a.state); end if;
  if a.state<>'proposed' or a.customer_terms_state<>'pending' then raise exception 'Proposal no longer awaiting agreement' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=a.booking_id for update;
  if b.cancellation_requested_at is not null then raise exception 'Cancellation request needs administrator review' using errcode='22023'; end if;
  issue := private.assignment_offering_issue(a);
  if issue is not null then raise exception '%',issue using errcode='22023'; end if;
  perform set_config('app.fulfillment_reason','Customer response to quoted terms and exact appointment schedule',true);
  update public.booking_assignments set customer_terms_state=case when p_accept then 'accepted' else 'declined' end,
    customer_agreed_at=case when p_accept then clock_timestamp() else null end,
    customer_agreed_by=case when p_accept then auth.uid() else null end,
    agreed_terms=case when p_accept then proposed_terms else null end,
    state=case when p_accept then 'proposed' else 'declined' end where id=a.id;
  return jsonb_build_object('outcome',case when p_accept then 'accepted' else 'declined' end);
end;
$$;
revoke all on function public.respond_booking_terms(uuid,text,boolean) from public, anon, authenticated;

create function public.respond_booking_assignment(p_assignment_id uuid,p_accept boolean,p_reason text default '')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare a public.booking_assignments; issue text;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
  select * into a from public.booking_assignments where id=p_assignment_id and professional_id=auth.uid() for update;
  if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  if a.state='expired' then return jsonb_build_object('outcome','expired'); end if;
  if p_accept is null then raise exception 'Response required' using errcode='22023'; end if;
  if p_accept and a.customer_terms_state<>'accepted' then raise exception 'Customer must first agree to price, terms and exact schedule' using errcode='22023'; end if;
  issue := private.assignment_offering_issue(a);
  if p_accept and issue is not null then raise exception '%',issue using errcode='22023'; end if;
  perform private.respond_booking_assignment(p_assignment_id,p_accept,p_reason);
  return jsonb_build_object('outcome',case when p_accept then 'accepted' else 'declined' end);
end;
$$;
revoke all on function public.respond_booking_assignment(uuid,boolean,text) from public, anon, authenticated;

create function public.customer_booking_offer(p_booking_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare a public.booking_assignments;
begin
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
  if not exists(select 1 from public.booking_requests where id=p_booking_id and customer_id=auth.uid()) then
    raise exception 'Booking unavailable' using errcode='42501'; end if;
  select * into a from public.booking_assignments where booking_id=p_booking_id order by created_at desc,id limit 1;
  if not found then return null; end if;
  return jsonb_build_object('assignment_id',a.id,'state',a.state,'terms',a.proposed_terms,'terms_hash',a.terms_hash,
    'customer_terms_state',a.customer_terms_state,'agreed_terms',a.agreed_terms,'customer_agreed_at',a.customer_agreed_at,
    'proposal_expires_at',a.proposal_expires_at,'starts_at',a.starts_at,'ends_at',a.ends_at,
    'professional',case when a.state in ('accepted','in_progress','completed') then a.professional_public_snapshot else null end);
end;
$$;
revoke all on function public.customer_booking_offer(uuid) from public, anon, authenticated;

create function public.booking_offering_candidates(p_booking_id uuid,p_starts_at timestamptz default null)
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
    case when p_starts_at is null then coalesce(private.professional_booking_issue(p.professional_id,b.service_id,b.address_snapshot->>'postal_code'),
      'Choose an exact time to check availability and conflicts')
    else private.assignment_proposal_issue(b,p.professional_id,p_starts_at,p.duration_minutes,current_id) end
    from public.list_public_offerings(null) p where p.service_id=b.service_id;
end;
$$;
revoke all on function public.booking_offering_candidates(uuid,timestamptz) from public, anon, authenticated;

create or replace function public.request_booking_cancellation(p_booking_id uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare b public.booking_requests;
begin
  perform private.lock_booking_fulfillment();
  if not private.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
  if p_reason is null or char_length(btrim(p_reason))=0 or char_length(p_reason)>1000 then
    raise exception 'Cancellation request reason required' using errcode='22023'; end if;
  select * into b from public.booking_requests where id=p_booking_id and customer_id=auth.uid() for update;
  if not found then raise exception 'Booking unavailable' using errcode='42501'; end if;
  if b.status not in ('awaiting_customer_agreement','assignment_proposed','confirmed','in_progress','requires_rescheduling') then
    raise exception 'Use pending cancellation, or contact administration for this state' using errcode='22023'; end if;
  if b.cancellation_requested_at is not null then return b.id; end if;
  update public.booking_requests set cancellation_requested_at=clock_timestamp(),cancellation_reason=p_reason where id=b.id;
  return b.id;
end;
$$;
revoke all on function public.request_booking_cancellation(uuid,text) from public, anon, authenticated;

-- Reuse the original owner-scoped schedule operations, expiring old proposals
-- before their conflict checks. Internal cores are not callable by API clients.
alter function public.save_weekly_availability(jsonb) set schema private;
revoke all on function private.save_weekly_availability(jsonb) from public,anon,authenticated;
alter function public.save_professional_time_off(timestamptz,timestamptz,text,uuid) set schema private;
revoke all on function private.save_professional_time_off(timestamptz,timestamptz,text,uuid) from public,anon,authenticated;

create function public.save_weekly_availability(p_windows jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
  perform private.save_weekly_availability(p_windows);
end;
$$;
revoke all on function public.save_weekly_availability(jsonb) from public, anon, authenticated;

create function public.save_professional_time_off(p_starts_at timestamptz,p_ends_at timestamptz,
  p_reason text default '',p_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.has_role('professional') then raise exception 'Professional required' using errcode='42501'; end if;
  perform private.expire_booking_proposals();
  return private.save_professional_time_off(p_starts_at,p_ends_at,p_reason,p_id);
end;
$$;
revoke all on function public.save_professional_time_off(timestamptz,timestamptz,text,uuid) from public, anon, authenticated;

-- Only these reviewed public entrypoints are exposed.
grant execute on function public.save_professional_offering(uuid,jsonb,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.submit_professional_offering(uuid,timestamptz) to authenticated;
grant execute on function public.review_professional_offering(uuid,boolean,text) to authenticated;
grant execute on function public.set_professional_offering_suspended(uuid,boolean,text) to authenticated;
grant execute on function public.request_professional_coverage(uuid,boolean) to authenticated;
grant execute on function public.review_professional_coverage(uuid,boolean,text) to authenticated;
grant execute on function public.list_public_offerings(text) to anon, authenticated;
grant execute on function public.refresh_expired_booking_proposals() to authenticated;
grant execute on function public.propose_booking_offering(uuid,uuid,uuid,timestamptz,uuid,text) to authenticated;
grant execute on function public.respond_booking_terms(uuid,text,boolean) to authenticated;
grant execute on function public.respond_booking_assignment(uuid,boolean,text) to authenticated;
grant execute on function public.customer_booking_offer(uuid) to authenticated;
grant execute on function public.booking_offering_candidates(uuid,timestamptz) to authenticated;
grant execute on function public.request_booking_cancellation(uuid,text) to authenticated;
grant execute on function public.save_weekly_availability(jsonb) to authenticated;
grant execute on function public.save_professional_time_off(timestamptz,timestamptz,text,uuid) to authenticated;
