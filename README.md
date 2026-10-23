# Aara — at-home wellness public website

A premium public website for a managed wellness marketplace preparing to launch in Delhi NCR. Aara is a temporary name, editable in `src/config/site.ts`. Phases 1?2 and the Phase 3B application integration are implemented. Services and the professional directory now query hosted Supabase; personal/professional accounts and minimal administration use real authenticated sessions. Booking and payments remain outside this milestone.

## Stack and local setup

Next.js App Router, React, strict TypeScript, Tailwind CSS v4, shadcn/ui-style source components built on Radix, Lucide, Motion, and Fraunces/DM Sans via `next/font`. Supabase JS and SSR prepare the integration boundary. Vitest, Testing Library, ESLint, and Playwright provide verification. Use Node.js 22.12+ (Node 24 LTS recommended) and npm.

```bash
npm ci
# Only if .env.local does not already exist:
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` only if the destination does not already exist. Preserve existing credentials. If script execution policy prevents `npm`, use `npm.cmd`. Open http://localhost:3000. Supabase public configuration is now required for database-backed pages and session refresh. Set NEXT_PUBLIC_SITE_URL to the exact application origin for signup and recovery redirects.

## Public routes

| Route | Purpose |
| --- | --- |
| `/` | Refined existing editorial homepage. |
| `/services` | Alternating image-led catalog and monthly program discovery. |
| `/services/personal-yoga` | Personal Yoga Training details, preparation, intended experience, and FAQ. |
| `/services/naturopathy` | Naturopathy Consultations with clearly bounded service scope. |
| `/services/massage-therapy` | Massage & Wellness Therapy with comfort and visit information. |
| `/yoga-programs` | Editorial comparison of potential 8/12-session options, continuity, and program FAQ. |
| `/professionals` | Intended professional review/assignment approach and honest unavailable-records state. |
| `/how-it-works` | Seven-step intended managed request/assignment/confirmation journey. |
| `/about` | Intended values, at-home care approach, and Delhi NCR launch context. |

Unknown service slugs return an HTTP 404 with a useful recovery page. No speculative provider detail routes exist.

## Environment and deployment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Real Supabase project URL; needed only when calling the client utilities. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase public publishable key. Never put service-role or secret keys here. |
| `NEXT_PUBLIC_SITE_URL` | Real canonical HTTP(S) origin, preferably HTTPS in production. Enables canonical/Open Graph URL and populated sitemap metadata. |

Deploy the repository to Vercel using the Next.js preset. Add the real domain and environment values before deployment, then rebuild when they change. Without a canonical origin, `/sitemap.xml` contains no entries and robots does not advertise it; no domain is invented. Fonts are downloaded by `next/font` at build time, so the first build needs access to Google Fonts. Runtime fonts are self-hosted by Next.js.

## Phase 3B authentication and operations

New routes: `/login`, `/signup`, `/forgot-password`, `/update-password`, `/auth/confirm`, `/account`, `/account/professional`, `/admin/professionals`, and `/admin/services`. Account/admin/auth pages are excluded from indexing. Private routes and every mutation verify identity with `getUser()` and read the current database role. The Next.js proxy refreshes cookies without performing database role authorization. Client navigation calls a private, uncached `/auth/status` endpoint.

Use only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. No service-role client is used. The missing local origin was set to `http://localhost:3001` in the ignored `.env.local`; keep it aligned with the port you actually browse. Use your actual HTTPS origin in production. Restart the dev server after environment changes.

In Supabase Auth URL Configuration, set the Site URL and allow the exact callback URL for each authorized origin, including local development. For this local setup allow `http://localhost:3001/auth/confirm` and `http://localhost:3001/auth/confirm?next=/update-password`. Keep email confirmation enabled. Configure a working mail provider/SMTP and sender as required by Supabase's delivery restrictions.

For cross-device email confirmation, use this confirmation-email template link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Confirm email</a>
```

For password recovery use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password">Reset password</a>
```

Configure templates per environment's Site URL. The callback also accepts PKCE `code` links using the initiating browser's verifier cookie. Never paste tokens/reset links into logs or source. Invalid/expired links show a safe recovery message. The reset-request response does not reveal whether an address is registered. Login and email confirmation default to the homepage; validated explicit internal `next` destinations are preserved. Protected-page visits carry their destination through login. Recovery links continue to `/update-password`. If your hosted confirmation email template still hardcodes `next=/account`, manually change it to `next=/` as shown above; existing explicit links retain their requested destination. Accepted signup requiring verification replaces the form with a prominent Check your inbox screen, displays the submitted email only in page state, and offers correction/login without automatic email requests. Acceptance does not claim delivery. Signup accepts no role; the existing Auth trigger creates the customer role. Profile enrichment uses retryable `ensure_own_profile()` separately, with an explicit retry path on the account page.

Personal accounts edit only name/phone. Professional accounts edit the four permitted descriptive fields while pending/rejected and view their restricted verification status and approved service associations. Verified/suspended profiles remain locked until an administrator reopens review.

Bootstrap the first administrator only through the trusted, explicit procedure in [PHASE_3A_HANDOFF.md](supabase/PHASE_3A_HANDOFF.md#trusted-first-admin-bootstrap-and-recovery), using a real confirmed account. No administrator was created automatically. Subsequent professional onboarding uses the existing guarded `change_user_role(target_user, 'professional', reason)` RPC through authorized administrator tooling/session; there is no public professional application/promotion flow. Role promotion creates professional records but does not verify or publish them. The admin review UI uses `review_professional()` and can reopen, approve, reject, suspend, and control visibility; private document links use the administrator session and expire in 60 seconds. Upload UI is out of scope. `/admin/services` controls publication only, with confirmation and RLS enforcement.

Public service queries explicitly require active published services and active categories. Database operational names/categories/prices/durations override editorial presentation. Unknown or unpublished slugs return 404; connection failures show an unavailable boundary. Homepage/catalog/detail/sitemap use fresh database reads. `/professionals` uses only `list_public_professionals()` and renders dynamically with uncached queries. Its honest empty state does not fabricate records. Approved image delivery remains outside the existing private document bucket; the directory currently presents text only.

Actual database types were generated from the hosted public schema into `src/lib/supabase/database.types.ts`. No deployed migration was modified. No schema migration is proposed for 3B. Future Phase 5 payments will use business UPI QR with administrator verification, not Razorpay; no payment implementation is included here.

Official integration reference: [Supabase SSR client and proxy guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Focused auth UX update: 36 relevant tests passed across login/signup actions, confirmation/recovery callbacks, protected-request redirects/cookie preservation, and the prominent signup confirmation screen; TypeScript passed. Supabase responses were mocked for these checks; no live email requests or hosted setting changes were made.

## Phase 3B verification and handoff (23 October 2026)

Implementation is complete for the requested routes and existing authorization contract. Authenticated end-to-end acceptance is still pending; do not equate mocks with hosted mutation verification.

| Check | Result / evidence |
| --- | --- |
| Signup/login/email/recovery | BLOCKED for end-to-end verification: no controlled account/inbox used. Real Supabase calls and callback flows are implemented; login invocation and generic recovery response tested with mocks. Hosted settings confirm email signup enabled and confirmation required. No email was sent |
| Session management | BLOCKED for authenticated persistence/recovery acceptance; SSR proxy/cookie flow implemented, unauthenticated redirects passed in browser |
| Customer profile updates | BLOCKED for hosted write acceptance; owner scoping, initialization, and protected-field stripping passed mocked tests |
| Role authorization | PASS for application tests: unauthenticated browser denial, mocked current-role checks, denied non-admin mutations, denied customer professional edits, fail-closed missing roles. Hosted authenticated isolation/self-promotion/state transitions remain UNVERIFIED |
| Professional profile editing | BLOCKED for hosted verification without a professional account; implemented through permitted columns and RLS |
| Professional verification controls | BLOCKED for hosted verification without an admin/professional account; exact deployed RPC used |
| Published service integration | PASS: real public API query returned three services; nine public routes passed focused browser regression at 375px/1440px; mocked unpublished 404 and database-failure distinction passed |
| Professional directory | PASS: real RPC returned zero eligible records; honest empty-state route passed browser checks. No professional transition was tested |
| Service publication | BLOCKED for authenticated mutation verification; session/role checks, scoped update, confirmation, RLS, dynamic public reads and invalidation implemented |
| TypeScript | PASS: standalone typecheck and final production build type validation |
| ESLint | PASS, final patched dependencies |
| Unit tests | PASS, 31 tests across four files (Supabase authorization/action assertions are mocked) |
| Production build | PASS on Next.js 16.4.1 |
| Playwright | PASS: four focused tests across initial run and targeted auth rerun; no signup/recovery submission or hosted mutation |
| Visual review | Signup screenshots inspected at 375px and 1440px; no material inconsistency found |

The initial build flagged installed Next.js 16.4.0. Next.js and matching ESLint configuration were patched to 16.4.1 following the [official October security advisory](https://nextjs.org/blog/nextjs-security-update-october-14-2026); the corrected build passed. The initial unit failure came from the async-homepage test adapter; the browser failures came from an ambiguous alert locator matching Next.js's route announcer. Only affected checks were retried. No further test/setup loops are required.

Before treating 3B as accepted and starting dependent Phase 4 work: configure/confirm Auth redirect URLs and email templates/provider, exercise one real customer signup-confirm-login-recovery-session-profile journey, explicitly bootstrap a legitimate administrator if none exists, and use legitimate admin/professional accounts for the essential role-isolation, self-promotion/self-verification denial, publication, suspension, and private-document checks. No service-role key, RLS bypass, new migration, or destructive fixture is needed. Do not fabricate professionals to populate the directory.

No hosted records/schema were changed by this implementation session. Hosted requests were read-only service/directory/Auth-settings queries. Applied SQL files remain unchanged. Local implementation checkpoints were created; nothing was pushed. Booking and all payment functionality remain unimplemented by design.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run test:watch` supports local development. Playwright starts the production server, so build first. Smoke tests cover all nine public routes at 375px, 768px, 1024px, and 1440px, route/anchor destinations, unique metadata, loaded images, overflow, request/page errors, menu focus trapping/selection/Escape/focus restoration, native FAQ keyboard behavior, reduced motion, and actual HTTP 404 responses. Screenshots are saved under ignored `test-results/`. For an installed compatible browser instead of downloaded Chromium, set `PLAYWRIGHT_CHANNEL=msedge` or `chrome`. An unavailable browser is a verification limitation, not a passing test.

Verified for Master Prompt 2 on 13 October 2026: TypeScript passed; ESLint passed without warnings; all nine Vitest tests passed; production build passed; all seven Playwright tests passed on the first verification run. Desktop and mobile screenshots of the homepage, catalog, personal yoga detail, programs, professionals, menu, and footer were visually inspected, plus desktop About/How It Works and tablet detail/program layouts. No disabled checks. The build uses existing local environment configuration, but no public route invokes Supabase; Master Prompt 1 also verified a build without Supabase credentials. In the restricted Windows environment, build-time font downloads and browser/server process management used approved sandbox escalation.

## Important directories

- `src/app`: public Server Component pages, shared root layout, async service slug resolution, dynamic published service resolution, 404 recovery, font loading, metadata, Tailwind v4 tokens, favicon, robots, and conditional sitemap entries for all real routes.
- `src/components/home`: editorial hero, service composition, yoga spotlight, workflow, approach, geography, and FAQ.
- `src/components/public`: reusable editorial page hero/breadcrumbs, service detail presentation, FAQ, program feature, and managed-appointment note.
- `src/components/layout`: shared brand, header, route-aware navigation, accessible Radix mobile sheet, and site/service footer links.
- `src/components/ui`: shadcn-compatible Button and Sheet source; `components.json` configures further additions. No Tailwind v3 config is required.
- `src/config/site.ts`: temporary branding, canonical URL validation, and navigation.
- `src/content/services.ts`: typed service records, stable slugs, shared offering names/descriptions/assets, expectations, suitability, FAQs, relations, optional verified price/duration fields, and planned monthly program content. These records supply the homepage, catalog, details, related links, and service metadata.
- `src/content/home.ts`: homepage summaries derived from the offerings, planned process, principles, and FAQs.
- `src/content/process.ts`: expanded intended appointment journey.
- `src/content/professionals.ts`: future genuine professional presentation contract and intended review principles, with no fabricated records.
- `src/lib/metadata.ts`: unique page metadata and canonical/Open Graph URLs only when a real origin is configured.
- `src/lib/supabase`: lazy browser/server integration utilities and environment boundary.
- `public/images`: original local SVG illustration placeholders.
- `tests`: component/config tests and focused browser smoke tests.

## Design and outstanding launch requirements

Ivory, forest green, sage, and restrained terracotta; Fraunces editorial headings with DM Sans interface text. The original homepage composition is retained with larger reading text and links to full pages. Alternating catalog rows, an editorial program comparison, a professional-information split, and a numbered appointment timeline create variety. Pages remain Server Components; only route-aware navigation and the mobile menu need client interactivity. Motion adds a short menu entrance transition, disabled for reduced motion. FAQs stay native and server rendered; no form packages are needed.

**Photography remains an outstanding dependency.** No suitable local photographs were provided and no third-party assets were downloaded. The three SVGs are original, intentionally flat illustrations, labelled as such on the page. They carry no third-party attribution requirements. Replace `quiet-room.svg` (hero), `botanical-study.svg` (services), and `practice-study.svg` (monthly yoga) with commercially licensed local wellness photographs before final launch artwork approval. Record each replacement's source and license here; update paths, alt text, and responsive sizes in the relevant section. SVG illustrations do not need raster optimization; replacement photographs should retain `next/image` optimization.

Also required before launch: official brand approval, real canonical domain/deployment configuration, genuine professional records and reviewed credentials, business-approved prices/durations/package terms/coverage, and verified email/authenticated operational workflows. No prices, professionals, testimonials, contact details, medical outcomes, or neighborhood coverage have been fabricated. There are no booking, checkout, authentication, dashboard, or API placeholders. Public operational content now comes from Supabase; see the Phase 3B section above for authentication and administration setup.

## Phase 3A database deliverables

The database foundation is prepared locally in three CLI-named SQL migrations, with ten RLS-enabled tables, one current role per account, guarded administrator operations, a single public professional-listing RPC, private document Storage policies, legitimate service data, and five rollback-based pgTAP test files. **All three migrations are recorded as applied on the hosted development project. Focused catalog and anonymous-role checks passed; authenticated state transitions and the full pgTAP suite remain unverified.** The public website and Supabase application utilities remain unchanged.

Read [the complete review and 3B handoff](supabase/PHASE_3A_HANDOFF.md) for applied SQL links, grants/policies, bootstrap procedure, and testing limitations. `npm run db:check` performs SQL parsing and static contract checks only. `npm run db:test` requires a working disposable local Supabase stack; do not retry unavailable services. `npm run db:inspect` makes only zero-record read-only probes and prints no credentials. Nothing is deployed or pushed automatically. In 3B, `/professionals` must call only `list_public_professionals()` and render dynamically without persistent caches so revocation is reflected on the next request.

Dependency audit at implementation time reported five high-severity findings in one development-only chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`), for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The suggested automatic remediation downgrades Next.js ESLint configuration to v14, which is incompatible with this foundation. No checks were disabled or forced downgrade applied. Recheck the advisory and update the compatible tooling when a patch is available. No production dependency findings were reported in that audit.

Configuration references: [Next.js App Router](https://nextjs.org/docs/app), [dynamic segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes), [metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [Tailwind v4 / Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui / Next.js](https://ui.shadcn.com/docs/installation/next), [Motion accessibility](https://motion.dev/docs/react-accessibility), [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase / Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs). Conceptual direction: restrained editorial typography from Aesop and the calm natural palette of Six Senses; no site assets or proprietary layouts copied.
