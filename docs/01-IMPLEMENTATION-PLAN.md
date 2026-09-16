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

Updated 16 September 2026 against `main` after Phase 28.

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
| Auth | Password + Google OAuth + refresh cookies; one account type per email except self-shot dual role (`contributor` + `ModelProfile` on the same user) |
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
| 20 | Contributor photo editor (PATCH metadata, exclusive, unpublish/resubmit) |
| 21 | Honest pricing economics (50/50 paid licences; no fake free pool) |
| 22 | Public rights report + staff commercial lock (takedown queue, audit trail) |
| 23 | Photo permission states (private / portfolio / editorial / restricted / commercial / exclusive / agency-protected) |
| 24 | Model account type, invite-the-model, likeness confirm, approve/reject per image |
| 25 | Two-approval commercial lock (photographer + model; admin verifies process, not a PDF) |
| 26 | Self-shot dual role (contributor + model profile on one account; likeness + usage still required) |
| 27 | Public model portfolio (`/m/:handle`, `/models`) from approved likeness photographs. Model does not gain copyright. |
| 28 | Opt-in visual likeness check (result only; selfie discarded; similarity ≠ release) |

Rights v1 treated model clearance as an admin-verified file. Phase 25 replaces that as the
commercial path: photographer plus model approval. PDFs remain supporting evidence.

---

## 3. Gap vs the recovered concept

Full doctrine: [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md) §8.

| Concept | Status |
| --- | --- |
| Photographer copyright + platform licence + buyer usage licence | Shipped (agreement + grants) |
| Model as a real, verifiable account | Shipped (Phase 24–26) — invite-only fifth type; photographers may also hold a model profile on the same email. Admin/agency cannot. |
| Public model portfolio | Shipped (Phase 27) — `/m/:handle` and `/models` from approved, confirmed likeness on profile-visible photographs. Model does not gain copyright. No booking CTA. |
| Two-approval commercial lock | Shipped (Phase 25) — commercial-class licences of people photos require every appearance approved with confirmed likeness and commercial usage. PDF is supporting evidence. |
| Invite-the-model as acquisition | Shipped (Phase 24) — photographer names a person; VueKumi emails the invite |
| Permission states (private / portfolio / editorial / restricted / commercial / exclusive / agency-protected) | Shipped (Phase 23) — orthogonal to moderation status; catalog is stock states only |
| Self-shot dual role | Shipped (Phase 26) — photographer identifies themselves on their own photo; `accountType` stays `contributor` |
| Visual verification with biometric safeguards | Shipped (Phase 28) — opt-in per photograph, discrete result only, selfie discarded immediately. No embedding store or public face database. Similarity cannot grant rights. |
| Report / takedown / dispute trail | Shipped (Phase 22) — public report, staff freeze of new licensing, audit log |
| Photo influencer role | Missing |
| Talent booking | Missing |
| VueQuatro representation / agency-protected inventory | Missing |
| Partner API | Missing |
| Separate AI-training consent | Missing |
| Photographer/model revenue split | **Undecided — do not invent** |

Marketplace leftovers that still matter for a honest live site, but are **not** the
differentiator:

- Featured homepage slots are query-driven, not admin-editable

---

## 4. How remaining work is sequenced

Three arcs. Do not skip Arc B to build booking or APIs on uncleared inventory.

### Arc A — Honest stock marketplace (close-out)

Keep vuekumi.com truthful while the identity graph is designed.

| Phase | Work | Why now |
| --- | --- | --- |
| **20** | Contributor photo editor — **shipped** | |
| **21** | Honest pricing economics (no fake 32% pool) — **shipped** | |
| **22** | Public rights **report** + staff takedown queue (temporary commercial lock, audit trail) — **shipped** | |

### Arc B — Rights 2.0 (the original differentiator)

This is the work the May discussion was actually about. It replaces “upload a release PDF.”

| Phase | Work | Hard rules |
| --- | --- | --- |
| **23** | Photo **permission states** (private, portfolio, editorial, restricted, commercial, exclusive, agency-protected). Commercial/RF/extended/exclusive/RM cannot be offered unless state + rights record allow it. Align RM with model-release requirement. — **shipped** | An image may exist without becoming stock. Editorial ≠ delete. |
| **24** | **Model** account type (fifth type, still one type per email). Photographer identifies people on a photo; VueKumi **invites** them. Claim profile, confirm likeness, approve/reject per image, set usage. Models do **not** earn. — **shipped** | Typed name is not identity. Checkbox is not consent. |
| **25** | **Two-approval commercial lock** + rights record as the asset (invites, consent version, timestamps, restrictions, grant history). Admin verifies process, not a PDF in isolation. — **shipped** | Photographer approval + model approval = commercially licensable. AI match cannot grant rights. |
| **26** | **Self-shot** dual role on one account — **shipped** | Do not force a fake photographer/model pair |
| **27** | Model **portfolio** assembled from images they approved — **shipped** | Model does not gain copyright |
| **28** | Visual verification (opt-in likeness check) — **shipped** | Voluntary, minimised retention, not a public face database. Similarity ≠ release. |

**Gate recorded with Phase 24 (15 September 2026):** models do **not** earn. The photographer 50% of paid licences is unchanged. The photographer/model/platform split remains **undecided** — do not invent a silent model share. Revisit before any payout work.

**Gate before 29:** photo influencer / discovery flag is the first Arc C slice. Do not start it until approved. Booking (30) still waits on cleared people photographs.

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

Do **not** start from this slice:

- A public face database or embedding store (Phase 28 stores a discrete check result only)
- Selling training data
- A public VueQuatro app
- Stylists / MUA / production-crew account types
- Changing the 50/50 photographer split without a written model-share decision (Phase 24 recorded: models do not earn; split still undecided)

---

## 6. Cross-cutting (still in force)

- Contract-first DTOs in `packages/shared`
- Demo stays runnable; seed remains the 29-photo African library (stock + portfolio/private states) plus demo accounts, including invite-only models `ada@vuekumi.demo` (approved editorial on afr-001, public `/m/ada-molefe`) and pending invite `nomsa@vuekumi.demo` (afr-011 exclusive lock demo), and self-shot dual-role `kofi-mensah@vuekumi.demo` (approved commercial on afr-027, public `/p/kofi-mensah` and `/m/kofi-mensah`). People photos without two-party commercial clearance are editorial except the exclusive/portfolio/private/self-shot demos.
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
| Biometrics | Phase 28 stores an opt-in result, not embeddings. Similarity ≠ release. |
| Model payouts | **Recorded with Phase 24:** models do not earn. Split still undecided. Photographer 50% unchanged. |

The old plan’s NestJS / MSW / lockfile / AfriStock risks are closed.

---

## 8. How to use this plan

1. Read [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md).
2. Approve **one** phase at a time (same “next” cadence as Phases 16–19).
3. Default next slice when work resumes: **Phase 29** (photo influencer role or contributor flag)
   unless you redirect. Do not start 30 from this slice.
