# Vuekumi — Static Template Review (pre-backend)

> **Archive (September 2026).** This review describes the client-only Noir template at
> commit `824e893`. Production is a Fastify + Prisma marketplace (Phases 0–19). For current
> product doctrine see [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md); for remaining
> work see [`01-IMPLEMENTATION-PLAN.md`](./01-IMPLEMENTATION-PLAN.md).

Reviewed commit: `824e893` — "Vuekumi — African stock image platform template (Noir design)".

Scope of this document: what existed on the template, what every screen contained (with a
full inventory of the **user** and **admin** sections), and what had to change before a real
frontend + backend could be built on top of it. No code changes are proposed here.

---

## 1. What the project is today

| Aspect | Current state |
| --- | --- |
| Type | Client-only SPA, no server, no API calls |
| Stack | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 3.4, shadcn/ui (Radix), Recharts, react-router 7 |
| Data | 100% static mock data in `src/data/content.ts` (5 photographers, 29 photos, mock stats/queues) |
| Auth | None. Every route is public, including `/admin` |
| Persistence | None. Every action is `useState` and is lost on refresh |
| Media | 50 JPEGs committed to `public/images/**`, served as full-size originals |
| Routes | 12 (`src/App.tsx`), wildcard falls back to Home (no 404 page) |
| Build | `tsc -b && vite build` → static `dist/` |
| Tests / CI | None |
| Env config | None (`.env` is gitignored, no `.env.example`, no `import.meta.env` usage) |

Installed but entirely unused: `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`
(toasts), `next-themes`, `cmdk`, `date-fns`, `input-otp`, `vaul`, `embla-carousel-react`, and
~45 of the 50 `src/components/ui/*` shadcn components. The unused dependency surface is
worth pruning or actually adopting (forms + toasts especially) rather than leaving as-is.

---

## 2. Route and element inventory

### 2.1 Public / marketplace (guest + signed-in member)

**`/` — `src/pages/Home.tsx` (716 lines, "Noir" landing page)**

| Section | Elements | Backend/behaviour gap |
| --- | --- | --- |
| `NoirHeader` | Logo, nav (Library / License & Pricing / Contributor / Admin), Log in, "Sell your photos", mobile overlay menu | Second, duplicate header implementation (see `SiteHeader`). Publicly advertises `/admin`. No auth-aware state (no avatar/menu when logged in). No search box |
| `HeroSlider` | 3 hardcoded slides, autoplay 5.2s, prev/next edge tabs, dot indicators, slide caption | Slides hardcoded in the page; should be admin-managed featured content |
| `Marquee` | Scrolling list of 9 category names | Plain text, not links; categories are not driven by the `categories` export (which is unused) |
| `IconRow` | 3 value propositions | Static copy — fine, candidate for CMS |
| `EdgeStrip` | 4 hardcoded photo IDs, hover meta, links to `/photo/:id` | Should be a "featured/curated" query |
| `CtaBand` | Headline + "Open contributor portal" | Links straight into the portal with no auth |
| `InfiniteFeed` | IntersectionObserver sentinel, 450ms fake delay, `columns-*` masonry, per-card premium badge, download count, loading pulse | **Repeats the same 29 photos forever** (`photos[i % photos.length]`). Needs real cursor pagination. No filters, sort, or search |
| `EditorialSplit` | 2 images + copy + 3 stats (50% / 48h / 54) + "Start uploading" | Hardcoded stats |
| `StatsBand` | 4 SVG progress rings (92/74/61/85) | Hardcoded percentages presented as "share of library by genre" |
| `ContributorsRail` | Snap-scroll rail of 5 photographers with downloads/earnings, plus a "you?" CTA card | Every card links to `/contributor` — **there is no public photographer profile route**. Also leaks per-contributor earnings publicly |
| `NoirPricing` | 3 image-topped plan cards: Superior / Premium / Superpro | **Plan names contradict `/pricing`** (Free / Vuekumi+ / Extended) |
| `NoirFooter` | Wordmark, blurb, 5 social links, copyright | **Wordmark reads "AfriStock", not Vuekumi**; social links are `href="#"`; no legal/company/support links |
| `BackToTop` | Appears after 800px scroll | `bg-noir-soft/90` is an invalid class (see §3) |

**`/photo/:id` — `PhotoDetail.tsx`**
Breadcrumb (Library / category / ID), main image with blur-up, view+download+like counts,
photographer card with a **no-op Follow button**, three-option license picker
(Free / Premium at the photo's price / Extended $49), download-or-buy button that only sets
local state, tag chips (**not clickable — no tag search exists**), related-images masonry
(client-side match on category or country). Unknown IDs silently fall back to `photos[0]`
instead of a 404.

**`/pricing` — `Pricing.tsx`**
3 plan cards (Free / Vuekumi+ $19 mo / Extended $49 per image, "Most popular" badge),
"Where the money goes" contributor-economics bars (50% royalty / 32% free pool / 50%
platform fee — note 50+32+50 does not reconcile and needs a product decision), 4 FAQs. All
CTAs go to `/login`; no checkout, no plan comparison table, no currency switch.

**`/login` — `Login.tsx`**
Sign-in / sign-up toggle, role chooser (Member / Contributor), name/email/password inputs
(placeholder-only, no `<label>`), submit that fakes success and redirects after 1.2s,
Google/Apple buttons that only set local state, terms text, and **demo deep links to the
contributor and admin portals**. Missing: forgot/reset password, email verification, 2FA,
OAuth callback handling, error states, rate limiting, "remember me".

**Missing user-facing surfaces entirely** (each needs a route, UI, and API):
search results with facets (query, category, country, license, orientation, colour, sort),
category / country / tag browse pages, public photographer profile, account settings
(profile, email, password, sessions, delete account), download history & issued licenses,
favourites / collections / lightboxes, cart & checkout, subscription + billing management,
invoices/receipts, notifications, legal pages (Terms, Privacy, License agreement, DMCA),
support/contact, cookie consent, 404/500 pages.

### 2.2 Contributor portal — `/contributor/*` (`Contributor.tsx`, 4 pages)

Shared chrome: `PortalShell` (dark sidebar, numbered nav, "Back to marketplace", subtitle
"Template UI — wire to your API, auth & storage"). Identity is a **module constant**
`const ME = 'amara-okafor'`.

| Page | Elements | Gaps |
| --- | --- | --- |
| `/contributor` Dashboard | Greeting, 4 stat cards (total earnings, downloads, profile views, approval rate), 6-month earnings area chart, top-4 images grid | All values from mock constants; no date-range control; no notifications |
| `/contributor/upload` | Drag & drop zone, Browse files, queued-file list with "processing" pill, metadata form (title, category select, country, tags, description), license radio (Free / Premium $12 suggested), copyright confirmation checkbox, Submit, review-checklist aside | Only file *names* are captured — no upload, no progress, no EXIF/IPTC extraction, no thumbnails, no per-file metadata, no validation, no draft saving. The license radio highlight is broken (`has-checked:` is Tailwind v4 syntax on v3) |
| `/contributor/portfolio` | All/Free/Premium tabs, table (thumb, title, country/category, licence, downloads, earnings, status, Edit) | Earnings computed in the browser with magic multipliers (`downloads * 0.18` / `* 0.006`); status comes from a hardcoded `statuses` array cycled by row index; "Edit" links to the public photo page, not an editor. No pagination, sorting, search, bulk actions, unpublish/delete |
| `/contributor/earnings` | 4 stat cards (available balance, this month, all time, payout method), earnings-vs-downloads dual-axis chart, payout history table | Hardcoded balance `612.8` and "+9.3% vs Jul"; no "request payout" action, no payout method management, no KYC/tax details, no statement export |

**Missing contributor surfaces**: onboarding/application flow, public profile editor, payout
method + KYC/identity verification, tax forms, per-image analytics, submission status with
rejection reasons and resubmission, messages/notifications, bulk metadata editing, model/
property release uploads, referral program.

### 2.3 Admin portal — `/admin/*` (`Admin.tsx`, 4 pages)

Shared chrome: same `PortalShell`, nav = Overview / Moderation / Users / Payouts. **No
authentication or role check of any kind, and the route is linked from the public header.**

| Page | Elements | Gaps |
| --- | --- | --- |
| `/admin` Overview | 3 stat cards (total users + contributors, photos live + pending, revenue Aug + downloads), revenue-vs-payouts bar chart (6 months), moderation-queue preview (3 rows), pending-payouts preview (3 rows) | Static aggregates; no date range, no comparison, no drill-down, no alerting. Thumbnail uses invalid class `w-13` |
| `/admin/moderation` | Card list of 5 items: thumbnail, title, flag pill (new submission / quality review / copyright check / reported), submitter, country, category, age, guidance copy, Approve / Reject buttons | Decisions are local state only. Copy promises "escalate" but there is no such action. No rejection reason, no notes, no bulk actions, no full-size inspection/zoom, no EXIF/duplicate/AI-detection panel, no queue filters or pagination, no SLA/assignment. `StatusPill` has **no style mapping for `approved`/`rejected`**, so decided items render unstyled |
| `/admin/users` | Search input (client-side over name/email/country), role filter pills (all/member/contributor/admin), table (name, email, ID, role, country, joined, downloads, status), Suspend/Reinstate button | Buttons are no-ops. No user detail view, no role/permission editing, no invite/create admin, no pagination or server-side search, no activity history, no impersonation, no export. The `admin` filter matches nothing — the mock data has no admin user |
| `/admin/payouts` | Summary line (count, total, "next batch Oct 1"), table (payout ID, contributor, method, requested date, amount), "Mark paid" button → `paid` pill | Local state only; hardcoded next-batch date; no batching, no provider integration, no reconciliation, no failure/retry handling, no fee/FX handling, no approval workflow or dual control, no ledger |

**Missing admin surfaces** (the largest gap in the project): admin login + 2FA + RBAC,
content/photo management (edit metadata, re-price, feature, curate collections, manage the
homepage hero/featured strips), taxonomy management (categories, tags, countries),
license & plan/pricing management, orders & transactions with refunds, subscription
management, coupons/promotions, reports & takedowns (DMCA, reported content workflow),
audit log, email/notification template management, CMS for static/legal pages, platform
settings (royalty %, platform fee, currencies, payment providers, upload limits), system
health, data export, and dashboards computed from real aggregates.

---

## 3. Concrete defects found

These are real, verifiable issues in the current code — worth fixing regardless of what
backend is chosen.

**Broken / invalid Tailwind classes**

1. `src/pages/Admin.tsx:97` — `w-13` is not a Tailwind class; the moderation thumbnail has no width.
2. `src/pages/Contributor.tsx:222` — `has-checked:border-terra has-checked:bg-terra/5` is Tailwind **v4** syntax; this project is on v3.4, so the selected license card never highlights. v3 equivalent is `has-[:checked]:`.
3. `src/pages/Home.tsx:689` — `bg-noir-soft/90` cannot work: `noir-soft` is a hand-written CSS class in `index.css`, not a theme colour, so the `/90` opacity modifier produces nothing.
4. Root cause of (3): the palette is **defined twice** — semantic colours in `tailwind.config.js` (`paper`, `cream`, `ink`, `ink-deep`, `terra`, `sand`, `noir`) and the `-soft`/`-faint` variants as literal utilities in `src/index.css` (lines 130–147). Anything relying on opacity modifiers or arbitrary variants of the CSS-only tokens silently fails.

**Content / branding**

5. `src/pages/Home.tsx:658` — footer wordmark reads **"AfriStock"** instead of Vuekumi.
6. Pricing tiers are named differently on the landing page (Superior / Premium / Superpro) than on `/pricing` (Free / Vuekumi+ / Extended).
7. `/pricing` economics claim 50% royalty + 32% free-pool share + 50% platform fee; these need to be reconciled into one authoritative revenue-share model before it becomes ledger code.
8. Every portal page ships visible placeholder copy ("Template UI — wire to your API…") that must be removed as each feature is wired.

**Correctness / robustness**

9. `src/data/content.ts:88` — `photographerOf()` ends in a non-null assertion (`!`); an unknown handle returns `undefined` and crashes the caller (`ph.name` in `FeedCard`, `EdgeStrip`, `PhotoDetail`).
10. `PhotoDetail` falls back to `photos[0]` for an unknown ID instead of rendering "not found".
11. `App.tsx` wildcard route renders `Home`, so any typo'd URL looks like the homepage — bad for users and for SEO.
12. `StatusPill` has no mapping for `approved` / `rejected`, the two statuses `AdminModeration` actually sets.
13. Dead code: `usePhotoById` (`Contributor.tsx:416`), the `categories` export (`content.ts:33`, never imported), the `dark` prop on `StatCard`, and the `.hero-frame`/`.text-outline` CSS.
14. Two independent site headers (`SiteHeader` in `shared.tsx` for `/pricing` and `/photo/:id`, `NoirHeader` inside `Home.tsx`) that differ in links, theme, and behaviour. `/photo/:id` and `/pricing` are light-themed while the landing page is noir — the design language splits mid-journey.
15. `vite.config.ts` loads `kimi-plugin-inspect-react` unconditionally; it is a dev/inspection tool and should not be in production builds.

**Non-functional**

16. **SEO**: a stock-photo marketplace lives on image search. There is no SSR/prerender, no per-route `<title>`/meta/OG tags, no canonical URLs, no `robots.txt`/`sitemap.xml`, and no `ImageObject` JSON-LD. This must be designed in, not bolted on.
17. **Images**: originals are served straight from `public/`; no responsive `srcset`/`sizes`, no AVIF/WebP, no CDN, no watermarked previews, and no separation between free-to-download files and paid originals. Today anyone can right-click a "premium" image and take the full file.
18. **Performance**: Recharts + 50 shadcn components are bundled into a single chunk with no route-level code splitting; Google Fonts is loaded from a blocking third-party stylesheet with five families.
19. **Accessibility**: form inputs are placeholder-only with no labels, footer links are `href="#"`, like/follow buttons carry no pressed state, tables have no captions/scope, there is no visible focus treatment, no `aria-current` on nav, and `text-noir-faint` on `bg-noir` is below contrast minimums.
20. **State/UX**: no error boundary, no loading skeletons, no empty states (beyond the users table), no toasts, no optimistic-update story — all of which the app needs the moment data comes from a network.
21. **i18n/currency**: `money()` hardcodes `$` and `en` formatting; a pan-African marketplace will need multi-currency display and probably localisation.
22. **Security posture**: no auth, no CSP or security headers, no rate limiting, no CSRF strategy, and privileged routes are advertised in the public nav.

---

## 4. What is genuinely reusable

The template is a good starting point and should be kept, not rewritten:

- The design system (typography scale, terra/noir/paper palette, motion, the `Reveal`, `BlurImage`, `PhotoCard`, `StatCard`, `SectionHead`, `StatusPill`, `PortalShell` primitives) is coherent and worth preserving as-is.
- The information architecture (marketplace → photo detail → licence choice; contributor dashboard/upload/portfolio/earnings; admin overview/moderation/users/payouts) maps cleanly onto the backend domains, so the mock data doubles as a de-facto schema draft and a seed fixture.
- The full shadcn/ui kit is already installed, so the missing screens (tables with pagination, dialogs, forms, command palette for search) can be built quickly.
- 50 demo images plus realistic mock records make a usable local/staging seed — with the caveat in the README that they must be replaced with licensed content before production.

---

## 5. Verified build status

`npm ci` on a clean checkout, then `npm run build` (`tsc -b && vite build`) and `npx eslint .`
— results recorded in `01-IMPLEMENTATION-PLAN.md` §Phase 1 as the baseline the first PR must
keep green.
