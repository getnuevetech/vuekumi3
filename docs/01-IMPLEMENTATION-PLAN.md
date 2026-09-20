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

Updated 18 September 2026 against `main` after Arc D (Phases 35–40). Post–Arc D
recommendations and ops/decision tracks:
[`05-POST-ARC-D-RECOMMENDATIONS.md`](./05-POST-ARC-D-RECOMMENDATIONS.md).
Trust, report hub, likeness compensation negotiation, and Country Activation Matrix:
[`07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md`](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md)
(**plan only** until approved). Admin portal engineering adoption (PDS, eight
modules, P0–P2):
[`08-ADMIN-PORTAL-ENGINEERING-SPEC.md`](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md).

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
| Auth | Password + Google OAuth + refresh cookies; one account type per email except self-shot dual role (`photographer` + `ModelProfile` on the same user). Community `contributor` is a separate, non-commercial path. |
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
| — | **Photographer vs community contributor** + two-rights engine (photo copyright vs likeness/model release). Automatic AI person screening. Route A photographer-provided release vs Route B VueKumi contacts the model. Guest approve/reject/not-me/unauthorized. Minors need guardian authorization. Commercial eligibility = copyright cleared + required likeness rights cleared. |
| 29 | Photo influencer as a **separate account type** (`photo_influencer`) — own signup, own admin list, own terms. Not a photographer sub-choice. Not commercial stock. Africa-only. Cannot convert to photographer on the same email. |
| 30 | Booking: hire photographer / book model — briefs, quotes, accept/decline/withdraw, availability + indicative day rate on profiles. Payment is settled off-platform; Vuekumi takes **no booking commission** (rate undecided — do not invent one). Booking money never touches the earnings ledger. |
| 31 | VueQuatro representation — opt-in request → staff approve/decline, revocable by either side. `agency_protected` becomes real handling: only settable while represented, licensed through staff-routed inquiries, reverts to portfolio-only when representation ends. Staff queue at `/admin/representation`. **No representation commission** (undecided) and **no second public app** — VueQuatro is a staff mode. |
| 32 | Brand production — campaign-shaped sourcing at `/campaigns`: buyer/agency accounts post campaign briefs (deliverables, usage, dates, indicative budget), contributors pitch with an optional rate, the brand accepts/declines, contributors withdraw pending pitches, owner or staff close campaigns. **No production commission** (undecided), settlement off-platform, campaign money never touches the earnings ledger, and accepting a pitch licenses nothing — photographs still go through checkout with all rights guards. |
| 33 | Partner / distribution API — authenticated (admin-issued bearer keys, hash-stored, shown once, revocable), licensed (cleared stock inventory only; licence flags computed with the same guards as checkout; licences granted on VueKumi, not by the API), rate-limited (120 req/min per key). Read-only `GET /api/partner/v1/photos[/:id]` with attribution and terms. **AI training is not permitted through this API** even when a photograph has a separate opt-in (Phase 34). Dataset pricing is undecided. Staff key management at `/admin/partner-api`. |
| **34** | AI-training opt-in, separate from RF/commercial grants. Consent recorded on copyright and likeness. Dataset pricing **undecided** — not sold; buyer grants stamp `ai_training: false`; partner API still forbids training. Minors never eligible. |
| **35** | Admin user management from the portal: create members, photographers, community contributors, agencies, and models; dedicated photographers list; activate/suspend the **agency entity** (not only the user). |
| **36** | Super-admin creates staff; `AdminRole` is a preset; authorization is `AdminProfile.capabilities[]`. Nav and every admin API route are gated. `content.impersonate_creator` is off for support/moderator/finance. |
| **37** | Symmetric rights quality (`claimed → documented → verified`); third-party copyright never commercially cleared by declaration; Rights Ledger; guardian write. |
| **38** | Model public registration + model upload; VueKumi contacts the photographer (copyright authorization, guest rights page). Self-shot commercial requires photographer agreement on the same email; `accountType` stays `model`. Models still do not earn. |
| **39** | DMCA notice path, repeat-infringer strikes, payout holds. `GET /contributor/earnings` is open to photographers. DMCA is copyright only. |
| **40** | VueKumi Global Rights Standard hooks + country overlays (agreement copy remains counsel-gated). |
| **41** | Admin-curated homepage featured slots (hero, edge, editorial, pricing, stats background). Unfilled positions keep live ranking. Featuring is not a licence. Private / portfolio / agency-protected cannot be pinned. |
| **42** | Staff booking + campaign queues (`/admin/bookings`, `/admin/campaigns`). Visibility + campaign close for moderation. No payment rails, no commission. |
| **43** | Staff act-as creator (`content.impersonate_creator`). Staff JWT + `?userId=`; Open as creator from Admin accounts; banner + exit. Payout writes blocked. No cookie swap. Models/agencies not in scope. |
| **44** | Arc C seed fixtures: representation request + represented photographer with agency-protected inventory + inquiry; partner API demo key (local/CI). No commissions. |
| **45** | Playwright web smoke (`e2e/smoke.spec.ts`): home, catalog, models, admin login → platform health, member bookings. CI runs after API tests against seeded Postgres. API remains the contract suite. |
| **46** | Ops inventory (O0 external probe) + decision workshop brief (`docs/06`) + O3/O4 checklists in Lightsail README. No invented rates; does not claim O2 closed. |
| **47** | Rotate live demo staff passwords (admin re-rotate, support, moderator); external O4 API smoke signed; finance on-host recovery required after rate-limit. TLS still open. |
| **48** | Finish live `@vuekumi.demo` password rotation (member/agency/models/photographers + finance); expand Playwright smoke to pricing/legal/DMCA. CI still uses seed passwords locally. |

Rights v1 treated model clearance as an admin-verified file. Phase 25 replaces that as the
commercial path: photographer plus model approval. PDFs remain supporting evidence.

---

## 3. Gap vs the recovered concept

Full doctrine: [`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md) §8.

| Concept | Status |
| --- | --- |
| Photographer copyright + platform licence + buyer usage licence | Shipped (agreement + grants) |
| Model as a real, verifiable account | **Yes** — public `model` registration (Africa not required) plus the photographer invite path. Photographers may also hold a `ModelProfile` on the same email. Models may upload; VueKumi contacts named photographers. Admin/agency cannot. |
| Public model portfolio | Shipped (Phase 27) — `/m/:handle` and `/models` from approved, confirmed likeness on profile-visible photographs. Model does not gain copyright. Booking CTA on profiles when available (Phase 30). |
| Two-approval commercial lock | Shipped (Phase 25) — commercial-class licences of people photos require every appearance approved with confirmed likeness and commercial usage. PDF is supporting evidence. |
| Invite-the-model as acquisition | Shipped (Phase 24) — photographer names a person; VueKumi emails the invite |
| Permission states (private / portfolio / editorial / restricted / commercial / exclusive / agency-protected) | Shipped (Phase 23) — orthogonal to moderation status; catalog is stock states only |
| Self-shot dual role | Shipped (Phase 26) — photographer identifies themselves on their own photo; `accountType` stays `photographer` |
| Visual verification with biometric safeguards | Shipped (Phase 28) — opt-in per photograph, discrete result only, selfie discarded immediately. No embedding store or public face database. Similarity cannot grant rights. |
| Report / takedown / dispute trail | Shipped (Phase 22 report + Phase 39 DMCA + Phase 40 overlays). Public report, staff freeze, DMCA notices, strikes, payout holds, country overlays. DMCA is copyright only. |
| Photo influencer role | Shipped — first-class `accountType: photo_influencer`. Separate registration, admin list, and terms from photographers. Not commercial stock. One type per email. |
| Talent booking | Shipped (Phase 30) — briefs, quotes, accept/decline/withdraw with availability on profiles. Off-platform settlement; no commission (rate undecided). |
| VueQuatro representation / agency-protected inventory | Shipped (Phase 31) — opt-in, revocable, no commission (rate undecided), copyright unchanged. Agency-protected inventory routes to staff inquiries instead of checkout. Staff mode only, no second public brand. |
| Partner API | Shipped (Phase 33) — read-only distribution of cleared inventory with honest licence flags, per-key rate limits, and explicit no-AI-training terms. Licences are still granted on VueKumi. |
| Separate AI-training consent | **Yes** (Phase 34) — explicit per-photograph opt-in on copyright and likeness, separate from RF/commercial grants. Dataset pricing is **undecided**; VueKumi does not sell training access. Buyer certificates stamp `ai_training: false`. Partner API still does not grant training rights. |
| Photographer/model revenue split | **Undecided — do not invent** |

Marketplace leftovers that still matter for a honest live site, but are **not** the
differentiator:

- Featured homepage slots are **staff-pinnable** (Phase 41); unfilled positions stay query-driven

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
| **41** | Admin-curated homepage featured slots — **shipped** | The last Arc A leftover: staff pin live stock photographs; empty slots keep ranking. |

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

**Gate recorded with Phase 30 (16 September 2026):** booking shipped as briefs + quotes +
decisions only. Vuekumi does **not** process booking payments and takes **no** commission —
the booking/production commission rate remains **undecided**. Do not add booking payment
rails or a platform fee without an explicit decision.

**Gate recorded with Phase 31 (16 September 2026):** representation shipped opt-in and
revocable with **no** commission — that rate is also **undecided**. VueQuatro stays a
VueKumi staff mode: whether it becomes a separate app or legal entity is an open decision.
Ending representation reverts agency-protected photographs to portfolio-only; it never
invents clearance and never moves copyright.

**Gate recorded with Phase 32 (17 September 2026):** brand production shipped as briefs +
pitches + decisions only, same discipline as booking: **no** production commission (rate
undecided), **no** campaign payment rails, and accepting a pitch grants **no** licence —
image licensing still runs through checkout with the two-approval commercial lock intact.

**Gate recorded with Phase 33 (17 September 2026):** the partner API is read-only
distribution of **cleared inventory only** (active photos in stock permission states —
never private, portfolio, or agency-protected). Licence flags reuse the exact checkout
guards, and licences are granted on VueKumi, not by the API. Partner terms **exclude AI
training** — Phase 34 records a separate AI-training opt-in. Dataset pricing remains
**undecided**, so VueKumi does not sell training access and the partner API still does not
grant AI-training rights. Do not invent a dataset SKU or price.

### Arc C — Talent, VueQuatro, distribution

Only after commercially cleared images have real people behind them.

| Phase | Work |
| --- | --- |
| **29** | Photo influencer as a **separate account type** (not a photographer kind). Own signup, ACL, and terms. Discovery without mixing commercial-stock photographers — **shipped** |
| **30** | Booking: hire photographer / book model (briefs, availability, quotes). VueKumi stays the marketplace. Off-platform settlement, no commission — **shipped** |
| **31** | VueQuatro representation: agency-protected inventory, opt-in enforcement/admin of rights, staff tools. Not a second public brand required on day one. No representation commission (undecided) — **shipped** |
| **32** | Brand production (campaign-shaped sourcing, not only single-image checkout). Off-platform settlement, no commission — **shipped** |
| **33** | Partner / Unsplash-style **distribution API** (authenticated, licensed, rate-limited). Cleared inventory only; no AI-training use — **shipped** |
| **34** | AI-training opt-in, separate from RF/commercial grants. Consent can be recorded on copyright and likeness tracks. **Dataset pricing remains undecided** — VueKumi does not sell training access, partner APIs never grant it, buyer certificates stamp `ai_training: false`. Minors never eligible. — **shipped** |

### Arc D — Staff ACL and symmetric rights

Full procedure: [`04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md`](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md).
Approve **one** remaining phase at a time.

| Phase | Work |
| --- | --- |
| **35** | Admin user management from the portal: create/edit every account type, photographers list, agency activation — **shipped** |
| **36** | Super-admin creates admins; granular capability ACL (roles are presets) — **shipped** |
| **37** | Symmetric rights quality (`claimed → documented → verified`); tighten commercial eligibility; Rights Ledger; guardian write — **shipped** |
| **38** | Model public registration + model upload; VueKumi contacts the photographer (mirror of Route B) — **shipped** |
| **39** | DMCA notice path, repeat-infringer strikes, payout holds — **shipped** |
| **40** | VueKumi Global Rights Standard hooks + country overlays (agreement copy remains counsel-gated) — **shipped** |

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
- Demo stays runnable; seed remains the 29-photo African library (stock + portfolio/private states) plus demo accounts, including public-register models `ada@vuekumi.demo` (approved editorial on afr-001, public `/m/ada-molefe`, plus model-uploaded `mdl-pending-copy` awaiting photographer Lena) and pending invite `nomsa@vuekumi.demo` (afr-011 exclusive lock demo), self-shot dual-role photographer `kofi-mensah@vuekumi.demo`, and model-primary dual-role `zuri-adewale@vuekumi.demo` (`mdl-self-shot`, accountType stays model). People photos without two-party commercial clearance are editorial except the exclusive/portfolio/private/self-shot demos. `amara-okafor@vuekumi.demo` is seeded as `accountType: photo_influencer` (not a photographer). Staff presets: `support@vuekumi.demo`, `moderator@vuekumi.demo`, `finance@vuekumi.demo` (`User12345!`); super-admin remains `admin@vuekumi.com` / `Admin123!`.
- CI seeds the database before the API test suite (the seeded demo constellation is test fixture data).
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
2. For staff ACL + model upload + symmetric rights, read
   [`04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md`](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md) and
   approve **one** phase at a time.
3. Default next slice: **none scheduled**. Phase 53 (T7 country matrix ops — evidence URLs,
   feature scopes, transitions, CSV export on `/admin/countries/activation`) is shipped.
   Phase 52 (T4 public `/rights` hub — token +
   auth review/approve, no compensation) is shipped. Phase 51 (T2 rights ops SOP — preserve /
   notify / escalate, DMCA unlock separation, `docs/runbooks/rights-ops.md`) is
   shipped. Phase 50 (T1 public `/report-content` hub + expanded taxonomy + safety
   fast-path) is shipped. Phase 49 (P0 country policy + PDS) is shipped. Phase 48
   (live demo cred hygiene + Playwright expand) is shipped. Phase 47 (staff password
   rotation + O4 API smoke) is shipped.
   For ops redeploy and decision gates, see
   [`05-POST-ARC-D-RECOMMENDATIONS.md`](./05-POST-ARC-D-RECOMMENDATIONS.md) and
   [`06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md)
   — still requires explicit approval before any numbered money/biometric phase.
4. When a phase is complete, **merge it to `main` immediately.** `main` is the single
   source of truth — do not leave a finished phase only on a feature branch.
5. **Ops, not a phase:** production still needs on-host SHA confirm (O2), TLS (O3),
   and HTTPS O4 re-sign. Prefer full `main` through 53. Do not invent undecided
   splits, commissions, biometric vendors/retention, or a VueQuatro entity form.
   Do not start P1 negotiation payouts before **Dec-PayBase**.
