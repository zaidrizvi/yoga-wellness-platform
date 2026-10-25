-- Pending: unified, explicit application/locality review. No automatic data changes.
-- Depends on 20261025130000. Historical postal references remain intact.
-- Verification and publication are independent; unpublished verified professionals
-- may receive reviewed coverage but remain excluded by public listing eligibility.
-- Newly activated localities always get an exact locality authorization gate, so
-- an unrelated professional's shared historical postal area cannot grant coverage.
create or replace function public.admin_approve_locality_coverage(p_localities uuid[],p_professional uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare selected uuid; l public.marketplace_localities; area uuid; request_id uuid; mapping record; total integer:=0;
begin
 perform private.lock_administrator_roles();
 if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 perform private.lock_booking_fulfillment();
 if p_localities is null or cardinality(p_localities) not between 1 and 20 or array_position(p_localities,null) is not null
   or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Choose 1–20 Delhi localities and give a decision reason' using errcode='22023'; end if;
 if p_professional is not null and not exists(select 1 from public.professional_profiles p join public.professional_verifications v on v.professional_id=p.user_id join public.user_roles r on r.user_id=p.user_id join auth.users u on u.id=p.user_id where p.user_id=p_professional and r.role='professional' and v.status='verified' and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
   raise exception 'Choose a currently verified, eligible professional' using errcode='22023'; end if;
 for selected in select distinct id from unnest(p_localities) selected(id) order by id loop
  select * into l from public.marketplace_localities where id=selected and region_code='IN-DL' for update;
  if not found then raise exception 'Delhi catalog locality required' using errcode='22023'; end if;
  -- This explicitly approves operating by the selected name; it asserts no postal mapping.
  update public.marketplace_localities set verified=true,is_active=true,updated_at=clock_timestamp() where id=l.id;
  if not (l.verified and l.is_active) or not exists(select 1 from public.locality_service_areas m join public.service_areas a on a.id=m.service_area_id
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


create function public.admin_application_localities(p_application uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',coalesce(l.name,'Unavailable locality'),
  'district',coalesce(l.district,''),'supported',coalesce(l.region_code='IN-DL',false),
  'active',coalesce(l.is_active and l.verified,false),'updated_at',l.updated_at,
  'source',l.source_url,'approved',private.professional_serves_locality(a.applicant_id,x.id)) order by l.name,x.id),'[]'::jsonb)
  from public.professional_applications a cross join lateral unnest(a.requested_locality_ids) x(id)
  left join public.marketplace_localities l on l.id=x.id where a.id=p_application);
end $$;

create function public.review_application_with_localities(p_application uuid,p_expected_updated_at timestamptz,
 p_decision text,p_feedback text,p_publish_profile boolean,p_reviews jsonb)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare a public.professional_applications; item jsonb; l public.marketplace_localities;
 reviewed uuid[]:='{}'; authorized uuid[]:='{}'; excluded uuid[]:='{}';
begin
 perform private.lock_administrator_roles();
 if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 perform private.lock_booking_fulfillment();
 if p_decision is null or p_decision not in ('approve','reject','approve_locations') or p_publish_profile is null
  or p_feedback is null or char_length(btrim(p_feedback)) not between 1 and 1000 then
  raise exception 'Explicit decision, visibility choice and feedback required' using errcode='22023'; end if;
 select * into a from public.professional_applications where id=p_application for update;
 if not found or a.updated_at is distinct from p_expected_updated_at then raise exception 'Application changed; reload' using errcode='40001'; end if;
 if p_decision='reject' then
  return public.review_professional_application(a.id,p_expected_updated_at,'reject',p_feedback,false);
 end if;
 if (p_decision='approve' and a.state<>'submitted') or (p_decision='approve_locations' and a.state<>'approved') then
  raise exception 'Application state does not permit this decision' using errcode='22023'; end if;
 if jsonb_typeof(p_reviews) is distinct from 'array' then raise exception 'Review every requested locality' using errcode='22023'; end if;
 if jsonb_array_length(p_reviews) not between 1 and 20 then raise exception 'Review 1-20 requested localities' using errcode='22023'; end if;
 -- Sort locks consistently and validate the complete partition before any promotion.
 for item in select value from jsonb_array_elements(p_reviews) order by value->>'id' loop
  if jsonb_typeof(item) is distinct from 'object' or item->>'id' is null or
   coalesce(item->>'decision','') not in ('authorize','exclude') then raise exception 'Explicit locality decision required' using errcode='22023'; end if;
  if (item->>'id')::uuid=any(reviewed) or not ((item->>'id')::uuid=any(a.requested_locality_ids)) then
   raise exception 'Only this applicant requested locations may be reviewed once' using errcode='22023'; end if;
  reviewed:=array_append(reviewed,(item->>'id')::uuid);
  select * into l from public.marketplace_localities where id=(item->>'id')::uuid for update;
  if item->>'decision'='authorize' then
   if not found or l.region_code<>'IN-DL' then raise exception 'Unsupported locality: exclude it with feedback or request changes' using errcode='22023'; end if;
   if l.updated_at is distinct from (item->>'updated_at')::timestamptz then raise exception 'Locality changed; reload and review again' using errcode='40001'; end if;
   authorized:=array_append(authorized,l.id);
  else excluded:=array_append(excluded,(item->>'id')::uuid); end if;
 end loop;
 if not (reviewed @> a.requested_locality_ids and a.requested_locality_ids @> reviewed) or cardinality(authorized)=0 then
  raise exception 'Resolve every requested locality and explicitly authorize at least one supported locality' using errcode='22023'; end if;
 if p_decision='approve' then
  perform public.review_professional_application(a.id,p_expected_updated_at,'approve',p_feedback,p_publish_profile);
 else
  -- Remediation never promotes or re-verifies an account. Existing verification is required.
  if not exists(select 1 from public.professional_profiles p join public.professional_verifications v on v.professional_id=p.user_id join public.user_roles r on r.user_id=p.user_id
   join auth.users u on u.id=p.user_id where p.user_id=a.applicant_id and r.role='professional' and v.status='verified'
   and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
   raise exception 'Eligible verified professional required; resolve verification first' using errcode='22023'; end if;
  if p_publish_profile then
   perform public.review_professional(a.applicant_id,'verified',true,(select internal_notes from public.professional_verifications where professional_id=a.applicant_id),(select approved_image_reference from public.professional_profiles where user_id=a.applicant_id),'Published during reviewed locality remediation: '||left(p_feedback,900));
  end if;
 end if;
 perform public.admin_approve_locality_coverage(authorized,a.applicant_id,p_feedback);
 -- Immutable locality audit includes each explicit exclusion and the application link.
 insert into public.marketplace_audit(entity_type,entity_id,actor_user_id,previous_details,new_details,reason)
 select 'locality',id,auth.uid(),null,jsonb_build_object('application_id',a.id,'professional_id',a.applicant_id,
  'decision',case when id=any(authorized) then 'authorized' else 'excluded' end,'reviewed_localities',p_reviews),p_feedback
 from unnest(reviewed) x(id);
 -- Advance the application version for remediation as well, preventing stale repeat decisions.
 if p_decision='approve_locations' then
  update public.professional_applications set updated_at=clock_timestamp() where id=a.id;
 end if;
 return a.id;
end $$;
revoke all on function public.admin_application_localities(uuid),
 public.review_application_with_localities(uuid,timestamptz,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.admin_application_localities(uuid),
 public.review_application_with_localities(uuid,timestamptz,text,text,boolean,jsonb) to authenticated;
