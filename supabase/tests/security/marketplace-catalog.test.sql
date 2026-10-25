-- LOCAL disposable database only. No accounts, bookings or geographic approvals.
begin;
do $$ begin
 if (select count(*) from public.marketplace_localities)<>2258 then raise exception 'Missing imported names'; end if;
 if exists(select 1 from public.marketplace_localities where verified or is_active)
   or exists(select 1 from public.locality_service_areas) then raise exception 'Catalog unexpectedly granted service coverage'; end if;
 if jsonb_array_length(public.marketplace_locations())<>0 then raise exception 'Unconfigured locality became serviceable'; end if;
end $$;
set local role anon;
do $$ declare names jsonb; chosen uuid; begin
 names:=public.marketplace_catalog_locations();
 if jsonb_array_length(names)<>2258 then raise exception 'Unconfigured locality names not discoverable'; end if;
 if exists(select 1 from jsonb_array_elements(names) l where l->'service_areas'<>'[]'::jsonb
   or (select array_agg(k order by k) from jsonb_object_keys(l) k)<>array['district','id','name','service_areas']) then
   raise exception 'Unexpected catalog projection or coverage'; end if;
 chosen:=(names->0->>'id')::uuid;
 if public.marketplace_directory(chosen)<>'[]'::jsonb or public.marketplace_directory()<>'[]'::jsonb then raise exception 'Unserved locality gained public eligibility'; end if;
 if has_table_privilege('anon','public.marketplace_localities','SELECT') then raise exception 'Catalog table exposed'; end if;
 begin perform public.admin_marketplace_localities(); raise exception 'Admin RPC exposed'; exception when insufficient_privilege then null; end;
 begin perform public.submit_direct_booking(null,null,null,chosen,now()+interval '1 day',gen_random_uuid(),'invalid','',true); raise exception 'Anonymous booking allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: public names independent of serviceability, safe projection, selected/cleared directory, private table and RPC restrictions' as result;
rollback;
