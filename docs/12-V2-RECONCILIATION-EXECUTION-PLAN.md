# VueKumi — Imagery Concept v2.0 reconciliation execution plan

**Status: P0 foundation + P1-T5 negotiation + P1-60 identity evidence (flag OFF)
shipped.** Companion to
[`11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md`](./11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md)
(Sep 28 repo review) and [`10-POST-REVIEW-EXECUTION-PLAN.md`](./10-POST-REVIEW-EXECUTION-PLAN.md)
(product phases). Decision blanks updated in
[`06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md).

**Do not implement the full VueKumi Imagery Concept v2.0 UI on top of the old
backlog yet.** First ship a **reconciliation release** that aligns rights,
library tiers, Photo Influencer, Open downloads, configurable economics, and
country activation with v2.0 assumptions.

The prior deferrals were mostly correct legal/business stops. Several items
are now **partially unblocked** by the locked decisions in §1.

---

## 1. Locked decisions (signed for engineering)

### Dec-Bio

Build Stage 3 **provider-agnostically**, but keep verification **disabled in
production** until an approved identity provider, DPA, biometric consent flow,
and explicit vendor-retention schedule are signed.

- VueKumi will **not** maintain persistent face templates or biometric search
  databases.
- Raw verification imagery will **not** be retained by VueKumi beyond the
  verification transaction except where specifically required by law.
- Retain **evidence** of verification (not biometrics): `verification_id`,
  vendor, `verified_person_id`, timestamp, result, `manual_review_status`,
  `consent_version`, document country/type where needed, `subject_match_result`,
  related image IDs.

**Verification chain (not avatar-based):**

1. Government ID → live verification selfie/liveness → **identity verified**
2. Verified live person → person in uploaded image → **subject match**
3. Subject match → person reviews image → **consent/release** (separate)

Face match must **never** equal commercial consent approved.

### Dec-PayBase

Model percentage compensation is calculated from the **Contributor
Distributable Share** attributable to the licensed image after the applicable
VueKumi platform share and transaction reversals/refunds, but **before** the
individual recipient's tax withholding, withdrawal fees, or FX/payout charges.

Illustrative (not a permanent rate lock):

```
Customer License Price
− sales/VAT collected for government (where applicable)
− refunds/chargebacks
= Net Collected License Revenue
→ apply Revenue Policy Version → Platform Share + Contributor Distributable Share
→ model % of Contributor Distributable Share
```

### Dec-Split

Ordinary model allocations come from the **creator/contributor pool**. Platform
share remains separately stated. Exceptions (VueKumi-sponsored campaign,
brand-paid model fee, promotional assignment, enterprise production) must be
**specifically funded** arrangements — not silent reductions of platform share.

### Dec-AfricaElig

A VueKumi contributor must have a **verified primary residence or qualifying
creator/business base in an ACTIVE African country**. African ancestry or
nationality alone does not establish contributor eligibility. Worldwide buyers
and nonmember rights holders remain allowed.

**Onboarding matrix (v2.0 launch):**

| Country state | Contributor path |
| --- | --- |
| ACTIVE African | Onboarding allowed |
| HOLD African | **Waitlist** allowed; activation blocked |
| SUSPENDED | No new contributor onboarding |
| Non-African | Contributor unavailable; rights-holder verification + buyer OK |

---

## 2. Review of deferred items (adjusted)

| Area | Assessment | Do now |
| --- | --- | --- |
| **Phase 60** | Correctly blocked from *activation* | Build provider-agnostic schema/API; feature flag OFF until vendor/DPA/counsel |
| **T5** | Can proceed with Dec-PayBase locked | Build negotiation; add Open eligibility rule (zero-price rights required) |
| **T6** | Ledger now; defer payout rails | Write model `EarningsLedger` lines from Dec-PayBase on grant; certificates must **not** show model economics; withdrawal rails stay finance-gated |
| **T3** | Correct | Finalize public legal copy + registered agent; engine stays |
| **T8** | Structure OK; signup wrong for v2 | HOLD → waitlist (not full contributor); ACTIVE required to activate |
| **T9** | Correct | Keep country overlays separate from person/entity sanctions screening |
| **H3** | No longer low priority | Split before adding v2 features |
| **H4** | Bring forward | Home, Search, Site Content, curation |
| **H5** | Bring forward | Rights, Open downloads, contributor, admin invariants |

---

## 3. Gaps vs Imagery Concept v2.0 (missing from prior plan)

These were not in the Sep 28 backlog and must enter the reconciliation:

| Requirement | Intent |
| --- | --- |
| **Photo Influencer** | Contributor **role/program**, not a separate user architecture |
| **VueKumi Open** | Image-level library tier; zero-price license path |
| **Anonymous Open downloads** | No login required; still tracked (`OpenDownloadEvent` + license version) |
| **Four library tiers** | OPEN / LICENSED / VERIFIED_PLUS / EDITORIAL (+ PRIVATE portfolio) |
| **Mixed-tier search** | Search across tiers with clear eligibility |
| **Guest checkout** | Paid buyer path without full account upfront — **shipped** (passwordless buyer session + email on PhotoDetail; free RF still requires sign-in for quota) |
| **Free-image rights clearance** | Open requires all necessary rights for a zero-price license |
| **License-version snapshots** | Downloads/grants stamp which Open/license policy version applied |
| **Search Opportunity data** | Content Opportunity Engine — **foundation shipped** (search demand events + contributor/admin rollups); deeper matching / auto-briefs stay later |
| **Separate state axes** | Rights status ≠ library tier ≠ commercial status |

### Image state model (required separation)

```
RIGHTS STATUS:     INCOMPLETE | PENDING | VERIFIED | RESTRICTED | DISPUTED
LIBRARY TIER:      OPEN | LICENSED | VERIFIED_PLUS | EDITORIAL | PRIVATE
COMMERCIAL STATUS: ENABLED | BLOCKED | SUSPENDED
```

A rights-verified image may still be placed in OPEN or LICENSED by creator
choice. EDITORIAL may permit publication without full commercial-release
requirements.

### Photo Influencer + Open compensation rule (extends T5)

```
Contributor
  ├── Photographer
  ├── Photo Influencer   ← program/role
  └── Model / Talent

Image
  └── Library Tier (Open | Licensed | Verified+ | Editorial | Private)
```

If a required model demands **ongoing revenue participation**, Open eligibility
is **BLOCKED — compensation requested**. Creator may move to Licensed,
negotiate zero for Open, fund a fixed fee separately, or not publish.

**Rule:** VueKumi Open requires all necessary rights to support a **zero-price
license**. Revenue participation forces a monetized licensing path.

### Anonymous Open download event

```
OpenDownloadEvent
  downloadId, imageId, imageVersion, openLicenseVersion,
  downloadedAt, fileVariant, source, referrer,
  country/region (where lawfully available),
  anonymousSessionId (optional)
```

No user account required. `openLicenseVersion` is critical for later policy
changes and dispute history.

### Buyer certificates vs Rights Ledger

| Surface | Show |
| --- | --- |
| **Buyer certificate** | Copyright verified, model release verified, commercial authorized, license scope, license ID — **not** photographer/model split |
| **Internal Rights Ledger** | Agreement ID, %, fixed amounts, acceptances, revenue-policy version, effective date |

### RevenuePolicy (ahead of T6)

Do **not** hardcode `sale * 0.5`. Every transaction stamps:

```
RevenuePolicy
  policyId, version, effectiveFrom,
  platformShareRule, creatorPoolRule,
  refundRule, taxRule, processingFeeRule, licenseType
```

Example allocation is illustrative only — rates stay policy-versioned.

---

## 4. Reconciliation release — build order

### P0 — Foundation (before v2 public experience)

| ID | Work | Done when |
| --- | --- | --- |
| **P0-H1** | Wire orphan API tests into `npm test` | Five files run in CI |
| **P0-H3** | Split `contributor` routes + `Home.tsx` into domain modules | Stable boundaries (profile, uploads, images, appearances, releases, rights, photo-influencer, analytics, earnings) — not an arbitrary LOC quota |
| **P0-RP** | Versioned `RevenuePolicy`; remove hardcoded 50/50 assumptions from allocation path | New grants stamp `policyId`/`version`; ledger reads policy, not magic numbers |
| **P0-PI** | Photo Influencer as contributor role/program + image-level library tier schema | One account can hold Open / Licensed / Verified+ / Editorial / Private images |
| **P0-OPEN** | Open download + `openLicenseVersion` event architecture | Anonymous download creates `OpenDownloadEvent`; no account required |
| **P0-RIGHTS** | Align Rights Engine with Open / Licensed / Verified+ / Editorial | Separate rights status, library tier, commercial status; Open blocked when compensation demanded |

### P1 — Partially unblocked product + hygiene

| ID | Work | Done when |
| --- | --- | --- |
| **P1-T5** | Compensation negotiation (Proposal → Negotiation → Agreement → Activation) + Open interaction | Commercial off until agree/zero; Open blocked if revenue % requested; multi-model cap vs Contributor Distributable Share — **engine shipped** (API + gates; no Rights hub UI / no T6 payouts) |
| **P1-60** | Phase 60 provider-neutral schema/API behind **OFF** feature flag | Evidence fields only; no prod activation; no biometric DB — **schema + flag-gated API shipped** (`identity.verification_enabled` default false) |
| **P1-T8** | Country ACTIVE / HOLD waitlist / SUSPENDED enforcement per Dec-AfricaElig | HOLD cannot fully activate contributors; waitlist exists — **shipped** (`ContributorWaitlist`; default `africa_list_and_country_active`; admin list/promote) |
| **P1-H4** | React Query on public marketplace: Home, Search, Site Content, curation | Admin save invalidates public keys — **shipped** (`publicQueryKeys`; Home/Search/Site/feed/plans; admin homepage/featured/content/site/plans invalidate) |
| **P1-H5** | Expanded Playwright for rights/Open/contributor/admin invariants | Specs below green in CI — **shipped** (`e2e/h5-invariants.spec.ts`; Open/compensation/dispute/DMCA + upload people + homepage reorder) |

**P1-H5 minimum invariants:**

1. Photo Influencer upload → person detected → no release → Open blocked  
2. Photographer invites model → model approves zero-fee Open → Open enabled  
3. Model requests 20% → Open blocked → Licensed available after agreement  
4. Anonymous visitor downloads Open image → no account  
5. Guest/paid checkout → license certificate created (certificate without economics)  
6. Rights dispute → commercial licensing suspended  
7. DMCA counter resolves copyright hold → likeness hold remains  

### P2 — Later

| ID | Work |
| --- | --- |
| **P2-T6** | Real model payouts after finance readiness — **ledger shipped** (activated likeness agreements → `likeness_compensation` EarningsLedger lines from Contributor Distributable Share; photographer residual; certificates omit model economics). **Payout withdrawal rails still finance-gated.** |
| **P2-VP** | Verified+ product surface — **shipped** (admin set + eligibility gate; search `libraryTier` filter/facets; PhotoCard/PhotoDetail badge; seed `afr-020`; ≠ Rights Verified) |
| **Partner API depth** | **Shipped** — partner photo DTO exposes `libraryTier` + `licenseType`; list filters reuse catalog `buildPhotoWhere` (`libraryTier`, `license`, `tag`, `photographer`, `sort`) |
| **P2-OE** | Content Opportunity Engine foundation — **shipped** (`SearchOpportunityEvent` from catalog search; contributor + admin rollups of unmet demand; seed gaps; no auto-briefs/ML) |
| **P2-BS** | Brand Studio foundation — **shipped** (`BrandProject` workspace for buyers/agencies; link campaign + lightboxes; `/brand` hub; no production fees / no licence-on-attach) |
| **Later** | Hire expansion |
| **Guest checkout** | **Shipped** — paid licences via guest email (passwordless `user` session); free RF still requires account |
| **T3** | Counsel: legal entity, registered DMCA agent, addresses, deploy public copy |
| **T9** | Person/entity/beneficial-owner/FI screening via KYC partners; country matrix records which provider covers which function — **not** country-only reject |

---

## 5. Explicit non-goals for reconciliation

- Activating biometric verification in production without vendor/DPA/counsel  
- Building a VueKumi face database or retaining selfies/templates  
- Showing model-photographer economics on buyer certificates  
- Hardcoding a permanent platform commission rate into ledger math  
- Treating ethnicity/ancestry as contributor eligibility  
- Inventing an OFAC screening vendor or country-blanket rejection  
- Implementing full Brand Studio / Opportunity Engine / Hire marketplace in P0  

---

## 6. Relationship to prior docs

| Doc | Role after this note |
| --- | --- |
| `11` | Historical Sep 28 recommendations; superseded for sequencing by **this doc** |
| `10` | Product phase map; T5/T8/60 proceed under **locked Dec-*** here; T6 still finance-gated |
| `06` | Dec-* Chosen rows updated to match §1 |
| `07` / `09` | Doctrine remains; payment base and Bio posture now concrete |
| Imagery Concept v2.0 | Product source; this doc is the engineering reconciliation bridge |

---

## 7. Immediate approval ask

Approve **P0 reconciliation** as the next build track (H1 → H3 → RevenuePolicy →
Photo Influencer + tiers → Open events → Rights alignment), then P1 slices
one at a time. Do **not** jump straight to a full v2 marketing UI rewrite.
