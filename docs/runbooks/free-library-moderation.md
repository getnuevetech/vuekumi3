# Free Library moderation SOP (staff)

Companion to [`14-FREE-LIBRARY-PROGRAM.md`](../14-FREE-LIBRARY-PROGRAM.md) §4 and
[`13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md`](../13-V21-IMAGERY-CONCEPT-RECOMMENDATIONS-AND-EXECUTION-PLAN.md)
(Dec-FreeLib A / Dec-TierMap).

Admin entry points:

- **Free Library inventory** — `/admin/content?libraryTier=OPEN` (sidebar: Content → Free Library)
- **Pending publish queue** — `/admin/moderation` (Approve / Reject)
- **Rights & safety** — `/admin/reports` (see [`rights-ops.md`](./rights-ops.md))

**Do not invent fees, Bio vendors, indemnity SKUs, or legal-entity names in this runbook.**
**Do not move Free Library assets to Licensed / Verified+ without an explicit reclassification decision.**

---

## 1. What Free Library is

| Rule | Detail |
| --- | --- |
| Public label | **Free Library** = `libraryTier: OPEN` (no separate enum) |
| Who uploads | **Photo Influencer only** |
| Who does not | Photographers / Contributors upload paid tiers only |
| Cost to uploader | Free forever — never require a subscription for Photo Influencer |
| Open download | Zero-price when rights + commercial gates allow (existing Open engine) |

---

## 2. Daily intake order

1. Open `/admin/moderation` — clear **pending** Free Library / influencer uploads first.
2. Open `/admin/content?libraryTier=OPEN` — spot-check live Free Library inventory and any commercial locks.
3. Cross-check `/admin/reports` for Free Library photo URLs (likeness / safety / copyright).

Prefer Free Library review before paid-tier backlog when the influencer queue is non-empty.

---

## 3. Acceptance checklist (before Approve)

Apply [`14`](../14-FREE-LIBRARY-PROGRAM.md) §4. Thresholds may be raised in Admin Settings; do not invent lower bars.

### 3.1 Technical quality

| Gate | Default | Action on fail |
| --- | --- | --- |
| Min width | `moderation.min_photo_width` (default **800px**) | System may AI-enhance (Phase 62 / FC1-6); if still short → keep pending / quarantine `low_resolution` |
| Min height | Prefer ≥ **600px** | Same |
| Severe blur / unusable exposure | Remediation notes | Reject or hold with reason — do not publish “good enough” junk |
| Exact duplicate of live photo | Content hash | Reject / quarantine duplicate |

### 3.2 Content / eligibility

| Gate | Rule |
| --- | --- |
| Africa supply | Uploader must satisfy Dec-AfricaElig (ACTIVE or waitlist path already enforced at signup/upgrade) |
| People | Recognizable people → invite / consent before any commercial-adjacent unlock; Free Library may stay editorial/pending until cleared |
| Illegal / harmful | Reject; escalate via reports / DMCA as needed |
| Undisclosed AI-generated | Follow existing screening / disclosure policy — do not invent a new AI SKU |

### 3.3 Outcomes

| Outcome | Staff action | Meaning |
| --- | --- | --- |
| **Approve** | `/admin/moderation` → Approve (only when `liveReady`) | Live in Free Library; Open download only if rights/commercial gates pass |
| **Hold** | Leave pending; note blockers | Needs consent, better file, or rights work |
| **Reject** | `/admin/moderation` → Reject | Does not meet criteria; uploader sees rejection path |

If Approve is blocked by `liveBlockers`, fix rights / people / quarantine first — do not force-publish.

---

## 4. Tier & upgrade guardrails

- Photo Influencer uploads that land as `OPEN` stay Free Library.
- After **FC2 upgrade** (same email → Photographer / Contributor / Model), Free Library photos **remain** `OPEN` until staff explicitly reclassifies.
- Do **not** set `libraryTier` to Licensed / Verified+ on an influencer Free Library shot just to “make it commercial.”
- Photographers/Contributors must not appear in Free Library as uploaders; if a paid-tier account somehow has `OPEN`, investigate (bug or mistaken reclassification) before Approve.

---

## 5. People, rights, and reports

- People on Free Library still use the likeness invite / Rights hub path.
- Open download can stay blocked while consent is incomplete — that is correct.
- Freeze / DMCA / likeness disputes: follow [`rights-ops.md`](./rights-ops.md). Free Library visibility ≠ commercial clearance.

---

## 6. AI enhance (FC1-6)

- Low-res Free Library uploads may be enhanced automatically before the quality re-check.
- Enhancement is **not** a licence to approve soft-porn, illegal content, or non-Africa-ineligible uploads.
- If enhance still fails the floor → quarantine / reject with `low_resolution` (or equivalent notes). Do not manually “pass” undersized files.

---

## 7. Closure & audit

- Prefer decide actions that write audit logs (moderation Approve/Reject, rights patches).
- When rejecting, use a clear reason the uploader can act on (resolution, people consent, duplicate, policy).
- Queue health: Admin home shows pending review counts — chase items older than ~7 days.

---

## 8. Smoke after a Free Library decision

1. Approved photo appears under `/search?libraryTier=OPEN` when active.
2. Open download still respects rights (people without consent → blocked).
3. Rejected photo does not appear in the public Free Library.
4. Sidebar **Free Library** filter still lists only `OPEN` rows.
