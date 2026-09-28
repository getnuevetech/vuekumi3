# Photo Influencer + Free Library Program

**Status: FC0–FC2 shipped (28 Sep 2026).** Program criteria + Dec-TierMap enforcement + same-email upgrade on `main`.  
Authority: [`13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md`](./13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md).  
Implements Spec §24.5 intent without renaming Photo Influencer.

---

## 1. Program summary

| Item | Rule |
| --- | --- |
| **Who** | `accountType: photo_influencer` |
| **Cost** | **Free forever** — no subscription required to register or upload |
| **Where they upload** | **Free Library only** (`libraryTier: OPEN`, public label “Free Library”) |
| **Who uses paid tiers** | Photographers and Contributors → Licensed / Verified+ / Editorial (/ Private portfolio) |
| **Cross-upload** | Forbidden both directions |

---

## 2. Benefits (Photo Influencer)

- Publish to Free Library for worldwide discovery and anonymous Open download
- Public creator profile / directory listing (existing influencer listing)
- Views & download stats on contributor dashboard
- Optional upgrade CTAs to Photographer / Contributor / Model (FC2) — never a paywall on the free role
- Agreement: Photo Influencer terms (counsel placeholder until counsel pastes)

---

## 3. Permissions matrix

| Action | Photo Influencer | Photographer | Contributor |
| --- | --- | --- | --- |
| Upload Free Library (`OPEN`) | Yes | No | No |
| Upload Licensed / Verified+ / Editorial | No | Yes | Yes |
| Private / portfolio | Editorial/portfolio Free Library path only | Yes | Yes |
| Commercial inventory / premium licence | No | Yes | Yes |
| Paid subscription required | **No** | Deferred (Dec-RolePay) | Deferred (Dec-RolePay) |

---

## 4. Free Library acceptance criteria (FC0-3)

Staff must apply these before Free Library images go live. Thresholds are product defaults; admin settings may raise them.

### 4.1 Technical quality

| Gate | Default | On fail |
| --- | --- | --- |
| Minimum width | `moderation.min_photo_width` (default **800px**) | AI enhance (Phase 62) then re-check; else quarantine `low_resolution` |
| Minimum height | Prefer ≥ **600px** (product default for FC1) | Same as width |
| Severe blur / unusable exposure | Phase 62 remediation notes | Quarantine if still unusable after enhance attempt |
| Exact duplicate of live photo | Content hash match | Quarantine duplicate |

### 4.2 Content / eligibility

| Gate | Rule |
| --- | --- |
| Africa supply | Uploader must satisfy Dec-AfricaElig (ACTIVE / waitlist already shipped) |
| People | Recognizable people → model consent / invite flow before live commercial-adjacent use; Free Library may stay editorial/pending until cleared |
| Illegal / harmful | Existing moderation + report/DMCA paths |
| AI-generated undisclosed | Follow existing screening / disclosure policy |

### 4.3 Moderation outcomes

| Outcome | Meaning |
| --- | --- |
| **Approve** | Live in Free Library; Open download when rights/commercial gates pass |
| **Hold** | Needs more info / consent / improve |
| **Reject** | Does not meet criteria; uploader notified with reason |

---

## 5. Upgrade matrix (FC0-4 / Dec-Upgrade)

Same verified email may upgrade **Photo Influencer → Photographer | Contributor | Model** after:

1. Re-accept target-role agreement  
2. AfricaElig / waitlist recheck  
3. Audit log entry  
4. Free Library assets **stay** Free Library until explicit reclassification (no silent commercial unlock)

Phase 29 hard block is superseded by Dec-Upgrade (implement FC2).

---

## 6. RolePay (FC0-5)

| Role | Subscription |
| --- | --- |
| Photo Influencer | **Never required** |
| Photographer / Contributor / Model / Buyer | Soft honesty first; hard gates deferred (Dec-RolePay) |

---

## 7. Engineering follow-ons

| Track | Status |
| --- | --- |
| **FC1** | **Shipped** — Free Library nav, PI CTAs, Dec-TierMap, admin filter, AI low-res, Playwright (`e2e/fc1-free-library.spec.ts`) |
| **FC2** | **Shipped** — upgrade API + tests |
| **V21-P2** | **Shipped** — Opportunity briefs, Brand/Hire UX, Buyer honesty, Verified+ polish |
| **V21-Gated** | Wait for owners — Dec-Fee, T3 counsel, finance withdrawal, Bio vendor, Dec-AI |

Do not invent Hire/Brand fees, Bio vendors, or indemnity SKUs.
