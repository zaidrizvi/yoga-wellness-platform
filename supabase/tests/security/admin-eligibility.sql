-- Disposable LOCAL PostgreSQL only. Run via scripts/test-admin-eligibility.mjs.
-- The runner loads the actual migration guards into a minimal Auth/role schema.
begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end;
$$;
create function pg_temp.reject_change(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when check_violation then return;
  end;
  raise exception 'FAIL: % was allowed', label;
end;
$$;

insert into auth.users(id,email_confirmed_at) values
  ('40000000-0000-4000-8000-000000000001',now()),
  ('40000000-0000-4000-8000-000000000002',now()),
  ('40000000-0000-4000-8000-000000000003',null);
insert into public.user_roles(user_id,role) values
  ('40000000-0000-4000-8000-000000000001','admin'),
  ('40000000-0000-4000-8000-000000000002','admin'),
  ('40000000-0000-4000-8000-000000000003','customer');
select pg_temp.assert_true((select count(*)=2 from public.user_roles r join auth.users u on u.id=r.user_id
  where r.role='admin' and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=now())), 'two eligible admins');

-- Two eligible admins: ban one. A banned admin must not count as a replacement.
update auth.users set banned_until=now()+interval '1 day' where id='40000000-0000-4000-8000-000000000002';
select pg_temp.reject_change($s$update auth.users set banned_until=now()+interval '1 day'
  where id='40000000-0000-4000-8000-000000000001'$s$, 'ban final eligible admin');
select pg_temp.reject_change($s$update auth.users set deleted_at=now()
  where id='40000000-0000-4000-8000-000000000001'$s$, 'soft-delete final eligible admin');
select pg_temp.reject_change($s$update auth.users set email_confirmed_at=null
  where id='40000000-0000-4000-8000-000000000001'$s$, 'unconfirm final eligible admin');
select pg_temp.reject_change($s$update public.user_roles set role='customer'
  where user_id='40000000-0000-4000-8000-000000000001'$s$, 'demote final eligible admin');
select pg_temp.reject_change($s$delete from auth.users
  where id='40000000-0000-4000-8000-000000000001'$s$, 'hard-delete final eligible admin');

-- Unban restores a replacement; legitimate ban, soft-delete, restoration and
-- confirmation changes remain possible when another eligible admin survives.
update auth.users set banned_until=null where id='40000000-0000-4000-8000-000000000002';
update auth.users set banned_until=now()+interval '1 day' where id='40000000-0000-4000-8000-000000000001';
select pg_temp.reject_change($s$update auth.users set deleted_at=now()
  where id='40000000-0000-4000-8000-000000000002'$s$, 'unbanned admin is now final eligible');
update auth.users set banned_until=now()-interval '1 minute' where id='40000000-0000-4000-8000-000000000001';
update auth.users set deleted_at=now() where id='40000000-0000-4000-8000-000000000002';
select pg_temp.reject_change($s$update auth.users set banned_until=now()+interval '1 day'
  where id='40000000-0000-4000-8000-000000000001'$s$, 'deleted admin does not count');
update auth.users set deleted_at=null where id='40000000-0000-4000-8000-000000000002';
update auth.users set email_confirmed_at=null where id='40000000-0000-4000-8000-000000000001';
select pg_temp.reject_change($s$update auth.users set email_confirmed_at=null
  where id='40000000-0000-4000-8000-000000000002'$s$, 'unconfirmed admin does not count');
update auth.users set email_confirmed_at=now() where id='40000000-0000-4000-8000-000000000001';

-- A multi-row statement must see its own preceding row changes and roll back
-- the entire statement when its final row would eliminate eligibility.
select pg_temp.reject_change($s$update auth.users set banned_until=now()+interval '1 day'
  where id in ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002')$s$, 'bulk ban');
select pg_temp.assert_true((select count(*)=2 from auth.users where email_confirmed_at is not null
  and deleted_at is null and (banned_until is null or banned_until<=now())), 'bulk failure rolls back both changes');

-- Ordinary non-admin Auth transitions must remain functional.
update auth.users set email_confirmed_at=now() where id='40000000-0000-4000-8000-000000000003';
update auth.users set banned_until=now()+interval '1 day',deleted_at=now()
  where id='40000000-0000-4000-8000-000000000003';
update auth.users set banned_until=null,deleted_at=null where id='40000000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select role='customer' from public.user_roles
  where user_id='40000000-0000-4000-8000-000000000003'), 'Auth transitions do not grant professional or admin roles');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.guard_administrator_eligibility()','EXECUTE')
  and not has_function_privilege('anon','private.guard_administrator_eligibility()','EXECUTE'), 'trigger has no client EXECUTE');
select pg_temp.assert_true((select prosecdef and proconfig=array['search_path=""'] from pg_proc
  where oid='private.guard_administrator_eligibility()'::regprocedure), 'definer search path is empty');
rollback;
