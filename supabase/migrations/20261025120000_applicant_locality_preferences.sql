-- Pending explicit deployment approval. Applicant intent never grants service coverage.
-- Preserve existing ownership, confirmed-email, credential, consent and review guards.
-- Keep every submission-completeness requirement; allow named preferences instead
-- of a postal mapping, which an applicant cannot legitimately invent.
alter table public.professional_applications drop constraint professional_applications_check;
alter table public.professional_applications add constraint professional_applications_check check (
 state not in ('submitted','approved','rejected') or
 (char_length(btrim(full_name))>0 and phone<>'' and category_id is not null and
  char_length(btrim(qualifications))>0 and years_experience is not null and
  char_length(btrim(biography))>0 and char_length(btrim(service_locations))>0 and
  (cardinality(postal_codes)>0 or (cardinality(requested_locality_ids) between 1 and 20
    and array_position(requested_locality_ids,null) is null)) and cardinality(document_paths)>0 and
  consented_at is not null and submitted_at is not null));
create or replace function public.save_application_localities(p_details jsonb,p_locality_ids uuid[],p_application_id uuid default null,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare result uuid; resolved jsonb; names text; selected_ids uuid[];
begin
  perform private.lock_administrator_roles();
  if not private.has_role('customer') then raise exception 'Applicant customer required' using errcode='42501'; end if;
  if p_locality_ids is null or cardinality(p_locality_ids)>20 or exists(select 1 from unnest(p_locality_ids) selected(id)
    where not exists(select 1 from public.marketplace_localities l where l.id=selected.id and l.region_code='IN-DL')) then
    raise exception 'Choose up to 20 valid Delhi locality names' using errcode='22023'; end if;
  selected_ids:=array(select distinct id from unnest(p_locality_ids) selected(id) order by id);
  if cardinality(selected_ids)>0 or exists(select 1 from public.professional_applications
    where id=p_application_id and applicant_id=auth.uid() and cardinality(requested_locality_ids)>0) then
    select coalesce(jsonb_agg(pin order by pin),'[]'::jsonb) into resolved from (
      select distinct a.postal_code as pin from public.locality_service_areas m
      join public.marketplace_localities l on l.id=m.locality_id
      join public.service_areas a on a.id=m.service_area_id
      where m.locality_id=any(selected_ids) and l.verified and l.is_active and a.is_active and a.postal_code is not null) x;
    if jsonb_array_length(resolved)>20 then raise exception 'Choose fewer localities: application routing supports at most 20 distinct PINs' using errcode='22023'; end if;
    select coalesce(string_agg(name||' ('||district||')',', ' order by name,district,id),'') into names
      from public.marketplace_localities where id=any(selected_ids);
    if char_length(names)>1000 then raise exception 'Choose fewer localities: saved location descriptions support 1000 characters' using errcode='22023'; end if;
    p_details:=p_details||jsonb_build_object('postal_codes',resolved,'service_locations',names);
  end if;
  result:=public.save_professional_application(p_details,p_application_id,p_expected_updated_at);
  update public.professional_applications set requested_locality_ids=selected_ids where id=result;
  return result;
end;
$$;
revoke all on function public.save_application_localities(jsonb,uuid[],uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.save_application_localities(jsonb,uuid[],uuid,timestamptz) to authenticated;

create or replace function public.submit_professional_application(p_application_id uuid,
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
    char_length(btrim(a.biography))=0 then
    raise exception 'Complete your name, phone, category, qualifications, experience and biography' using errcode='22023'; end if;
  -- Named applicant preferences do not assert serviceability or require inferred PINs.
  if cardinality(a.requested_locality_ids)>0 then
    if cardinality(a.requested_locality_ids)>20 or exists(select 1 from unnest(a.requested_locality_ids) selected(id)
      where not exists(select 1 from public.marketplace_localities l where l.id=selected.id and l.region_code='IN-DL')) then
      raise exception 'Choose up to 20 valid Delhi locality names' using errcode='22023'; end if;
  elsif char_length(btrim(a.service_locations))=0 or cardinality(a.postal_codes)=0 then
    raise exception 'Choose your intended Delhi localities before submitting' using errcode='22023';
  end if;
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


grant execute on function public.submit_professional_application(uuid,timestamptz,boolean) to authenticated;
