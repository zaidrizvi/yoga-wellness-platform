# Professional onboarding — database approval checkpoint

Target: **`nubblifjxikhpdvkgztt`**. No hosted changes were made for this enhancement.

Complete pending SQL: [20261024012000_professional_applications.sql](migrations/20261024012000_professional_applications.sql).

## Inspected existing state

The hosted project has `user_roles`, `professional_profiles` and `professional_verifications`, but no applicant/application tables. The existing private `professional-documents` bucket admits owner uploads only after professional-role assignment; granting customers access there would change an existing security boundary. Its policies and all existing migrations remain unchanged.

One administrator now exists. The separate, explicitly approved first-admin bootstrap was completed earlier for `zaidd.rizvii@gmail.com` (`a4074c7d-1be3-4566-b510-4c823e94f9fa`), with role-change audit ID `26f2083d-0db6-4d3a-8ff4-fdcd68cab750`. Do not bootstrap again. That approved role change is separate from this pending schema deployment.

## Proposed minimal addition

- `professional_applications`: one private application per existing Auth user, draft/submitted/approved/rejected status, practical qualification/contact/category/experience/location/PIN fields, consent, pinned submitted document paths, review feedback and optimistic concurrency timestamps. Applications do not grant service-area authorization.
- `professional_application_events`: append-only owner/admin history; submitted snapshots preserve the details and documents actually reviewed. No second professional profile, verification or role system is introduced.
- `save_professional_application`: only a confirmed eligible customer can save their own draft or revise a rejected application. It accepts a fixed field allowlist and cannot accept roles, approval flags or reviewer data.
- `submit_professional_application`: requires complete details, an active existing category, explicit review consent and at least one uploaded credential. The database pins document paths and submission details. Submitted details cannot be edited through the API.
- `review_professional_application`: administrator-only, stale-review protection and explicit feedback/visibility choice. Approval calls the existing `change_user_role`, copies reviewed claims into the existing profile, calls existing `review_professional`, then records the application decision/audit in one transaction. Any failure rolls everything back. Approval can target only a confirmed eligible customer, so it cannot demote an existing administrator or silently reapprove a professional. Individual offerings and prices still need separate review.
- Private `professional-applications` Storage bucket: 10 MB PDF/JPEG/PNG limit, UUID owner/application/file paths, applicant-owned draft/rejected uploads only, owner/admin reads, no anonymous access or public links. Existing `professional-documents` policies remain untouched. Maximum 20 immutable uploads per application; corrections add a new file, with no overwrite/delete API policy. Review history retains earlier credentials. UI consent must explain that retention. File signature/size validation and short-lived signed document links remain part of the pending application integration.

Only authenticated role-checked RPCs write application tables. Clients receive SELECT with owner/admin RLS, no direct insert/update/delete grants. Function execution defaults are explicitly revoked; public RPCs and two private Storage-policy predicates have narrow authenticated execution grants. Private helpers are not exposed through the Data API. Application mutations and document metadata authorization reuse the existing administrator-role lock to serialize submission and approval with role changes; the existing role-to-fulfillment lock order is preserved.

Deploying this file creates empty application/audit tables and a private bucket, functions, indexes and policies. It does not seed accounts, applications, qualifications or credentials; promote anyone; approve offerings; modify customer data or bookings; change existing tables/functions/policies; or implement payments.

## Checks actually executed

| Check | Result |
| --- | --- |
| Relevant hosted schema/Storage inspection | PASS: no existing application tables; professional-only document restriction confirmed; one administrator exists |
| New migration outer grammar | PASS: 27 SQL statements |
| Function grammar | PASS: four PL/pgSQL bodies and one SQL-language body parsed, not executed |
| Static permission/access contracts | PASS: explicit execution revokes/empty search paths, no direct application write grants, no destructive operations, calls to the existing role-change and verification functions |
| Single migration dry run | PASS: exact project above; only `20261024012000_professional_applications.sql` pending; no seeds or roles |
| Hosted application/Storage/approval transitions | UNVERIFIED: migration not deployed; no applicants or credentials created |
| New frontend/auth integration checks | Not run: application UI and dashboard work are intentionally pending this database checkpoint |

A dry run does not execute migration bodies, RLS, Storage policies or approval transitions. Existing frontend and Phase 4B tests were not repeated. No Docker, new project, privileged application client or Phase 5 functionality was introduced.

## Resume after explicit deployment approval

1. Apply only the approved file, verify tables/policies/functions/bucket, and regenerate actual hosted types. Do not rewrite prior migrations or repeat bootstrap.
2. Add `/join-as-professional` recruitment and `/professional/apply` dedicated signup/onboarding using the existing Auth provider. Preserve validated application continuation through signup/email confirmation; never assign a role through signup metadata. Existing verified customers reuse their Auth account.
3. Add owner-only draft/save/upload/submit/status/history at `/professional/apply` and `/professional/application-status`, with honest confirmation/error feedback and consent. Pending/rejected applicants retain the customer role and cannot reach professional-only tools.
4. Split the existing professional route layout into onboarding and professional-only workspace guards without changing current tool URLs. Build `/professional` overview using actual verification, offering and upcoming-assignment data; reuse existing profile/services/packages/availability/appointment screens.
5. Extend `/admin/professionals` with application/document review and the atomic review RPC. Retain current professional verification/suspension/reopen functionality.
6. Make default login destinations role-aware using the authoritative role query: customer `/`, professional `/professional`, admin `/admin`; safe explicit `next` wins. Preserve recovery and ordinary confirmation behavior. Applicants get status navigation without receiving trainer privileges.
7. Run one focused TypeScript/lint/relevant unit/build/browser pass after integration stabilizes; at most two focused repair/retest cycles. Distinguish mock/static checks from actual hosted acceptance and do not create fake practitioners or credentials.

**Approval required:** deploy only `20261024012000_professional_applications.sql` to `nubblifjxikhpdvkgztt`. The enhancement is not complete at this checkpoint; no new onboarding route or live application success is claimed yet.
