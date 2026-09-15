# VueKumi — execution plan

Companion documents:

- [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md) — recovered May 2026 concept,
  VueKumi vs VueQuatro, and the copyright operating model (read that first).
- [`00-CODE-REVIEW.md`](./00-CODE-REVIEW.md) — **historical** review of the static Noir
  template (commit `824e893`). Not a description of production.
- [`02-DEPLOYMENT-LIGHTSAIL-DOCKER.md`](./02-DEPLOYMENT-LIGHTSAIL-DOCKER.md) — original
  Lightsail sketch. Live ops: [`deploy/lightsail/README.md`](../deploy/lightsail/README.md).

**Status: plan only for work that has not shipped. Do not start a new phase until
explicitly approved.**

Updated 15 September 2026 against `main` at Phase 19 (`98a1bb8`).

---

## 1. Objective (updated)

Build **African visual identity infrastructure**, not a generic stock-photo clone.

VueKumi (`vuekumi.com`) is the marketplace and creator-facing product. VueQuatro is the
parent rights, licensing, protection, and (later) agency layer. See
[`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md).

The intended business stack:

Stock media → creator discovery → African talent → commercial licensing → brand production →
distribution/API → consented AI datasets.

What that means for sequencing: **finish a trustworthy commercial library**, then **replace
PDF model releases with two-party consent and a photographer–model identity graph**, then
open talent booking and VueQuatro representation. Distribution APIs and AI-training consent
come after the rights record is real. Unsplash-style extras (more CMS, more charts) are
secondary to that differentiator.

SquadPay remains a separate Nueve Technologies product.

---

## 2. What production actually is

The original Phase 0–10 plan assumed NestJS, OpenAPI-first MSW, and a greenfield admin
build. That plan is superseded.

| Concern | In production |
| --- | --- |
| Frontend | `apps/web` — React 19, Vite, Tailwind, react-router 7 (`:3000`, `/api` proxy → API) |
| Backend | `apps/api` — Fastify, Prisma, PostgreSQL 16 |
| Shared types | `packages/shared` — Zod + DTOs |
| Auth | Password + Google OAuth + refresh cookies; one account type per email (`admin\|contributor\|user\|agency`) |
| Media | Presigned upload, private originals, watermarked premium previews |
| Commerce | RF / Commercial / Extended / Editorial / RM quote / Exclusive; Stripe + Flutterwave; Vuekumi+ quotas |
| Payouts | 50/50 of paid licences on `EarningsLedger`; manual mark-paid |
| Email | Resend via Admin Settings (not `.env`) |
| Ops | Docker-only Lightsail; GitHub Actions `check` + image builds; API keys in Admin Settings |

Locked product rules already in the running system:

- Africa-only contributors (54 AU states); buyers and agencies anywhere
- Sells **usage permission**, not ownership
- USD internally + visitor FX
- 50/50 split on premium/paid licences (photographer vs platform) until a model split is
  decided
- Seed: `admin@vuekumi.com` / `Admin123!` and `*@vuekumi.demo` / `User12345!`

### Shipped phases (do not rebuild)

| Phase | What landed |
| --- | --- |
| 0–1 | Monorepo, API, auth, route guards |
| 2 | Africa-only contributors, FX, admin gateways and AI keys |
| 3 | Rights **v1**: copyright flag, PDF-style model release, platform agreement, licence catalog, grants, certificates |
| 4 | Media pipeline |
| 5 | Payments → grant after pay |
| 6 | Manual AI metadata suggestions |
| 7 | Agency portal (team, seats, shared licences) |
| 8 | CI, security headers, health/ready, 404 |
| 9 | Google OAuth, rate limits, Sentry |
| 10 | Contributor payouts from the 50/50 ledger |
| 11 | Catalog search, photographer profiles, favorites |
| 12 | Collections and agency lightboxes |
| 13 | Follows and live contributor dashboard |
| 14 | Account settings, password, sessions |
| 15 | Vuekumi+ and RF download quotas |
| 16 | Live homepage stats and featured photographs |
| 17 | Resend for auth and invites |
| 18 | Admin RM quotes queue and quote emails |
| 19 | Live admin overview metrics and chart |

Rights v1 is necessary but not the May 2026 model. It treats model clearance as an admin
verified file, not as a second party on the platform.

---

## 3. Gap vs the recovered concept

Full doctrine: [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md) §8.

| Concept | Status |
| --- | --- |
| Photographer copyright + platform licence + buyer usage licence | Shipped (agreement + grants) |
| Model as a real, verifiable account | Missing |
| Two-approval commercial lock | Missing (checkbox + PDF name + admin verify) |
| Invite-the-model as acquisition | Missing |
| Permission states (private / portfolio / editorial / restricted / commercial / exclusive / agency-protected) | Missing (only photo lifecycle + free/premium) |
| Self-shot dual role | Missing |
| Visual verification with biometric safeguards | Missing (do not start casually) |
| Report / takedown / dispute trail | Missing |
| Photo influencer role | Missing |
| Talent booking | Missing |
| VueQuatro representation / agency-protected inventory | Missing |
| Partner API | Missing |
| Separate AI-training consent | Missing |
| Photographer/model revenue split | **Undecided — do not invent** |

Marketplace leftovers that still matter for a honest live site, but are **not** the
differentiator:

- Contributor photo editor (`PATCH /contributor/photos/:id` exists; UI does not)
- Pricing page still shows a hardcoded 32% “free pool” bar; ledger only has `licence_sale`
- Featured homepage slots are query-driven, not admin-editable
- RM products currently `requiresModelRelease: false` (contradicts two-approval)

---

## 4. How remaining work is sequenced

Three arcs. Do not skip Arc B to build booking or APIs on uncleared inventory.

### Arc A — Honest stock marketplace (close-out)

Keep vuekumi.com truthful while the identity graph is designed.

| Phase | Work | Why now |
| --- | --- | --- |
| **20** | Contributor photo editor (live `PATCH`, rights flags, exclusive opt-in, unpublish) | Upload without edit is an operational hole |
| **21** | Free-pool / pricing economics: either implement a real pool or remove the 32% bar | Do not ship a ledger fiction |
| **22** | Public rights **report** + staff takedown queue (temporary commercial lock, audit trail) | Doctrine requires this even before models have accounts |

### Arc B — Rights 2.0 (the original differentiator)

This is the work the May discussion was actually about. It replaces “upload a release PDF.”

| Phase | Work | Hard rules |
| --- | --- | --- |
| **23** | Photo **permission states** (private, portfolio, editorial, restricted, commercial, exclusive, agency-protected). Commercial/RF/extended/exclusive/RM cannot be offered unless state + rights record allow it. Align RM with model-release requirement. | An image may exist without becoming stock. Editorial ≠ delete. |
| **24** | **Model** account type (fifth type, still one type per email). Photographer identifies people on a photo; VueKumi **invites** them. Claim profile, confirm likeness, approve/reject per image, set usage. | Typed name is not identity. Checkbox is not consent. |
| **25** | **Two-approval commercial lock** + rights record as the asset (invites, consent version, timestamps, restrictions, grant history). Admin verifies process, not a PDF in isolation. | Photographer approval + model approval = commercially licensable. AI match cannot grant rights. |
| **26** | **Self-shot** dual role on one account | Do not force a fake photographer/model pair |
| **27** | Model **portfolio** assembled from images they approved (feeds talent search later) | Model does not gain copyright |
| **28** | Visual verification (opt-in likeness check) | Last in this arc. Voluntary, minimised retention, not a public face database. Skip until 24–25 are live. |

**Gate before 24–25:** decide whether models can earn, and if so the photographer/model/
platform split. Record the decision in this file. Do not code a silent 50/50 that ignores
the depicted person.

### Arc C — Talent, VueQuatro, distribution

Only after commercially cleared images have real people behind them.

| Phase | Work |
| --- | --- |
| **29** | Photo influencer role *or* a contributor flag — discovery without pretending every creator is a studio photographer |
| **30** | Booking: hire photographer / book model (briefs, availability, quotes). VueKumi stays the marketplace. |
| **31** | VueQuatro representation: agency-protected inventory, opt-in enforcement/admin of rights, staff tools. Not a second public brand required on day one. |
| **32** | Brand production (campaign-shaped sourcing, not only single-image checkout) |
| **33** | Partner / Unsplash-style **distribution API** (authenticated, licensed, rate-limited) |
| **34** | **AI-training** licence as an explicit opt-in, separate from RF/commercial grants, payable if we sell datasets |

---

## 5. Explicitly out of the next slice

Until Arc B exists, do **not** start:

- Face scanning or embedding stores
- Selling training data
- A public VueQuatro app
- Stylists / MUA / production-crew account types
- Changing the 50/50 photographer split without a written model-share decision

---

## 6. Cross-cutting (still in force)

- Contract-first DTOs in `packages/shared`
- Demo stays runnable; seed remains the 29-photo African catalog plus demo accounts
- Vertical slices (schema → API → UI → tests)
- Africa-only contributors; keys in Admin Settings; Docker-only Lightsail
- PII / biometric minimisation for any future verification pipeline
- Every privileged mutation writes an audit log

---

## 7. Risks that changed

| Risk | Notes |
| --- | --- |
| Treating VueKumi as Unsplash-with-a-flag | Would ship Arc A forever and never build the identity graph. Sequence above exists to prevent that. |
| PDF model releases | Legal theatre. Arc B replaces them as the commercial path. |
| Building booking on uncleared people photos | Brand liability. Arc C waits on Arc B. |
| Silent AI-training rights | Forbidden. Separate consent (Phase 34). |
| Biometrics | Phase 28 only, with counsel-level privacy design. Similarity ≠ release. |
| Model payouts | Undecided economics. Gate on Phase 24. |

The old plan’s NestJS / MSW / lockfile / AfriStock risks are closed.

---

## 8. How to use this plan

1. Read [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md).
2. Approve **one** phase at a time (same “next” cadence as Phases 16–19).
3. Default next slice when work resumes: **Phase 20** (editor) unless you redirect to Arc B
   earlier. Rights 2.0 is the strategic priority; Arc A is only so the live site does not
   lie while that land.
