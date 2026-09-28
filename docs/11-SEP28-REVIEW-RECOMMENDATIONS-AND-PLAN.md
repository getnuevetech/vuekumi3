# VueKumi — Sep 28 review recommendations and execution plan

**Status: recommendations + sequenced plan only. Do not start a numbered
product phase from this document until explicitly approved.** Companion to
[`10-POST-REVIEW-EXECUTION-PLAN.md`](./10-POST-REVIEW-EXECUTION-PLAN.md) (product
phases blocked on Dec-*) and [`06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md)
(ops + decision blanks).

Reviewed against `main` at `aad1a01` (homepage typography / secondary text).
Phases 0–65 are on `main`. This note does **not** reopen T1, P0, or Phases
62–65.

**Do not invent** Dec-Bio, Dec-PayBase, Dec-AfricaElig, Dec-Split, Dec-Fee,
Dec-VQ, Dec-AI, launch countries, or counsel DMCA copy.

---

## 1. Verdict

VueKumi is past “build the differentiator.” The rights marketplace, admin ACL,
PDS gates, AI registry (fail-closed detection), homepage CMS, and portals are
real. The bottleneck is no longer missing Arc B/C/D features.

Priority order:

1. **Make production trustworthy** (TLS, host SHA, HTTPS smoke, Phase 64 on box).
2. **Close decision blanks** that block the next monetisation / identity layers.
3. **Engineering hygiene** that reduces drift and review cost without inventing product.
4. **Only then** resume numbered product phases from `10` after signed Dec-*.

---

## 2. Recommendations (ranked)

### R1 — Ops first (critical)

Live probe in `06` (Sep 2026): HTTP API healthy; **HTTPS broken**; host git SHA
unconfirmed; browser O4 after Secure cookies still open.

| ID | Action | Owner | Why |
| --- | --- | --- | --- |
| O2 | SSH → `git rev-parse --short HEAD` vs `main` | Operator | Know whether catch-up redeploy is needed |
| O3 | Fix TLS (`ssl-init.sh` / certs); then set `WEB_URL=https://vuekumi.com` and redeploy | Operator | Sessions and trust |
| Redeploy | Deploy current `main` **without** `SEED_DEMO=1` | Operator | Homepage CMS + Phases 62–65 on the box |
| Moderation | Confirm `moderation.ai_auto_approve_content` matches Phase 64 posture on host | Operator | Fail-closed detection must be live before trusting auto-approve |
| O4 | Re-sign smoke on HTTPS (browser + Secure cookies) | Operator | CI Playwright is not a substitute |
| Seed leftover | Expire `seed-nomsa-model-invite` on host if still live | Operator | Seed artifact hygiene |

Do not flip `WEB_URL` to `https://…` until TLS actually works.

### R2 — Decision workshop (blocks product)

Fill blanks in `06` before scheduling builds from `10` §4:

| Decision | Unlocks |
| --- | --- |
| **Dec-Bio** | Phase 60 ID ↔ avatar / identity-bound likeness |
| **Dec-PayBase** (+ finance) | T5 negotiation, T6 model ledger lines |
| Counsel DMCA copy | T3 public `/dmca` hardening |
| Counsel + four-eyes on G01–G16 | T8 first ACTIVE country |
| Counsel buyer overlays | T9 |
| **Dec-AfricaElig** + one honest ACTIVE | Flip onboarding to `africa_list_and_country_active` |
| Finance + counsel | P2 tax / payee / withholding |

Until signed: leave Phase 60 and T5/T6 untouched; keep photographer 50% /
platform 50%; models do not earn.

### R3 — Engineering hygiene (can start without Dec-*)

Small, high-leverage slices. Approve one at a time; none invent economics.

| Slice | Scope | Acceptance |
| --- | --- | --- |
| **H1 — Wire orphan API tests** | Add to `apps/api` `npm test`: `account-features`, `account-plans`, `buyer-plans`, `home-layout`, `home-slot-uploads` (files exist on disk, omitted from script) | `npm test` runs all five; CI green |
| **H2 — Homepage CMS contract freeze** | Short runbook: Homepage vs Featured vs Site vs Menu ownership; which DTO fields public `GET /api/public/home` and `GET /api/public/site` expose | Staff can operate without guessing; no schema change unless a bug is found |
| **H3 — Split oversized modules (pass 1)** | Extract from `apps/api/src/routes/contributor.ts` (~1.3k) and/or `apps/web/src/pages/Home.tsx` (~1.1k) — section components / route submodules **without** behaviour change | Same tests pass; files under ~500–600 LOC each where practical |
| **H4 — Adopt React Query where it hurts** | Start with `api.home()`, `api.site()`, admin homepage save/reload — Query already in `main.tsx` but unused by pages | Mutations invalidate correctly; no double-fetch on navigation |
| **H5 — Expand Playwright beyond smoke** | One authenticated contributor upload → people prompt path; one admin homepage reorder save → public home reflects order | Specs stable in CI with seed DB |

### R4 — Do not schedule yet

From `10` and `05` — still blocked or explicitly out of scope:

- Face database / stored embeddings (unless Dec-Bio says otherwise)
- Silent AI-training grants; partner training through the API
- Public VueQuatro brand / second app (staff representation mode stays)
- Changing 50/50 without Dec-Split / Dec-PayBase
- Non-OpenAI AI provider wire formats (optional later adapter task; registry already exists)
- Replacing in-process media worker with a queue — only if multi-replica API is planned

### R5 — Product after decisions (from `10`, not restarted here)

When Dec-* land, prefer this order (unchanged from `10`):

1. T3 counsel DMCA copy (engine exists)
2. Dec-PayBase → T5 → T6
3. Dec-Bio → Phase 60
4. T8 / Dec-AfricaElig / T9 as counsel allows

---

## 3. Execution plan

### Track A — Production trust (this week if host access exists)

```
A1  O2 host SHA confirm
A2  Catch-up redeploy from main (no SEED_DEMO) if behind
A3  O3 TLS fix → WEB_URL=https → redeploy
A4  Confirm Phase 64 + moderation.ai_auto_approve_content on host
A5  O4 HTTPS browser + API smoke re-sign
A6  Expire leftover seed invite if still resolving
```

**Exit:** `https://vuekumi.com` healthy; Secure cookies; signed O4; SHA known.

### Track B — Decision workshop (parallel with A)

```
B1  Schedule Dec-* workshop using blanks in 06
B2  Sign or explicitly defer each blank (no invented defaults)
B3  Update 06 with signed answers; then open one build from 10 §4
```

**Exit:** At least one of Dec-Bio / Dec-PayBase / counsel DMCA / T8 evidence path is signed or formally deferred with a date.

### Track C — Engineering hygiene (approve slices)

```
C1  H1 orphan tests          ← default first code slice (smallest)
C2  H2 homepage CMS runbook  ← docs only
C3  H3 module split pass 1   ← after H1 green
C4  H4 React Query foothold  ← optional; after H3 or in parallel on web-only
C5  H5 Playwright expansion  ← after A5 so local/CI patterns match live
```

**Exit:** CI runs the five orphaned tests; one oversized module split; smoke still green.

### Track D — Product phases (gated)

Only after Track B signs the relevant Dec-*. Do not pull Phase 60 or T5 into a
sprint “to keep moving.” Sequence remains `10` §4 / §7.

---

## 4. Suggested immediate approval

| Approve now? | Item |
| --- | --- |
| **Yes (ops)** | Track A end-to-end |
| **Yes (workshop)** | Track B scheduling |
| **Yes (code, if wanted)** | **H1** only — wire orphan API tests into `npm test` |
| **Hold** | H3–H5 until H1 lands and ops is not on fire |
| **Hold** | Phase 60, T5/T6, T3, T8, T9 until Dec-* / counsel |

---

## 5. What this review deliberately did not change

- No product phase numbers invented beyond existing `10` backlog
- No economics, biometric vendor, or country activation invented
- No redeploy performed from this agent (needs host access)
- Homepage curation feature work recently shipped; treat as stabilize, not expand

---

## 6. Evidence pointers

| Area | Path |
| --- | --- |
| Product phase backlog | `docs/10-POST-REVIEW-EXECUTION-PLAN.md` |
| Ops + Dec blanks | `docs/06-OPS-INVENTORY-AND-DECISION-BRIEF.md` |
| Deploy runbook | `deploy/lightsail/README.md` |
| Orphan tests | `apps/api/test/{account-features,account-plans,buyer-plans,home-layout,home-slot-uploads}.test.ts` vs `apps/api/package.json` `test` script |
| Large modules | `apps/api/src/routes/contributor.ts`, `apps/web/src/pages/Home.tsx`, `AdminHomepage.tsx` |
| Unused React Query | `apps/web/src/main.tsx` provider; no page `useQuery` usage |
| E2E smoke | `e2e/smoke.spec.ts` |
