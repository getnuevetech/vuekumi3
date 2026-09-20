# VueKumi — Admin portal engineering adoption (spec v1.2)

**Status: engineering adoption note. Plan only until build is explicitly approved.**
Does **not** replace legal agreements, local counsel sign-off, or the Country
Activation Matrix research workbook.

Sources:

1. Product admin-portal memo (three control layers; eight modules; PDS).
2. [`assets/VueKumi_Admin_Portal_Engineering_Specification_v1_2.pdf`](./assets/VueKumi_Admin_Portal_Engineering_Specification_v1_2.pdf)
   — Engineering Implementation Specification v1.2 (Sep 2026).
3. [`07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md`](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md)
   — Trust & Markets product plan (report hub, compensation, matrix).
4. [`assets/VueKumi_Country_Activation_Matrix_2026-09-19.pdf`](./assets/VueKumi_Country_Activation_Matrix_2026-09-19.pdf)
   — country register + research notes (**all HOLD**).

---

## 1. Verdict

The engineering spec and the admin memo are **aligned with VueKumi doctrine** and
with `07`. They correctly require:

- One **Policy Decision Service (PDS)** — not spreadsheet or client-only gates
- **Three independent control layers** (country eligibility ≠ identity/rights ≠
  commercial/payment)
- **Eight connected admin modules**, not eight apps
- Nonmember rights holders and global buyers **outside** the Africa contributor gate
- Fail-closed decisions with reason codes + policy version
- No silent revocation of historical buyer licences

**Shipped today is a partial rights stack** (ACL admin, reports, DMCA, rights
ledger, Africa country list, legal overlays). It is **not** yet a versioned
country-policy + PDS system. Spec v1.2 should be treated as the **target
architecture** for Arc T / admin control plane.

**Do not invent:** Africa-eligibility evidence rules, ID vendors, Dec-PayBase,
launch countries, or VueQuatro entity form — listed as owner decisions in spec §16
and in `06`.

---

## 2. Three control layers (must stay independent)

| Layer | Question | Example (memo) |
| --- | --- | --- |
| **L1 Country eligibility** | May this person register as an Africa-based contributor in role R? | Nigerian photographer APPROVED for contributor signup |
| **L2 Identity & image rights** | Who are they, and are copyright + likeness cleared for this asset? | Canadian model verifies identity + signs release **without** African contributor account |
| **L3 Commercial & payment** | May this image be licensed to a buyer, and may each payee be paid? | Japan buyer licence ALLOW after L2 clears; payouts checked separately |

**Hard rule:** L1 denial must not block L2 nonmember consent. L2 clearance must not
imply L1 contributor privileges. L3 licence issuance must re-evaluate at checkout
time (suspension between listing and pay must DENY **new** licence; keep history).

This matches current doctrine (Africa-only creators; models/buyers unrestricted)
and closes the gap where today’s signup uses a static AU list without ACTIVE
country policy.

---

## 3. Eight modules ↔ shipped admin ↔ target

| Spec module | Spec screens | Shipped today | Target |
| --- | --- | --- | --- |
| **A. Countries** | List, detail, 16 gates, activation wizard | `/admin/countries`, `/admin/legal` overlays | Full HOLD→REVIEW→ACTIVE→SUSPENDED→OFFBOARDING + versioned policy |
| **B. People & eligibility** | Applications, residence, nonmembers, ID result | `/admin/accounts`, models, photographers | Residence verification refs; nonmember payee; waitlist |
| **C. Assets & rights** | Queue, AI subjects, ledger, commercial lock | Content admin, rights ledger, commercial lock | Quarantine + reason-coded locks + policy version on asset |
| **D. Consent & negotiation** | Invites, proposals, signed deals | Guest invite / model decide | Negotiation threads + Dec-PayBase denominator + multi-payee cap |
| **E. Complaints & enforcement** | Report/DMCA/safety/appeals | `/admin/reports`, `/admin/dmca`, strikes | Unified cases + `/report-content` intake (`07` T1–T2) |
| **F. Payouts / tax** | Payee, withholding, holds | Payouts + holds (Phase 39) | Nonmember payee; tax flags; sanctions/provider checks |
| **G. Work / approvals** | Cases, four-eyes, SLA | Admin ACL presets | Maker-checker for country activation; case assignment |
| **H. Audit / monitoring** | Append-only, policy diffs | `writeAuditLog` scattered | Typed events + policy-version traces + exportable dossier |

Shared architecture: identity, RBAC (`AdminProfile.capabilities`), append-only
audit, and **PDS** — do not reimplement country rules inside each route ad hoc.

---

## 4. Gate list: matrix vs engineering spec

The matrix PDF and eng spec v1.2 both require **16 gates**, but **wording/order
differ**. For implementation:

| Authority | Use for |
| --- | --- |
| Eng spec §4 (01–16) | **Canonical gate codes** in `country_gate` schema |
| Matrix PDF | Country register, research notes, initial source URLs, buyer overlay research |
| Phase 40 overlays | Runtime notices only until `counselStatus: signed`; never grant commercial |

Canonical eng-spec gates (store as stable codes `G01`…`G16`):

1. Scope / business model + local counsel assignment  
2. Copyright ownership / commissioning / assignment  
3. Likeness / privacy / publicity / model release  
4. E-signatures + admissible consent evidence  
5. Data-protection law + extraterritorial reach  
6. Registrations / local representative / permits  
7. International transfers / U.S. hosting  
8. Government-ID checks: law + vendor availability  
9. Facial/biometric verification: lawful basis + deletion  
10. Minors / guardians / child compensation  
11. Tax characterization / withholding / reporting  
12. Payment rails / currencies / local licensing  
13. Sanctions / beneficial ownership / payment restrictions  
14. Complaints / consumer / accessibility / language  
15. Retention / security / incident response  
16. Final contracts + approved SOP + counsel + operational sign-off  

Per gate: `NOT_STARTED → RESEARCHING → BLOCKED | APPROVED | NOT_APPLICABLE`.
N/A requires written rationale + distinct approver. Source hyperlink alone ≠
APPROVED.

---

## 5. Policy Decision Service (PDS)

### 5.1 Contract

`POST /policy/evaluate` (internal, service-auth or staff):

**Input:** `actor_id`, `action`, country context, `role`, optional
`asset_id` / `payee_id` / `buyer_id` / `license_use`, `event_time`.

**Output:** `ALLOW | DENY | REVIEW`, `reason_codes[]`, `policy_version`,
`expires_at`, optional `evidence_required[]`.

### 5.2 Actions that must call PDS (backend, not UI)

| Action | Checks (summary) |
| --- | --- |
| `contributor.create` | Africa geo list + country policy ACTIVE + role in `role_scope` + `contributor_signup` ON + identity admission as configured |
| `rights.invite` | Valid clearance purpose + contact safeguards + supported verification for jurisdiction |
| `asset.commercialize` / `license.issue` | Contributor eligibility where required + copyright + every required likeness + negotiation terms + no holds + market checks |
| `payout.authorize` | Entitlement + verified payee + tax + sanctions + provider + no disputed hold |

**Fail closed** if policy missing, stale, conflicting, expired, or unreachable.
Preserve reporting/appeals/existing-account access and lawful payout review paths
as separate actions.

### 5.3 Mapping to current code

Today: `assertContributorCountry`, rights helpers, ACL `preHandler`s — **inline**.
Target: extract evaluators behind PDS; keep Fastify routes as callers. Do **not**
rename working packages solely to match conceptual service names; adapt interfaces.

Commercial eligibility formula (spec §8) extends Phase 25:

```
country_and_program_ok
AND valid_copyright
AND every_required_likeness_valid
AND negotiation_terms_satisfied   // NEW — after Dec-PayBase / Dec-Split
AND no_active_legal_or_safety_hold
AND market_checks_ok
```

Return machine-readable reason codes (not a bare boolean).

---

## 6. Country policy data model (minimum)

From spec §3 / §10 — implement as Prisma models (names illustrative):

- `Country` — iso2, iso3, displayName, `geoContributorEligible` (AU list), provenance  
- `CountryPolicyVersion` — status HOLD|REVIEW|ACTIVE|SUSPENDED|OFFBOARDING,
  version, effectiveFrom/To, immutable once published  
- `CountryGate` + `GateEvidence` + `GateApproval` — G01–G16 lifecycle  
- `CountryFeatureScope` — per-action ON|HOLD|CONDITIONAL:
  `contributor_signup`, `contributor_upload`, `new_license`, `payouts`,
  `biometric_match`, `minor_program`, `nonmember_consent`  
- `CountryTransition` — activation/suspension events (only legal path to change status)  
- Plus existing: assets, appearances, DMCA, holds, audit  

**Activation** is transactional: lock version → recheck gates + four-eyes →
immutable activation event → invalidate PDS cache. Direct DB boolean edits are
**invalid** to PDS.

**Suspension effects** must be explicit per scope: NEW signup / NEW upload /
NEW licences / pending consent / historical licences / unpaid balances — never
silent confiscation of valid history.

---

## 7. Staff four-eyes (country activation)

| Role | Can | Cannot |
| --- | --- | --- |
| Researcher | Draft findings, attach sources | Approve own gate / activate |
| Jurisdiction counsel | Approve legal gates | Unilateral activate / replace specialist signoff |
| Privacy / ID / Tax / Payments / T&S leads | Approve assigned specialty | Approve outside specialty by default |
| Compliance administrator | Confirm completeness; submit activation | Be sole activator if also preparer |
| Independent authorizer | Approve effective policy | Self-approve own material changes |
| Security administrator | Staff access / break-glass | Bypass legal activation rules |
| Support investigator | Case-relevant holds | Raw IDs / face templates / country legality |

Map onto existing `AdminRole` + `capabilities[]` with new capabilities such as
`geo.activation.research`, `geo.activation.gate.approve`,
`geo.activation.submit`, `geo.activation.authorize`, `geo.activation.suspend`.

---

## 8. Delivery tranches (P0–P2) ↔ Arc T phases

Integrate with `07` §7; **do not rebuild** working asset/account/payout services.

| Tranche | Spec meaning | Maps to `07` | Acceptance (from spec §14–15, condensed) |
| --- | --- | --- | --- |
| **P0 Policy core** | 54 HOLD import, PDS, country detail, 16 gates, dual approval, signup enforcement, nonmember independence, audit, expiry alerts | **T0 + T7** (+ wire `contributor.create` to PDS) | **Shipped Phase 49.** HOLD default; activation fails if any gate missing; same staff cannot prepare+authorize; Canada contributor DENY but invited consent ALLOW; `contributorOnboardingPolicy` defaults `africa_list` |
| **P1 Rights & revenue** | Quarantine, AI subjects, reciprocal invites, ID/face provider, releases, negotiation, license recheck | **T4 + T5 + T6** (T5/T6 need Dec-PayBase) | NG photographer + CA model + JP buyer path; unsigned negotiation keeps LOCKED; over-allocation blocked |
| **P2 Global operations** | Complaints/enforcement, tax/payee, buyer overlays, suspend/offboard, vendor deletion evidence, monitoring | **T1 + T2 + T3 + T8 + T9** | Suspension mid-checkout blocks new licence; DMCA counter ≠ likeness hold clear; fail-closed if PDS down |

**Recommended build start when approved:** **P0** first (foundation). Parallel
safe UI: public `/report-content` (T1) can begin once taxonomy is agreed, but
must call the same case/audit store P2 expects.

---

## 9. Mandatory UAT scenarios (adopt verbatim)

Ship automated or runbook tests for at least:

1. All countries HOLD — no self-activation from unreviewed row  
2. ACTIVE NG photographer + CA nonmember model + JP buyer — ALLOW if non-country gates pass  
3. CA applicant contributor — DENY L1; invited model consent still possible  
4. Missing/stale/BLOCKED gate — activation DENY with gate id  
5. Same staff prepare + authorize — DENY separation-of-duties  
6. Direct DB status flip without transition event — PDS invalid  
7. Suspend between list and checkout — new licence DENY; history kept  
8. Photographer claims release; model denies — commercial LOCKED + case  
9. Negotiation without signed agreement — no payout allocation  
10. Multi-model shares exceed pool — block sign/activate  
11. Face-match false negative — manual appeal; no fabricated consent; no biometrics in logs  
12. Vendor deletion SLA miss — incident + safety flag  
13. Accept release, decline account — no contributor/marketing profile  
14. Tax/sanctions restricted payee — review path; entitlement not erased  
15. DMCA counter-notice does not clear likeness/safety hold  
16. PDS unavailable / stale cache — regulated writes fail closed  

---

## 10. Owner decisions before schema freeze (spec §16)

Track in `06` workshop; do not invent answers:

| Decision | Blocks |
| --- | --- |
| Legal entity (VueKumi / VueQuatro) as operator / grantor / payor | Dec-VQ; contracts; DMCA agent |
| Precise Africa-eligibility definition (residence vs creator-business base) + evidence | L1 PDS rules |
| Initial launch countries (none cleared by matrix presence alone) | First ACTIVE |
| ID / facial vendor + DPA + deletion + human fallback | Dec-Bio; gates G08–G09 |
| Which licence classes need likeness / negotiation | Commercial formula |
| **Dec-PayBase** + refund/tax classification | Negotiation + payouts |
| Admin staffing (counsel, privacy, T&S, tax, second approver) | Four-eyes roles |
| Complaint SLAs / retention / escalation contacts | P2 ops |

---

## 11. Explicit non-goals

- Client-only country dropdown as enforcement  
- One ACTIVE flag meaning “all features on” without `feature_scope`  
- Storing raw ID scans / face templates in country-policy tables or exportable reports  
- Auto-converting nonmember payees into Africa contributors  
- Silent wipe of historical licences or earned balances on suspension  
- Inventing launch countries, vendors, or revenue percentages  

---

## 12. Immediate engineering next step

**P0 shipped (Phase 49).** **T1 shipped (Phase 50).** **T2 shipped (Phase 51):**
admin SOP actions (preserve / notify / escalate), DMCA hold blocks report unfreeze,
`docs/runbooks/rights-ops.md`.

**Next (when approved):** T4 `/rights` hub, or T3 DMCA policy hardening (counsel copy).
**P1 Rights & revenue** only after **Dec-PayBase**. Do not invent rates, vendors, or entity.
