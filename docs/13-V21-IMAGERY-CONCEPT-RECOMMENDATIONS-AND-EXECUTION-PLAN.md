# VueKumi Imagery Concept v2.1 — recommendations & execution plan

**Status: plan only until Dec-FC / Dec-Upgrade / Dec-RolePay are locked.**  
Source: *VueKumi Imagery Platform — Full Product, Content, Rights & Commercial Concept* v2.1 (September 2026).  
Supersedes product terminology in older “Photo Influencer” concept copy where they conflict; does **not** restart shipped rights/Open/Licensed/Verified+ engineering from [`12-V2-RECONCILIATION-EXECUTION-PLAN.md`](./12-V2-RECONCILIATION-EXECUTION-PLAN.md).

Companion: existing technical reconciliation remains in **`12`**. This document answers: what v2.1 changes, what is already built, what to build next, and what must stay gated.

---

## 1. Verdict

v2.1 is the right strategic document for VueKumi: **not an African Unsplash clone**, but trusted African imagery infrastructure with frictionless Open discovery, explicit rights, Africa-based supply, and worldwide buyers.

Most of Spec Phase 1 is **already shipped** as foundations on `main` (Open downloads, library tiers, guest checkout, rights engine, compensation negotiation, country waitlist, Hire/Brand/Opportunity/Partner API foundations, Verified+ surface).

The **real delta** in v2.1 is account-model clarity:

| v2.1 concept | Current product (`main`) |
| --- | --- |
| **Free Contributor** = free Open-library identity; discontinue “Photo Influencer” | `photo_influencer` + community `contributor`; UI still says Photo influencer |
| Paid **Contributor / Photographer / Model / Buyer** as subscriber roles | Plans exist; roles are **not** gated on paid subscription |
| Upgrade Free → paid role **same verified identity** | Phase 29: photo influencer **cannot** convert to photographer on same email |
| Image-level Open / Licensed / Verified+ / Editorial | **Shipped** |
| No-login Open download; guest paid checkout | **Shipped** |
| Model compensation from Contributor Distributable Share | Engine + UI + ledger **shipped**; withdrawal flag OFF |

**Recommendation:** Treat v2.1 as the product authority for naming and Free Contributor program design. Treat `12` as the rights/economics technical authority. Sequence a **Free Contributor reconciliation track (FC)** before inventing new marketplace features.

---

## 2. Recommendations

### R1 — Do not rebuild the marketplace
Do not restart Open, rights, guest checkout, or Verified+ badge work. Extend and rename.

### R2 — Lock Free Contributor as the Open-tier identity (Dec-FC)
- Adopt **Free Contributor** as the public name for the free Open-library account.
- Engineering mapping options (choose one in Dec-FC):
  - **A (preferred):** Rename UX/copy/`photo_influencer` → Free Contributor; keep enum `photo_influencer` until a migration sprint, or migrate enum to `free_contributor`.
  - **B:** Collapse `photo_influencer` + community `contributor` into one Free Contributor type (larger migration).
- Keep Open uploads **non-commercial** until upgrade (already true for non-commercial creators).

### R3 — Separate “account permission” from “image tier” (already true — keep it)
v2.1 is correct: library tier is image-level; account permissions decide which tiers a user may submit to. Do not invent a second tier system.

### R4 — Unlock same-identity upgrade (Dec-Upgrade)
v2.1 requires upgrade into paid Contributor/Photographer/Model without a new account. That **conflicts** with Phase 29 one-type-per-email / no influencer→photographer conversion. Recommend:
- Allow **verified identity upgrade** with audit + agreement re-accept + AfricaElig recheck.
- Preserve one primary `accountType` at a time (or explicit dual-role rules already used for model+photographer agreement).

### R5 — Do not invent role paywalls yet (Dec-RolePay)
v2.1 says Buyer/Contributor/Model/Photographer are paid subscribers. Today access is not subscription-gated. Until Dec-RolePay:
- Keep plans/credits honest for **Buyer** benefits (collections, history, allowances).
- Do **not** hard-block Photographer/Model signup behind pay without pricing + grace rules + counsel.

### R6 — Depth over invention for Phase 2 surfaces
Opportunity Engine, Brand Studio, Hire foundations exist. Next ungated work is **briefs from demand**, **upgrade CTAs**, **Hire/Brand UX** — not payment rails (Dec-Fee still open).

### R7 — Keep external gates intact
T3 counsel-complete, T6 withdrawal flag, T9/Bio vendor activation, Verified+ indemnity SKU, Hire/Brand fees, Dec-VQ, Dec-AI dataset sell — do not invent.

### R8 — Spec Phase numbering ≠ engineering sequence
v2.1 “Phase 1 core marketplace” ≈ already done. Engineering should use **FC0–FC2 / V21-P2** below, not re-run Spec Phase 1.

---

## 3. Gap matrix (v2.1 → `main`)

| Concept | Status |
| --- | --- |
| Public search / browse | **Shipped** |
| VueKumi Open + anonymous download + events | **Shipped** |
| Paid Licensed + guest checkout | **Shipped** |
| Africa contributor eligibility + HOLD waitlist | **Shipped** (P1-T8) |
| AI person detection + rights workflow | **Shipped** |
| Model/photographer invites + consent hub | **Shipped** |
| Compensation negotiation + Open interaction | **Shipped** (P1-T5) |
| USD ledger + model likeness lines | **Shipped**; withdrawal **flag OFF** |
| Public report / DMCA / disputes | **Shipped**; T3 counsel paste pending |
| Country activation admin | **Shipped** foundation |
| Verified+ merchandising | **Foundation shipped** (no indemnity SKU) |
| Opportunity Engine rollups | **Foundation**; auto-briefs missing |
| Brand Studio workspace | **Foundation**; production fees gated |
| Hire discovery → booking | **Foundation**; commission gated |
| Partner API | **Foundation shipped**; attribution/download events later |
| Free Contributor naming + program UX | **Missing** |
| Paid-role subscription gating | **Missing** (Dec-RolePay) |
| Free → paid same-email upgrade | **Blocked** by Phase 29 (Dec-Upgrade) |
| Free Contributor tips/donations | **Missing** (later) |
| Enterprise teams / API licensing SKU | **Missing** (Phase 3) |

---

## 4. Conflicts & decisions to lock

| ID | Decision | Recommendation |
| --- | --- | --- |
| **Dec-FC** | Free Contributor vs Photo Influencer vs community Contributor | Prefer rename `photo_influencer` → Free Contributor in product language; schedule enum migration; clarify community `contributor` or merge |
| **Dec-Upgrade** | Same-email upgrade Free → Photographer/Contributor/Model | Allow with agreement re-accept + audit; supersede Phase 29 hard block |
| **Dec-RolePay** | Must Photographer/Model/Buyer hold a paid plan to use the role? | Defer hard gate; first ship Buyer plan honesty + Free upgrade CTAs |
| **Dec-Fee** | Hire / Brand / representation fees | Still undecided — no rails |
| **Dec-VQ** | VueQuatro entity vs staff mode | Still pending |
| **Dec-AI** | Sell AI-training datasets | Still undecided — consent engine only |
| **Counsel** | Open/paid license legal copy; T3 entity/agent | Counsel-gated |

---

## 5. Execution plan

### FC0 — Product lock & mapping (docs/spike only)

| ID | Work | Done when |
| --- | --- | --- |
| **FC0-1** | Write Free Contributor Program one-pager (benefits, Open-only permissions, upgrade matrix) | Product sign-off |
| **FC0-2** | Enum/UX mapping table (`photo_influencer` / `contributor` / photographer / model / user) | Dec-FC recorded in `06` |
| **FC0-3** | Upgrade state machine draft (eligibility, agreements, library submit permissions) | Dec-Upgrade recorded |
| **FC0-4** | RolePay policy draft (optional soft prompts vs hard gate) | Dec-RolePay recorded or explicitly deferred |

**Do not ship code that renames enums until FC0-2 is locked.**

---

### FC1 — Free Contributor reconciliation (ungated after Dec-FC)

| ID | Work |
| --- | --- |
| **FC1-1** | Replace public “Photo influencer” copy with **Free Contributor** (site content, nav, signup, agreements titles as placeholders until counsel) |
| **FC1-2** | Nav entry **Free Images** → Open-filtered search (Spec §17.1) |
| **FC1-3** | Free Contributor dashboard: Open stats (views/downloads), upgrade CTAs to Photographer/Contributor/Model |
| **FC1-4** | Enforce/clarify Open-only upload permissions for Free tier (already non-commercial — add product messaging) |
| **FC1-5** | Optional enum rename migration `photo_influencer` → `free_contributor` (behind feature flag / dual-read) |

---

### FC2 — Same-identity upgrade (after Dec-Upgrade)

| ID | Work |
| --- | --- |
| **FC2-1** | Upgrade API: Free → photographer / paid contributor / model with agreement re-accept |
| **FC2-2** | AfricaElig + waitlist recheck on upgrade |
| **FC2-3** | Audit log + Rights Hub messaging; no silent commercial unlock of old Open assets without reclassification rules |
| **FC2-4** | Playwright: Free upload Open → upgrade → Licensed path |

---

### V21-P2 — Demand & creator economy depth (ungated UX; no fee invention)

Aligns to Spec Phase 2 where foundations already exist.

| ID | Work |
| --- | --- |
| **V21-P2-1** | Opportunity Engine → **staff/manual creator briefs** (no ML) |
| **V21-P2-2** | Brand Studio UX depth (briefs, collections) — still no production fee |
| **V21-P2-3** | Hire messaging / discovery polish — still off-platform settlement |
| **V21-P2-4** | Buyer plan honesty: collections, purchase history, credit/allowance display from existing plans |
| **V21-P2-5** | Verified+ merchandising polish (filters, detail copy) — no indemnity SKU |

---

### V21-Gated — activate only with owners

| ID | Wait for |
| --- | --- |
| Model withdrawal ON | Finance (`payouts.model_withdrawal_enabled`) |
| T3 counsel-complete | Counsel pastes entity/agent |
| T9 / Bio ON | Vendor + DPA |
| Hire/Brand payment rails | Dec-Fee |
| Verified+ indemnity product | Counsel + finance |
| Partner API attribution/download events + enterprise teams | Product Phase 3 + Dec-Fee/enterprise |
| AI dataset licensing | Dec-AI |

---

## 6. Suggested immediate build order

1. **Approve Dec-FC** (naming + enum strategy).  
2. Ship **FC1-1..4** (copy, Free Images nav, dashboard CTAs) — high leverage, low risk.  
3. **Approve Dec-Upgrade** → **FC2**.  
4. **V21-P2-1** Opportunity → briefs.  
5. Buyer plan honesty (**V21-P2-4**).  
6. Hold RolePay hard gates, fees, indemnity, Auto vendor activation.

---

## 7. Spec Phase mapping

| Spec v2.1 phase | Engineering reality |
| --- | --- |
| Phase 1 — Core marketplace | **Largely shipped** via Phases 23–65 + `12` P0–P2 foundations |
| Phase 2 — Demand & creator economy | **Foundations shipped**; depth = FC1 + V21-P2 |
| Phase 3 — Distribution & enterprise | Partner API foundation only; enterprise/API SKUs later |

---

## 8. Non-goals

- Rebuilding Open download or rights engines from scratch  
- Inventing platform commission rates or Hire/Brand fees  
- Enabling Bio/KYC or inventing screening vendors  
- Claiming Copyright Office registration or inventing legal entity names  
- Hard-blocking creator signup on unpaid plans before Dec-RolePay  
- Selling AI-training access before Dec-AI  

---

## 9. Next documents (from Spec §24 — prioritize)

After Dec-FC:

1. **Free Contributor Program Specification** (Spec §24.5) — highest priority  
2. Short **Account Upgrade Spec** (covers Dec-Upgrade)  
3. Then PRD deltas only where FC changes screens  

Do not commission all eight Spec §24 docs before FC0 locks.

---

## 10. Relationship to other docs

| Doc | Role after this plan |
| --- | --- |
| **`13` (this file)** | v2.1 product recommendations + FC / V21 execution |
| **`12`** | Technical reconciliation status; gated activation checklist |
| **`01` / `10`** | Historical phase log — update Free Contributor naming when FC1 ships |
| **`06`** | Record Dec-FC / Dec-Upgrade / Dec-RolePay |

**Immediate ask:** Approve **Dec-FC** (and whether to proceed with FC1 copy/nav without enum migration).
