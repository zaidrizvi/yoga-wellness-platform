-- Pending separate approval: discoverability never grants coverage or bookability.
-- Keep marketplace_locations() and every booking/coverage guard unchanged.
create function public.marketplace_catalog_locations()
returns jsonb language sql stable security definer set search_path='' as $$
  with configured as materialized (select a from jsonb_array_elements(public.marketplace_locations()) a)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'name',l.name,'district',l.district,
    'service_areas',coalesce(c.a->'service_areas','[]'::jsonb)) order by l.name,l.district,l.id),'[]'::jsonb)
  from public.marketplace_localities l left join configured c on c.a->>'id'=l.id::text
  where l.region_code='IN-DL';
$$;
revoke all on function public.marketplace_catalog_locations() from public,anon,authenticated;
grant execute on function public.marketplace_catalog_locations() to anon,authenticated;
