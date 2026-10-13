begin;
\ir ../fixtures.sql
select no_plan();

select is((select role from public.user_roles where user_id = '10000000-0000-4000-8000-000000000003'), 'customer', 'Signup metadata cannot grant admin');
select is((select role from public.user_roles where user_id = '10000000-0000-4000-8000-000000000004'), 'customer', 'Signup metadata cannot grant professional');
select lives_ok($$select private.ensure_customer_role('10000000-0000-4000-8000-000000000003')$$, 'Duplicate initialization is idempotent');
select is((select count(*) from public.user_roles where user_id = '10000000-0000-4000-8000-000000000003'), 1::bigint, 'Exactly one role');
select lives_ok($$select private.ensure_customer_role('10000000-0000-4000-8000-000000000005')$$, 'Duplicate initialization preserves trusted promotion');
select is((select role from public.user_roles where user_id = '10000000-0000-4000-8000-000000000005'), 'professional', 'No downgrade on duplicate initialization');

create function pg_temp.fail_role_insert() returns trigger language plpgsql as $$
begin raise exception 'Simulated essential role failure'; end; $$;
create trigger test_role_failure before insert on public.user_roles for each row execute function pg_temp.fail_role_insert();
select throws_ok($$insert into auth.users(id) values('10000000-0000-4000-8000-000000000007')$$, 'P0001', 'Simulated essential role failure', 'Essential role failure aborts signup');
select is((select count(*) from auth.users where id = '10000000-0000-4000-8000-000000000007'), 0::bigint, 'No orphan Auth account after failure');
drop trigger test_role_failure on public.user_roles;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select throws_ok($$update public.user_roles set role = 'admin' where user_id = auth.uid()$$, '42501', null, 'Direct self-promotion denied by grants');
select throws_ok($$select public.change_user_role(auth.uid(), 'admin')$$, '42501', null, 'Customer cannot use role RPC');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select throws_ok($$select public.change_user_role(auth.uid(), 'admin')$$, '42501', null, 'Professional cannot promote self');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.change_user_role(auth.uid(), 'customer')$$, '42501', null, 'Admin cannot change own role through RPC');
select throws_ok($$select public.change_user_role('10000000-0000-4000-8000-000000000004', 'owner')$$, '22023', null, 'Invalid role rejected');
select lives_ok($$select public.change_user_role('10000000-0000-4000-8000-000000000004', 'professional', 'Promotion test')$$, 'Authorized promotion succeeds');
reset role;
select ok(exists(select 1 from public.professional_profiles where user_id = '10000000-0000-4000-8000-000000000004'), 'Promotion creates profile');
select is((select status from public.professional_verifications where professional_id = '10000000-0000-4000-8000-000000000004'), 'pending', 'Promotion does not verify');
select ok(exists(select 1 from public.administrative_audit where target_user_id = '10000000-0000-4000-8000-000000000004' and new_state = 'professional' and actor_user_id = '10000000-0000-4000-8000-000000000001'), 'Promotion audit has authoritative actor');

-- Force a dependent-profile failure to prove the entire promotion rolls back.
create function pg_temp.fail_professional_insert() returns trigger language plpgsql as $$
begin raise exception 'Simulated professional write failure'; end; $$;
create trigger test_promotion_failure before insert on public.professional_profiles for each row execute function pg_temp.fail_professional_insert();
set local role authenticated;
select throws_ok($$select public.change_user_role('10000000-0000-4000-8000-000000000003', 'professional')$$, 'P0001', 'Simulated professional write failure', 'Dependent failure aborts promotion');
reset role;
select is((select role from public.user_roles where user_id = '10000000-0000-4000-8000-000000000003'), 'customer', 'Failed promotion leaves role unchanged');
select is((select count(*) from public.administrative_audit where target_user_id = '10000000-0000-4000-8000-000000000003' and new_state = 'professional'), 0::bigint, 'Failed promotion leaves no success audit');
drop trigger test_promotion_failure on public.professional_profiles;

set local role authenticated;
select lives_ok($$select public.change_user_role('10000000-0000-4000-8000-000000000002', 'customer')$$, 'Admin may demote another admin when one remains');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.change_user_role('10000000-0000-4000-8000-000000000001', 'customer')$$, '42501', null, 'Demoted admin loses RPC authority immediately, same JWT subject');
reset role;
select throws_ok($$update public.user_roles set role = 'customer' where user_id = '10000000-0000-4000-8000-000000000001'$$, '23514', 'Cannot remove the last administrator', 'Trusted direct SQL cannot demote last admin');
select throws_ok($$delete from auth.users where id = '10000000-0000-4000-8000-000000000001'$$, '23514', 'Cannot remove the last administrator', 'Cascaded deletion of last admin blocked');
select throws_ok($$update auth.users set deleted_at = now() where id = '10000000-0000-4000-8000-000000000001'$$, '23514', 'Cannot remove the last administrator', 'Soft deletion of last admin blocked');
select is((select count(*) from public.user_roles where role = 'admin'), 1::bigint, 'Single-session last-admin invariant holds');
select throws_ok($$update public.user_roles set role = 'owner' where user_id = '10000000-0000-4000-8000-000000000003'$$, '23514', null, 'Role constraint also protects trusted writes');

delete from public.user_roles where user_id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is(private.is_admin(), false, 'Missing role fails closed');
select throws_ok($$select public.ensure_own_profile()$$, '42501', null, 'Missing role cannot initialize an authorized profile');
reset role;
select * from finish();
rollback;
