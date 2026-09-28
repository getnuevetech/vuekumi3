# VueKumi — execution plan after review (23 September 2026)

**Status: product-phase companion.** Ungated Imagery Concept v2.0 reconciliation
is shipped on `main` — see
[`12-V2-RECONCILIATION-EXECUTION-PLAN.md`](./12-V2-RECONCILIATION-EXECUTION-PLAN.md)
for current status. This document remains the older product-phase backlog and
ops notes. Sep 28 ops/hygiene context remains in
[`11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md`](./11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md).
It reconciles the Trust & Markets memo, the Admin Portal engineering spec, and
the AI-pipeline request with `main` through Phase 65.

Companions:

- [`12-V2-RECONCILIATION-EXECUTION-PLAN.md`](./12-V2-RECONCILIATION-EXECUTION-PLAN.md) — **current default** (v2.0 foundation + locked Dec-*).
- [`11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md`](./11-SEP28-REVIEW-RECOMMENDATIONS-AND-PLAN.md) — Sep 28 ops / hygiene context.
- [`09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md`](./09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md) — AI phases 58–65 (58–59, 61–65 shipped; 60 architecture unblocked under Dec-Bio, prod OFF).
- [`07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md`](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md) — Arc T (T0–T9).
- [`08-ADMIN-PORTAL-ENGINEERING-SPEC.md`](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md) — three layers, eight modules, PDS, P0–P2.
- [`06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md) — Dec-* (Bio / PayBase / Split / AfricaElig locked; VQ / Fee / AI pending).

**Do not invent** a permanent platform commission rate, Dec-Fee / Dec-VQ / Dec-AI
answers, launch countries, or a VueQuatro entity form. Payment base, Bio posture,
split rule, and Africa eligibility are locked in `12` / `06`.

---

## 1. What the older notes were asking for

Two reviews were written before most of Arc T and the AI registry existed.
They are already the text of `07` and `08`. Treating them as a fresh build
list would rebuild shipped work.

| Note | Ask | On `main` now |
| --- | --- | --- |
| Trust & Markets (T0–T9) | Public report hub, rights hub, country matrix admin, then compensation | T0–T2, T4, T7 shipped (Phases 49–53). **T5 engine + UI**, **T8 waitlist**, **T3/T9 foundations**, and **T6 ledger** shipped via `12`. Still gated: T3 counsel-complete, T6 withdrawal, T9 KYC partners, first ACTIVE country evidence. |
| Admin portal spec v1.2 | Three independent layers, eight modules, PDS ALLOW/DENY/REVIEW, 16 gates, four-eyes activation | P0 shipped (Phase 49). `license.issue` and `contributor.upload` recheck shipped (Phases 54, 56). Quarantine reason codes shipped (Phase 57). Tax/payee and buyer-overlay counsel status remain. |
| AI pipeline request | Several providers, one per function; detect a person; contact them if the uploader gave details; otherwise force an authorization prompt | Registry and contributor prompt shipped (Phases 58–59). Detection fails closed when vision is missing (Phase 64). Image remediation shipped as quarantine plus opt-in preview (Phase 62). Phase 60 evidence API shipped **flag OFF**; prod ID match waits Dec-Bio vendor/DPA. |

The three control layers stay the architecture:

| Layer | Question | Enforced today |
| --- | --- | --- |
| L1 Country eligibility | May this person register as an Africa-based contributor? | PDS `contributor.create`. Default onboarding is `africa_list_and_country_active` (P1-T8 / Dec-AfricaElig): HOLD → waitlist; ACTIVE required for full activation; SUSPENDED → deny. |
| L2 Identity and image rights | Who are they, and are copyright and likeness cleared for this asset? | Rights record, appearances, invite, two-approval lock. Government-ID and identity-bound face match wait on Dec-Bio (Phase 60). |
| L3 Commercial licence and payout | May this image be licensed, and may each payee be paid? | Checkout rechecks rights and, when a market is ACTIVE or SUSPENDED, `license.issue`. Photographer residual + likeness_compensation ledger lines ship from Dec-PayBase (T5/T6 ledger). **Payout withdrawal** stays finance-gated. |

A Nigerian photographer, a Canadian model, and a Japanese buyer remain a legal
shape: L1 applies to the contributor, not to the model or the buyer.

---

## 2. AI functions — request versus code

Admins can register more than one `AiProvider` row per purpose. `resolveProvider`
picks the lowest `priority` among enabled rows for that purpose, then the legacy
OpenAI setting, then a dev no-op. Every live caller still speaks OpenAI
chat-completions. A Replicate row in seed data is not called.

| Function | Registry purpose | What runs | Next step |
| --- | --- | --- | --- |
| Image analysis (tags, description, person present) | `image_analysis` | `suggestFromContext` (opt-in Apply) and `screenImageForRights` at upload | Keep. Fix fail-open (§3) before trusting it. Optional later: pre-fill the upload form as an editable draft (already sketched in `09` §8). |
| Image remediation (quality, enhancement, quarantine action) | `image_remediation` | Option A shipped. Quarantine and advisory notes. Preview brighten/crop is opt-in. Pixels are not sent out for an automatic edit. | Phase 62, **shipped**. |
| ID document matched to avatar / profile image | `id_verification` | Phase 60 evidence schema/API behind `identity.verification_enabled` (default OFF). No live vendor. | Prod activation waits Dec-Bio vendor/DPA. |
| Named model / person likeness for a copyright or release check | `likeness_matching` | Phase 28 opt-in compare. Selfie bytes are discarded. A similarity result does not grant a release and does not search a face database. | Stay. Binding a face to a named identity is Phase 60, same Dec-Bio gate. |
| Person detected → contact, or prompt that authorization is required | `image_analysis` plus the existing invite | Contributor upload: if the server sets `hasRecognizablePeople`, the UI opens `/contributor/photos/:id` and `PeopleIdentifier` collects name, email, and mobile, which sends the existing invite. If the checkbox was off, a warning states that commercial licensing stays on hold. Empty contact cannot clear the two-approval lock. | Shipped for contributors (Phase 59) and model uploads (Phase 65). Detection fails closed (Phase 64). |

Phase 61 account and content “AI approval” is a settings checklist
(disposable-email domain, title/category/country, minimum width and height).
It is not a vision model. Auto-approve defaults to on. `possibleMinor`,
`potentiallySensitive`, and `uncertainHumanDetection` always stay in human
review — but only when screening actually sets those flags.

---

## 3. Defect that made detection unsafe — closed by Phase 64

`screenImageForRights` used to catch every provider error and return
`heuristicPeopleScreen`. With no vision key, development returned that
heuristic directly. The heuristic marked a person only for categories People,
Fashion, and Culture, or for a few words in the title, and set
`uncertainHumanDetection` to false. Phase 61 could then auto-publish.

Phase 64 writes `uncertain_human_detection` instead. Likeness stays required
and auto-approve stays off until a vision call succeeds and reports no person.
Hosts that have not deployed Phase 64 should keep
`moderation.ai_auto_approve_content` false.

---

## 4. Build sequence (approve one slice at a time)

### Phase 64 — Detection fails closed — **shipped**

Correction of Phases 59 and 61. `visionUnavailableScreen` writes
`uncertain_human_detection` when the image-analysis provider is missing or
the vision call fails. A keyword hint may still raise `possibleMinor`. It
cannot return `no_recognizable_person`. A successful vision read is trusted.
Auto-approve and commercial eligibility then stay locked through the existing
people flag. No second invite pipeline.

Original scope, for reference:

- If the `image_analysis` provider is missing, times out, returns invalid
  JSON, or is the dev no-op, write `uncertain_human_detection`. Record that
  the result was not a successful vision read.
- A keyword heuristic may still raise a person or possible-minor flag. It
  must not turn a failed vision call into `no_recognizable_person`.
- A successful vision read that returns `no_recognizable_person` may still
  clear the people flag. Trust the model only when the call succeeded.
- Existing rules then do the rest: uncertain counts as a person
  (`applyScreeningToPeopleFlag`), commercial permission drops to editorial
  until consent, and Phase 61 will not auto-approve.
- The contributor warning and `PeopleIdentifier` stay the contact step. If
  the uploader already supplied name, email, and mobile, the existing invite
  send remains the contact step. Do not add a parallel email flow.
- Cover contributor and model upload, because both call
  `screenImageForRights`.
- Tests: no provider → uncertain, photo stays pending, commercial eligibility
  stays locked; thrown vision error → same; successful `no_recognizable_person`
  → people flag follows the declaration; People/Fashion keyword still flags
  when vision succeeded and also saw no person only if product wants the
  heuristic as a second opinion — default is to trust a successful vision read.
- No retroactive rescan of the live library unless product asks for one.

**Done when:** a Landscape upload with vision unconfigured cannot become
`active` commercial stock, and the uploader is sent to the authorization
screen because the server set `hasRecognizablePeople`.

### Phase 65 — Model-upload prompt parity — **shipped**

Model submit compares the server `hasRecognizablePeople` flag with the
checkbox. An undeclared person, or an unfinished detection, warns that
likeness authorization is required and that models do not earn. The model
photo editor can send the existing appearance invite. An unsettled detection
does not treat a self-likeness checkbox as clearance of everyone in the frame.
Photographer contact for third-party copyright stays on the same editor.

Hardened after review: the settled/unsettled check is now an allowlist
(auto-clear only on `no_recognizable_person` or `one_recognizable_person`)
rather than a blocklist, so `crowd_background_persons` can no longer slip
through as "settled." Because that gate can now hold a genuinely self-shot
photo in `required` with no vision provider ever confirming it, the model
can explicitly override via `POST /model/photos/:id/appearances/confirm-self`
— a human closing AI uncertainty, not the AI granting a release.

### Phase 62 — Image remediation — **shipped** (option A)

Recorded in `06` §2b. Severe quality failures and exact duplicates of live
photographs stay in review and skip criteria auto-approve. Exposure and
resolution notes are advisory. Brighten and crop are opt-in preview
derivatives; the original file is not replaced. `image_remediation` is
resolved so the registry is the caller, and the image bytes are not sent to
that provider for an automatic edit. A non-OpenAI wire format remains a
separate adapter task.

### Phase 63 — Analytics reporting — **shipped**

Read-only counts of views, favorites, and licences on the contributor
dashboard and `/admin` metrics, plus how many moderation items have been
pending for more than 7 days. Photo comments are not stored, so they are
not part of the summary. `analytics_reporting` is resolved and catalog rows
are not sent to that provider. This phase cannot deny an account, a photo,
or a licence.

### Still blocked — do not schedule as build

| Item | Wait for | What it is |
| --- | --- | --- |
| T6 **payout withdrawal** rails | Finance readiness to flip `payouts.model_withdrawal_enabled` | Model ledger + manual withdrawal path shipped (flag default OFF). No invented processor. |
| T3 counsel-complete | Counsel paste of real entity + filed agent into Admin Settings | Foundation + `/admin/legal` counsel-status checklist shipped. Copyright Office filing stays ops/counsel. |
| T8 first ACTIVE country | Counsel evidence on G01–G16 plus four-eyes | Waitlist + `africa_list_and_country_active` default shipped (P1-T8). ACTIVE never bypasses the Global Rights Standard. |
| T9 KYC partner activation | Counsel/ops: named screening partners per matrix function | Foundation + `/admin/compliance` readiness shipped (flags OFF; no invented OFAC vendor). |
| Phase 60 **production ON** | Approved identity provider, DPA, retention schedule | Evidence API + readiness checklist ship flag OFF. |
| P2 tax, payee verification, withholding | Finance and counsel | Entitlement is not erased when a payee is held. |

---

## 5. What not to rebuild

Already on `main`: Phases 0–61, including public `/report-content` (50),
rights-ops SOP (51), `/rights` (52), country activation admin (53), PDS
`license.issue` (54), PDS `contributor.upload` (56), quarantine reason codes
(57), AI provider registry (58), contributor subject routing (59), and
criteria-based auto-approve (61). Guest invite, model approve/reject, DMCA
notices, strikes, holds, and Africa-only contributor signup are in
production code. Eight modules are one admin portal, not eight apps.

`07` §1 and `08` §1 still describe the pre-P0 gap in their opening verdicts.
Later sections of those files mark the shipped phases. Trust this document
for sequencing.

---

## 6. Ops, beside the phases

From `06`: confirm the host git SHA (O2), fix TLS (O3), re-sign the live
smoke test after HTTPS (O4). Redeploy from current `main` without
`SEED_DEMO=1`. Set `moderation.ai_auto_approve_content` to false on that
host until Phase 64 is deployed.

---

## 7. Immediate decision

Ungated v2 reconciliation foundations are shipped (see `12`). Remaining §4
rows stay externally gated. Do **not** invent payout withdrawal rails, a KYC
vendor, or signed legal-entity copy. Next human gates: **T3 counsel-complete**,
finance readiness for **T6 withdrawal**, or Bio/T9 vendor contracts.