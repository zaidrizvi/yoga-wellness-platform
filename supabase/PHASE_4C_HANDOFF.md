# Phase 4C — local implementation and deployment approval checkpoint

Date: 24 October 2026. Intended development project: **`nubblifjxikhpdvkgztt`**.

No hosted Supabase connection, migration dry run, data mutation, user creation, role change, coverage change or booking change was performed in Phase 4C. Previously applied migrations remain unchanged. Phase 5 has not started. **Phase 4C is not operationally accepted or complete at this checkpoint.**

## Implementation summary

| Feature | Previous gap | Local result | Evidence |
| --- | --- | --- | --- |
| Coverage | No underlying PIN-area management screen | `/admin/coverage` is prepared with create/edit/activation decisions, reason/confirmation, reference counts and audit history. It explicitly shows a migration-required state until its backend exists. | `src/app/admin/coverage`, `src/app/admin/operations-actions.ts`, proposed SQL |
| Team | No general administrator-management screen | `/admin/team` is prepared with exact UUID lookup, eligibility/current-role display, reason/confirmation, stale-version protection, self-change denial and existing role audit. No email directory or account creation. Migration required before use. | `src/app/admin/team`, controlled wrapper calling existing `change_user_role` |
| Pricing | Generic service records could display a platform quote | Generic service presentation no longer supplies platform price/duration. Booking and service detail pages explain actual approved trainer terms, explicit customer agreement and professional acceptance. Existing approved offering prices/snapshots are untouched. | `src/lib/data/public.ts`, service detail and booking pages |
| Yoga/process | Described implemented request/fulfillment features as unavailable | Current request → reviewed offering → customer agreement → professional acceptance → tracked visit explanation. Session-count illustrations are not purchases; four weeks differs from a calendar month. Actual offerings remain linked through service pages. | `src/content/process.ts`, services/home content, Yoga and process pages |
| Customer history | Latest proposal/milestones omit reassignment and professional acceptance | Customer-safe event timeline is prepared; current milestone fallback remains available before migration. No internal reasons/actor identities/addresses are exposed. Cancelled bookings no longer show a stale cancellation-awaiting-review message. | `src/components/fulfillment/customer-history.tsx`, proposal component, scoped SQL RPC |
| SEO | Recruitment missing from sitemap; private route rules incomplete | Recruitment canonical metadata and sitemap entry; exact professional-root/private-prefix robots rules preserve `/professionals` and recruitment. Existing private layouts retain noindex. | Sitemap, robots, recruitment metadata |

Existing professional application approval, profiles, offerings, price revisions, availability and appointments remain in place. Admin navigation includes Coverage Management and Team Management.

## Required database approval

Complete SQL: [20261024020000_admin_operations_and_customer_history.sql](migrations/20261024020000_admin_operations_and_customer_history.sql).

**Prepared locally only. Not applied.** No remote pending-migration/history assertion is made; hosted inspection was not authorized in this milestone. The earlier seven deployed migrations are documented by prior handoffs.

Security-sensitive effects proposed:

- New RLS-protected, admin-readable, append-only `service_area_events`; coverage writes record the previous/new name, PIN and active state plus actor and mandatory reason.
- `admin_save_service_area` uses existing role/fulfillment locks, current administrator checks, validated six-digit PIN format, optimistic timestamps and the existing area UUID. Referenced PINs cannot change; create a new area instead. No area deletion is exposed. Legacy NULL-PIN areas can remain inactive/deactivate without changing references; creation/activation requires a valid PIN. A configured PIN's business support still requires the administrator's judgment; no postal-address verification service is invented.
- Authenticated direct INSERT/UPDATE/DELETE privileges on `service_areas` are revoked so the application uses the audited write path. Existing SELECT/RLS and professional coverage requests/approvals remain. Deactivation retains references and invokes existing eligibility hooks; affected active assignments may be invalidated and require reassignment. The migration itself updates no area or booking rows.
- `admin_team_lookup` returns only one exact UUID's name, role/version and eligibility flags to a current admin. It exposes no email/phone directory and creates no Auth user.
- `admin_change_team_role` requires current admin authority after the existing role lock, an unchanged target role/version, mandatory reason and confirmed eligible target for promotion. It calls existing `change_user_role`; it never directly writes roles or grants professional access. Revocation returns the account to customer. UI warnings explain that promoting a professional replaces their sole role and may invalidate professional work; a separate administrator account is preferable.
- The original `guard_role_mutation` and `change_user_role` protections were inspected in source: role serialization, no self changes, no final admin-row removal and role-change auditing exist. The proposed additive `guard_last_eligible_administrator` trigger also prevents a role removal leaving only banned/deleted/unconfirmed administrators; the original role-change path cannot bypass this trigger. No guard or RLS is disabled.
- Focused security correction: the pending migration also adds `private.guard_administrator_eligibility`, a BEFORE UPDATE trigger on Auth `banned_until`, `deleted_at` and `email_confirmed_at`. Actual changes, including eligibility restoration and non-admin changes that could race with promotion, acquire the existing administrator advisory/row lock. Under READ COMMITTED it rechecks for another confirmed, non-deleted, non-banned administrator after acquiring the lock; losing the final eligible administrator raises `23514` and rolls back. Unchanged fields return immediately. Original soft-delete, role/cascade, audit and professional-approval guards remain enabled; no applied migration is edited and no new client EXECUTE permission is granted.
- `customer_booking_timeline` authorizes only the current customer’s own booking, returning event UUID, whitelisted milestone key and timestamp. It reads existing audit rows without exposing reasons, actor identities, private checks, commercial fingerprints or customer addresses. Both agreement and professional acceptance remain required by existing database rules.
- New/replaced function execution is explicitly revoked from PUBLIC/anon/authenticated and narrowly granted to authenticated API entrypoints; private trigger execution is not granted to clients. All function search paths are empty. No Storage policies or existing role/application RPC definitions change.

Client calls use a small explicit pending-RPC adapter because actual generated hosted types cannot include undeployed functions. Existing generated types were not fabricated. Missing-function responses produce a migration-required notice for admin screens, and customer history retains the old milestones. Other authorization/network failures are not misrepresented as migration absence.

## Operational prerequisites and acceptance evidence

| Item | Evidence classification |
| --- | --- |
| First administrator | Confirmed configured in previous bootstrap verification. Do not repeat bootstrap. |
| Professional onboarding | Owner reports manual acceptance. Independent recorded tests cover entry UI, mocked actions and database-context denials; not every rejection/document/isolation sub-step was independently verified. |
| Active categories/services | Initial genuine categories/services and publication integration documented in prior handoffs. Their present hosted state was not re-queried. |
| Current approved professionals/offerings/PINs/hours | Not independently verified in Phase 4C. Do not call these missing based on an old empty-data snapshot. Owner should confirm via the authorized interfaces. |
| Email provider/redirect settings | Not independently verified here. Owner-reported onboarding supports the exercised flow, not all recovery/cross-device/template cases. |
| Migration history | Previously documented through onboarding. New Phase 4C SQL is local only; no hosted history inspection was performed. |

| Journey | Source/unit evidence | Real acceptance evidence |
| --- | --- | --- |
| A: customer request | Existing Auth/address/submission/history integration; prior mock tests and limited database-context probes. | Genuine booking submission previously reported; complete authenticated address/cancellation journey not independently documented. |
| B: professional onboarding | Existing dedicated entry/application/document/admin approval/dashboard integration; prior focused tests. | Owner-reported manual onboarding acceptance; no new account or promotion performed here. |
| C: offering/package/price approval | Existing trainer forms, immutable revisions, administrator decisions and public-safe listing. | Genuine full offering/revision/publication journey remains unverified in recorded evidence. |
| D: quote → customer agreement → professional acceptance → completion | Existing controlled RPCs and status/confirmation guards; approved offering drives immutable terms. | Full legitimate multi-account authenticated journey still needs acceptance. |
| E: expiry/cancellation/reassignment/time off/overlap/suspension | Existing exclusion/unique constraints, controlled transitions and eligibility hooks; previous catalog/context evidence. | Real conflicts, concurrent assignment races and correction workflows remain unverified. |

## Checks actually run

- **PASS — focused last-eligible-admin correction (24 October 2026):** `node scripts/test-admin-eligibility.mjs` parsed the updated pending SQL and executed the actual new trigger functions plus existing role lock, role guard and soft-delete guard on installed local PostgreSQL 18.6. The runner creates its own disposable loopback-only cluster with a minimal Auth/role schema; it never reads environment files or uses a hosted connection. SQL regressions are in `supabase/tests/security/admin-eligibility.sql`. Two eligible administrators, one eligible/one banned, blocked final-admin ban/soft-delete/unconfirmation/demotion/hard-delete, permitted changes with an eligible replacement, unban/undelete/reconfirmation, expired bans, bulk-update atomic rollback, ordinary customer Auth transitions, trigger EXECUTE restrictions and empty definer search path all passed.
- **PASS — focused real concurrency:** six two-session schedules observed actual database lock waits: ban versus ban, ban versus soft-delete, ban versus role demotion, role demotion versus ban, committed unban versus role demotion (permitted), and rolled-back unban versus ban (rejected). Each finished with one eligible administrator. An Auth eligibility mutation under REPEATABLE READ was rejected by the existing lock helper. The runner stopped its disposable cluster afterward. These are real local PostgreSQL guard tests, **not** hosted Supabase/Auth HTTP API, full-schema integration or professional-approval acceptance tests.
- Local runner setup initially encountered the Windows sandbox restricted-token error and then inherited output-pipe handling during server startup. Elevated local execution and detached server output resolved these harness-only issues; the temporary cluster from the failed setup was stopped. The migration required no repair after its first actual SQL/concurrency execution. No frontend tests or previous database audit suites were repeated for this correction.
- **PASS — correction tooling:** targeted ESLint on `scripts/test-admin-eligibility.mjs` and `git diff --check`. No frontend or project-wide checks were rerun.
- **Earlier implementation baseline:** original proposed SQL outer grammar, 25 statements; seven PL/pgSQL bodies parsed. Static tests covered explicit grants/search paths, original role-change reuse, last-eligible-admin guard, immutable referenced PINs and customer-safe timeline output. The complete migration remains **unexecuted against PostgreSQL**; only the guard subset described above was subsequently executed locally.
- **PASS:** TypeScript and ESLint. Final legacy-NULL-PIN compatibility adjustment received targeted lint, typecheck and admin-unit revalidation.
- **PASS:** 18 unique focused unit checks across `admin-operations.test.ts` (14 final tests) and `phase4c-public.test.tsx` (four unchanged tests). Admin role guards/RPC results are mocked; SQL assertions are source contracts, not hosted security proof.
- **PASS:** final production build with isolated dummy Supabase configuration. All changed routes compiled.
- **PASS:** two focused local Playwright checks at 375px/1440px: process/Yoga copy, no horizontal overflow, and logged-out coverage/team redirects. Dummy Supabase configuration prevented hosted project contact. No authenticated admin decision or customer timeline was exercised.
- The temporary browser harness needed two setup corrections: its working directory and a static `/robots.txt` readiness URL instead of the data-backed homepage. Those failed startup attempts ran no browser tests. Application checks passed; one later legacy-PIN compatibility correction was focused and revalidated. No historic suite, database security rerun, Docker or dependency installation occurred.

The ignored production build artifacts use **dummy backend configuration** from isolated verification. Use normal `npm.cmd run dev -- --port 3001` with the existing `.env.local`, or rebuild normally after approved deployment, before real-account acceptance. No environment file was edited. The unrelated `next-env.d.ts` edit was restored from its exact pre-build snapshot and is excluded from the commit.

## Outstanding work and readiness

**P0 / operational checkpoint:** approve and deploy only the proposed migration before using coverage/team writes or the expanded timeline. Then regenerate actual schema types, use the actual generated RPC signatures and verify the new functions/policies/trigger. No existing migration should be reapplied or rewritten.

**P0 / acceptance:** with legitimate accounts and genuine business records, confirm actual offerings/PINs/hours, run one full customer/admin/professional appointment, then expiry, cancellation/reassignment, time-off/overlap and suspension checks. Obtain explicit authorization before any hosted role/coverage/booking mutation. Do not create synthetic hosted practitioners or data.

**P1:** after approved deployment, accept coverage create/edit/deactivate and reference preservation; accept exact-account promotion/revocation and revoked-session/stale-version denial using separately authorized accounts. Last-admin runtime proof must be controlled and non-destructive; never remove the final administrator to test it. Verify customer milestone privacy/isolation on actual owned/foreign bookings.

**P2:** normal final-launch photography/canonical-domain preparation remains outside this milestone. No payment or entitlement feature is included.

Readiness answers: Phases 1–4 are **not yet operationally complete**; the admin can use coverage/team only **after migration deployment**; public pricing/process presentation is aligned; real booking flows remain insufficiently accepted; one migration awaits approval; Phase 5 payment integration should wait for approval and focused operational acceptance. Independent content/SEO work is complete. No additional architecture or redesign is needed.

## Resume sequence after approval

1. Confirm the exact project/pending file under the newly authorized operation, deploy only this file, and perform focused non-destructive object/permission verification.
2. Regenerate actual hosted types and remove the temporary pending-RPC type escape without changing the public contracts. Build with normal environment configuration.
3. Complete separately authorized real-account acceptance above. Previously passing unrelated checks do not need repetition.

No GitHub push was performed. See the local implementation commit for the precise source/test/documentation file list; only the unrelated generated `next-env.d.ts` change should remain outside it.
