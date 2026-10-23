-- Phase 4A only. Additive; do not apply to hosted Supabase without approval.
-- No assignment, appointment confirmation, availability, or payments.

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) >= 1 and char_length(label) <= 40),
  recipient_name text not null check (char_length(btrim(recipient_name)) >= 1 and char_length(recipient_name) <= 120),
  phone text not null check (phone ~ '^(\+91)?[6-9][0-9]{9}$'),
  address_line_1 text not null check (char_length(btrim(address_line_1)) >= 1 and char_length(address_line_1) <= 200),
  address_line_2 text not null default '' check (char_length(address_line_2) <= 200),
  locality text not null check (char_length(btrim(locality)) >= 1 and char_length(locality) <= 120),
  city text not null check (char_length(btrim(city)) >= 1 and char_length(city) <= 100),
  state text not null check (char_length(btrim(state)) >= 1 and char_length(state) <= 100),
  postal_code text not null check (postal_code ~ '^[1-9][0-9]{5}$'),
  landmark text not null default '' check (char_length(landmark) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_owner_idx on public.customer_addresses(customer_id, created_at desc);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null check (char_length(btrim(service_name)) between 1 and 120),
  address_id uuid references public.customer_addresses(id) on delete set null,
  -- Built only by submit_booking_request from a locked, customer-owned address.
  -- Includes saved_address_id so idempotent retries survive address deletion.
  address_snapshot jsonb not null check (
    jsonb_typeof(address_snapshot) = 'object' and octet_length(address_snapshot::text) <= 12000
  ),
  preferred_date date not null,
  time_window text not null check (time_window in ('morning', 'afternoon', 'evening')),
  customer_notes text not null default '' check (char_length(customer_notes) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'cancelled')),
  idempotency_key uuid not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  constraint booking_cancellation_state check (
    (status = 'pending' and cancelled_at is null) or
    (status = 'cancelled' and cancelled_at is not null)
  )
);
create index booking_requests_customer_history_idx on public.booking_requests(customer_id, created_at desc, id);
create index booking_requests_pending_queue_idx on public.booking_requests(created_at, id) where status = 'pending';
create index booking_requests_service_idx on public.booking_requests(service_id);
create index booking_requests_address_idx on public.booking_requests(address_id);

alter table public.customer_addresses enable row level security;
alter table public.booking_requests enable row level security;
revoke all on public.customer_addresses, public.booking_requests from public, anon, authenticated;

-- Owner and generated identity/timestamp fields are never client-writable.
grant select, delete on public.customer_addresses to authenticated;
grant insert(label, recipient_name, phone, address_line_1, address_line_2, locality,
  city, state, postal_code, landmark) on public.customer_addresses to authenticated;
grant update(label, recipient_name, phone, address_line_1, address_line_2, locality,
  city, state, postal_code, landmark) on public.customer_addresses to authenticated;
grant select on public.booking_requests to authenticated;

create policy customer_address_read on public.customer_addresses for select to authenticated
using (customer_id = (select auth.uid()) and private.has_role('customer'));
create policy customer_address_insert on public.customer_addresses for insert to authenticated
with check (customer_id = (select auth.uid()) and private.has_role('customer'));
create policy customer_address_update on public.customer_addresses for update to authenticated
using (customer_id = (select auth.uid()) and private.has_role('customer'))
with check (customer_id = (select auth.uid()) and private.has_role('customer'));
create policy customer_address_delete on public.customer_addresses for delete to authenticated
using (customer_id = (select auth.uid()) and private.has_role('customer'));
create policy customer_booking_read on public.booking_requests for select to authenticated
using (customer_id = (select auth.uid()) and private.has_role('customer'));

create trigger customer_addresses_updated_at before update on public.customer_addresses
for each row execute function private.touch_updated_at();
create trigger booking_requests_updated_at before update on public.booking_requests
for each row execute function private.touch_updated_at();

-- A single operational source for the UI and submission validation.
-- These are preferences, not available slots or reserved appointments.
create function public.booking_request_options()
returns table(window_key text, label text, start_time time, end_time time, booking_horizon_days integer)
language sql immutable set search_path = '' as $$
  select w.window_key, w.label, w.start_time, w.end_time, 60
  from (values
    ('morning', 'Morning (9 am to noon)', time '09:00', time '12:00'),
    ('afternoon', 'Afternoon (noon to 3 pm)', time '12:00', time '15:00'),
    ('evening', 'Evening (3 pm to 6 pm)', time '15:00', time '18:00')
  ) as w(window_key, label, start_time, end_time);
$$;
revoke all on function public.booking_request_options() from public, anon, authenticated;
grant execute on function public.booking_request_options() to authenticated;

-- Protect immutable request facts even from accidental future update grants.
-- The saved-address FK may become NULL after deletion; its snapshot never changes.
create function private.guard_booking_request_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id, new.customer_id, new.service_id, new.service_name, new.address_snapshot,
      new.preferred_date, new.time_window, new.customer_notes, new.idempotency_key, new.created_at)
     is distinct from
     (old.id, old.customer_id, old.service_id, old.service_name, old.address_snapshot,
      old.preferred_date, old.time_window, old.customer_notes, old.idempotency_key, old.created_at) then
    raise exception 'Submitted booking details are immutable' using errcode = '42501';
  end if;
  if new.address_id is distinct from old.address_id and new.address_id is not null then
    raise exception 'Submitted address reference cannot be replaced' using errcode = '42501';
  end if;
  if (new.status, new.cancelled_at) is distinct from (old.status, old.cancelled_at)
     and not (old.status = 'pending' and new.status = 'cancelled' and new.cancelled_at is not null) then
    raise exception 'Unsupported booking status transition' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_request_update() from public, anon, authenticated;
create trigger guard_booking_request_update before update on public.booking_requests
for each row execute function private.guard_booking_request_update();

create function public.submit_booking_request(
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
revoke all on function public.submit_booking_request(uuid, uuid, date, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.submit_booking_request(uuid, uuid, date, text, uuid, text)
to authenticated;

create function public.cancel_pending_booking_request(p_booking_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
  if actor is null or not private.has_role('customer') then
    raise exception 'Authenticated customer required' using errcode = '42501';
  end if;
  -- The conditional UPDATE locks/rechecks the row and cannot overwrite a
  -- concurrent transition. No client-supplied status or owner is accepted.
  update public.booking_requests b
  set status = 'cancelled', cancelled_at = clock_timestamp()
  where b.id = p_booking_id and b.customer_id = actor and b.status = 'pending'
  returning b.id into result;
  if not found then
    raise exception 'Pending request unavailable or no longer cancellable' using errcode = '42501';
  end if;
  return result;
end;
$$;
revoke all on function public.cancel_pending_booking_request(uuid) from public, anon, authenticated;
grant execute on function public.cancel_pending_booking_request(uuid) to authenticated;

-- No admin/professional read or mutation policies are added in Phase 4A.
-- Phase 4B must add its own reviewed grants/transitions and update the status
-- constraint/guard together. Service-area eligibility remains pending review.
