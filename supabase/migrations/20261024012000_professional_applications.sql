-- Professional onboarding only. Prepared locally; explicit deployment approval required.
-- Existing roles, professional profiles/verification and professional-documents are reused unchanged.

create table public.professional_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references auth.users(id) on delete cascade,
  state text not null default 'draft' check (state in ('draft','submitted','approved','rejected')),
  full_name text not null default '' check (char_length(full_name)<=120),
  phone text not null default '' check (phone='' or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  category_id uuid references public.service_categories(id) on delete restrict,
  qualifications text not null default '' check (char_length(qualifications)<=3000),
  years_experience numeric(4,1) check (years_experience between 0 and 80),
  biography text not null default '' check (char_length(biography)<=3000),
  specializations text not null default '' check (char_length(specializations)<=1500),
  service_locations text not null default '' check (char_length(service_locations)<=1000),
  postal_codes text[] not null default '{}' check (
    cardinality(postal_codes)<=20 and array_position(postal_codes,null) is null and
    (cardinality(postal_codes)=0 or array_to_string(postal_codes,',') ~ '^[1-9][0-9]{5}(,[1-9][0-9]{5}){0,19}$')),
  -- Written only by submit: object paths, never public/signed URLs or file contents.
  document_paths text[] not null default '{}',
  consented_at timestamptz,
  submitted_at timestamptz,
  feedback text not null default '' check (char_length(feedback)<=1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state not in ('submitted','approved','rejected') or
    (char_length(btrim(full_name))>0 and phone<>'' and category_id is not null and
     char_length(btrim(qualifications))>0 and years_experience is not null and
     char_length(btrim(biography))>0 and char_length(btrim(service_locations))>0 and
     cardinality(postal_codes)>0 and cardinality(document_paths)>0 and
     consented_at is not null and submitted_at is not null)),
  check (state not in ('approved','rejected') or (reviewed_by is not null and reviewed_at is not null))
);
create index professional_applications_review_idx on public.professional_applications(state,submitted_at,id);

create table public.professional_application_events (
  id uuid primary key default gen_random_uuid(),
  -- Retain audit identity/snapshots after account deletion, without cascading audit mutation.
  application_id uuid not null,
  applicant_id uuid not null,
  actor_user_id uuid,
  event text not null check (event in ('draft_saved','submitted','approved','rejected')),
  feedback text not null default '' check (char_length(feedback)<=1000),
  -- Submission snapshot preserves exactly which application/documents were reviewed.
  submission_snapshot jsonb check (submission_snapshot is null or
    (jsonb_typeof(submission_snapshot)='object' and octet_length(submission_snapshot::text)<=40000)),
  created_at timestamptz not null default now()
);
create index professional_application_events_history_idx on public.professional_application_events(application_id,created_at,id);
create index professional_application_events_owner_idx on public.professional_application_events(applicant_id,created_at);
create trigger immutable_professional_application_events before update or delete on public.professional_application_events
for each row execute function private.prevent_audit_mutation();

alter table public.professional_applications enable row level security;
alter table public.professional_application_events enable row level security;
revoke all on public.professional_applications,public.professional_application_events from public,anon,authenticated;
grant select on public.professional_applications,public.professional_application_events to authenticated;
create policy application_owner_admin_read on public.professional_applications for select to authenticated
using (private.is_admin() or (applicant_id=auth.uid() and
  (private.has_role('customer') or private.has_role('professional'))));
create policy application_event_owner_admin_read on public.professional_application_events for select to authenticated
using (private.is_admin() or (applicant_id=auth.uid() and
  (private.has_role('customer') or private.has_role('professional'))));
-- No direct client INSERT/UPDATE/DELETE grants or policies; no public applicant listing.

create function public.save_professional_application(p_details jsonb,p_application_id uuid default null,
  p_expected_updated_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare a public.professional_applications; details record;
begin
  -- Reuse the existing role lock: submission, document metadata writes and approval
  -- serialize with role changes. Approval then follows the existing role -> fulfillment lock order.
  perform private.lock_administrator_roles();
  if not private.has_role('customer') or not exists(select 1 from auth.users
    where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Confirmed customer account required to apply' using errcode='42501'; end if;
  if p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>20000 then
    raise exception 'Invalid application details' using errcode='22023'; end if;
  select * into details from jsonb_to_record(p_details) as d(full_name text,phone text,category_id uuid,
    qualifications text,years_experience numeric,biography text,specializations text,
    service_locations text,postal_codes text[]);
  if details.category_id is not null and not exists(select 1 from public.service_categories
    where id=details.category_id and is_active) then
    raise exception 'Choose an active Aara category' using errcode='22023'; end if;
  if details.years_experience is not null and
    (details.years_experience<>round(details.years_experience,1) or details.years_experience not between 0 and 80) then
    raise exception 'Experience must be between zero and 80 years, with at most one decimal place' using errcode='22023'; end if;
  if p_application_id is null then
    if exists(select 1 from public.professional_applications where applicant_id=auth.uid()) then
      raise exception 'An application already exists; reload and continue it' using errcode='22023'; end if;
    insert into public.professional_applications(applicant_id) values(auth.uid()) returning * into a;
  else
    select * into a from public.professional_applications where id=p_application_id and applicant_id=auth.uid() for update;
    if not found or a.state not in ('draft','rejected') then
      raise exception 'Only your draft or changes-required application can be edited' using errcode='42501'; end if;
    if a.updated_at is distinct from p_expected_updated_at then
      raise exception 'Application changed; reload before saving' using errcode='40001'; end if;
  end if;
  update public.professional_applications set full_name=btrim(coalesce(details.full_name,'')),
    phone=btrim(coalesce(details.phone,'')),category_id=details.category_id,
    qualifications=btrim(coalesce(details.qualifications,'')),years_experience=details.years_experience,
    biography=btrim(coalesce(details.biography,'')),specializations=btrim(coalesce(details.specializations,'')),
    service_locations=btrim(coalesce(details.service_locations,'')),postal_codes=coalesce(details.postal_codes,'{}'::text[]),
    state='draft',updated_at=clock_timestamp() where id=a.id;
  insert into public.professional_application_events(application_id,applicant_id,actor_user_id,event)
    values(a.id,auth.uid(),auth.uid(),'draft_saved');
  return a.id;
end;
$$;
revoke all on function public.save_professional_application(jsonb,uuid,timestamptz) from public,anon,authenticated;

-- A separate private bucket keeps all existing professional-document policies intact.
-- UUID paths: <owner UUID>/<application UUID>/<random v4 UUID>.<supported extension>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('professional-applications','professional-applications',false,10485760,
  array['application/pdf','image/jpeg','image/png']);

create function private.can_read_application_document(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.professional_applications a
    where split_part(p_name,'/',1)=a.applicant_id::text and split_part(p_name,'/',2)=a.id::text
    and (private.is_admin() or (a.applicant_id=auth.uid() and
      (private.has_role('customer') or private.has_role('professional')))));
$$;
revoke all on function private.can_read_application_document(text) from public,anon,authenticated;

create function private.can_upload_application_document(p_name text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare a public.professional_applications;
begin
  perform private.lock_administrator_roles();
  if not private.has_role('customer') or not exists(select 1 from auth.users
    where id=auth.uid() and email_confirmed_at is not null) then return false; end if;
  select * into a from public.professional_applications where applicant_id=auth.uid()
    and id::text=split_part(p_name,'/',2) and state in ('draft','rejected');
  if not found then return false; end if;
  if p_name !~ ('^'||auth.uid()::text||'/'||a.id::text||
    '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$') then return false; end if;
  return (select count(*)<20 from storage.objects where bucket_id='professional-applications'
    and split_part(name,'/',1)=auth.uid()::text and split_part(name,'/',2)=a.id::text);
end;
$$;
revoke all on function private.can_upload_application_document(text) from public,anon,authenticated;
-- Policy predicates must be callable by authenticated; private remains outside Data API schemas.
grant execute on function private.can_read_application_document(text),private.can_upload_application_document(text) to authenticated;
create policy applicant_documents_read on storage.objects for select to authenticated
using(bucket_id='professional-applications' and private.can_read_application_document(name));
create policy applicant_documents_upload on storage.objects for insert to authenticated
with check(bucket_id='professional-applications' and private.can_upload_application_document(name));
-- No UPDATE/DELETE policies: credentials are immutable and retained for review history.
-- Corrections use a new UUID-named upload (up to 20 files), not replacement or upsert.

create function public.submit_professional_application(p_application_id uuid,
  p_expected_updated_at timestamptz,p_consent boolean)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare a public.professional_applications; documents text[];
begin
  perform private.lock_administrator_roles();
  if not private.has_role('customer') or not exists(select 1 from auth.users
    where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Confirmed customer account required to submit' using errcode='42501'; end if;
  select * into a from public.professional_applications where id=p_application_id and applicant_id=auth.uid() for update;
  if not found then raise exception 'Application unavailable' using errcode='42501'; end if;
  if a.state='submitted' then return a.id; end if;
  if a.state not in ('draft','rejected') or a.updated_at is distinct from p_expected_updated_at then
    raise exception 'Application changed or cannot be submitted; reload' using errcode='40001'; end if;
  if p_consent is distinct from true then raise exception 'Explicit application review consent required' using errcode='22023'; end if;
  if char_length(btrim(a.full_name))=0 or a.phone='' or a.category_id is null or
    char_length(btrim(a.qualifications))=0 or a.years_experience is null or
    char_length(btrim(a.biography))=0 or char_length(btrim(a.service_locations))=0 or cardinality(a.postal_codes)=0 then
    raise exception 'Complete your name, phone, category, qualifications, experience, biography and service locations/PINs' using errcode='22023'; end if;
  if not exists(select 1 from public.service_categories where id=a.category_id and is_active) then
    raise exception 'Choose an active Aara category' using errcode='22023'; end if;
  select array_agg(name order by name) into documents from storage.objects
    where bucket_id='professional-applications' and split_part(name,'/',1)=a.applicant_id::text and split_part(name,'/',2)=a.id::text;
  if coalesce(cardinality(documents),0)=0 then raise exception 'Upload at least one supporting credential first' using errcode='22023'; end if;
  update public.professional_applications set state='submitted',document_paths=documents,
    consented_at=clock_timestamp(),submitted_at=clock_timestamp(),feedback='',reviewed_by=null,
    reviewed_at=null,updated_at=clock_timestamp() where id=a.id returning * into a;
  insert into public.professional_application_events(application_id,applicant_id,actor_user_id,event,submission_snapshot)
    values(a.id,a.applicant_id,auth.uid(),'submitted',to_jsonb(a));
  return a.id;
end;
$$;
revoke all on function public.submit_professional_application(uuid,timestamptz,boolean) from public,anon,authenticated;

create function public.review_professional_application(p_application_id uuid,p_expected_updated_at timestamptz,
  p_decision text,p_feedback text,p_publish_profile boolean default false)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare a public.professional_applications; image_reference text;
begin
  perform private.lock_administrator_roles();
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('approve','reject') or p_publish_profile is null or
    p_feedback is null or char_length(btrim(p_feedback))=0 or char_length(p_feedback)>1000 then
    raise exception 'Review decision, feedback and explicit visibility choice required' using errcode='22023'; end if;
  select * into a from public.professional_applications where id=p_application_id for update;
  if not found or a.state<>'submitted' then raise exception 'Submitted application unavailable' using errcode='22023'; end if;
  if a.updated_at is distinct from p_expected_updated_at then raise exception 'Application changed; reload before review' using errcode='40001'; end if;
  if p_decision='approve' then
    if not exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id
      where r.user_id=a.applicant_id and r.role='customer' and u.email_confirmed_at is not null
        and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
      raise exception 'Only a confirmed eligible customer applicant may be approved' using errcode='22023'; end if;
    if not exists(select 1 from public.service_categories where id=a.category_id and is_active) then
      raise exception 'Application category is no longer active' using errcode='22023'; end if;
    if exists(select 1 from unnest(a.document_paths) d(name) where not exists(select 1 from storage.objects o
      where o.bucket_id='professional-applications' and o.name=d.name)) then
      raise exception 'A submitted credential is unavailable; resolve before approval' using errcode='22023'; end if;
    -- One transaction: authoritative promotion, existing profile, existing verification,
    -- application decision and both audit trails all succeed or all roll back.
    perform public.change_user_role(a.applicant_id,'professional','Approved professional application '||a.id::text||': '||p_feedback);
    update public.professional_profiles set display_name=a.full_name,biography=a.biography,
      qualifications_description=a.qualifications,experience_description=a.years_experience::text||' years of experience',
      specializations=a.specializations where user_id=a.applicant_id;
    select approved_image_reference into image_reference from public.professional_profiles where user_id=a.applicant_id;
    perform public.review_professional(a.applicant_id,'verified',p_publish_profile,
      'Application '||a.id::text||' approved: '||p_feedback,image_reference,
      'Approved professional application '||a.id::text);
  end if;
  update public.professional_applications set state=case p_decision when 'approve' then 'approved' else 'rejected' end,
    feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() where id=a.id;
  insert into public.professional_application_events(application_id,applicant_id,actor_user_id,event,feedback)
    values(a.id,a.applicant_id,auth.uid(),case p_decision when 'approve' then 'approved' else 'rejected' end,p_feedback);
  return a.id;
end;
$$;
revoke all on function public.review_professional_application(uuid,timestamptz,text,text,boolean) from public,anon,authenticated;

grant execute on function public.save_professional_application(jsonb,uuid,timestamptz),
  public.submit_professional_application(uuid,timestamptz,boolean),
  public.review_professional_application(uuid,timestamptz,text,text,boolean) to authenticated;
-- No seed users/applications/qualifications, automatic promotion, offering approval,
-- service/PIN authorization, booking mutation, or changes to existing Storage policies.
