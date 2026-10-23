# Phase 4B deployment and interface handoff — 24 October 2026

Phase 4B code and the three role interfaces are implemented. Both explicitly approved migrations were applied to development project **`nubblifjxikhpdvkgztt`**, in order:

1. [20261023101357_booking_fulfillment.sql](migrations/20261023101357_booking_fulfillment.sql)
2. [20261024002611_professional_offerings_and_agreements.sql](migrations/20261024002611_professional_offerings_and_agreements.sql)

The pre-deployment dry run listed only those files, no seeds or role files. CLI application succeeded for both. Hosted migration history includes all six migrations. No migration file was rewritten, database reset performed, customer record changed, account created, or role promoted. Application types were generated from the actual hosted public schema. Phase 5 has not started.

## Implemented interfaces

All pages use verified server sessions, role authorization and the existing PostgreSQL RLS/RPC rules. No service-role client is used. Responsive forms retain the Aara palette/typography and show success only after a successful Supabase response. Availability and appointment times explicitly use Asia/Kolkata.

| Role | Routes and working integration |
| --- | --- |
| Professional | Existing `/account/professional`: edit permitted profile fields including specializations while pending/rejected; read locked verified claims; upload private PDF/JPEG/PNG credentials up to 10 MB and open short-lived owner-scoped links. An administrator must reopen material profile changes. |
| Professional | `/professional/services`: create single-session treatments or recurring Yoga packages, save drafts, edit rejected drafts, submit saved revisions, inspect decisions/feedback, and propose revised prices/terms without editing immutable approved revisions. Navigation includes Yoga Packages and Approval Status. |
| Professional | `/professional/availability`: add/remove weekly working windows, save the complete weekly schedule, add/remove time off, view approved working areas, and request administrator-reviewed coverage additions/removals. No working hours or PIN coverage are invented. |
| Professional | `/professional/appointments` and `/professional/appointments/[id]`: own assignments, scoped details, accept/decline, start and complete visits. Acceptance requires customer agreement. Full contact/address details are fetched only through the scoped details RPC. Latest 100 appointments are shown. |
| Administrator | `/admin/bookings`: real paginated requests with status filters; `/admin/bookings/[id]`: submitted customer/address/preference, exact-time eligibility/slot checks, approved-offering proposal/reassignment, cancellation decisions, immutable offering revision details, and booking event history. A retry key binds retries to the original proposal. |
| Administrator | Existing `/admin/professionals`: qualifications/experience/specializations and private documents, professional verification/rejection/suspension or reopening review. |
| Administrator | `/admin/services/offerings`: offering and price revision review, feedback, approval/rejection, suspension/resumption, coverage requests and review history. Existing platform publication remains at `/admin/services`. |
| Administrator | `/admin/history`: latest 100 events per verification/role, offering/coverage, and booking category. Audit data is read-only. |
| Customer | Existing `/account/bookings` and detail route: readable live statuses, exact proposed offering/package/INR terms, explicit accept/decline, agreement deadline, confirmed interval, original request/address, agreement summary and history. Existing saved addresses and pending cancellation are preserved. After assignment, cancellation is a request for administrator resolution. |
| Public | Service detail pages display only actual `list_public_offerings` output using a sessionless, uncached public client. Empty results and data failures are honest. The editorial service pages, verified directory and service-level booking journey are preserved. |

Administrator assignment history selects only explicitly granted columns. Its terms display comes from the immutable approved offering revision and recorded assignment times; it does not broaden direct table privileges. Customers obtain their actual immutable quote/agreement through `customer_booking_offer`. Detailed internal event history remains administrator-only; customer screens show their submission, agreement/cancellation milestones and current state.

## Booking and commercial rules

The original GiST range exclusion and one-active-assignment unique index remain deployed. The new proposal path validates current professional eligibility, service authorization, exact approved PIN coverage, approved offering revision/duration, weekly availability and time off. The deprecated platform-duration-only proposal entrypoint is not executable by authenticated clients.

The customer explicitly accepts the quoted INR price, package/session terms and exact schedule before professional acceptance can confirm. Outside-preference proposals are clearly identified and require that same explicit agreement. Four weeks is not a calendar month. Approved revisions and agreed terms remain immutable; no package purchase, payment, purchased credits or renewal is implemented.

Proposals expire at the earlier of 24 hours or appointment start, including while waiting for professional acceptance. Work-area reads refresh expiry before reading state; scheduling functions also clean up expired reservations. This is opportunistic cleanup, not a background job. A failed transaction rolls back its cleanup; the next successful refresh releases expired reservations. Customer agreement does not automatically confirm a visit. Reassignment, cancellation, decline, expiry and eligibility revocation preserve history and release the corresponding reservation.

## Executed verification

| Check | Result and scope |
| --- | --- |
| Hosted deployment/history | **PASS**: both migrations applied; all six migration versions recorded. |
| Eight new application tables and RLS | **PASS**, hosted catalog: weekly availability, time off, assignments, fulfillment events, offerings, revisions, coverage requests, offering events. All have RLS enabled. |
| Required booking/offering functions | **PASS**, hosted catalog, including proposal, customer agreement, professional response, offering save/review/list, schedule and lifecycle functions. |
| Overlap / one-active-assignment / agreement constraints | **PASS configuration**: hosted catalog confirms exclusion constraint, partial unique index and confirmation-requires-customer-agreement check. **UNVERIFIED runtime/concurrency**: no booking fixtures or simultaneous assignments were created. |
| Anonymous privacy and writes | **PASS runtime database-role probes**: anonymous booking/revision reads and agreement/assignment RPC calls were denied. Public offering listing executed and returned zero records. |
| Customer ownership and role isolation | **PASS read-only database-context probes**: with transaction-local JWT subjects for the two existing legitimate customer identities, the booking owner saw their one request; unowned bookings/addresses returned zero; the designated separate account could not read the original customer's booking. Customer calls to offering review, assignment proposal and professional response raised insufficient privilege. This simulates PostgreSQL JWT context; it is not browser login acceptance. |
| TypeScript | **PASS**, `npm.cmd run typecheck`. |
| ESLint | **PASS**, `npm.cmd run lint`. |
| Focused unit/component/action tests | **PASS**, 21 tests across five files: fulfillment validation, fulfillment actions, fulfillment forms, existing booking actions and auth proxy. Supabase action results/authorization are mocked; these do not prove hosted transitions or concurrency. |
| Production build | **PASS**, Next.js 16.4.1; all new routes compiled. |
| Focused browser checks | **PASS**, two tests at 375px/1440px: real public offering section, preserved service booking link, no overflow, and logged-out redirects for professional/admin/customer routes. No hosted write or account creation. Authenticated panel rendering was not browser-tested. |

PowerShell initially blocked the `npm.ps1` launcher before checks ran; `npm.cmd` ran the checks normally. All code checks passed on the first executed pass. No code repair/retest cycle was needed. No historic full test suite, Docker setup or unrelated audit was run.

## Acceptance still required

Hosted verification found **zero administrators, zero professionals and zero active assignments**. No eligible offerings exist. The designated separate account remains a customer; administrator promotion is separately unapproved and was not performed. Keep the prepared [secure first-admin bootstrap](PHASE_3A_HANDOFF.md#trusted-first-admin-bootstrap-and-recovery) pending until the user specifically authorizes that operation.

After legitimate role setup, acceptance must cover trainer profile/document submission, admin verification, actual coverage and weekly hours, draft/reject/resubmit/approve, old-price retention during revision review, customer agreement, professional acceptance, start/completion, cancellation/reassignment and suspension. In particular, trainer-to-trainer isolation, authenticated private Storage access, actual double-booking races and commercial agreement transitions remain **UNVERIFIED** against real operational records. Do not mark them passed based on catalog or mocked tests.

No critical build/deployment defect is currently known. Operational acceptance is blocked by missing legitimate admin/professional roles and genuine approved coverage/offerings. The Phase 4B implementation is ready for that acceptance; Phase 5 should wait for essential authenticated acceptance. No GitHub push was performed. The unrelated `next-env.d.ts` edit is preserved and excluded from the focused commit.
