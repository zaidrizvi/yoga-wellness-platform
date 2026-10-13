# Aara — at-home wellness public website

A premium public website for a managed wellness marketplace preparing to launch in Delhi NCR. Aara is a temporary name, editable in `src/config/site.ts`. Master Prompts 1 and 2 are implemented. The website introduces planned services; it does not accept bookings or provide live operational features.

## Stack and local setup

Next.js App Router, React, strict TypeScript, Tailwind CSS v4, shadcn/ui-style source components built on Radix, Lucide, Motion, and Fraunces/DM Sans via `next/font`. Supabase JS and SSR prepare the integration boundary. Vitest, Testing Library, ESLint, and Playwright provide verification. Use Node.js 22.12+ (Node 24 LTS recommended) and npm.

```bash
npm ci
# Only if .env.local does not already exist:
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` only if the destination does not already exist. Preserve existing credentials. If script execution policy prevents `npm`, use `npm.cmd`. Open http://localhost:3000. No environment variables are required for the public website.

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

Supabase utilities initialize lazily. A clear configuration error is thrown only when a caller requests an unconfigured client. `server.ts` creates a client per request with the async Next.js cookies API; `client.ts` provides the browser client. Public pages import neither. The existing root `supabase/` CLI directory is preserved without changes or migrations. Database schema, Storage buckets/policies, RLS, authentication, roles, and session refresh remain future work. Before implementing auth, add the official Supabase SSR session-refresh proxy, verified route protection, and cookie-write handling. Never use these utilities alone as authorization.

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

- `src/app`: public Server Component pages, shared root layout, async service slug resolution, static known service generation, 404 recovery, font loading, metadata, Tailwind v4 tokens, favicon, robots, and conditional sitemap entries for all real routes.
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

Also required before launch: official brand approval, real canonical domain/deployment configuration, genuine professional records and reviewed credentials, business-approved prices/durations/package terms/coverage, and Supabase database/authentication work in Phase 3. No prices, professionals, testimonials, contact details, medical outcomes, or neighborhood coverage have been fabricated. There are no booking, checkout, authentication, dashboard, or API placeholders. Typed records and presentation components are prepared for future Supabase-backed content; Phase 3 is not implemented.

Dependency audit at implementation time reported five high-severity findings in one development-only chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`), for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The suggested automatic remediation downgrades Next.js ESLint configuration to v14, which is incompatible with this foundation. No checks were disabled or forced downgrade applied. Recheck the advisory and update the compatible tooling when a patch is available. No production dependency findings were reported in that audit.

Configuration references: [Next.js App Router](https://nextjs.org/docs/app), [dynamic segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes), [metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [Tailwind v4 / Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui / Next.js](https://ui.shadcn.com/docs/installation/next), [Motion accessibility](https://motion.dev/docs/react-accessibility), [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase / Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs). Conceptual direction: restrained editorial typography from Aesop and the calm natural palette of Six Senses; no site assets or proprietary layouts copied.
