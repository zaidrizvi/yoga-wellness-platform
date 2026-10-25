# Phase 4E — deployed marketplace and Delhi discovery approval checkpoint

25 October 2026. Supabase development project: **`nubblifjxikhpdvkgztt`**. No GitHub push or Phase 5 work. Existing users, roles, bookings, professional approvals and operational coverage were not changed by acceptance probes.

## Hosted migration status

The linked project reference and remote migration history were checked immediately before deployment. Corrected Phase 4C `20261024020000_admin_operations_and_customer_history.sql` was already applied. Exactly the following two migrations were pending and explicitly approved; the supported `supabase db push --linked --yes` workflow applied them successfully in order, with no seeds, resets, role changes, history repair or conflict:

1. **APPLIED** — `20261025090000_marketplace_localities_direct_booking_and_bundles.sql`.
2. **APPLIED** — `20261025090001_delhi_locality_catalog.sql`.

Read-only hosted history queries independently confirmed both versions. Previously applied migration files were not edited or reapplied.

**PENDING SEPARATE APPROVAL** — [20261025110000_public_delhi_locality_catalog.sql](../supabase/migrations/20261025110000_public_delhi_locality_catalog.sql). This adds only `marketplace_catalog_locations()`: an anonymous/authenticated, empty-search-path SECURITY DEFINER projection of Delhi IDs/names/source district labels, with configured service-area summaries (empty for unconfigured names). PUBLIC default EXECUTE is revoked, explicit anon/authenticated EXECUTE granted. It does not grant direct table reads, change verification/activation, add mappings, approve professionals or change any booking/coverage guard. Existing `marketplace_locations()` remains the serviceable-only authority. This file has NOT been deployed. Review its complete SQL before approval.

## Actual hosted verification

All probes were read-only; no synthetic hosted account, booking, coverage request or business record was created.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Phase 4C and two approved Phase 4E versions | PASS | Hosted migration history includes all three exact versions. |
| Six new tables and RLS | PASS | `marketplace_localities`, `locality_service_areas`, `marketplace_audit`, `customer_booking_choices`, `marketplace_bundles`, `marketplace_bundle_items` exist with RLS enabled. |
| New functions and triggers | PASS | Catalog, directory, preview, direct submission, alternative consent, admin catalog, coverage request and private proposal helpers exist; checked DEFINER functions have empty search paths. Choice-binding and immutable-audit triggers exist. |
| Imported geography state | PASS | 2,258 catalog rows; zero verified; zero active; zero locality-to-service-area mappings. No automatic serviceability or professional approvals. |
| Anonymous runtime public reads | PASS | Under `SET LOCAL ROLE anon`, serviceable locations, directory and public bundles execute and return empty arrays, matching the unconfigured state. |
| Private table / privileged EXECUTE restrictions | PASS (catalog) | anon has no SELECT on catalog/choice tables and no EXECUTE on admin catalog, direct submit, coverage request, alternative or private proposal functions. Public directory/location/preview EXECUTE is allowed. |
| Admin runtime denial | PASS (limited role context) | An authenticated role context without a user identity was denied the admin catalog operation. This is not a signed-in non-admin account test. |
| Public discovery catalog | BLOCKED | New catalog RPC does not yet exist remotely; separate migration approval required. |
| Real trainer pending-coverage exclusion / owned direct booking / customer agreement / admin bulk writes | UNVERIFIED on hosted accounts | No legitimate records were modified. Existing guards remain; prior local booking/security evidence is retained below. |

## Local implementation completed

- Public homepage/directory remain anonymous, default **All Delhi**, with name/district search, no customer PIN entry, optional selection and clearing. Public data now uses the separate catalog projection when available; if the additional RPC is pending, it falls back to serviceable locations and explicitly explains the missing catalog approval. It never bypasses database grants using a service key.
- A selected valid catalog locality can have zero service-area mappings and zero professionals. The exact empty message is **“No professionals available in this area yet.”** Clearing returns the existing all-eligible-Delhi directory query. Listing a name does not claim availability or verification.
- Trainer `/professional/availability` uses the same discoverable names after approval, supports multiple selections, and labels configured/requested/approved/rejected/unavailable areas. Empty mappings are explicitly unavailable (never vacuously “Approved”). Requests are disabled when selections include unavailable names or exceed 20; configured requests still use the original guarded coverage operation and require admin approval.
- `/admin/coverage` offers select-all and bounded bulk activation of existing inactive PIN-configured areas. `/admin/coverage/localities` offers bulk activation of already verified, genuinely mapped localities on the current results page; mappings must point to active PIN-configured areas. Imported unverified/unmapped names are excluded. `/admin/services/offerings` offers bulk approve/reject of actual submitted professional coverage requests.
- Bulk operations require server-side administrator authorization, explicit selected IDs, reason/feedback and confirmation. Existing per-record RPCs retain authorization, version checks where available, validation, locking and audit. Each batch is bounded to 100 and stops at the first failure, reporting how many decisions were saved. A batch is not atomic. It does not invent PIN mappings, mark geography verified, or grant a professional role. No new bulk database privilege is required.
- Public profiles, approved services/prices/packages, trainer-bound booking, validated login/signup continuation, explicit customer agreement, professional acceptance, alternative authorization, historical snapshots and existing admin-assisted `/book/[serviceSlug]` fallback remain intact. No payment, purchased package credit or bundle entitlement is implemented.
- Existing role-aware desktop/mobile navigation from commit `e95b3ee` remains: guests receive login/signup/recruitment; ordinary customers account/bookings; submitted/rejected applicants application status; professionals dashboard/appointments; admins dashboard; authenticated users logout. Recruitment remains in the footer. No authorization depends on client flags.

## Focused verification for this deployment checkpoint

- **PASS** — TypeScript, ESLint and production build for the focused changes. No app dependency was added.
- **PASS** — eight initial new unit/component/action checks: unconfigured name selection/clearing, unavailable trainer submission prevention, pending status without approval, bulk admin guard, original review RPC use, partial failure, PIN-less rejection and reviewed-version activation. One additional directory test verifies the exact requested empty state and selected unserved name. Its assertions were corrected to target the named location input and exact string value (two focused test repair/retest cycles); no app failure was found.
- **PASS** — `node scripts/test-marketplace-database.mjs --catalog-only` applies the schema chain in a disposable loopback PostgreSQL 18.6 cluster with minimal Auth/Storage stubs and runs ONLY the new catalog security scenarios. The full prior booking SQL suite was not rerun. Real SQL confirms all 2,258 names discoverable despite zero serviceable areas, allowlisted projection keys, selected/cleared empty directory, no anonymous table access, and denied privileged operations. This is local SQL evidence, not hosted acceptance of the pending migration.
- **PASS** — two focused Playwright checks: actual anonymous homepage/directory against the deployed Supabase project via the local production app (200 responses, All Delhi, explicit pending-catalog message, clearing and login protection for admin/fallback booking); real combobox keyboard search/select/clear/multi-select at 320px in an explicit local component fixture. No accounts or bookings were created. The complete previous browser suite was not rerun.
- **Prior passing evidence retained, not repeated:** local real PostgreSQL checks for approved filtering, same-PIN distinct-locality isolation, immutable consent, owned address routing, exact retry, conflict rollback, blocked trainer substitution, fresh alternative consent, bundle eligibility and pending coverage exclusion; earlier auth continuation and responsive public route checks. Actual two-session races and populated hosted multi-account journeys remain unverified.

## Location setup and acceptance requirements

1. Approve the complete new catalog projection migration above. Until applied, all imported names remain unavailable in the hosted public/trainer selector because the deployed serviceable-only RPC correctly hides them. The local UI explains this dependency; it does not mark names active to bypass it.
2. Browsing imported names needs no service activation after the projection is approved. Source district labels are historical grouping labels, not current administrative boundaries. See [data/localities/README.md](../data/localities/README.md) for the official Revenue source, source hash, 2,261 source rows / 2,258 distinct records, omissions and postal-verification limits.
3. For actual bookability, an authorized administrator must verify legitimate locality identity/current geography and postal evidence, map it to genuine supported existing service-area UUIDs, then activate. Use bulk activation for already verified/mapped selections rather than approving hundreds individually. There is no authoritative bulk locality-to-PIN dataset in this repository; no mapping was inferred or automatically imported.
4. Trainers request configured localities; administrators can review multiple submitted coverage requests together. Approved professional status, offering/service approval, current pricing, all mapped delivery-area approvals and real availability remain independently required. A shared PIN never automatically authorizes another locality.
5. Manual acceptance with genuine authorized accounts remains required for successful mapped address save, coverage approval, direct request/terms/professional acceptance, alternatives, cancellation, bulk write success/failure and the existing admin-assisted booking journey. Zero currently active mappings means no actual locality is bookable yet.

## Local checkpoint

The earlier complete implementation is committed as `e95b3ee`. This deployment/configuration follow-up is committed locally with this report. The unrelated `next-env.d.ts` modification is preserved and excluded. No GitHub push. No further hosted deployment or geographic activation is authorized by this report; the new migration awaits the owner's separate approval.