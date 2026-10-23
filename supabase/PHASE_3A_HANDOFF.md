# Phase 3A - hosted foundation verified

## Current status - 23 October 2026

Target: `yoga-wellness-platform` (`nubblifjxikhpdvkgztt`), PostgreSQL 17.11. The preceding live check confirmed `ACTIVE_HEALTHY`, working PostgreSQL connections, and all three migration versions present remotely. Its dry run returned `upToDate: true` with no migrations, seeds, or roles pending. This supersedes earlier statements that the database was empty or migrations were pending. The deployment actor/time was not established; this session did not deploy or modify hosted data.

One focused hosted verification used the Supabase CLI Management API query workflow with explicit project targeting, read-only transactions, catalog queries, and `SET LOCAL ROLE anon` access checks. No test users, records, uploads, schema changes, or destructive fixtures were created. No frontend checks, dry run, or full pgTAP suite were repeated during this verification.

## Actual hosted verification results

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Ten expected tables exist | PASS | All ten table names in the contract below resolve in the hosted catalog |
| RLS enabled on all ten | PASS | `pg_class.relrowsecurity` is true for every expected table |
| Role/verification functions exist | PASS | Role helpers, initialization/guards, `ensure_own_profile`, `change_user_role`, `review_professional`, `own_professional_verification`, and `list_public_professionals` exist; inspected definer functions are owned by `postgres` with empty search paths; internal mutation helpers are not executable by anon/authenticated |
| Private document bucket/policies | PASS (configuration) | `professional-documents` has `public=false`, 10 MiB limit, PDF/JPEG/PNG allowlist; expected SELECT/INSERT/DELETE policies exist, restricted to authenticated current-role/owner or admin access; no other Storage object policies returned |
| Anonymous sensitive-table reads | PASS (database runtime) | Actual `anon` SELECT attempts with LIMIT 0 on profiles, user_roles, professional_profiles, professional_verifications each failed with SQLSTATE 42501 permission denied; catalog also confirms no table or column SELECT privileges |
| Approved public listing path | PASS (configuration and invocation) | Hosted function definition requires professional role, verified status, public visibility, nondeleted and nonbanned Auth account; returns only the six approved public fields. Anon execution succeeded. No public views or anonymous direct sensitive-table access found. Current website remains static; application integration belongs to 3B |
| Anonymous Storage metadata query | PASS (limited runtime) | Read-only anon query for this bucket returned zero visible metadata rows; this alone does not prove denial against populated foreign documents |
| Authenticated customer isolation / self-promotion denial | UNVERIFIED | No controlled authenticated accounts used; policies/function existence does not prove behavior |
| Professional verification/suspension transitions | UNVERIFIED | Hosted eligibility predicate confirmed, but no account state changed or fixtures created |
| Storage owner/admin isolation, HTTP upload limits, signed URLs | UNVERIFIED | Catalog configuration inspected; no uploads, documents, or authenticated API tests |
| Last-admin/concurrency/signup-trigger behavior | UNVERIFIED | No mutation or concurrency tests executed |

No critical blocker was found in these focused checks. Phase 3A is complete enough to begin Master Prompt 3B development, with the explicit runtime limitations above. This is not production security certification. Phase 3B was not started.

## Applied migration source

Remote history already records these versions; retain the files unchanged:

1. [20261013154854_initial_schema.sql](migrations/20261013154854_initial_schema.sql)
2. [20261013154856_security_policies.sql](migrations/20261013154856_security_policies.sql)
3. [20261013154859_storage_and_initial_service_data.sql](migrations/20261013154859_storage_and_initial_service_data.sql)

## Historical evidence and remaining limits

Earlier source review found no material destructive operation, privilege escalation, private-data exposure, critical RLS defect, unsafe administrator function, or dangerous Storage access. No SQL correction was required. SQL parsing and frontend TypeScript/ESLint/nine unit tests/build/seven Playwright tests were historically reported passing; none was rerun for this focused verification. Five pgTAP files exist but remain unexecuted. Local Supabase execution was historically blocked by unavailable container services; no Docker setup or troubleshooting was attempted here. Local migration application remains unverified and is distinct from the confirmed hosted migration history.

## Tables and relationships

All ten application tables have RLS enabled and explicit client grants.

| Table | Purpose and relationships |
| --- | --- |
| `profiles` | Optional private contact/profile enrichment; PK references `auth.users`, cascading deletion |
| `user_roles` | Exactly one current role per Auth user; direct Auth FK, independent of optional profiles |
| `professional_profiles` | Public-safe presentation fields; direct Auth FK; visibility and image reference protected |
| `professional_verifications` | Private review state, reviewer, timestamp, notes; profile FK cascades, reviewer deletion sets NULL |
| `service_categories` | Stable unique slugs, active state, ordering |
| `services` | Category FK restricts deletion; unique slugs; nullable integer INR paise and duration; inactive services cannot be published |
| `professional_services` | Unique professional/service pair; professional deletion cascades, service/reviewer deletion restricted |
| `service_areas` | Optional validated postal code, active state, unique name/postal combination; no coverage rows seeded |
| `professional_service_areas` | Unique professional/area pair; professional deletion cascades, area/reviewer deletion restricted |
| `administrative_audit` | Append-only role, verification, and publication decisions; bare immutable identity UUIDs retain history after account deletion, no private notes or PII payload |

Timestamps use `timestamptz`. 3B should display them in `Asia/Kolkata`. No appointment, package, payment, address, or availability tables exist.

## Finalized security decisions

**One public professional path.** `public.list_public_professionals()` is the single authoritative public eligibility function. No professional view or public `SELECT` policy exists. `anon` has no table privileges on `professional_profiles`, `professional_verifications`, `user_roles`, or `profiles`. Both `anon` and `authenticated` may execute the parameterless listing function, which returns only professional ID, display name, biography, public qualifications, experience, and an administrator-approved image reference. It never returns phone numbers, notes, documents, or Auth metadata.

The function joins current role, verification, profile visibility, and Auth account state. It requires role `professional`, status `verified`, `public_visible`, no `auth.users.deleted_at`, and no current `banned_until`. Missing verification fails closed. No additional eligibility columns are invented. A new query after suspension, hiding, demotion, ban, or deletion excludes the record. Auth field names were checked against the official Supabase Auth user model; the hosted listing function was successfully invoked under the anon database role on 23 October 2026; state-transition behavior remains unverified.

**Current database roles.** `private.has_role()` and `private.is_admin()` read PostgreSQL, not editable metadata or stale custom JWT roles. Missing roles, banned accounts, and soft-deleted accounts do not gain authority. `private` must remain absent from hosted Data API exposed schemas. Only `authenticated` gets schema usage and execution on narrowly necessary helpers; trigger/locking/initialization helpers are not callable by web clients. All definer functions use empty `search_path`, qualified relations, and no arbitrary SQL input. Verify function ownership is a trusted database owner before hosted use.

**Signup is minimal.** The Auth insertion trigger only ensures one default `customer` role using `INSERT ... ON CONFLICT DO NOTHING`. It never reads user metadata, creates professional records, or performs external work. Essential failures propagate and abort signup. Authorization fails closed if a role is absent. Ordinary customer inserts avoid the administrator serialization path. Private profiles are created separately by `ensure_own_profile()`; enrichment errors are retryable and cannot invalidate an already registered account.

**Atomic promotion and revocation.** `change_user_role()` verifies current admin authority, rejects normal admin self-role changes, and atomically updates the role, creates professional records when needed, resets verification/publication for any role transition, and writes audits. Promotion is never verification. Re-promotion cannot restore an old reviewed state.

**Last administrator.** Administrator mutation RPCs acquire transaction advisory lock `31032026`, then lock current administrator rows in deterministic UUID order using `FOR UPDATE`, then check authorization and remaining count. The table trigger applies the same lock/count guard to direct trusted role changes and cascaded Auth deletion. A separate Auth trigger protects soft deletion of the last administrator. Mutations require `READ COMMITTED`; higher isolation levels are rejected instead of relying on stale snapshots. RPCs acquire the shared lock before target-row writes. Trusted multi-row maintenance/deletion may encounter deadlocks and must be retried safely; do not bypass triggers. Banning/recovery of Auth accounts remains a trusted operational action and must preserve a usable administrator.

Single-session last-admin tests are written but unexecuted; concurrent behavior is not independently tested. Ordinary pgTAP cannot prove the two-session race. When a disposable Supabase environment is available, stage two genuine **test-only** admin accounts: transaction A demotes B and stays open; transaction B, authenticated as B, attempts to demote A and should wait. Commit A; B must then lose authority and fail, leaving one admin. Roll back failed transactions. Do not run this scenario on the business project.

**Verification privacy.** Admins may read private review records; professionals use `own_professional_verification()` to get only their own status and review time. Direct professional queries return no private review rows, including requests selecting `internal_notes`. Professionals may edit only permitted draft/rejected profile fields; verified/suspended profiles require an admin to reopen review first. Protected status, publication, and image columns have no general client update grant. Review uses `review_professional()`. Verification changes, including role-transition resets, are audited by a database trigger. Publication decisions are also audited. Audit UPDATE/DELETE are forbidden by both grants and an append-only trigger.

## RLS and grant summary

- `anon`: published, active services/categories and active areas only; professional listing via RPC; no application writes or private table reads.
- Customer: own profile read/permitted-column update, own current role read; no role mutations, private professional rows, reviews, audit, or approved eligibility writes.
- Professional: own draft/profile and assignments; edits only permitted columns while pending/rejected; own status via restricted RPC; no verification/publication/role changes or self-approved service/area eligibility.
- Admin: current-role-checked reads and category/service/area management; approved assignment writes must identify the current admin as `approved_by`. Role and verification mutations require guarded RPCs; no general role/review/audit DML grants.
- Public service visibility requires publication, service activity, and category activity; publication does not mean confirmed visit availability.

No policies grant public access to underlying professional records. `security_invoker` views are unnecessary because no such view is created. Hosted review must examine any **pre-existing** views, grants, role memberships, and permissive Storage policies that could create additional access paths.

## Private Storage contract

`professional-documents` is private, maximum 10 MiB, MIME allowlist PDF/JPEG/PNG. Owner uploads require both current professional role and owner UUID folder. Keys must be `{user_uuid}/{random_uuid_v4}.pdf|jpg|jpeg|png`; nested/traversal and non-UUID filenames are rejected. Owners can read/delete their documents while their role remains professional; admins can read/delete after authoritative checks. No UPDATE/overwrite policy or permanent public URLs exist. Demotion revokes subsequent owner access.

3B must use the Storage API, validate file type/size server-side as well as bucket limits, and generate short-lived document URLs only after admin/owner authorization. Signed URLs already issued may remain valid until expiry; use a short lifetime. SQL metadata fixtures test policies only and do not verify the Storage HTTP service's MIME/size enforcement. No public image bucket is created; image approval/delivery needs a separate controlled design in a later phase.

## Executable tests and commands

`supabase/tests/database/` contains `roles.test.sql`, `profiles.test.sql`, `professionals.test.sql`, `services.test.sql`, and `storage.test.sql`. Each begins a transaction, includes `../fixtures.sql`, uses realistic `anon`/`authenticated` database roles and JWT subject settings, and rolls back all data. They cover allowed/denied access, atomic promotion failure, essential signup failure, idempotency, missing roles, foreign keys, unique/check constraints, direct anonymous access, all professional exclusion states, private notes, audits, protected prices/publication, assignment eligibility, and Storage ownership/revocation.

Available now:

```text
npm.cmd run db:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

Once a working **disposable local** Supabase stack is available and target is verified:

```text
npx.cmd --no-install supabase start
npx.cmd --no-install supabase migration up --local
npx.cmd --no-install supabase db lint --local --schema public,private --fail-on error
npm.cmd run db:test
```

Do not use a remote reset or run these fixture-based tests on the business project. Generate database types with the real Supabase CLI after successful migration application; no generated types are fabricated here.

## Trusted first-admin bootstrap and recovery

Do this only after migration review/application, using trusted administrative database access for the verified project. Identify an existing, confirmed, non-banned, non-deleted Auth user whose current application role is customer. Replace the placeholder UUID below deliberately; this is **not** a web endpoint or automatic first-user promotion.

```sql
begin;
select private.lock_administrator_roles();
do $$
declare target uuid := '<existing-user-uuid>'::uuid;
begin
  if exists(select 1 from public.user_roles where role = 'admin') then
    raise exception 'First-admin bootstrap is not applicable';
  end if;
  if not exists(select 1 from auth.users where id = target and email_confirmed_at is not null
    and deleted_at is null and (banned_until is null or banned_until <= now())) then
    raise exception 'Confirmed eligible Auth account required';
  end if;
  perform set_config('app.role_change_reason', 'Explicit trusted first-admin bootstrap', true);
  update public.user_roles set role = 'admin' where user_id = target and role = 'customer';
  if not found then raise exception 'Expected customer role not found'; end if;
end;
$$;
commit;
```

The role/audit triggers still run. The audit actor is NULL for trusted database maintenance without an authenticated JWT subject. Check exactly one intended role/audit result using the trusted session. Never store admin credentials in code. For recovery of an inaccessible admin, use Supabase's legitimate Auth recovery or trusted unban/restore procedure. If a replacement is needed, add an explicitly identified eligible user as admin under the same lock with an audit reason **before** demoting/removing the old one; never disable last-admin protection or edit audit history.

## Hosted approval and 3B handoff

Hosted deployment is already recorded for all three migrations. Do not reapply or rewrite them. The focused read-only hosted verification above is sufficient to begin 3B development; authenticated isolation, mutation guards, and Storage HTTP behavior still need verification during integration. No further migration deployment approval is pending for this existing three-file set.

3B must:

1. Use the deployed foundation and preserve its security contract. Verify authenticated identity/isolation and administrator mutation behavior during 3B integration. The unavailable local pgTAP/concurrency suite is not a new release gate.
2. Generate and use actual Supabase database types; preserve editorial copy while integrating operational records.
3. Implement SSR Auth/verified identities and fail closed when role/profile initialization is unavailable.
4. Read current `user_roles` for authorization and use guarded role/review RPCs; never trust editable metadata or JWT application-role claims.
5. Call **only** `list_public_professionals()` for public professional data. Do not add a view, public table SELECT policy, or a second eligibility predicate.
6. Render `/professionals` dynamically (`dynamic = 'force-dynamic'` and uncached database fetches), or prove immediate route invalidation on every verification/visibility/role/Auth-state change. Dynamic rendering is the preferred approach because trusted DB/Auth changes may occur outside Next.js. No persistent result cache may expose revoked professionals. Merely avoiding a data cache is insufficient if the page itself is statically rendered.
7. Use `ensure_own_profile()` separately from signup and `own_professional_verification()` without exposing review notes.
8. Validate inputs, use approved image publication separately, and authorize private Storage URLs server-side.
9. Keep bookings, scheduling, packages, payments, and notifications out of 3B's database/authentication scope.

Official references reviewed: [CLI workflows](https://supabase.com/docs/guides/local-development/cli-workflows), [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth user data](https://supabase.com/docs/guides/auth/managing-user-data), [Storage access](https://supabase.com/docs/guides/storage/security/access-control), [database tests](https://supabase.com/docs/guides/database/testing), [Auth user state model](https://github.com/supabase/auth/blob/master/internal/models/user.go).
