# VueKumi v3 discovery redesign — recommendations and implementation plan

**Status: D-R2 and D-R3 shipped on `main` (including home spotlight Digital ID and admin revoke).**
Public pages use one marketplace chrome. Role-aware `/p` and `/m` layouts, `/models`
talent directory, and `DigitalIdentityCard` + `/id/:token` are done.

Sources reviewed 30 September 2026 against `main`:

- *VueKumi Design Page Index* v1.0, concepts **D01-A, D02-A, D03-A, D04-A, D06-A, D07-A** (attached mockups).
- *VueKumi Master Development Specification* v3.0.
- *VueKumi Master Product Documentation* v3.0.
- Running app: `apps/web` public pages, homepage CMS, search, profiles, Prisma domain.

Companions that stay authoritative for rights, money, and roles:

- [`12-V2-RECONCILIATION-EXECUTION-PLAN.md`](./12-V2-RECONCILIATION-EXECUTION-PLAN.md) — technical reconciliation. R1 of the v3 spec is already shipped here.
- [`13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md`](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md) — Photo Influencer, Free Library, Dec-Upgrade, Dec-RolePay.
- [`14-FREE-LIBRARY-PROGRAM.md`](./14-FREE-LIBRARY-PROGRAM.md) — Free Library acceptance criteria.

This document does **not** restart Open downloads, the rights engine, RevenuePolicy, guest checkout, compensation negotiation, or country activation.

---

## 1. Verdict

Redesign the **public discovery surface** to the attached image-forward marketplace. Do **not** rebuild the platform to match v3’s engineering chapters. Those chapters describe a system that largely exists.

| v3 spec release | What it asks | On `main` today |
| --- | --- | --- |
| **R1 — Reconciliation** | RevenuePolicy, role/tier model, Open download events, country waitlist / ACTIVE enforcement | **Shipped.** `RevenuePolicy`, `OpenDownloadEvent`, library tiers, PDS country gates, Photo Influencer → Free Library only. |
| **R2 — Discovery UI** | D01, D02, D03, D10; React Query; endless scroll | **Shipped (D-R2).** Marketplace chrome, home section map, library/category/photo layout. |
| **R3 — Premium profiles** | D04–D07, directories, Digital ID / QR | **Shipped (D-R3).** Role-aware `/p`/`/m`, `/models` directory, Digital ID + home spotlight QR. |
| **R4 — Rights & negotiation** | Invitations, proposals, identity behind OFF gates | **Shipped as foundations.** Identity verification stays OFF (Dec-Bio). |
| **R5 — Finance** | Ledger lines, payout provider, withdrawals after approval | **Ledger shipped.** Withdrawal flag stays OFF. Do not invent Wise, tax rates, or a permanent split. |
| **R6 — Expansion** | Brand Studio, Hire, API, Opportunity Engine, enterprise | **Foundations shipped.** Fees and dataset sales stay off (Dec-Fee, Dec-AI). |

**Recommendation:** approve a discovery redesign in two implementation releases — **D-R2** (shell, home, library, category, image detail) then **D-R3** (role-aware profiles, directories, Digital ID). Leave admin, contributor workspace, payouts, biometrics, and subscription hard-gates alone.

---

## 2. What the app is today

Monorepo: React 19 + Vite + Tailwind (`apps/web`), Fastify + Prisma (`apps/api`), shared Zod types (`packages/shared`). Public marketplace and signed-in portals share one router (`apps/web/src/App.tsx`).

Two visual systems already coexist:

- **Noir cinematic home** (`pages/Home.tsx` + `pages/home/sections.tsx`, ~980 lines). Full-viewport dark hero, script + condensed uppercase type, terra accent `#bc773f`, CMS section order from `HomeLayout`. Home does **not** use `MarketplaceLayout`.
- **Light paper marketplace** for `/search`, `/category/:slug`, `/photo/:id`, `/p/:handle`, `/m/:handle`, `/creators`. Serif headlines, mono kickers, select-dropdown filters, masonry. Header is `SiteHeader` inside `MarketplaceLayout`.
- **Portal theme** (`body.portal-theme`) for account, admin, contributor, agency, model, bookings, checkout. Leave this theme in place.

Tokens already match the mockup palette closely (`tailwind.config.js`): `paper #faf6f3`, `cream #f5ece5`, `ink #3c3835`, `terra #bc773f`, `noir #0b0a09`, `sand #dec9b8`. The redesign is composition and chrome, not a new color brand.

### Public routes that must stay

| Surface | Live route | Spec example | Decision |
| --- | --- | --- | --- |
| Landing | `/` | `/` | Keep. Restyle in place. CMS keeps ownership of section order and pins. |
| Library | `/search` | `/search` or `/library` | Keep `/search`. Add `/library` as a redirect only if a later menu needs it. |
| Category | `/category/:slug` | `/category/:slug` | Keep. |
| Photo Influencer + Photographer + paid Contributor | `/p/:handle` | `/creator/:slug`, `/contributor/:slug`, `/photographer/:slug` | **Keep `/p/:handle`.** Branch the layout on `creatorKind`. Do not split SEO into three new trees. |
| Model | `/m/:handle` | `/model/:slug` | Keep `/m/:handle`. |
| Image | `/photo/:id` | `/asset/:id` | Keep `/photo/:id`. |
| Directories | `/creators`, `/models` | dedicated photographer and model directories | Keep both. Make `/models` a **talent directory**. Filter photographers at `/creators?kind=photographer`. |

Signed-in product routes (`/contributor`, `/admin`, `/account`, `/licenses`, `/rights`, `/bookings`, `/campaigns`, `/brand`, `/hire`) stay. They are out of the attached mockups.

---

## 3. Recommendations (lock these before UI work)

### R-A — Skin the discovery pages. Do not fork the domain.

Account types stay `user`, `photo_influencer`, `contributor`, `photographer`, `model`, `agency`, `admin`. Library tiers stay `OPEN | LICENSED | VERIFIED_PLUS | EDITORIAL | PRIVATE`. Rights status, commercial status, and publication status stay independent. A verified asset may still be Open. Editorial may publish while commercial status is blocked.

### R-B — “Free Contributor” in the v3 PDFs maps to Photo Influencer.

Design index D04 and the product doc say **Free Contributor**. [`13`](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md) **Dec-FC** already locked the opposite public name:

- Enum stays `photo_influencer`.
- Public role name stays **Photo Influencer**.
- Program badge may say **Open Creator**.
- Library label stays **Free Library** (`libraryTier: OPEN`).
- The account is free. It must not look like a monetized stock seller.

D04-A (Kofi Mensah “Open Creator”, upgrade CTA, open images only, credibility, QR card) is the layout for a **Photo Influencer** profile. D07-A is a different role (Verified Photographer) even though the mockup reuses the same display name. One account shows one primary role. After a Photo Influencer upgrades (Dec-Upgrade, already shipped), Free Library assets do not silently become commercial.

### R-C — Premium roles stay visually distinct.

Models and Photographers are not generic creator cards when the role matters: home spotlight, search people filters, directories, image detail attribution, Digital ID. Paid Contributor (general monetized creator) is a third layout, quieter than Photographer, and must not wear a Verified Photographer badge.

### R-D — Mockup chrome that the product cannot back must not ship as live navigation.

D01/D02 headers show **Videos** and **Illustrations**. The catalog is photographs. Do not create empty video or illustration libraries. Menu entries come from the existing site menu CMS and only link to shipped surfaces (Photos → `/search`, Collections, Categories, Contributors, Pricing). Staff can add a media type later when an asset type exists.

### R-E — Numbers on the page come from the API.

Profile stats, “licensing performance”, follower counts, download counts, and collection counts render only when the profile or ledger DTO already has them. Missing analytics show the module as absent, not as invented figures. Verified+ copy stays the live disclaimer: marketplace placement, not an indemnity SKU (`verified_plus.indemnity_enabled` remains false).

### R-F — Subscriptions stay soft.

v3 calls Buyer, Contributor, Model, and Photographer paid roles. **Dec-RolePay** still defers hard gates. Photo Influencer stays free forever. Discovery UI may show plan names and upgrade CTAs from `BuyerPlan` / account-type config. It must not block browse, Open download, or existing photographer/model signup behind a new paywall.

### R-G — Digital ID is a public profile card, not KYC.

No Persona activation, no face embeddings, no document numbers, no email or phone on the card. QR target is the existing public profile URL (or a compact `/id/:token` view that only shows display name, role, country/base, public id, and badge). Issuance can be deterministic from the profile until a revoke list is needed.

### R-H — Homepage CMS survives the redesign.

`GET /api/public/home` and Admin → Homepage stay the source of hero pins, featured frames, people rails, and section order (`docs/runbooks/homepage-cms.md`). D01 sections are new **layout keys** with fallbacks, not a hardcoded page that ignores `HomeLayout.order`.

### R-I — Engineering doctrine from v3 §2 still applies.

Do not invent legal text, vendors, rates, retention, tax treatment, or country approvals. Feature flags in spec §14 stay at their current recommended state (`payouts.model_withdrawal_enabled`, `identity.verification_enabled`, `compliance.screening_enabled`, `ai.dataset_sales_enabled`, `partner_api.billing_enabled` all false).

---

## 4. Gap matrix — mockups vs live pages

Attached concepts: D01-A landing, D02-A library, D03-A Travel & Landscapes, D04-A Open Creator, D06-A model, D07-A photographer. **No mockup** for D05 paid contributor, D08 buyer, D09 ID card alone, D10 image detail, D11 contributor dashboard, D12 admin. Those wait for a later concept, except D05 and D10 which can be derived in D-R3 / D-R2 from the rules below.

### D01 Landing — image-forward discovery

| Mockup module | Live home | Plan |
| --- | --- | --- |
| Black utility header: logo, primary nav, search, Log in, Join | Transparent noir header over the hero; search under the nav | New `MarketplaceChrome` used by home and inner pages. Join stays the existing contributor/sell action from site content. |
| Hero with headline, subcopy, search, category chips, side collage | Full-viewport slider, centered script + giant uppercase title | Replace the slider as the default hero **section**. Keep pin data (`hero` slot, capacity 3) as the collage / background images. Copy stays in site content, not hardcoded “Images that tell Africa’s story” if CMS text exists. |
| Category strip under the hero | Marquee of category names | Image chips linking to `/category/:slug`. |
| Featured Photos, large 3-up | Featured strip (`edge` pins) | Restyle to the large 3-up. Keep frame controls. |
| Browse by Category image cards | Category banners | Restyle. Same pins. |
| Featured Collections | Not a home section | New section fed by public collections (existing collection APIs). Empty state hides the rail. |
| Continent CTA banner | `CtaBand` / static banners | Restyle one static banner slot to this pattern. |
| Contributor spotlight + QR card | People rails (influencers, photographers, contributors) and models rail | One spotlight module that picks a CMS person and renders the role-correct Digital ID **preview** (link only until D-R3 cards exist). |
| Top African Creators carousel | People rails | Role-split carousel: photographers and models are not the same card. |
| License banner | `NoirPricing` | Point at `/pricing`. Do not redraw plan prices that are not in config. |
| Latest from the library | `InfiniteFeed` | Keep infinite catalog preview with larger tiles. |
| Patterned footer | `NoirFooter` | Shared public footer. Portal footer unchanged. |

### D02 Library / search

| Mockup | Live `/search` | Plan |
| --- | --- | --- |
| Left filter sidebar | Horizontal `<select>` row | Sidebar on desktop, sheet on small screens. |
| Content type, orientation, people, contributor type | Not in the query | Add only filters the photo record can answer. Orientation if width/height exist on `Photo`; people as “people present” from appearances; contributor type from owner `accountType`. **No video/illustration facet until that media exists.** |
| License chips: Free, Licensed, Editorial, Verified+ | `license=free\|premium` plus `libraryTier` | Drive chips from `libraryTier` (`OPEN`, `LICENSED`, `VERIFIED_PLUS`, `EDITORIAL`). Keep the Verified+ disclaimer. |
| Topic chips | Tag facet buttons | Keep, style as chips. |
| Sort + grid density | Sort only (`newest`, `downloads`, `views`, `likes`) | Add a two-density toggle in local UI state. Sort stays URL-backed. |
| Endless masonry, large tiles, tier badge on the tile | `PhotoMasonry` + infinite `useInfiniteQuery` | Larger tiles. Badge from `libraryTier` using `LIBRARY_TIER_LABEL`. |
| Result count and “clear all” | Present | Keep. |
| Digital ID promo tile in the grid | Absent | Static promo linking to `/creators` until cards exist; real card in D-R3. |
| Cursor pagination | Page-number infinite query (`page`, `limit` 24) | **Do not block D-R2 on a cursor migration.** Offset infinite scroll already matches the UX. Cursor becomes its own task if catalog size makes deep offsets slow. |
| React Query | Already used | Keep `publicQueryKeys.photoSearch`. |

Filter state stays in the URL (`useSearchParams`), which already matches spec §11.

### D03 Category

Live `Category.tsx` is a title, one search box, and a masonry (~212 lines) with its own `useEffect` loader (not React Query). `Models.tsx` reuses this as a **photo** grid (`featuring=model`), which is the wrong object for a talent directory.

Target composition, all optional when data is empty:

1. Hero still from the first featured photo in that category (or category banner pin).
2. Subcategory / tag chips from the search tag facet scoped to the category.
3. Featured row (first pinned or top-ranked photos).
4. Curated collections that contain the category.
5. Top creators who have published in the category (existing photographer list filtered by category if the API supports it; otherwise a small read API).
6. License banner → `/pricing`.
7. Endless filtered grid. Move this page onto the same infinite query helper as `/search`.

### D04 Photo Influencer profile (`/p/:handle` when `creatorKind` is photo influencer)

Live profile is one white card (avatar, name, follow, bio) and a masonry for every creator kind (`Photographer.tsx`, 169 lines, `useEffect`).

D04 modules to add, Open inventory only:

- Cover image from the creator’s latest public photo.
- **Photo Influencer** + **Open Creator** badges. No Licensed / Verified+ / earnings language.
- Stats the DTO already exposes (followers, photo count, collections). Downloads only if the public profile already returns them.
- About, location, member-since.
- Upgrade CTA to the existing account-upgrade flow (Photographer / Contributor / Model). Copy must say monetized participation starts after upgrade and reclassification, not that current images are for sale.
- Featured Open images, collections, categories they contribute to.
- Community credibility row (counts only).
- Digital ID preview (D-R3).

### D05 Paid Contributor profile (no mockup)

Same `/p/:handle` when `creatorKind` is `contributor`.

- Paid membership badge from plan config, not a hardcoded price.
- Tabs or filters: Licensed, Editorial, and any Open work they are actually allowed to show. Photographers and Contributors do not upload Free Library; do not render an empty Free Library tab as if it were their program.
- Portfolio masonry, collections, public proof points that exist on the DTO.
- No photographer “licensing performance” chart unless the same public aggregate is defined for this role.
- Digital ID uses the contributor card style, not the photographer premium style.

### D06 Model profile (`/m/:handle`)

Live page mirrors the thin photographer card (`ModelProfile.tsx`, 173 lines).

Add, from `ModelPublicDto` and appearance queries only:

- Cover, verified model badge, location, member-since.
- Specialty chips already stored on the profile.
- Featured appearances (approved likeness, profile-visible photos).
- Portfolio grid.
- Collaborating photographers (distinct copyright owners on those photos).
- Approved commercial appearance count.
- Availability and book CTA when `availability` is hireable — existing `/book/:handle`. Booking payment stays off-platform; show no commission.
- Model Digital ID card (D-R3).
- Featured collections that include their appearances, if that query is cheap; otherwise omit.

`/models` becomes a directory of model profiles (country, specialty, availability, verified badge), not `CategoryBrowse` of photographs. Photograph grids that credit a model stay on `/search` and `/photo/:id`.

### D07 Photographer profile (`/p/:handle` when `creatorKind` is photographer)

- Verified Photographer treatment, cover, specialty, location.
- Stats row from public DTO.
- Featured shoots if `PhotoShoot` is public; otherwise a featured-photo row.
- Top licensed work: public photos in `LICENSED` / `VERIFIED_PLUS` only.
- Verified+ strip only for that tier.
- Collections, category chips, recent uploads.
- “Licensing performance” only with a **defined public aggregate** (for example lifetime licensed download count). Do not expose revenue, splits, or model compensation. If the aggregate does not exist, ship the module in a follow-up rather than fake a chart.
- Hire CTA → existing `/hire/:handle` when availability allows. No platform commission copy beyond “inquiry / off-platform”.
- Photographer Digital ID card (D-R3).

### D10 Image detail (no mockup; spec §10)

`PhotoDetail.tsx` (~633 lines) already loads the asset, license products, checkout, follow, collections, and agency-protected inquiry. D-R2 is a layout pass:

- Larger preview.
- Public rights badges via `permissionPublicCopy` / library tier label. No private split, no agreement percentages.
- Photographer link (`/p/:handle`) and model appearance links (`/m/:handle`) as separate entities.
- Related images and collections already nearby stay.
- Open download and paid checkout behavior unchanged, including anonymous Open download and guest paid checkout.

### Explicitly out of this plan’s build

| ID | Why it waits |
| --- | --- |
| D08 Buyer library / account | No mockup. `/account`, `/favorites`, `/collections`, `/licenses` already work. |
| D11 Contributor dashboard | No mockup. `Contributor.tsx` is 1,160 lines and should be split before new workspace features, but that split is not required to ship D01–D03. |
| D12 Admin portal | No mockup. Country, DMCA, content, payouts, homepage CMS, and PDS already exist under `/admin`. |
| R4 identity vendor | Flag stays OFF until DPA / counsel / vendor. |
| R5 withdrawals | Flag stays OFF. |
| R6 fees, dataset sales, partner billing | Flags stay OFF. |

---

## 5. Implementation plan

Two approved releases. Each is independently shippable. Tests and the homepage CMS contract are part of the release, not a follow-up.

### D-R2 — Discovery shell, home, library, category, image detail

**Goal:** a visitor recognizes D01-A, D02-A, and D03-A without any API contract break.

1. **Marketplace chrome**
   - Extract header, search, and footer from `pages/home/sections.tsx` and `components/shared.tsx` into a small `components/marketplace/` set.
   - Home uses the same chrome as `/search` (light page, black bar, terra buttons).
   - `MarketplaceLayout` wraps `/` as well, or Home renders the same chrome component. One header implementation.
   - Mobile: existing menu button pattern; filters on search become a drawer.

2. **Home section map**
   - Add layout keys beside the current ones rather than deleting pins: `category_chips`, `featured_collections`, `spotlight`, `top_creators`, `library_preview`.
   - Default order matches D01 top-to-bottom.
   - Unrecognized older keys (`marquee`, `icons`, `editorial`, `stats`, `pricing`) keep rendering until an admin reorders, so production CMS JSON does not go blank.
   - Document the new keys in `docs/runbooks/homepage-cms.md`.
   - Split `sections.tsx` by section while moving code. Do not grow that file.

3. **Search**
   - Sidebar + URL filters listed in §4 D02.
   - Shared `PhotoTile` with tier badge and large image (used by search, category, home preview, related images).
   - Empty, loading, and zero-result copy stay honest. Zero-result searches keep feeding the existing Content Opportunity events; do not build a new engine.

4. **Category**
   - Rebuild `CategoryBrowse` on React Query infinite pages.
   - Hero, chips, featured row, collections, creators, then the grid.
   - Stop using `CategoryBrowse` for `/models` (that move is D-R3). Until D-R3, `/models` may keep the current photo grid so the route does not break mid-release.

5. **Image detail layout**
   - Presentation only. License issue, Open download, guest checkout, and agency inquiry stay on the current API functions.

6. **Tests**
   - Extend `e2e/smoke.spec.ts` for home heading/search, `/search` filter in the URL, `/category/:slug` hero, `/photo/:id` license panel.
   - API: no schema change required for D-R2 if filters only use columns that exist. If orientation or “people present” needs a new query param, add it in `packages/shared` and an API test beside the current photo list tests.
   - Homepage CMS test: unknown section keys are ignored; default order still returns a payload.

**Acceptance:** desktop and a narrow viewport. Home, search, one category, one photo. Open download still works logged out. A pinned hero photo still appears. Admin homepage still saves order.

### D-R3 — Role-aware profiles, directories, Digital ID

**Goal:** D04-A, D06-A, and D07-A, plus a derived D05, without new legal or payout behavior.

1. **Profile layouts**
   - One route component for `/p/:handle` with three presentations selected by `creatorKind`: `photo_influencer`, `contributor`, `photographer`.
   - `/m/:handle` premium model layout.
   - Move both pages to React Query (`publicQueryKeys` entries for photographer and model).
   - Public DTO additions are additive and documented: cover photo, collection summaries, collaborator list, commercial appearance count. Omit any field that would leak earnings or compensation terms.

2. **Directories**
   - `/creators` cards show role, location, specialty, and a portfolio strip. Kind filter remains.
   - `/models` lists `ModelPublicDto` cards (availability, specialty, country), linking to `/m/:handle`.
   - Search people/contributor filters deep-link to these routes.

3. **Digital ID**
   - Prisma model `DigitalIdentityCard`: `profileId`, `cardType` (`photo_influencer | contributor | model | photographer`), `publicToken`, `status`, `issuedAt`, `revokedAt`.
   - `GET /api/digital-id/:token` returns only public card fields.
   - QR encodes that URL. Render with a small client QR library already allowable in the web app, or an SVG generator with no remote call.
   - Card appears on the matching profile, on the home spotlight, and on directory cards for photographer and model.
   - Photo Influencer card copy cannot say licensed, verified-plus, or earnings.
   - Admin revoke can be a later checkbox on the existing account screen; until then, revoking is a status column staff can set in a minimal admin section. Do not build a new admin visual system.

4. **Tests**
   - API: card payload excludes email, phone, documents, ledger lines.
   - Web smoke: seed Photo Influencer profile shows Open Creator and no license-performance block; seed photographer shows the premium header; seed model shows book CTA only when availability is hireable; `/models` shows profile cards.
   - Upgrade CTA on the influencer profile links to the existing upgrade path and does not call payout or plan-purchase APIs by itself.

**Acceptance:** the six attached concepts are recognizable. A Photo Influencer page cannot be mistaken for a stock seller. QR opens the public profile. No KYC vendor calls.

### Later, only with a new approval

| Item | Trigger |
| --- | --- |
| Cursor-based search | Measured slow offsets, not the mockup. |
| Split `Contributor.tsx` / `Admin.tsx` | Next workspace feature, or before any D11 mockup. |
| D08 / D11 / D12 visual redesign | Mockups labeled with those design IDs. |
| Public licensing-performance chart | A defined aggregate that is not revenue or a model split. |
| Hard subscription gates | Dec-RolePay decision with prices in commercial config. |
| Payout, tax, identity, screening, dataset sales | Existing flags and counsel/finance/vendor gates in `12`. |

---

## 6. File map (expected touch list)

D-R2:

- `apps/web/src/components/marketplace/*` (new chrome, tile, filter sidebar)
- `apps/web/src/pages/Home.tsx`
- `apps/web/src/pages/home/sections.tsx` (split, not expanded)
- `apps/web/src/pages/Search.tsx`
- `apps/web/src/pages/Category.tsx`
- `apps/web/src/pages/PhotoDetail.tsx` (layout only)
- `apps/web/src/components/shared.tsx` (header/footer delegates)
- `apps/web/src/App.tsx` only if `/` joins `MarketplaceLayout`
- `packages/shared/src/home.ts` if new section keys are added
- `apps/api` photo list query only if a new filter param is required
- `e2e/smoke.spec.ts`
- `docs/runbooks/homepage-cms.md`

D-R3:

- `apps/web/src/pages/Photographer.tsx`
- `apps/web/src/pages/ModelProfile.tsx`
- `apps/web/src/pages/Creators.tsx`
- `apps/web/src/pages/Models.tsx`
- `apps/api/prisma/schema.prisma` (`DigitalIdentityCard`)
- `apps/api/src` profile + digital-id routes
- `packages/shared` card DTO
- API tests for the public card
- seed so local profiles have stable tokens

No change to payment, payout, identity-vendor, or DMCA modules in either release.

---

## 7. Invariants the redesign must not break

Copied from v3 spec §17 and already enforced on `main`. UI work re-runs them; it does not reimplement them.

| Scenario | Invariant |
| --- | --- |
| Photo Influencer uploads a recognizable person without a release | Open publication and download stay blocked. |
| Model approves zero-fee Open use | Open eligible only if every other rights check passes. |
| Model requests a percentage | Open blocked; paid path waits for an accepted agreement. |
| Anonymous Open download | No signup; `OpenDownloadEvent` stores asset and license version. |
| Guest paid checkout | License email path unchanged. |
| DMCA counter-notice while a model hold exists | Copyright hold may clear; likeness hold remains. |
| Country HOLD | Contributor activation blocked; buyer and external rights-holder flows still work. |
| Country ACTIVE with incomplete gates | Server rejects activation. |
| Model withdrawal flag false | Ledger may accrue; withdrawal API denies. |
| RevenuePolicy version changes | Old grants keep the old version. |
| Buyer certificate | No photographer/model split on the certificate. |

---

## 8. Suggested approval

Approve **D-R2** first. Review it in the browser against D01-A, D02-A, and D03-A before starting **D-R3**. D-R3 needs the chrome and tile from D-R2.

Do not treat this document as approval to change prices, commission, KYC vendors, payout providers, or public legal entity text.
