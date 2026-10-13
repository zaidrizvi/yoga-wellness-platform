-- Included only inside pgTAP BEGIN/ROLLBACK tests. NEVER a migration or seed.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'admin-one@fixture.invalid', '{"role":"customer"}'),
  ('10000000-0000-4000-8000-000000000002', 'admin-two@fixture.invalid', '{}'),
  ('10000000-0000-4000-8000-000000000003', 'customer-a@fixture.invalid', '{"role":"admin"}'),
  ('10000000-0000-4000-8000-000000000004', 'customer-b@fixture.invalid', '{"role":"professional"}'),
  ('10000000-0000-4000-8000-000000000005', 'professional-one@fixture.invalid', '{}'),
  ('10000000-0000-4000-8000-000000000006', 'professional-two@fixture.invalid', '{}');

-- Explicit trusted bootstrap for disposable tests, never first-signup magic.
update public.user_roles set role = 'admin' where user_id = '10000000-0000-4000-8000-000000000001';
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  perform public.change_user_role('10000000-0000-4000-8000-000000000002', 'admin', 'Test fixture');
  perform public.change_user_role('10000000-0000-4000-8000-000000000005', 'professional', 'Test fixture');
  perform public.change_user_role('10000000-0000-4000-8000-000000000006', 'professional', 'Test fixture');
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
  perform public.ensure_own_profile('Fixture Customer A');
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
  perform public.ensure_own_profile('Fixture Customer B');
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;
update public.profiles set phone = '+919999999999' where id = '10000000-0000-4000-8000-000000000004';
update public.professional_profiles set display_name = 'Fixture Professional',
  qualifications_description = 'Test-only asserted qualification';
