# Professional onboarding ? implementation handoff (24 October 2026)

The professional onboarding implementation is complete and ready for manual acceptance. The explicitly approved [20261024012000_professional_applications.sql](migrations/20261024012000_professional_applications.sql) was successfully deployed to development project **`nubblifjxikhpdvkgztt`** before this resumed turn. Its hosted application tables, RLS, RPCs and private bucket were verified then. This resumed turn did not repeat migration or database permission checks, alter migrations, create applications/accounts/credentials, or change real roles/bookings.

## Routes and real integrations

| Route | Implemented behavior |
| --- | --- |
| `/join-as-professional` | Public recruitment page using actual published Aara services, review explanation, professional entry links and no promises of income, appointments or automatic approval. |
| `/professional/register` | Dedicated registration presentation using the existing Supabase signup action. Metadata contains only the full name; the existing Auth trigger creates a customer role. Already-authenticated customers reuse their existing account and continue to the application. Confirmation preserves a validated application destination. |
| `/professional/login` | The existing Supabase password login, dedicated presentation and safe continuation. Customer applicants return to their application/status; professional-role users go to the dashboard and admins to administration. |
| `/professional/apply` | Confirmed customer accounts save owner-scoped drafts, choose existing active categories, enter qualifications/experience/biography/locations/PINs, upload private credentials, explicitly consent and submit their saved version. Submitted applications are locked and route to status; rejected applications may be revised/resubmitted. |
| `/professional/application-status` | Owner-only state, reference, feedback, submitted credentials and recent history. Approved professionals have a dashboard link. A historical approved application never overrides a subsequently revoked database role. |
| `/professional` | Professional-only dashboard with actual verification, approved-offering/review counts, upcoming/active assignments and actionable empty states. No invented revenue, appointments or ratings. |
| `/admin/professionals` | Real application queue with filters/pagination, qualification/contact/location details, pinned submitted private documents, review feedback/history and approve/reject decisions. Existing professional verification/suspension/reopen controls remain. |

Professional route groups separate public entry, authenticated applicant pages and professional-only tools without changing existing service/package, availability or appointment URLs. Layout and action authorization remain server-side; PostgreSQL is authoritative. Pending/rejected applicants retain customer access, including existing bookings and saved addresses, while workspace guards redirect them to application status. Existing profile/credentials functionality is reused, with access to onboarding credentials through application status.

Normal customer login still defaults to `/`. With no validated explicit `next`, professional-role users default to `/professional`, administrators to `/admin`. A dedicated professional login by a customer chooses the existing application/status. Safe internal `next` destinations win, but they never bypass role authorization. Recovery and ordinary confirmation defaults remain unchanged. Confirmation-required signup still shows the prominent Check your inbox state, makes no delivery claim, and sends no repeated email requests.

## Supabase contracts and approval

New records use `professional_applications` and append-only `professional_application_events`; existing Auth, `user_roles`, professional profiles and verification records remain the single authoritative systems. The application client never uses a service-role key.

- `save_professional_application`: fixed applicant-field allowlist, owner checks, draft/rejected edit restriction and optimistic version checks. No client role/approval/reviewer fields are accepted.
- `submit_professional_application`: validated saved details, explicit consent, supporting credentials and an active existing category. Database-pinned document paths and submission snapshots preserve the reviewed version.
- `review_professional_application`: one administrator-authorized transaction calls existing `change_user_role`, populates the existing professional profile and calls existing `review_professional`, then records the application decision and audit. A failed promotion/review cannot leave a false approved application. UI success is shown only after the RPC succeeds. Professional approval does not approve offerings, prices or booking coverage.

The new `professional-applications` bucket is private. Owner/application/random UUID paths, 10 MB PDF/JPEG/PNG limits, file-signature/MIME validation, no upsert and 60-second authorized read links are implemented. Up to 20 immutable files are retained with application/review history; corrections add a file rather than overwrite/delete. Consent and retention are explained before upload and submission. Admin document actions accept only paths pinned to a submitted application. The existing `professional-documents` bucket and policies remain unchanged.

The separately approved first-admin bootstrap was already completed for `zaidd.rizvii@gmail.com` (`a4074c7d-1be3-4566-b510-4c823e94f9fa`), audit ID `26f2083d-0db6-4d3a-8ff4-fdcd68cab750`. Do not repeat bootstrap. No role promotion occurred during onboarding implementation/testing.

## Verification actually executed

| Check | Result and scope |
| --- | --- |
| Approved migration deployment | **PASS**, previous implementation segment: only the approved file was pending and applied; actual public types regenerated. No migration/reset was repeated on resume. |
| New schema and existing boundaries | **PASS configuration**, previous segment: both tables have RLS; three public application RPCs and private bucket/policies exist; existing professional verification functions and document policies were preserved. |
| Hosted permission probes | **PASS**, previous segment: anonymous application read/review and customer review denied; direct application insert/update grants absent; foreign/nonexistent document predicates denied; invalid customer application rejected before a write. These used existing customer JWT contexts in rollback-only transactions. The original READ ONLY transaction could not take the existing authorization row locks; allowing locks in a rollback-only transaction resolved the test setup without data writes. No probes were repeated on resume. |
| TypeScript | **PASS**, `npm.cmd run typecheck`. |
| ESLint | **PASS**, `npm.cmd run lint`. |
| Focused unit/component tests | **PASS**, 61 tests in six relevant files: professional application actions/validation, professional entry/workspace gates, changed Auth role/default redirects, confirmation/recovery, proxy/cookie preservation and signup confirmation. Supabase calls are mocked; binary-file fixtures are local test data only and were not uploaded. |
| Production build | **PASS**, Next.js 16.4.1. All seven required routes and preserved trainer/customer/admin routes compiled. |
| Focused browser checks | **PASS**, two production-browser tests at 375px/1440px: recruitment/registration/login links, safe application continuation, protected professional route redirects, preserved customer signup/booking boundary and no horizontal overflow. No signup, credential upload, application decision or role change was performed. Authenticated applicant/admin panels still need real-account manual acceptance. |
| Real applicant signup/email, upload, submitted isolation and admin approval/rejection | **UNVERIFIED / manual acceptance required**: no legitimate application or private credential was submitted automatically. Mocked action tests and empty-table denial probes do not prove these live state transitions. |

All executed code checks passed on their first pass in the resumed turn; no repair/retest cycle was needed. Only relevant tests were run. No historic full suite, Docker setup, unrelated audit, new feature phase or automatic GitHub push was performed.

## Manual setup and acceptance

Use localhost port **3001** with the existing environment configured for the development Supabase project. Confirm the Supabase Site URL, permitted `/auth/confirm` callback/redirects and working SMTP/sender manually. Signup passes a callback with validated `next=/professional/apply`. If the hosted confirmation template still hardcodes `next=/`, update it manually to preserve the requested application destination for automatic continuation. Otherwise, verification still works and the Check your inbox screen's dedicated login link resumes the application. No hosted Auth settings were changed automatically.

1. A genuine practitioner opens `/join-as-professional`, registers or logs in with their existing account, confirms email and continues to `/professional/apply`. Confirm their role is still customer and approved-only tools are inaccessible.
2. Save genuine details, upload actual supporting credentials, consent and submit. Check pending status, reference, private document access and the lock on submitted edits. Do not use fictional qualifications or files for hosted acceptance.
3. The existing authorized administrator reviews `/admin/professionals`. First request corrections and verify applicant feedback/edit/resubmit; then approve only after genuine review. Confirm atomic role/verification/application/audit results, including safe handling of stale review attempts.
4. Refresh or sign in as the approved professional; open `/professional` and existing services/packages, availability and appointments. Set actual working areas/hours and submit real offerings for their independent approval.
5. With a second legitimate account, verify it cannot read/open another application's details or documents. Complete a genuine email/session/recovery check as appropriate. Keep existing customer bookings intact.

No known critical implementation/build blocker remains. Genuine authenticated applicant/admin acceptance and email-provider/template settings are the remaining operational checks. No Phase 5 payment work is included. The unrelated `next-env.d.ts` edit is restored from its pre-build snapshot and excluded from the implementation commit.
