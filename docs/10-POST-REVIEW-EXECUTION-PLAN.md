# VueKumi — execution plan after review (23 September 2026)

**Status: plan only. Do not start a numbered phase until it is explicitly
approved.** This document is the current backlog. It reconciles the Trust &
Markets memo, the Admin Portal engineering spec, and the AI-pipeline request
with `main` through Phase 61.

Companions:

- [`09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md`](./09-AI-PIPELINE-MULTI-PROVIDER-AND-SUBJECT-DETECTION-PLAN.md) — AI phases 58–63 (58, 59, 61 shipped).
- [`07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md`](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md) — Arc T (T0–T9).
- [`08-ADMIN-PORTAL-ENGINEERING-SPEC.md`](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md) — three layers, eight modules, PDS, P0–P2.
- [`06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md) — Dec-* blanks and live ops.

**Do not invent** photographer/model percentages, a payment base (Dec-PayBase),
a biometric vendor or retention window (Dec-Bio), an Africa-eligibility evidence
rule (Dec-AfricaElig), launch countries, or a VueQuatro entity form.

---

## 1. What the older notes were asking for

Two reviews were written before most of Arc T and the AI registry existed.
They are already the text of `07` and `08`. Treating them as a fresh build
list would rebuild shipped work.

| Note | Ask | On `main` now |
| --- | --- | --- |
| Trust & Markets (T0–T9) | Public report hub, rights hub, country matrix admin, then compensation | T0, T1, T2, T4, T7 shipped (Phases 49–53). T3, T5, T6, T8, T9 still open. |
| Admin portal spec v1.2 | Three independent layers, eight modules, PDS ALLOW/DENY/REVIEW, 16 gates, four-eyes activation | P0 shipped (Phase 49). `license.issue` and `contributor.upload` recheck shipped (Phases 54, 56). Quarantine reason codes shipped (Phase 57). Negotiation, tax/payee, and buyer overlays remain. |
| AI pipeline request | Several providers, one per function; detect a person; contact them if the uploader gave details; otherwise force an authorization prompt | Registry and contributor prompt shipped (Phases 58–59). Detection **fails open** when vision is missing or errors (see §3). ID match and image remediation have no caller. |

The three control layers stay the architecture:

| Layer | Question | Enforced today |
| --- | --- | --- |
| L1 Country eligibility | May this person register as an Africa-based contributor? | PDS `contributor.create`. Default onboarding policy is still the static AU list (`africa_list`). ACTIVE-country requirement waits on Dec-AfricaElig and a counsel-backed pilot (T8). |
| L2 Identity and image rights | Who are they, and are copyright and likeness cleared for this asset? | Rights record, appearances, invite, two-approval lock. Government-ID and identity-bound face match wait on Dec-Bio (Phase 60). |
| L3 Commercial licence and payout | May this image be licensed, and may each payee be paid? | Checkout rechecks rights and, when a market is ACTIVE or SUSPENDED, `license.issue`. Payouts stay photographer 50% / platform 50%. Model negotiation waits on Dec-PayBase (T5/T6). |

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
| Image remediation (quality, enhancement, quarantine action) | `image_remediation` | No caller. Purpose exists so a row can be saved early. | Phase 62, after the scope call in §4. |
| ID document matched to avatar / profile image | `id_verification` | No route, no schema, no vendor. | Phase 60. Blocked on Dec-Bio. |
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

### Remediation scope call, then Phase 62

`image_remediation` has no behavior until product picks one action. Record
the choice in `06` (a product note, not a new Dec-*):

| Option | Action | Recommendation |
| --- | --- | --- |
| A | Quarantine and notify. Do not alter pixels. | Default if no one chooses. |
| B | Blur the detected region on public previews only. Original stays intact. | Higher cost; publish is already blocked by Phase 64. |
| C | Reject the file and require a re-upload. | Harsh default. |

Phase 62, after that note: advisory sharpness/exposure notes, opt-in crop or
brightness (uploader clicks apply), perceptual-hash duplicate check against
live photos. No silent rewrite of a contributor’s file. The
`image_remediation` purpose gets its first caller. A non-OpenAI wire format
is a separate adapter task; do not pretend the Replicate seed row already
does it.

### Phase 63 — Analytics reporting (can run beside Phase 62)

Read-only summaries of views, favorites, licences, and comments for the
contributor dashboard and `/admin` metrics. New purpose
`analytics_reporting` if a text model is used to narrate the numbers. This
phase cannot deny an account, a photo, or a licence.

### Still blocked — do not schedule as build

| Item | Wait for | What it is |
| --- | --- | --- |
| Phase 60 ID ↔ avatar, and identity-bound likeness | **Dec-Bio** signed (vendor, DPA, retention or an explicit discard-forever reaffirmation) | Tier B. Similarity and an ID match are evidence, never consent. No face database, no stored embeddings, unless the signed retention window says otherwise. |
| T5 compensation negotiation | **Dec-PayBase** signed | Commercial clearance can then require both parties to accept the same terms (percent of that base, fixed, combo, or explicit zero). New terms do not rewrite old certificates. |
| T6 model ledger lines | T5 plus finance | Payouts from the signed base. Today the ledger stays photographer 50%. |
| T3 public DMCA policy hardening | Counsel copy | `/dmca` text matches the operator, agent, counter-notice clock, and repeat-infringer rule. Engine already exists (Phase 39). |
| T8 first ACTIVE country | Counsel evidence on G01–G16 plus four-eyes | All 54 countries stay HOLD. ACTIVE never bypasses the Global Rights Standard. |
| T9 buyer-market overlays and sanctions checklist | Counsel | US/EU/UK overlay status; OFAC as an SOP, not an invented screening vendor. |
| Flip onboarding from `africa_list` to `africa_list_and_country_active` | **Dec-AfricaElig** plus at least one honest ACTIVE country | Residence versus business-base evidence is still unsigned. |
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

Phases 64 and 65 are shipped. Next build is **Phase 62** (image remediation, default A: quarantine only, no silent pixel edits).
Record the Phase 62 remediation option (default A, quarantine only) when that
phase starts. Leave Phase 60 and T5/T6 untouched until Dec-Bio and Dec-PayBase
are signed in `06`.
