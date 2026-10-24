-- Phase 4C: local proposal only. Explicit hosted deployment approval required.
-- No seeded areas/accounts, role changes, booking changes or existing migration edits.
create table public.service_area_events (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null,
  actor_user_id uuid,
  previous_details jsonb,
  new_details jsonb not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index service_area_events_history_idx on public.service_area_events(service_area_id,created_at,id);
alter table public.service_area_events enable row level security;
revoke all on public.service_area_events from public,anon,authenticated;
grant select on public.service_area_events to authenticated;
create policy service_area_audit_admin on public.service_area_events for select to authenticated using(private.is_admin());
create trigger immutable_service_area_events before update or delete on public.service_area_events
for each row execute function private.prevent_audit_mutation();

-- All application writes to areas now use the audited RPC. Existing SELECT/RLS,
-- professional area requests/associations and eligibility triggers are unchanged.
revoke insert,update,delete on public.service_areas from authenticated;

create function public.admin_coverage_overview()
returns table(id uuid,name text,postal_code text,is_active boolean,updated_at timestamptz,
  professional_count bigint,request_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return query select a.id,a.name,a.postal_code,a.is_active,a.updated_at,
    (select count(*) from public.professional_service_areas p where p.service_area_id=a.id),
    (select count(*) from public.professional_coverage_requests r where r.service_area_id=a.id)
    from public.service_areas a order by a.name,a.id;
end;
$$;
revoke all on function public.admin_coverage_overview() from public,anon,authenticated;

create function public.admin_save_service_area(p_name text,p_postal_code text,p_is_active boolean,p_reason text,
  p_id uuid default null,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare a public.service_areas; previous jsonb; result uuid;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform private.lock_booking_fulfillment();
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120
    or (p_postal_code is null and (p_id is null or p_is_active))
    or (p_postal_code is not null and p_postal_code !~ '^[1-9][0-9]{5}$') or p_is_active is null or p_reason is null
    or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Area name, six-digit supported Indian PIN, active choice and reason required' using errcode='22023'; end if;
  if p_id is null then
    insert into public.service_areas(name,postal_code,is_active) values(btrim(p_name),p_postal_code,p_is_active) returning id into result;
  else
    select * into a from public.service_areas where id=p_id for update;
    if not found then raise exception 'Service area unavailable' using errcode='22023'; end if;
    if a.updated_at is distinct from p_expected_updated_at then raise exception 'Area changed; reload before editing' using errcode='40001'; end if;
    if p_postal_code is null and a.postal_code is not null then
      raise exception 'An existing PIN cannot be cleared' using errcode='22023'; end if;
    -- A legacy NULL-PIN area may stay inactive without changing its references.
    if a.postal_code is distinct from p_postal_code and
      (exists(select 1 from public.professional_service_areas where service_area_id=a.id) or
       exists(select 1 from public.professional_coverage_requests where service_area_id=a.id)) then
      raise exception 'Referenced PIN is immutable; create a new area and explicitly review coverage instead' using errcode='22023'; end if;
    previous := jsonb_build_object('name',a.name,'postal_code',a.postal_code,'is_active',a.is_active);
    -- UUID and references are preserved. Existing eligibility hooks handle deactivation.
    update public.service_areas set name=btrim(p_name),postal_code=p_postal_code,is_active=p_is_active,
      updated_at=clock_timestamp() where id=a.id;
    result := a.id;
  end if;
  insert into public.service_area_events(service_area_id,actor_user_id,previous_details,new_details,reason)
    values(result,auth.uid(),previous,jsonb_build_object('name',btrim(p_name),'postal_code',p_postal_code,'is_active',p_is_active),p_reason);
  return result;
end;
$$;
revoke all on function public.admin_save_service_area(text,text,boolean,text,uuid,timestamptz) from public,anon,authenticated;

create function public.admin_team_lookup(p_user_id uuid)
returns table(user_id uuid,full_name text,role text,role_updated_at timestamptz,email_confirmed boolean,eligible boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return query select r.user_id,coalesce(p.full_name,''),r.role,r.updated_at,u.email_confirmed_at is not null,
    u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
    from public.user_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
    where r.user_id=p_user_id;
end;
$$;
revoke all on function public.admin_team_lookup(uuid) from public,anon,authenticated;

-- Existing protection counts all admin rows. This additive guard also prevents
-- removing the final eligible admin when other admin accounts are banned/deleted/unconfirmed.
-- A trigger ensures the original change_user_role path cannot bypass this guard.
create function private.guard_last_eligible_administrator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role='admin' and (tg_op='DELETE' or new.role<>'admin') then
    perform private.lock_administrator_roles();
    if not exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id
      where r.role='admin' and r.user_id<>old.user_id and u.email_confirmed_at is not null
        and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
      raise exception 'Cannot remove the last eligible administrator' using errcode='23514'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_last_eligible_administrator() from public,anon,authenticated;
create trigger guard_last_eligible_administrator before update or delete on public.user_roles
for each row execute function private.guard_last_eligible_administrator();

-- Auth eligibility gains AND losses share the role-mutation lock. Even a
-- customer's confirmation/ban change must serialize with concurrent promotion.
-- Unchanged fields (e.g. ordinary Auth session updates) need no extra lock.
-- Keep the original soft-delete guard and role/cascade guards in force.
create function private.guard_administrator_eligibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not distinct from old.email_confirmed_at
    and new.deleted_at is not distinct from old.deleted_at
    and new.banned_until is not distinct from old.banned_until then
    return new;
  end if;
  -- READ COMMITTED is enforced by this helper. The eligibility query below
  -- runs after serialization, with a fresh snapshot, not a pre-lock count.
  perform private.lock_administrator_roles();
  if old.email_confirmed_at is not null and old.deleted_at is null
    and (old.banned_until is null or old.banned_until<=now())
    and (new.email_confirmed_at is null or new.deleted_at is not null
      or (new.banned_until is not null and new.banned_until>now()))
    and exists(select 1 from public.user_roles where user_id=old.id and role='admin') then
    if not exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id
      where r.role='admin' and r.user_id<>old.id and u.email_confirmed_at is not null
        and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
      raise exception 'Cannot remove the last eligible administrator' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_administrator_eligibility() from public,anon,authenticated;
create trigger guard_administrator_eligibility
before update of banned_until,deleted_at,email_confirmed_at on auth.users
for each row execute function private.guard_administrator_eligibility();

create function public.admin_change_team_role(p_user_id uuid,p_expected_role text,p_expected_updated_at timestamptz,
  p_make_admin boolean,p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare target_role public.user_roles;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() or p_user_id=auth.uid() then
    raise exception 'Administrator required; self role changes are forbidden' using errcode='42501'; end if;
  if p_make_admin is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Explicit decision and reason required' using errcode='22023'; end if;
  select * into target_role from public.user_roles where user_id=p_user_id for update;
  if not found then raise exception 'Existing application account required' using errcode='22023'; end if;
  if target_role.role is distinct from p_expected_role or target_role.updated_at is distinct from p_expected_updated_at then
    raise exception 'Role changed; repeat exact account lookup before deciding' using errcode='40001'; end if;
  if p_make_admin then
    if target_role.role='admin' then raise exception 'Account is already an administrator' using errcode='22023'; end if;
    if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null
      and deleted_at is null and (banned_until is null or banned_until<=now())) then
      raise exception 'Confirmed eligible account required' using errcode='22023'; end if;
  elsif target_role.role<>'admin' then raise exception 'Only administrator access can be revoked here' using errcode='22023';
  end if;
  -- Never updates roles directly or grants professional privileges; existing
  -- role/audit/revocation hooks and self/last-admin protections remain in force.
  perform public.change_user_role(p_user_id,case when p_make_admin then 'admin' else 'customer' end,p_reason);
  return p_user_id;
end;
$$;
revoke all on function public.admin_change_team_role(uuid,text,timestamptz,boolean,text) from public,anon,authenticated;

create function public.customer_booking_timeline(p_booking_id uuid)
returns table(event_id uuid,event_key text,occurred_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role('customer') or not exists(select 1 from public.booking_requests
    where id=p_booking_id and customer_id=auth.uid()) then
    raise exception 'Own customer booking required' using errcode='42501'; end if;
  return query
    select x.id,x.key,x.at from (
      select b.id,'submitted'::text as key,b.created_at as at from public.booking_requests b where b.id=p_booking_id
      union all
      select e.id,case
        when e.event='commercial_agreement' then case e.new_state when 'accepted' then 'terms_accepted' else 'terms_declined' end
        when e.event='booking_state' then 'cancelled'
        when e.event='cancellation_request' then case e.new_state when 'requested' then 'cancellation_requested' else 'cancellation_not_approved' end
        else case e.new_state when 'proposed' then 'proposal_received' when 'accepted' then 'professional_accepted'
          when 'in_progress' then 'started' when 'completed' then 'completed' when 'declined' then 'professional_declined'
          when 'reassigned' then 'reassigned' when 'invalidated' then 'requires_rescheduling' when 'expired' then 'proposal_expired' end
        end,e.created_at
      from public.booking_fulfillment_events e where e.booking_id=p_booking_id and (
        (e.event='commercial_agreement' and e.new_state in ('accepted','declined')) or
        (e.event='booking_state' and e.new_state='cancelled') or
        (e.event='cancellation_request' and e.new_state in ('requested','declined')) or
        (e.event='assignment_state' and e.new_state in ('proposed','accepted','in_progress','completed','declined','reassigned','invalidated','expired')
          and not (e.new_state='declined' and exists(select 1 from public.booking_fulfillment_events d
            where d.assignment_id=e.assignment_id and d.event='commercial_agreement' and d.new_state='declined'))))
    ) x order by x.at,x.id;
end;
$$;
revoke all on function public.customer_booking_timeline(uuid) from public,anon,authenticated;

grant execute on function public.admin_coverage_overview(),
  public.admin_save_service_area(text,text,boolean,text,uuid,timestamptz),public.admin_team_lookup(uuid),
  public.admin_change_team_role(uuid,text,timestamptz,boolean,text),public.customer_booking_timeline(uuid) to authenticated;

create function public.admin_coverage_history()
returns table(id uuid,service_area_id uuid,actor_user_id uuid,previous_details jsonb,new_details jsonb,reason text,created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return query select e.id,e.service_area_id,e.actor_user_id,e.previous_details,e.new_details,e.reason,e.created_at
    from public.service_area_events e order by e.created_at desc,e.id limit 30;
end;
$$;
revoke all on function public.admin_coverage_history() from public,anon,authenticated;
grant execute on function public.admin_coverage_history() to authenticated;
