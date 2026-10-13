# Phase 3A — pending database foundation

## Simplified remaining workflow (latest instruction)

One focused source review of the existing three migrations found no obvious critical privilege-escalation, private-data-exposure, or RLS defect. There are no destructive table drops, resets, or data wipes. The review checked fixed definer search paths, explicit function execution grants, closed anonymous table access, current database role checks, the single public listing projection, private verification notes, and owner/current-role Storage policies. This is source review, not executed database verification. No SQL or application code was changed during this review.

Use the **existing hosted project for development only after checking for valuable data**. The verified target is `yoga-wellness-platform` (`nubblifjxikhpdvkgztt`), PostgreSQL 17.11, matching the configured application hostname. Authenticated read-only preflight found zero Auth users, zero Storage objects/buckets, no public tables/views, no private schema, and no Storage object policies. No existing application data or naming/policy conflicts were detected in these checks. Do not reset, delete, or overwrite anything to make a project appear empty.

Prepare the dry run with the already-created migration files:

```text
npx.cmd --no-install supabase migration list --project-ref nubblifjxikhpdvkgztt
npx.cmd --no-install supabase db push --project-ref nubblifjxikhpdvkgztt --dry-run
```

The dry run succeeded: it would apply exactly the three migration files listed below, with no seed files or role files. Remote migration history has no applied application migrations and no migration-history table was present in the read-only preflight. The local link file is absent, so supported explicit `--project-ref` targeting was used. Obtain **explicit deployment approval** before executing a real push. Approval to review SQL does not itself authorize deployment. No GitHub push is authorized.

Following deployment approval and application, perform only a few essential checks on this verified development database: (1) anonymous private-table denial/public listing projection, (2) customer isolation/default role and failed privilege escalation, (3) professional self-verification denial plus immediate public exclusion after suspension, and (4) private document bucket and owner/current-role access restrictions. Use actual Supabase roles/context and transaction-rolled-back temporary fixtures where needed; do not commit fake users or documents. Report any critical failures, permit at most two targeted repair/retest cycles, and stop. Do not add test files, run the full existing pgTAP suite as a new release gate, install Docker, create another harness, or rerun passing frontend checks.

This simplified workflow supersedes the earlier requirement to wait for the entire local pgTAP/concurrency suite before moving toward 3B. Existing test files remain available but unexecuted; unavailable local Supabase tests remain **blocked**. The detailed schema/security contract and 3B freshness requirements below remain applicable.

Implemented locally on 13 October 2026. **Not deployed, not approved for deployment, and not verified on hosted Supabase.** The public website and existing Supabase application utilities remain unchanged. This is a database contract for 3B, not a live backend.

## Environment and verification

Supabase CLI 2.120.0 is available. Local configuration uses PostgreSQL 17 and exposes only `public` and `graphql_public`; `private` is excluded. Docker/Podman are unavailable and nothing is listening on the configured local database port. No additional service troubleshooting was attempted after that was established.

Initial checks had no local project link and unavailable public REST probes. Subsequent authenticated CLI inspection identified the existing project, verified its match to configured hostname fingerprint `59e62f46421f`, inspected counts/schema metadata, listed empty remote migration history, and completed the explicit-target dry run successfully. Credentials and configured values were not printed. No migration SQL, reset, migration repair, account change, Storage upload, or application configuration mutation was executed on the hosted project. Read-only preflight SQL was executed through the supported CLI Management API query command.

| Check | Actual result |
| --- | --- |
| PostgreSQL outer SQL parsing and static access contracts | Pass; all three migrations and five pgTAP files parsed |
| PL/pgSQL compilation and execution against Supabase | Blocked |
| Local migration application | Blocked |
| pgTAP, RLS, escalation, signup-trigger, and Storage policy behavior | Blocked; tests written, not executed |
| Two-session concurrency | Blocked; not independently tested |
| Hosted target/counts/history preflight and migration dry run | Pass; three pending migrations, no application data detected, no migrations applied |
| Storage HTTP MIME/size enforcement and signed URL behavior | Blocked; only configuration/policy source reviewed |
| TypeScript | Pass |
| ESLint | Pass, no warnings |
| Vitest | Pass, 9 existing tests |
| Production build | Pass |
| Playwright public regression | Pass, 7 existing tests across nine routes and four widths |

SQL parsing is independent validation, **not proof of migration execution or Supabase RLS correctness**. `pgsql-parser` parses outer SQL; function bodies, object dependencies, privileges, native Auth behavior, and Storage APIs still need the real stack. No generic PostgreSQL harness is used. No quality or security checks were disabled. Existing five development-only ESLint advisory findings remain unchanged.

## Complete SQL for review

Review these source files in order; they are the complete pending SQL, not excerpts:

1. [20261013154854_initial_schema.sql](migrations/20261013154854_initial_schema.sql) — ten tables, constraints, indexes, immediate RLS, and revoked client privileges.
2. [20261013154856_security_policies.sql](migrations/20261013154856_security_policies.sql) — authoritative roles, signup initialization, lazy profile initialization, locked role/review operations, audit triggers, public listing contract, column grants, and RLS.
3. [20261013154859_storage_and_initial_service_data.sql](migrations/20261013154859_storage_and_initial_service_data.sql) — private document bucket/policies, three real service categories, and the three stable initial service slugs. No invented prices or durations.

Filenames were created by `supabase migration new`. None has been applied locally or remotely. The existing local migration history could not be queried because the local database is absent; no pre-existing migration files were present. Do not rewrite these files after they are applied: create subsequent migrations instead.

There are no table drops, remote resets, or destructive production seeds. Sensitive changes include application triggers on `auth.users`, definer functions owned by the trusted migration executor, role backfill for existing real Auth users, publication of informational service records, and creation of a private Storage bucket. These require review against existing hosted objects before approval. A naming collision fails rather than silently overwriting existing objects. Synthetic accounts occur only in transaction-rolled-back test fixtures. `seed.sql` intentionally contains no sample data.

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

The function joins current role, verification, profile visibility, and Auth account state. It requires role `professional`, status `verified`, `public_visible`, no `auth.users.deleted_at`, and no current `banned_until`. Missing verification fails closed. No additional eligibility columns are invented. A new query after suspension, hiding, demotion, ban, or deletion excludes the record. Auth field names were checked against the official Supabase Auth user model; actual hosted schema compatibility is still unverified.

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

Before any remote application: obtain trusted CLI/database access, link and verify the intended existing project against configured target, inspect remote migration history/application objects/Auth fields, reconcile naming conflicts without overwriting history, confirm private is not exposed, and review bucket/policy overlap and function owners. Run the supported dry run. Then request explicit approval for the **complete three-file SQL set** above and report the blocked local security tests. No conditional approval here substitutes for identifying the target or checking remote history.

3B must:

1. Wait for approved migration deployment and the few essential hosted development permission checks in the simplified workflow; this database is not yet verified ready. The entire unavailable local pgTAP/concurrency suite is not a new release gate.
2. Generate and use actual Supabase database types; preserve editorial copy while integrating operational records.
3. Implement SSR Auth/verified identities and fail closed when role/profile initialization is unavailable.
4. Read current `user_roles` for authorization and use guarded role/review RPCs; never trust editable metadata or JWT application-role claims.
5. Call **only** `list_public_professionals()` for public professional data. Do not add a view, public table SELECT policy, or a second eligibility predicate.
6. Render `/professionals` dynamically (`dynamic = 'force-dynamic'` and uncached database fetches), or prove immediate route invalidation on every verification/visibility/role/Auth-state change. Dynamic rendering is the preferred approach because trusted DB/Auth changes may occur outside Next.js. No persistent result cache may expose revoked professionals. Merely avoiding a data cache is insufficient if the page itself is statically rendered.
7. Use `ensure_own_profile()` separately from signup and `own_professional_verification()` without exposing review notes.
8. Validate inputs, use approved image publication separately, and authorize private Storage URLs server-side.
9. Keep bookings, scheduling, packages, payments, and notifications out of 3B's database/authentication scope.

Official references reviewed: [CLI workflows](https://supabase.com/docs/guides/local-development/cli-workflows), [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth user data](https://supabase.com/docs/guides/auth/managing-user-data), [Storage access](https://supabase.com/docs/guides/storage/security/access-control), [database tests](https://supabase.com/docs/guides/database/testing), [Auth user state model](https://github.com/supabase/auth/blob/master/internal/models/user.go).
