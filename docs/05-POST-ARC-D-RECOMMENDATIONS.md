# VueKumi — post–Arc D review, recommendations, and execution plan

**Status: recommendations only. Do not start a numbered phase from this document
until explicitly approved.** Companion to
[`01-IMPLEMENTATION-PLAN.md`](./01-IMPLEMENTATION-PLAN.md) and
[`03-PRODUCT-AND-RIGHTS.md`](./03-PRODUCT-AND-RIGHTS.md).

Reviewed against `main` after Phases 0–40 (Arcs A–D complete). Default next
slice in the living plan remains **none scheduled** until something below is
approved.

---

## 1. Verdict

VueKumi on `main` is a coherent **rights-verification marketplace**, not a stock
clone. The four rights layers, two-approval commercial lock, model identity
graph, booking/campaigns as agreement records, VueQuatro as staff
representation, partner distribution, AI-training consent engine, admin ACL,
DMCA/holds, and country overlays are all present and generally honest about
what money and clearance mean.

The product is **past “build the differentiator.”** The bottleneck is no longer
missing Arc B/C/D features. It is:

1. **Production lag** — live Lightsail is behind `main` for the HTTP admin
   cookie fix and Rights 2.0 (Phases 23–28 at minimum; realistically through 40).
2. **Ops safety** — every `deploy.sh` run re-seeds and can wipe live data.
3. **Decision debt** — economics and VueQuatro entity questions block the next
   monetisation layer; inventing numbers would be wrong.
4. **Honesty polish** — a few surfaces still overclaim curation or contradict
   booking CTAs.

Do **not** invent photographer/model splits, booking/production/representation
commissions, biometric vendors, retention windows, AI dataset SKUs, or a public
VueQuatro app.

---

## 2. Still undecided (do not invent)

Carried forward from [`03` §10](./03-PRODUCT-AND-RIGHTS.md). These are phase-gate
decisions immediately before any related build — not backlog tickets to “fill
in.”

| Topic | Current shipped behaviour | Decision needed before |
| --- | --- | --- |
| Photographer / model / platform split when a model is party to a sale | Models do **not** earn; photographer 50% of paid licences unchanged | Any model payout, likeness royalty, or ledger change |
| Booking / production commission | Phases 30 / 32: **zero** fee, off-platform settlement, no ledger touch | Any payment rails or platform fee on briefs/campaigns |
| Representation commission | Phase 31: **zero** fee | Any VueQuatro agency fee product |
| Dedicated biometric vendor + numbered selfie-retention window | Phase 28: opt-in check, **result only**, selfie discarded immediately; OpenAI vision when configured | Any Stage 3 vendor swap, embedding store, or retention policy |
| Whether VueQuatro is an app, a legal entity, or a staff mode | Phase 31 shipped **staff mode** only; question remains open | Second brand, separate contracting entity, or counsel entity split |
| Exclusive premiums beyond current default | Live exclusive list price exists; treat as revisable | Pricing experiments that imply a locked premium formula |
| Vuekumi+ long-term price lock | Live Plus plan exists; treat as revisable | Marketing that freezes Plus forever |
| AI dataset pricing | Phase 34 consent engine only; not sold; partner API forbids training | Any dataset SKU, buyer grant of `ai_training: true`, or partner training terms |

Counsel-gated (engine structure exists; do not invent signed copy): agreement
wording, DMCA Copyright Office filing, insurance, Texas vs Delaware governing
law, exact repeat-infringer defaults beyond admin settings.

---

## 3. Repo and app review (evidence-backed)

### 3.1 Architecture (healthy)

| Layer | State |
| --- | --- |
| `apps/web` | React 19 + Vite marketplace, portals, capability-gated `/admin/*` |
| `apps/api` | Fastify + Prisma + PostgreSQL; media worker; seed as CI fixture |
| `packages/shared` | Contract-first Zod/DTOs for rights, bookings, ACL, legal |
| Ops | Docker Compose on Lightsail; CI typecheck/lint/test/build + images |
| Auth | Password + Google OAuth; refresh cookies; `cookieSecureFromRequest` on `main` (`83f4577`) |

### 3.2 What shipped and should not be rebuilt

Arcs A–D (Phases 0–40) are on `main`. See `01` §2 table. Notable locks:

- Africa-only creators; models as subjects not Africa-restricted
- Usage licence ≠ ownership; commercial eligibility = copyright + required likeness cleared at sufficient quality
- Booking / campaigns / representation do not grant licences and do not invent commissions
- Partner API: cleared inventory only; no AI training through the API
- Stage 3 likeness similarity ≠ release; no public face DB

### 3.3 Gaps that matter now

| Gap | Evidence | Severity |
| --- | --- | --- |
| Production not redeployed with cookie fix + Rights 2.0+ | Ops note; cookie fix is on `main`, Phases 23–40 on `main` | **Critical (ops)** |
| `deploy/lightsail/deploy.sh` always runs `prisma/seed.ts` | Destructive wipe + recreate on every deploy | **Critical (ops)** |
| Featured homepage slots query-driven, not admin-picked | `apps/api/src/lib/home-queries.ts`; leftover in `01` §3. Branch `cursor/homepage-featured-slots-9c19` (Phase 41) exists off `main` | Medium (marketplace honesty) |
| Homepage copy overclaims “curated weekly / human review” | `apps/web/src/pages/Home.tsx` IconRow vs algorithmic slots | Medium (honesty) |
| `/models` says booking not offered; `/m/:handle` shows Book when available | `Models.tsx` vs `ModelProfile.tsx`; docs `01` Phase 27 vs `03` §9 | Low–medium (consistency) |
| No dedicated admin queues for bookings/campaigns | Admin nav has representation/partner; bookings/campaigns share public UI | Low (ops tooling) |
| `content.impersonate_creator` API-only | Capability exists; no admin impersonation UI | Low |
| Seed lacks booking/campaign/representation/partner fixtures | Weak demos for Phases 30–33 | Low (demo/CI) |
| No web/UI tests | CI runs API tests + web typecheck/lint/build only | Medium (quality) |
| Docs drift | `docs/README.md` still says 0–28 / 29–34 remaining; `04` §1 Gap table describes pre–Arc D state | Medium (process) |
| Counsel placeholders still labelled placeholder | Legal overlays force `counselStatus: 'placeholder'` | Expected until counsel |

### 3.4 What is intentionally incomplete (not bugs)

- No booking/production payment rails
- No model earnings
- No public VueQuatro app
- No stylist / MUA / crew account types
- No AI dataset product
- No embedding store / biometric retention

These match doctrine. Do not “finish” them by inventing policy.

---

## 4. Recommendations

### R1 — Treat ops as the next real work (not a phase number)

Redeploy production from current `main` so live matches Rights 2.0 and the HTTP
admin session fix. Before or as part of that redeploy, **stop automatic seed on
production deploys** (gate behind `SEED_DEMO=1` or a one-shot first-boot flag).
Change the admin password after first live login; keep gateway keys in Admin
Settings only.

### R2 — Close Arc A leftovers only if approved as a thin slice

Admin-curated homepage featured slots already have an unmerged Phase 41 branch
(`cursor/homepage-featured-slots-9c19`). Prefer **review and merge that branch**
over a greenfield rewrite. Pair it with homepage copy that no longer claims
weekly human curation unless slots are actually staff-pinned. Featuring must
never invent a licence or allow private / portfolio / agency-protected pins
(the branch already encodes that).

### R3 — Fix honesty and docs before inventing Arc E

Align `/models` copy with profile booking CTAs (or remove Book until product
says otherwise). Refresh `docs/README.md`, `01` intro dates/status, and the
stale Gap table in `04` §1 so the next agent does not re-propose shipped work.

### R4 — Decision workshop before any money phase

Run a short product/counsel gate on the undecided table in §2. Until then:

- Keep ledger at photographer 50% / platform 50%
- Keep booking, campaigns, representation at zero platform fee
- Keep Phase 28 discard-selfie behaviour
- Keep VueQuatro as staff mode in product UI and marketing

Optional decision order (suggested, not mandated):

1. VueQuatro entity vs staff-only (unblocks contracts and counsel filing)
2. Model share policy (unblocks “models monetise” marketing honesty)
3. Booking / production / representation fee policy (unblocks payment rails)
4. Biometric vendor + retention (only if Stage 3 must leave OpenAI vision)
5. AI dataset price (only after consent volume is real)

### R5 — Staff tooling after money policy, not before

Dedicated admin booking/campaign queues and creator impersonation UI are useful
but secondary to (a) live redeploy safety and (b) fee decisions. Building payment
UI without a decided rate recreates the trap Arcs B/C avoided.

### R6 — Quality bar for the live site

- Add a non-destructive production deploy path (migrate + restart; seed optional)
- Consider a smoke checklist: admin login over HTTP and HTTPS, commercial
  checkout on a two-approved people photo, guest model rights page, partner key
  read, representation inquiry
- Optional later: Playwright smoke on web; keep API tests as the contract suite

### R7 — Explicitly do not schedule

- Public face database / embeddings
- Silent AI-training in RF/commercial grants
- Second public VueQuatro brand without an entity decision
- Crew account types before photographer–model–image network is dense in
  production
- Changing 50/50 without a written model-share decision

---

## 5. Execution plan (in addition to the living phase table)

This is an **ops + decision + thin product** track. It sits beside Arcs A–D; it
does not replace them. Approve one track item at a time the same way phases
were approved.

### Track O — Production (ops, not a phase)

| Step | Work | Done when |
| --- | --- | --- |
| **O0** | Inventory live instance: git SHA, migration head, whether admin login works on current `WEB_URL` scheme | Written note of live vs `main` delta |
| **O1** | Change `deploy.sh` so seed is **opt-in** on production (`SEED_DEMO` / first-boot only); document migrate-only redeploy | Redeploy cannot wipe live users/grants |
| **O2** | Redeploy Lightsail from `main` (includes HTTP admin cookie fix `83f4577` + Phases 23–28 minimum; prefer full 23–40) | Admin sessions work on HTTP if TLS not yet live; permission states / models / two-approval / self-shot / portfolios / likeness check behave as on `main` |
| **O3** | Post-deploy: rotate demo admin password if seed ever ran; confirm Admin Settings keys; TLS/`WEB_URL=https://…` when certs exist | Live secrets and cookie Secure flag match scheme |
| **O4** | Smoke: report queue, commercial freeze, model invite guest page, representation queue | Ops checklist signed off |

**Note:** Featured homepage slots remaining query-driven is **current fact**, not
an O-track failure. Promotion to admin-picked is Track A below, only if approved.

### Track A — Marketplace honesty (optional thin slice)

| Step | Work | Gate |
| --- | --- | --- |
| **A1** | Review existing Phase 41 branch; merge or revise — admin-pinned featured slots with ranking fallback | Explicit approve as Phase 41 (or equivalent) |
| **A2** | Homepage marketing copy matches reality (algorithmic vs staff-curated) | Ships with or immediately after A1 |
| **A3** | Resolve `/models` vs `/m/:handle` booking CTA contradiction + doc drift in `01` / `03` | Product one-liner: booking on or off from index |

### Track Dox — Documentation hygiene (can run anytime)

| Step | Work |
| --- | --- |
| **D1** | Update `docs/README.md` read order: Phases 0–40 shipped; Arc D complete; point here for post–Arc D plan |
| **D2** | Align `01` §8 “next slice” with Tracks O / A / Decision; keep “do not start until approved” |
| **D3** | Rewrite `04` §1 Gap table to “was / now” so it cannot be misread as current backlog |

### Track Decision — Human gates (no code until closed)

| Decision ID | Question | Unblocks |
| --- | --- | --- |
| **Dec-VQ** | VueQuatro: staff mode only vs legal entity vs separate app | Contracts, counsel filing, marketing |
| **Dec-Split** | Model party-to-sale revenue split (or confirm models never earn) | Ledger, payouts, contributor copy |
| **Dec-Fee** | Booking / production / representation commission (or confirm forever-zero + off-platform) | Payment rails, invoices |
| **Dec-Bio** | Biometric vendor + retention days (or confirm discard-forever Stage 3) | Phase 28 hardening / vendor swap |
| **Dec-AI** | Dataset pricing / whether to sell training access | SKU, grants, partner terms |

### Track E — Only after decisions (proposed Arc E shape; not scheduled)

Do not number these as phases until Dec-* closes and work is approved.

| Candidate | Depends on | Scope sketch |
| --- | --- | --- |
| Model earnings / split in ledger | Dec-Split | Extend `EarningsLedger`; never silent |
| Booking & campaign payment rails | Dec-Fee | Escrow or record-only invoicing; still no licence grant on accept |
| Representation fee / agency billing | Dec-Fee + Dec-VQ | Staff-mode billing vs entity invoices |
| Stage 3 vendor + retention | Dec-Bio | Still: voluntary, similarity ≠ release, no public face DB |
| AI dataset product | Dec-AI | Separate SKU; minors never eligible; partner API terms update only if sold |
| Admin booking/campaign queues | Useful after volume or Dec-Fee | Staff visibility, not economics |
| Creator impersonation UI | ACL already has capability | Support tooling |

---

## 6. Suggested immediate sequence

If only one stream of work is approved next, prefer this order:

```
O1 (safe deploy) → O2 (Lightsail redeploy to main) → O3/O4 (smoke)
        ↓
   Dox D1–D3 (cheap, prevents rework)
        ↓
   Decision workshop (Dec-VQ / Dec-Split / Dec-Fee at minimum)
        ↓
   Optional A1–A3 (Phase 41 + honesty) if marketplace polish is wanted
        ↓
   Only then: any Track E money or biometric work
```

Parallelisation that is safe: **Dox** anytime; **A1 review** can start while O
runs, but do not merge Phase 41 to production until O1 is safe (seed wipe).

---

## 7. How to use this with the existing plan

1. Doctrine stays in [`03`](./03-PRODUCT-AND-RIGHTS.md).
2. Shipped phase history stays in [`01`](./01-IMPLEMENTATION-PLAN.md).
3. Arc D procedure archive stays in [`04`](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md).
4. **This file** is the post–Arc D backlog of recommendations and ops/decision
   tracks. Promote an item into `01` as a numbered phase only when approved.
5. Merge finished work to `main` immediately; keep production redeploys on the
   O-track checklist, not as an afterthought.

---

## 8. Explicit non-goals for the next approval cycle

- Inventing any undecided rate, vendor, retention window, or entity form
- Rebuilding Rights 2.0 or Arc D features already on `main`
- Treating the Phase 41 branch as merged when it is not
- Running production `seed.ts` as part of routine redeploy
