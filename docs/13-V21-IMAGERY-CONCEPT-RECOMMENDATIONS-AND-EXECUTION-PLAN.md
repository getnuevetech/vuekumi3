# VueKumi Imagery Concept v2.1 — recommendations & execution plan

**Status: R1–R8 + FC0–FC2 + V21-P2 SHIPPED (28 Sep 2026).** Dec-FreeLib A + Dec-TierMap + Dec-Upgrade locked. Remaining work is **V21-Gated** (finance / counsel / vendor / Dec-Fee / Dec-AI) — do not invent.  
Source: *VueKumi Imagery Platform — Full Product, Content, Rights & Commercial Concept* v2.1 (September 2026), plus product direction 28 Sep 2026.  
Does **not** restart shipped rights/Open/Licensed/Verified+ engineering from [`12-V2-RECONCILIATION-EXECUTION-PLAN.md`](./12-V2-RECONCILIATION-EXECUTION-PLAN.md).

Companion: technical reconciliation remains in **`12`**. This document is product authority for Photo Influencer / Free Library / upgrade / RolePay sequencing.

---

## 0. Product locks (28 Sep 2026)

Recorded from product:

| Lock | Rule |
| --- | --- |
| **Photo Influencer = free group** | Keep `accountType: photo_influencer`. **No subscription required** to sign up or upload. Do **not** rename the role to “Free Contributor” in product language. |
| **Tier map (locked)** | **Photo Influencer → free tier only (Free Library).** **Photographer + Contributor → paid tiers only** (Licensed / Verified+ / Editorial / Private). No cross-upload. |
| **Free Library only (PI)** | Photo influencers may upload **only** into **Free Library**. Not Licensed / Verified+ / Editorial. |
| **Paid tiers only (Photographer / Contributor)** | Photographers and Contributors may upload **only** to paid library tiers. They do **not** upload to Free Library. |
| **Monitor Free Library** | Staff must review Free Library uploads against published quality/content criteria (queue + reject/hold path). |
| **AI enhance low-res** | When an upload fails minimum resolution/quality, run **AI image enhancement** (reuse Phase 62 remediation) before accept or quarantine with clear reason. |

**Dec-FC:** **Locked** — keep Photo Influencer; v2.1 “Free Contributor” maps to this role.

**Dec-TierMap:** **Locked** — PI = free tier; Photographer + Contributor = paid tiers.

**Dec-FreeLib:** **Locked (A)** — Public label **Free Library** = existing `libraryTier: OPEN` (no new enum).

**Dec-Upgrade:** **Locked** — allow same-email upgrade Photo Influencer → Photographer / Contributor / Model with agreement re-accept + audit + AfricaElig recheck (supersedes Phase 29 hard block). Implement in **FC2**.

**Dec-RolePay (partial):** Photo Influencer stays free forever. Paid-role hard gates for Photographer/Model/Buyer deferred; soft honesty first.

**R1–R8:** **SHIPPED** — see §2. Dec-TierMap / Free Library label foundations on `main`. **FC0–FC2 / V21-P2** also shipped; next is gated activation only.

---

## 1. Verdict

v2.1 is the right strategic document for VueKumi: **not an African Unsplash clone**, but trusted African imagery infrastructure with frictionless free discovery, explicit rights, Africa-based supply, and worldwide buyers.

Most of Spec Phase 1 is **already shipped** as foundations on `main` (Open downloads, library tiers, guest checkout, rights engine, compensation negotiation, country waitlist, Hire/Brand/Opportunity/Partner API foundations, Verified+ surface, Phase 62 image remediation).

The **real delta** is Free Library program clarity for Photo Influencers + upgrade path + deferred RolePay for paid roles:

| v2.1 / product concept | Current product (`main`) |
| --- | --- |
| Free identity for free library uploads | **`photo_influencer` shipped** — free; no plan gate |
| **Free Library** (influencer-only upload target) | **Shipped** — `OPEN` + Free Library label + Dec-TierMap upload lock |
| Paid Contributor / Photographer / Model / Buyer | Plans exist; paid-role hard subscription gates **deferred** (Dec-RolePay) |
| Upgrade free → paid role same verified identity | **Shipped** — `POST /api/account/upgrade` (FC2) |
| Monitor Free Library quality | **Shipped** — admin Free Library filter + criteria in `14` |
| AI enhance low-resolution Free Library uploads | **Shipped** — `enhanceLowResolution` on Free Library upload |
| Image-level Open / Licensed / Verified+ / Editorial | **Shipped** |
| No-login Open download; guest paid checkout | **Shipped** |
| Model compensation from Contributor Distributable Share | Engine + UI + ledger **shipped**; withdrawal flag OFF |

**Recommendation:** Ungated Free Library / upgrade / V21-P2 depth is on `main`. Treat `12` as rights/economics technical authority. Do not invent fees, Bio vendors, or entity names.

---

## 2. Recommendations (R1–R8)

### R1 — Do not rebuild the marketplace
Do not restart Open download, rights engine, guest checkout, or Verified+ badge work. Extend them for Free Library / Photo Influencer rules.

### R2 — Photo Influencer is the free (no-subscription) identity — **locked**
- Keep public name **Photo Influencer** and enum `photo_influencer`.
- Never require a paid plan to register or use Photo Influencer.
- Map v2.1 “Free Contributor” language in older concept copy → Photo Influencer in product docs going forward.
- **Contributor** is a paid-tier uploader (with Photographer), not the free Free Library role.

### R3 — Account → library tier map — **locked**
Library tier stays image-level. Account type decides **which tiers may be submitted** (hard enforce):

| Account | Allowed upload tiers |
| --- | --- |
| **Photo Influencer** | **Free Library only** (free tier; `OPEN` under Dec-FreeLib A) |
| **Photographer** | **Paid tiers only** — Licensed / Verified+ / Editorial (not Free Library) |
| **Contributor** | **Paid tiers only** — Licensed / Verified+ / Editorial (not Free Library) |

Do not invent a second parallel tier system. Do not allow Photographer/Contributor Free Library uploads or Influencer paid-tier uploads.

### R4 — Unlock same-identity upgrade (Dec-Upgrade — still open)
v2.1 wants upgrade into Photographer / paid Contributor / Model without a new account. That **conflicts** with Phase 29. Recommend:
- Allow **verified identity upgrade** with audit + agreement re-accept + AfricaElig recheck.
- Preserve one primary `accountType` at a time (or explicit dual-role rules already used for model+photographer).
- Free Library assets do **not** silently become commercial on upgrade without reclassification rules.

### R5 — Role paywalls only for paid roles (Dec-RolePay — partial lock)
- Photo Influencer: **never** subscription-gated (**locked**).
- Photographer / Model / Buyer / paid Contributor: defer hard gates until pricing + grace + counsel; first ship Buyer plan honesty + upgrade CTAs.

### R6 — Depth over invention for Phase 2 surfaces
Opportunity Engine, Brand Studio, Hire foundations exist. Next ungated work after FC1: **briefs from demand**, **upgrade CTAs**, **Hire/Brand UX** — not payment rails (Dec-Fee still open).

### R7 — Keep external gates intact
T3 counsel-complete, T6 withdrawal flag, T9/Bio vendor activation, Verified+ indemnity SKU, Hire/Brand fees, Dec-VQ, Dec-AI dataset sell — do not invent.

### R8 — Spec Phase numbering ≠ engineering sequence
v2.1 “Phase 1 core marketplace” ≈ already done. Engineering uses **FC0–FC2 / V21-P2** below, not a Spec Phase 1 restart.

---

## 3. Gap matrix (v2.1 + locks → `main`)

| Concept | Status |
| --- | --- |
| Public search / browse | **Shipped** |
| VueKumi Open + anonymous download + events | **Shipped** (`OPEN` / Free Library) |
| Photographer/Contributor **paid-tiers-only** upload lock | **Shipped** |
| **Free Library** public label (`OPEN`) + PI-only free tier | **Shipped** (R1–R8 + FC1) |
| Paid Licensed + guest checkout | **Shipped** |
| Africa contributor eligibility + HOLD waitlist | **Shipped** (P1-T8) |
| AI person detection + rights workflow | **Shipped** |
| Model/photographer invites + consent hub | **Shipped** |
| Compensation negotiation + Open interaction | **Shipped** (P1-T5) |
| USD ledger + model likeness lines | **Shipped**; withdrawal **flag OFF** |
| Public report / DMCA / disputes | **Shipped**; T3 counsel paste pending |
| Free Library **criteria moderation** queue | **Shipped** — admin filter + `14` criteria; deeper SOP optional |
| **AI enhance low-res** on Free Library upload | **Shipped** (FC1) |
| Photo Influencer no-subscription | **Shipped** / locked |
| Free → paid same-email upgrade | **Shipped** (FC2) |
| Paid-role subscription gating | **Deferred** (Dec-RolePay); PI excluded |
| Verified+ merchandising | **Shipped** polish (no indemnity SKU) |
| Opportunity / Brand / Hire / Partner API | **Shipped** foundations + V21-P2 depth |
| Tips/donations / enterprise SKUs | **Later** (Phase 3 / Dec-Fee) |

---

## 4. Conflicts & decisions

| ID | Decision | Status / recommendation |
| --- | --- | --- |
| **Dec-FC** | Photo Influencer vs “Free Contributor” naming | **Locked:** keep Photo Influencer; free; no subscription |
| **Dec-TierMap** | Who uploads free vs paid tiers | **Locked:** PI → Free Library only; Photographer + Contributor → paid tiers only |
| **Dec-FreeLib** | Free Library = `OPEN` label vs new enum | **Locked (A):** Free Library = public name for `OPEN` |
| **Dec-Upgrade** | Same-email upgrade PI → Photographer/Contributor/Model | **Locked + shipped** (FC2) |
| **Dec-RolePay** | Paid roles behind plan? | PI excluded (**locked**); others deferred |
| **Dec-Fee** | Hire / Brand / representation fees | Undecided — no rails |
| **Dec-VQ** | VueQuatro entity vs staff mode | Pending |
| **Dec-AI** | Sell AI-training datasets | Undecided — consent only |
| **Counsel** | License legal copy; T3 entity/agent | Counsel-gated |

---

## 5. Execution plan

### FC0 — Product lock & mapping (docs / criteria) — **SHIPPED**

See [`14-FREE-LIBRARY-PROGRAM.md`](./14-FREE-LIBRARY-PROGRAM.md).

| ID | Work | Done when |
| --- | --- | --- |
| **FC0-1** | Photo Influencer + Free Library one-pager | **Done** — `14` |
| **FC0-2** | Record Dec-FC + **Dec-FreeLib A** in `06` | **Done** (R1–R8) |
| **FC0-3** | Free Library acceptance criteria | **Done** — `14` §4 |
| **FC0-4** | Upgrade state machine draft | **Done** — `14` §5; Dec-Upgrade locked |
| **FC0-5** | RolePay: PI free; others deferred | **Done** — `14` §6 |

**Dec-FreeLib A locked** — Free Library = public label for `OPEN` (no new enum).

---

### FC1 — Free Library + Photo Influencer enforcement — **SHIPPED** (foundations)

| ID | Work | Status |
| --- | --- | --- |
| **FC1-1** | Product copy: Photo Influencer = free program | **Shipped** (portal subtitle + dashboard) |
| **FC1-2** | Nav **Free Library** → `/search?libraryTier=OPEN` | **Shipped** (default site menu + footer) |
| **FC1-3** | PI dashboard Free Library CTAs | **Shipped** |
| **FC1-4** | Hard Dec-TierMap enforce | **Shipped** (R1–R8 + upload coerce) |
| **FC1-5** | Free Library admin review filter | **Shipped** (`/admin/content?libraryTier=OPEN`) |
| **FC1-6** | AI/local low-res enhance on Free Library upload | **Shipped** (`enhanceLowResolution`) |
| **FC1-7** | Playwright | Deferred / covered by API Dec-TierMap tests |

---

### FC2 — Same-identity upgrade — **SHIPPED**

| ID | Work | Status |
| --- | --- | --- |
| **FC2-1** | Upgrade API Photo Influencer → photographer / contributor / model | **Shipped** `POST /api/account/upgrade` |
| **FC2-2** | AfricaElig + waitlist recheck on upgrade | **Shipped** |
| **FC2-3** | Audit log; Free Library assets stay Free Library | **Shipped** |
| **FC2-4** | API test covering upgrade + asset lock | **Shipped** |

---

### V21-P2 — Demand & creator economy depth — **SHIPPED** (ungated UX)

| ID | Work | Status |
| --- | --- | --- |
| **V21-P2-1** | Opportunity → staff/manual creator briefs | **Shipped** (`CreatorBrief` + Admin “Create brief”) |
| **V21-P2-2** | Brand Studio UX depth | **Shipped** (copy/guidance; still no production fee) |
| **V21-P2-3** | Hire messaging / discovery polish | **Shipped** (copy; off-platform settlement) |
| **V21-P2-4** | Buyer plan honesty | **Shipped** (Account plan blurb + links) |
| **V21-P2-5** | Verified+ merchandising polish | **Shipped** (Search filter helper copy) |

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

1. ~~Lock **Dec-FreeLib** (A: Free Library = `OPEN` label).~~ **Done**  
2. ~~Approve **FC0-3** Free Library criteria.~~ **Done** (`14`)  
3. ~~Ship **FC1-1..7**.~~ **Done**  
4. ~~**Approve Dec-Upgrade** → **FC2**.~~ **Done**  
5. ~~**V21-P2** briefs / Brand / Hire / Buyer honesty / Verified+ polish.~~ **Done**  
6. **Hold** RolePay hard gates (except PI already free), fees, indemnity, Bio vendor activation — wait for owners in §5 V21-Gated.

---

## 7. Spec Phase mapping

| Spec v2.1 phase | Engineering reality |
| --- | --- |
| Phase 1 — Core marketplace | **Largely shipped**; Free Library program = FC1 delta |
| Phase 2 — Demand & creator economy | **Shipped** foundations + FC1 + V21-P2 depth |
| Phase 3 — Distribution & enterprise | Partner API foundation only; enterprise/API SKUs later |

---

## 8. Non-goals

- Renaming Photo Influencer to Free Contributor  
- Requiring subscription for Photo Influencer  
- Rebuilding Open download or rights engines from scratch  
- Inventing platform commission rates or Hire/Brand fees  
- Enabling Bio/KYC or inventing screening vendors  
- Claiming Copyright Office registration or inventing legal entity names  
- Selling AI-training access before Dec-AI  

---

## 9. Next documents

1. **Photo Influencer + Free Library Program Spec** (criteria, upload lock, moderation, AI enhance) — highest priority  
2. Short **Account Upgrade Spec** (Dec-Upgrade)  
3. PRD deltas only where FC1 changes screens  

Do not commission all eight Spec §24 docs before FC0 criteria + Dec-FreeLib lock.

---

## 10. Relationship to other docs

| Doc | Role after this plan |
| --- | --- |
| **`13` (this file)** | v2.1 + Photo Influencer / Free Library product authority + FC / V21 execution |
| **`12`** | Technical reconciliation; gated activation checklist |
| **`01` / `10`** | Historical phase log — update Free Library when FC1 ships |
| **`06`** | Record Dec-FC (locked), Dec-FreeLib, Dec-Upgrade, Dec-RolePay |

**Immediate ask:** none for ungated FC / V21-P2. Next product moves need owners from §5 V21-Gated (Dec-Fee, counsel T3, finance withdrawal, Bio vendor, Dec-AI).
