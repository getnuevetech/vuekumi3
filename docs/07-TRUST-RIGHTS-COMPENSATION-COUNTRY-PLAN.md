# VueKumi — Trust, rights operations, likeness compensation & country activation

**Status: implementation plan only. Do not start numbered build phases from this
document until explicitly approved.** Companion to
[`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md),
[`05-POST-ARC-D-RECOMMENDATIONS.md`](./05-POST-ARC-D-RECOMMENDATIONS.md), and
[`04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md`](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md).

Source inputs reviewed for this plan:

1. Product memo (Sep 2026): public image-rights complaint system, formal DMCA +
   counter-notice + repeat-infringer ops, model compensation negotiation in
   clearance, and a secure rights-holder surface.
2. [`assets/VueKumi_Country_Activation_Matrix_2026-09-19.pdf`](./assets/VueKumi_Country_Activation_Matrix_2026-09-19.pdf)
   — internal planning draft. **No country is legally cleared or ACTIVE.**
3. Admin portal memo + [`assets/VueKumi_Admin_Portal_Engineering_Specification_v1_2.pdf`](./assets/VueKumi_Admin_Portal_Engineering_Specification_v1_2.pdf)
   — three control layers, eight modules, Policy Decision Service. Engineering
   adoption: [`08-ADMIN-PORTAL-ENGINEERING-SPEC.md`](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md).

---

## 1. Verdict against what already shipped

VueKumi already has pieces of a rights operating system. The memo is not a
greenfield rebuild; it is a **productization and separation** of paths that are
today either photo-detail-only, counsel-placeholder, or missing entirely.

| Memo ask | Shipped today (`main`) | Gap |
| --- | --- | --- |
| Public image-rights / takedown page | Per-photo report on `/photo/:id` (`POST /api/photos/:id/report`); reasons: `copyright`, `likeness`, `unauthorized_use`, `other` | No dedicated `/report-content`; categories thinner than memo; no guest-first hub |
| Secure rights-holder dashboard | Guest invite pages + model portal + **`/rights` hub (Phase 52)** | Compensation negotiation still deferred (T5 / Dec-PayBase) |
| Formal DMCA notice / counter-notice | Phase 39: `/dmca`, notices, counters, freezes, earnings holds | Agent filing + public policy copy still counsel/ops; counter restore waits staff |
| Repeat-infringer policy | Strikes + threshold (default 3) + serious-fraud strike reasons | Needs documented public policy + staff SOP UI, not only settings |
| Separate safety / likeness vs DMCA | Code comment and separate report vs DMCA routes | Product UX must enforce: counter-notice ≠ likeness/safety override |
| Model compensation negotiation | **Absent.** Models `earns: false`; photographer 50% of paid licences | Dec-Split reframed below — build only after payment-base decision |
| Country activation ops | Phase 40 overlays + `/admin/legal` + Africa creator gate; overlays `counselStatus: placeholder` | Matrix’s 16 gates, HOLD→ACTIVE workflow, evidence, sign-off **not** in admin |

**Do not invent:** photographer/model/platform percentages, booking fees, biometric
vendors, retention days, or VueQuatro entity form. Illustrative 20%/35% figures in
the memo are **examples only**.

---

## 2. Doctrine locks this plan must not break

Carried from [`03`](./03-PRODUCT-AND-RIGHTS.md) and the matrix:

1. **Copyright ≠ likeness.** Separate clearance tracks; commercial needs both when
   people are required.
2. **Identity match ≠ ownership or consent.** Phase 28 similarity and any future
   ID vendor result never grant a release.
3. **Africa-only contributors** for photographer / community / influencer accounts.
   Models-as-subjects and **nonmember rights holders** are not Africa-restricted.
4. **Usage permission, not ownership.** Buyer grants stay certificates with
   stamped terms.
5. **Withdrawal / dispute locks NEW licences;** does not silently void past
   certificates (ledger preserved).
6. **Country overlays never weaken** the Global Rights Standard or invent
   commercial eligibility.
7. **ALL countries start HOLD** in the activation matrix. Research notes ≠
   clearance. ACTIVE only after **16/16 gates + evidence + signed approval**.
8. **DMCA is copyright-only.** Likeness, forged release, intimate images, and
   payment disputes use other procedures; a valid DMCA counter-notice must not
   auto-clear those holds.

---

## 3. How the memo reframes Dec-Split (without inventing rates)

Today Dec-Split in [`05`](./05-POST-ARC-D-RECOMMENDATIONS.md) / [`06`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md)
asks for a global photographer/model/platform split (or “models never earn”).

The memo’s commercial rule is sharper and should **replace that framing** when
approved:

| Old framing | New framing (memo) |
| --- | --- |
| Fixed platform-wide model share (or never earn) | Per-clearance **negotiation**: %, fixed fee, combination, or zero |
| Photographer can clear commercial without model money talk | Photographer **cannot** obtain VueKumi commercial clearance while bypassing the model’s compensation decision |
| Silent ledger change | No commercial licensing until **both** accept identical financial terms |

Still undecided until a human signs (workshop blanks in `06`, updated by this plan):

- **Dec-PayBase** — exact definition of the payment base for any %-share (e.g.
  customer paid licence price vs photographer distributable share after platform
  cut vs net after refunds). **Must be one sentence signed by product + finance.**
- **Dec-Split** — superseded for *new* commercial releases by negotiation; still
  needed for: default UX suggestions (optional presets only), marketing honesty,
  and whether zero-comp is the default prompt.
- **Existing releases / issued grants** — new negotiation does **not** rewrite
  binding past agreements; staff/counsel evaluate under actual terms.

Until Dec-PayBase is signed, engineering may build **proposal/counter/accept
plumbing and commercial lock**, but must **not** pay models or change the 50/50
photographer ledger formula.

---

## 4. Target product surfaces

### 4.1 `/report-content` — public Report an Image or Rights Violation

Dedicated SPA route + API (guest allowed). Not limited to copyright.

**Categories (map to internal queues):**

| UI category | Primary queue | Notes |
| --- | --- | --- |
| Copyright infringement | DMCA-capable copyright track | May escalate to formal `/dmca` notice when statutory fields present |
| Unauthorized use of my image or likeness | Likeness / consent track | Freeze commercial; not a DMCA counter target |
| Fraudulent release or false identity | Fraud / strikes track | Can support immediate serious-fraud strike path |
| Intimate images, minor safety or other urgent harm | Safety fast-path | Separate SLA; not ordinary copyright queue |
| Compensation or licensing dispute | Commercial dispute track | May freeze new sales; does not invent a fee |

Keep photo-detail “Report” as a deep-link into `/report-content?photoId=…`.

### 4.2 `/rights` — secure rights-holder dashboard

Authenticated **or** tokenized guest session for nonmembers:

- Verify identity / review invited images
- Approve / reject / restrict releases (existing guest flows consolidated)
- **Propose / counter / accept compensation** for commercial scope (new)
- See dispute status for their appearances

Nonmember rights holders (including outside Africa) may receive an agreed likeness
fee **without** becoming Africa-restricted contributors.

### 4.3 `/dmca` — keep as formal copyright statutory path

Retain and harden Phase 39. Public policy pages must state agent identity,
notice requirements, counter-notice timetable (10–14 business days restore wait
per U.S. Copyright Office guidance — **staff restore, not automatic**), and that
counter-notice does not lift likeness/safety holds.

### 4.4 Admin trust console

Unify (capability-gated) intake across reports, DMCA, safety, fraud, and
compensation disputes with urgency, evidence preservation, notify, escalate,
strike, hold, close — matching the memo’s SOP list. Prefer extending
`/admin/reports` + `/admin/dmca` over a third orphan queue.

---

## 5. Model compensation negotiation — engine sketch

Build as a first-class rights object, not chat notes.

```
Proposal → Negotiation → Agreement → Activation
```

1. **Proposal** — model (or photographer) proposes: `% of Dec-PayBase`, fixed USD,
   combination, or `zero`. Unsigned proposal ≠ release.
2. **Negotiation** — other party accept / counter / decline. Full history audited.
3. **Agreement** — both accept identical terms: photo set, licence scopes,
   payment basis enum, % and/or fixed amount, effective date, restrictions.
4. **Activation** — commercial engine enables only when: copyright cleared +
   likeness approved for commercial + **compensation agreement active** (or
   explicit zero) + any required identity/legal gates for that country.

**Multi-model:** every required appearance needs its own agreement; sum of
promised allocations cannot exceed **available revenue under Dec-PayBase**
(hard validation).

**Ledger (after Dec-PayBase):** extend `EarningsLedger` with model likeness lines
that are never silent; photographer share adjusts only by the **agreed** model
allocations from the defined base. Platform cut stays explicit.

**Out of scope until decided:** booking/campaign/representation fees (still zero).

---

## 6. Country Activation Matrix — admin product (no conflict)

Source of truth for ops tracking:
[`assets/VueKumi_Country_Activation_Matrix_2026-09-19.pdf`](./assets/VueKumi_Country_Activation_Matrix_2026-09-19.pdf)
(workbook XLSX remains the editable counsel artifact; admin mirrors status).

### 6.1 Alignment with Phase 40 overlays

| Matrix concept | Existing system | Rule |
| --- | --- | --- |
| 54 African countries HOLD | `Country` + creator Africa eligibility | Default activation **HOLD**; creator signup still Africa-list based, but **commercial contributor activation** may later require country ACTIVE |
| 16 legal gates | Not in DB today | New `CountryActivationGate` records; never auto-flip ACTIVE |
| Priority research (NG, GH, KE, ZA, RW, MA, EG) | Priority overlays NG/GH/KE/ZA/RW/TZ/UG/SN | Research notes ≠ `counselStatus: signed` |
| Buyer overlays US/EU/UK | Global Rights Standard + buyer terms | Separate **buyer market overlay** table; does not unlock contributor ACTIVE |
| ID / biometrics gates | Phase 28 discard-selfie; Dec-Bio open | Gate K evidence may remain Pending until Dec-Bio; do not invent vendor |
| Rights workflow Steps 1–7 | Largely matches invite → decide → dispute freeze | Matrix Step 3 ID+liveness is **gated** on Dec-Bio + privacy counsel |

**Conflict avoidance:**

- Admin country ACTIVE must **not** bypass Global Rights Standard commercial
  rules or invent overlay commercial eligibility.
- HOLD countries may still appear in the Africa register for signup if product
  keeps today’s “AU state list” rule — but the matrix’s launch log expects
  **pilot ACTIVE** before treating a market as counsel-cleared. Plan: introduce
  `contributorOnboardingPolicy`: `africa_list` (current) vs `africa_list_and_country_active`
  (post–pilot). Default stays `africa_list` until product flips the flag.
- Matrix “delete ID/selfie under fixed retention” does **not** override Dec-Bio;
  until Dec-Bio closes, keep Phase 28 discard-forever for Stage 3 vision checks.

### 6.2 Admin UI: Country Activation

New `/admin/countries/activation` (capability e.g. `geo.activation.manage`,
super-admin / compliance role):

- Register: 54 rows, ISO, region, review wave, status HOLD|ACTIVE|SUSPENDED
- Per country: 16 gates with status Pending|Complete|Blocked, evidence URL,
  reviewer, reviewedAt, recheck trigger
- ACTIVE transition: server enforces `gatesComplete === 16` + `approvalSignedAt`
  + actor capability; write audit log
- Buyer overlay panel (US, EU/EEA, UK, Other) — review status only until counsel
- Import/export CSV compatible with workbook columns where practical

Launch action log from matrix §07 (US entity, DMCA agent, privacy RoPA, face
vendor, rights contract tests, payment/tax, sanctions, country pilot, buyer
global) becomes an **ops checklist** entity or static admin page linked to
evidence — not a substitute for counsel sign-off.

---

## 7. Proposed phase sequence (Arc T — Trust & Markets)

Do **not** number these into `01` as approved work until product says start.
Suggested order minimizes counsel blockers and avoids inventing money.

| Phase | Name | Depends on | Done when |
| --- | --- | --- | --- |
| **T0** | Doctrine + Dec workshop update | — | This doc accepted; `06` Dec-Split / Dec-PayBase blanks updated; matrix PDF in repo |
| **T1** | Public `/report-content` + category taxonomy | T0 | **Shipped Phase 50.** Guest hub live; deep-link from photo; queues + safety fast-path |
| **T2** | Rights ops SOP in admin | T1 | **Shipped Phase 51.** Preserve / notify / escalate on `/admin/reports`; DMCA unlock separation; `docs/runbooks/rights-ops.md` |
| **T3** | Public DMCA/repeat-infringer policy hardening | Counsel copy | `/dmca` policy matches entity + agent; counter-notice clock documented; repeat policy public |
| **T4** | `/rights` hub (consolidate guest + model) | T1 | **Shipped Phase 52.** Token/auth dashboard for review/approve without compensation |
| **T5** | Compensation negotiation (commercial lock) | **Dec-PayBase signed**; T4 | Propose/counter/agree; commercial off until agree or explicit zero; multi-model cap validation; **no payout yet** if pay rails unreadiness |
| **T6** | Model likeness payouts in ledger | T5 + finance | Ledger lines from Dec-PayBase; certificates stamp agreed terms; Africa nonmember fee OK |
| **T7** | Country Activation Matrix admin | T0 | **Shipped Phase 53** (ops polish on Phase 49 P0): evidence URLs, feature scopes, transitions, CSV |
| **T8** | Pilot country activation (ops) | T7 + counsel | First ACTIVE country(ies) with evidence; optional flip `contributorOnboardingPolicy` |
| **T9** | Buyer market overlays + sanctions checklist | Counsel | US/EU/UK overlay status in admin; OFAC screening SOP linked |

**Parallelisation that is safe:** T7 / **P0 policy core** (`08`) can run beside
T1–T4. **T5/T6 must wait** on Dec-PayBase. **T3/T8** wait on counsel artifacts.

When the engineering spec is the build authority, prefer tranche labels **P0 →
P1 → P2** in [`08`](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md) §8; keep T1–T9 as the
product surface map.

---

## 8. Internal SOP (staff) — minimum sections

Document in `docs/runbooks/rights-ops.md` (new) when T2 starts:

1. Intake & category classification  
2. Urgency assessment (safety vs ordinary)  
3. Evidence preservation  
4. Licensing suspension / commercial freeze  
5. Investigation  
6. User notifications  
7. Escalation (legal / law enforcement)  
8. DMCA counter-notice handling (statutory wait; no likeness auto-clear)  
9. Repeat-infringer & serious-fraud decisions  
10. Closure & audit  

---

## 9. Explicit non-goals

- Inventing default model % or platform booking fees  
- Public face database / long-term embedding store  
- Auto-converting nonmember contacts into contributor accounts  
- Treating matrix research notes as legal clearance  
- Letting overlays or ACTIVE flags clear commercial when rights engine would block  
- Rewriting issued buyer certificates when a new compensation demand appears  

---

## 10. Immediate next actions (human)

1. Approve this plan as the Trust & Markets backlog (or edit).  
2. Sign **Dec-PayBase** (and revisit Dec-Split / Dec-Bio / Dec-VQ in `06`).  
3. Counsel: DMCA agent filing, public policy copy, first-wave country gate evidence.  
4. Ops: keep Lightsail TLS + SHA work on Track O; do not block T0–T1 docs/UI on TLS.  
5. **P0–T2 + T4 + T7 shipped (Phases 49–53).** Optional next: **T3** DMCA policy (counsel),
   or PDS `license.issue` suspend enforcement. Do not start negotiation payouts before **Dec-PayBase**.
   Pilot ACTIVE countries (T8) still need counsel evidence.
