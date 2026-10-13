-- Private helpers are NOT Data API endpoints. Fixed search paths prevent
-- attacker-controlled object resolution; no editable JWT role is consulted.
create function private.has_role(required_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r join auth.users u on u.id = r.user_id
    where r.user_id = (select auth.uid()) and r.role = required_role
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  );
$$;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('admin');
$$;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Every role mutation shares this lock, including trusted SQL and cascaded
-- deletion. The advisory lock protects an empty admin set (first bootstrap).
-- Deterministic row locks follow serialization; counts are rechecked afterwards.
create function private.lock_administrator_roles()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Role mutations require READ COMMITTED isolation' using errcode = '25000';
  end if;
  perform pg_advisory_xact_lock(31032026);
  perform r.user_id from public.user_roles r where r.role = 'admin' order by r.user_id for update;
end;
$$;

create function private.guard_role_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Ordinary signup inserts cannot remove an administrator. Keep that path
  -- minimal and avoid serializing every registration against admin reviews.
  if tg_op = 'INSERT' and new.role = 'customer' then return new; end if;
  perform private.lock_administrator_roles();
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Role identity is immutable' using errcode = '23514';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'admin' then
    if tg_op = 'DELETE' or new.role <> 'admin' then
      if (select count(*) from public.user_roles where role = 'admin') <= 1 then
        raise exception 'Cannot remove the last administrator' using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_role_mutation before insert or update or delete on public.user_roles
for each row execute function private.guard_role_mutation();

-- Also reject soft deletion of the last administrator. Hard deletes cascade
-- into user_roles and are checked by the role trigger above.
create function private.guard_admin_soft_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    perform private.lock_administrator_roles();
    if exists(select 1 from public.user_roles where user_id = old.id and role = 'admin')
       and (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last administrator' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_admin_soft_delete before update of deleted_at on auth.users
for each row execute function private.guard_admin_soft_delete();

create function private.record_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare previous text; next_state text; target uuid;
begin
  if tg_op = 'INSERT' then
    if new.role = 'customer' then return new; end if;
    previous := null; next_state := new.role; target := new.user_id;
  elsif tg_op = 'DELETE' then
    previous := old.role; next_state := 'deleted'; target := old.user_id;
  else
    if old.role = new.role then return new; end if;
    previous := old.role; next_state := new.role; target := new.user_id;
  end if;
  insert into public.administrative_audit(target_user_id, actor_user_id, action, previous_state, new_state, reason)
  values (target, auth.uid(), 'role_change', previous, next_state,
          nullif(current_setting('app.role_change_reason', true), ''));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger record_role_change after insert or update or delete on public.user_roles
for each row execute function private.record_role_change();

create function private.prevent_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Administrative audit is append-only' using errcode = '42501';
end;
$$;
create trigger immutable_audit before update or delete on public.administrative_audit
for each row execute function private.prevent_audit_mutation();

create function private.record_verification_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare previous text; next_state text; target uuid;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then return new; end if;
    previous := null; next_state := new.status; target := new.professional_id;
  elsif tg_op = 'DELETE' then
    previous := old.status; next_state := 'deleted'; target := old.professional_id;
  else
    if (new.status, new.reviewed_by, new.reviewed_at, new.internal_notes) is not distinct from
       (old.status, old.reviewed_by, old.reviewed_at, old.internal_notes) then return new; end if;
    previous := old.status; next_state := new.status; target := new.professional_id;
  end if;
  insert into public.administrative_audit(target_user_id, actor_user_id, action, previous_state, new_state, reason)
  values (target, auth.uid(), 'verification_change', previous, next_state,
          nullif(current_setting('app.verification_change_reason', true), ''));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger record_verification_change after insert or update or delete on public.professional_verifications
for each row execute function private.record_verification_change();

create function private.ensure_customer_role(target_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.user_roles(user_id, role) values (target_user, 'customer')
  on conflict (user_id) do nothing;
$$;
create function private.initialize_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Security-critical; do not catch failures. No profile or metadata processing.
  perform private.ensure_customer_role(new.id);
  return new;
end;
$$;
create trigger initialize_application_role after insert on auth.users
for each row execute function private.initialize_auth_user();
-- Idempotent default assignment for genuine existing accounts only.
insert into public.user_roles(user_id, role)
select id, 'customer' from auth.users on conflict (user_id) do nothing;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'user_roles', 'professional_profiles',
    'professional_verifications', 'service_categories', 'services', 'service_areas'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
  end loop;
end;
$$;

create function public.ensure_own_profile(new_full_name text default '')
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare result public.profiles;
begin
  if auth.uid() is null or not (private.has_role('customer') or private.has_role('professional') or private.is_admin()) then
    raise exception 'Authenticated application account required' using errcode = '42501';
  end if;
  -- Optional enrichment happens independently of signup. A failed call can be
  -- retried; it cannot undo an already registered Auth account/default role.
  insert into public.profiles(id, full_name) values (auth.uid(), coalesce(new_full_name, ''))
  on conflict (id) do nothing;
  select * into strict result from public.profiles where id = auth.uid();
  return result;
end;
$$;

create function public.change_user_role(target_user uuid, new_role text, reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare previous_role text;
begin
  -- Lock BEFORE checking authority to see committed concurrent revocations.
  perform private.lock_administrator_roles();
  if not private.is_admin() or target_user = auth.uid() then
    raise exception 'Administrator required; self role changes are forbidden' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('customer', 'professional', 'admin')
     or char_length(reason) > 4000 then
    raise exception 'Invalid role change' using errcode = '22023';
  end if;
  select role into previous_role from public.user_roles where user_id = target_user for update;
  if previous_role is null then raise exception 'Application account not found' using errcode = 'P0002'; end if;
  if previous_role = new_role then return; end if;
  perform set_config('app.role_change_reason', coalesce(reason, ''), true);
  update public.user_roles set role = new_role where user_id = target_user;
  if new_role = 'professional' then
    insert into public.professional_profiles(user_id) values(target_user) on conflict (user_id) do nothing;
    insert into public.professional_verifications(professional_id) values(target_user) on conflict (professional_id) do nothing;
  end if;
  -- Re-promotion cannot resurrect an old verification/publication decision.
  update public.professional_profiles set public_visible = false where user_id = target_user;
  perform set_config('app.verification_change_reason', 'Role changed; fresh professional review required', true);
  update public.professional_verifications set status = 'pending', reviewed_at = null,
    reviewed_by = null, internal_notes = '' where professional_id = target_user;
  -- Promotion, professional records, reset, and role audit all commit together.
end;
$$;

create function public.review_professional(target_user uuid, new_status text,
  make_public boolean, new_internal_notes text default '',
  new_image_reference text default null, reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare previous_status text; previous_public boolean; previous_image text;
begin
  -- Same lock serializes review with role changes, including actor demotion.
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if new_status is null or new_status not in ('pending', 'verified', 'rejected', 'suspended')
     or make_public is null or char_length(new_internal_notes) > 4000 or char_length(reason) > 4000 then
    raise exception 'Invalid professional review' using errcode = '22023';
  end if;
  if not exists(select 1 from public.user_roles where user_id = target_user and role = 'professional') then
    raise exception 'Professional role required' using errcode = '22023';
  end if;
  select status into previous_status from public.professional_verifications
  where professional_id = target_user for update;
  if previous_status is null then raise exception 'Verification record not found' using errcode = 'P0002'; end if;
  select public_visible, approved_image_reference into previous_public, previous_image
  from public.professional_profiles where user_id = target_user for update;
  perform set_config('app.verification_change_reason', coalesce(reason, ''), true);
  update public.professional_verifications set status = new_status, reviewed_by = auth.uid(),
    reviewed_at = now(), internal_notes = coalesce(new_internal_notes, '') where professional_id = target_user;
  update public.professional_profiles set public_visible = make_public,
    approved_image_reference = new_image_reference where user_id = target_user;
  if previous_public is distinct from make_public or previous_image is distinct from new_image_reference then
    insert into public.administrative_audit(target_user_id, actor_user_id, action, previous_state, new_state, reason)
    values (target_user, auth.uid(), 'publication_change', previous_public::text, make_public::text, reason);
  end if;
end;
$$;

create function public.own_professional_verification()
returns table(status text, reviewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.status, v.reviewed_at from public.professional_verifications v
  where v.professional_id = auth.uid() and private.has_role('professional');
$$;

-- SINGLE authoritative public eligibility rule and ONLY public professional
-- read path. No public view and no public SELECT policy on underlying tables.
-- No input parameters, dynamic SQL, private phones, notes, or document paths.
create function public.list_public_professionals()
returns table(professional_id uuid, display_name text, biography text,
  qualifications_description text, experience_description text, approved_image_reference text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.display_name, p.biography, p.qualifications_description,
         p.experience_description, p.approved_image_reference
  from public.professional_profiles p
  join public.professional_verifications v on v.professional_id = p.user_id
  join public.user_roles r on r.user_id = p.user_id
  join auth.users u on u.id = p.user_id
  where r.role = 'professional' and v.status = 'verified' and p.public_visible
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  order by p.display_name, p.user_id;
$$;

-- Approved content is locked against professional edits. In 3B an admin first
-- moves verification back to pending, then the professional can submit edits.
create function private.can_edit_own_professional_profile()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('professional') and exists (
    select 1 from public.professional_verifications
    where professional_id = auth.uid() and status in ('pending', 'rejected')
  );
$$;

grant usage on schema private to authenticated;
revoke all on function private.has_role(text), private.is_admin(),
  private.touch_updated_at(), private.lock_administrator_roles(), private.guard_role_mutation(),
  private.guard_admin_soft_delete(), private.record_role_change(), private.prevent_audit_mutation(), private.record_verification_change(),
  private.ensure_customer_role(uuid), private.initialize_auth_user(), private.can_edit_own_professional_profile()
from public, anon, authenticated;
grant execute on function private.has_role(text), private.is_admin(), private.can_edit_own_professional_profile() to authenticated;

revoke all on function public.ensure_own_profile(text), public.change_user_role(uuid, text, text),
  public.review_professional(uuid, text, boolean, text, text, text),
  public.own_professional_verification(), public.list_public_professionals()
from public, anon, authenticated;
grant execute on function public.ensure_own_profile(text), public.change_user_role(uuid, text, text),
  public.review_professional(uuid, text, boolean, text, text, text), public.own_professional_verification()
to authenticated;
grant execute on function public.list_public_professionals() to anon, authenticated;

-- Anonymous users retain NO privileges on any of these four tables.
grant select on public.profiles, public.user_roles, public.professional_profiles,
  public.professional_verifications, public.administrative_audit to authenticated;
grant update(full_name, phone) on public.profiles to authenticated;
grant update(display_name, biography, qualifications_description, experience_description)
  on public.professional_profiles to authenticated;
create policy own_profile_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_admin());
create policy own_profile_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and (private.has_role('customer') or private.has_role('professional') or private.is_admin()))
with check (id = (select auth.uid()));
create policy own_role_read on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin());
create policy own_professional_read on public.professional_profiles for select to authenticated
using ((user_id = (select auth.uid()) and private.has_role('professional')) or private.is_admin());
create policy own_professional_update on public.professional_profiles for update to authenticated
using (user_id = (select auth.uid()) and private.can_edit_own_professional_profile())
with check (user_id = (select auth.uid()));
create policy admin_professional_update on public.professional_profiles for update to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy admin_verification_read on public.professional_verifications for select to authenticated
using (private.is_admin());
create policy admin_audit_read on public.administrative_audit for select to authenticated
using (private.is_admin());

grant select on public.service_categories, public.services, public.service_areas to anon, authenticated;
grant select, insert, update, delete on public.professional_services, public.professional_service_areas to authenticated;
grant insert, update, delete on public.service_categories, public.services, public.service_areas to authenticated;
create policy active_categories_read on public.service_categories for select to anon, authenticated using (is_active);
create policy published_services_read on public.services for select to anon, authenticated
using (is_active and is_published and exists(select 1 from public.service_categories c where c.id = category_id and c.is_active));
create policy active_areas_read on public.service_areas for select to anon, authenticated using (is_active);
create policy own_service_assignments on public.professional_services for select to authenticated
using (professional_id = (select auth.uid()) and private.has_role('professional'));
create policy own_area_assignments on public.professional_service_areas for select to authenticated
using (professional_id = (select auth.uid()) and private.has_role('professional'));
do $$
declare table_name text;
begin
  foreach table_name in array array['service_categories', 'services', 'service_areas'] loop
    execute format('create policy admin_manage on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', table_name);
  end loop;
end;
$$;

create policy admin_manage on public.professional_services for all to authenticated
using (private.is_admin()) with check (private.is_admin() and approved_by = (select auth.uid()));
create policy admin_manage on public.professional_service_areas for all to authenticated
using (private.is_admin()) with check (private.is_admin() and approved_by = (select auth.uid()));
