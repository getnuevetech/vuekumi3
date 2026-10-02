# Homepage CMS contract (staff)

Sep 28 hygiene **H2**. Freeze ownership so Homepage, Featured, Site content, and Menu
do not fight each other. Public readers: `GET /api/public/home` and `GET /api/public/site`.

**Do not invent fees, Bio vendors, or legal-entity copy in this runbook.**

---

## 1. Ownership map

| Surface | Admin UI | Writes | Public consumer |
| --- | --- | --- | --- |
| **Homepage** | `/admin/homepage` | Section order/hide, hero/editorial/pricing/stats/people slots, category banners, static banners, contributor rail picks | `GET /api/public/home` → `layout` + assembled `featured` |
| **Featured images** | `/admin/featured` | Edge / featured-grid photo pins + frame size only | Same `/api/public/home` `featured.edge` (and related pin slots) |
| **Site content** | `/admin/site` | Brand, hero *copy*, CTAs, footer blurb/links, static legal/about panels, logo upload | `GET /api/public/site` → `content`, `logoUrl`, `panels`, `facts` |
| **Menu** | `/admin/menu` | Header menu + account-icon menu (labels, paths, audience, sort, font/size) | Same `/api/public/site` → `content.menu` / `content.accountMenu` / `content.menuStyle` |

Rules of thumb:

1. **Images on the home feed** → Homepage or Featured (pins / uploads), never Site content.
2. **Words, brand, logo, static page panels** → Site content.
3. **Nav chrome** → Menu (also mirrored into footer links under Site content when staff edit footer).
4. **Buyer plan card copy/prices** → Buyer plans admin (`/admin/plans`), not Homepage. Homepage only supplies optional pricing-slot imagery.

---

## 2. Public DTO — `GET /api/public/home`

Returns `HomePageDto`:

| Field | Meaning |
| --- | --- |
| `stats` | Live library counts (photos, countries, downloads, …) |
| `featured` | Resolved slot photos / uploads for hero, edge, editorial, pricing, stats background, people rails, category banners, static banners |
| `contributors` | Contributor strip for the home “creators” section |
| `layout` | `{ order, hidden, … }` — which home sections show and in what order |

Staff edits that must invalidate this response: Homepage save, Featured pin/frame save, Content “feature on home” toggles that write the same pin table.

---

## 3. Public DTO — `GET /api/public/site`

Returns `SitePublicDto`:

| Field | Meaning |
| --- | --- |
| `content` | Full `SiteContent`: brand, search placeholder, **menu**, **accountMenu**, menuStyle, actions, footer, home *copy* (hero slides text/CTAs), and other copy blocks |
| `logoUrl` | Resolved logo URL (or null) |
| `facts` | Derived site facts used by some panels |
| `panels` | Static panels keyed by panel id (legal/about-style pages) |

Staff edits that must invalidate this response: Site content save, Menu save, logo upload.

**Free Library:** default menu/footer include `{ label: 'Free Library', to: '/search?libraryTier=OPEN' }`. Do not remove without product intent — Dec-FreeLib A uses this label for `OPEN`.

---

## 4. Who edits what (checklist)

| Change | Go to |
| --- | --- |
| Reorder or hide home sections | Homepage → Section arrangement |
| Hero slide *images* / pins | Homepage (hero slot) |
| Hero slide *titles / CTAs* | Site content → Home hero copy |
| Featured strip photos / frame size | Featured images |
| Category banner images | Homepage |
| People / models / photographers rails | Homepage |
| Header & account-menu links | Menu |
| Footer blurb / footer links | Site content → Footer |
| Logo / brand name | Site content → Brand |
| `/legal`, `/dmca` panel body (CMS panels) | Site content → Panels — counsel paste for T3 entity/agent still required separately |

---

## 5. Contract freeze

- Do **not** move menu into Homepage, or featured pins into Site content, without an explicit schema/PRD change.
- Prefer invalidating React Query keys (`publicQueryKeys.home` / `site`) after admin saves — already wired on Homepage, Featured, Site, Menu.
- Seed defaults live in `packages/shared/src/site-content.ts` (`DEFAULT_SITE_CONTENT`); production uses DB `SiteContent` after first save.

### D-R2 section keys (discovery aliases)

Public `layout.order` / `layout.hidden` accept both legacy and D01 alias keys. Rendering treats these pairs as the same module (show if either key is visible):

| D-R2 alias | Legacy key | Module |
| --- | --- | --- |
| `category_chips` | `marquee` | Category chip / icon strip |
| `featured_collections` | `editorial` | Featured collections rail |
| `spotlight` | `photo_influencers` (plus people rails) | Creator spotlight |
| `top_creators` | `contributors` | Top African Creators |
| `library_preview` | `feed` | Latest from the Library |

Default order prefers the D01 aliases. Unrecognized older keys keep rendering until staff reorders. Do not delete legacy keys from `HOME_BUILTIN_SECTIONS` without a migration of saved `HomeLayout` rows.

---

## 6. Smoke after a CMS edit

1. Hard-refresh `/` — hero copy + section order match admin.
2. Hard-refresh a menu destination — link still resolves.
3. `/search?libraryTier=OPEN` still reachable from Free Library nav when that link is enabled.
4. Featured strip on home matches `/admin/featured` pins (empty slots may auto-fill from the live library).
5. Home, `/search`, `/category/:slug`, and `/photo/:id` share one marketplace header/footer (D-R2).
