# VueKumi — AI pipeline: multi-provider registry, subject detection, and ID/likeness verification

**Status: plan only. No new Dec-* decision is invented here; ID/face
verification stays blocked on Dec-Bio exactly as `06`, `07` §6, and `08` §8
(P1 "ID/face provider") already say.** Companion to
[`06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](./06-OPS-INVENTORY-AND-DECISION-BRIEF.md),
[`07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md`](./07-TRUST-RIGHTS-COMPENSATION-COUNTRY-PLAN.md),
and [`08-ADMIN-PORTAL-ENGINEERING-SPEC.md`](./08-ADMIN-PORTAL-ENGINEERING-SPEC.md).

Origin: product asked to (1) let admins configure different/multiple AI
providers per function (image analysis, image remediation, ID-to-avatar
verification, model/person likeness verification for copyright), (2) make
image analysis able to detect an undeclared person in a photo, then either
auto-initiate contact using uploader-supplied details or block publishing
with an explicit authorization prompt when no details are given, and (3) a
follow-up round asking for AI-driven meta-naming/profiling of photos,
criteria-based automated account/content approval and denial, image
fine-tuning and uploader recommendations, and view/comment analytics
reporting to admin and uploaders — "an AI pipeline built in all ways
possible to manage the entire system, with reports to admin and manual
override where needed." §§8–11 below answer that follow-up round.

---

## 1. What already exists (audit)

| Piece | File(s) | State |
| --- | --- | --- |
| `AiProvider` table (`slug`, `purpose`, `apiBaseUrl`, `apiKeyEnc`, `enabled`) | `apps/api/prisma/schema.prisma:1601` | **Schema + admin CRUD shipped** (`admin-integrations.ts`, capabilities `integrations.ai.read/write`). Nothing reads `purpose` selectively yet. |
| Provider resolution | `apps/api/src/lib/ai.ts: resolveVisionProvider()` | Looks up **one** row (`slug: 'openai'` OR `purpose: 'vision'`), else `ai.openai_api_key` setting, else dev fallback. Every caller gets the same single provider regardless of what it's asking for. |
| Metadata/tagging suggestions ("image analysis" today) | `apps/api/src/lib/ai.ts: suggestFromContext/callOpenAi`, `routes/ai.ts`, `components/AiSuggestPanel.tsx` | Shipped. Contributor-triggered, opt-in per field ("Apply"), never auto-applied. Can suggest `hasRecognizablePeople`; applying it sets `modelReleaseRequired: true` / `modelReleaseStatus: 'pending'` (Phase 25 two-party lock already enforces commercial lock on that state). |
| Likeness/selfie comparison (Phase 28) | `apps/api/src/lib/likeness.ts`, `routes/models.ts` | Shipped. Opt-in, one-time, **result only** — selfie bytes are zeroed and discarded (`selfie.fill(0)`) immediately after the call, no embedding stored, no face database. Hard-coded to the same single OpenAI-shaped provider as above. |
| Person→contact invite pipeline | Phase 25 appearances + Phase 24/RightsHub invite emails | Shipped, but **manually triggered**: a contributor tags an appearance and supplies contact info themselves; nothing today runs *automatically* off an AI detection. |
| Reciprocal invite when no contact info is given | — | **Does not exist.** Today a contributor can leave `hasRecognizablePeople` false with no cross-check; the AI suggestion is advisory only and easy to ignore. |
| ID-document ↔ selfie/avatar verification (KYC) | — | **Does not exist anywhere in the codebase.** No route, no library, no schema fields. |
| "Image remediation" (auto-correction/quarantine action after analysis) | — | **Does not exist.** Today an analysis result is informational; nothing takes an automated corrective action (blur, quarantine, auto-unpublish). |

Two structural gaps, not one:

1. **No real per-function dispatch.** The `AiProvider.purpose` column exists but is decorative — one provider row serves every AI call in the codebase today, wire-formatted for OpenAI's chat-completions API specifically. Adding "a different AI for image remediation" is currently impossible without editing code.
2. **No enforcement loop for undeclared subjects.** Detection (the AI suggestion) and consequence (commercial lock) are only connected when a human clicks "Apply." An uploader can skip the suggestion panel entirely.

---

## 2. Doctrine locks this plan must not break

Carried over from `07` §2 and `01` §5/§6 — restated here because this plan
touches the same surface:

1. **Similarity/detection is evidence, never consent or ownership.** An AI
   flag that "a person is in this photo," a likeness-similarity score, or an
   ID-document match is an input to a human/PDS decision — it never itself
   grants a licence, a release, or an identity.
2. **No public face database, no persistent biometric embedding store.**
   Phase 28's discard-forever posture stays the default for any new
   comparison step until Dec-Bio says otherwise.
3. **Country eligibility, identity/rights verification, and commercial
   eligibility stay three independent layers** (`08` §2). Nothing in this
   plan lets an ID-verification result silently grant country eligibility or
   vice versa.
4. **PDS returns ALLOW/DENY/REVIEW + reason + policy version for every
   restricted action** (`08` §5). A new restricted action ("commercially
   publish an image with an AI-detected, uncleared subject") gets a PDS
   action code like every other gate — it is not a bespoke if-statement in
   the upload route.
5. **Do not invent Dec-Bio.** Any code path that identifies *who* a specific
   person is (face-match against a named individual, government-ID
   verification) stays behind a kill switch until Dec-Bio is signed, exactly
   as `07` §6 already states for Gate K.

---

## 3. Two different problems hiding under "image analysis"

The request bundles four functions; they split cleanly into two risk tiers
that must **not** share a gate:

| Tier | Function | What it needs to know | Biometric? | Gate |
| --- | --- | --- | --- | --- |
| **A — presence** | Detect *that* a recognizable person/face appears in an image | Bounding box / yes-or-no | No — this is object detection, the same class of task as NSFW or quality flags | None. Buildable now. |
| **A — remediation** | Take an automated corrective action once analysis flags a problem (undeclared subject, policy violation, low quality) | The Tier-A flag | No | None. Buildable now (scope of the action needs one product decision, §6). |
| **B — identity** | Verify a government ID photo matches a user's avatar/profile selfie | Face-match between two specific images tied to a real identity | **Yes** | Dec-Bio |
| **B — likeness-to-person** | Confirm the person in a stock photo *is* a specific named model/rights-holder (beyond "a face is present") | Face-match against a named identity | **Yes** | Dec-Bio |

Phase 28 already draws exactly this line correctly (it does Tier-B-shaped
work — comparing two faces — but stays inside doctrine by discarding the
input and storing only a discrete, non-identifying result). The new
ID-to-avatar and "verify this is the model" use cases are Tier B by nature:
they exist specifically to bind a face to a claimed identity. They inherit
Phase 28's discard-forever posture as the default and stay gated on Dec-Bio
before any different retention or vendor is adopted.

---

## 4. Phase 58 — AI Provider Registry (multi-provider dispatch) — **shipped**

**Not gated. Pure infrastructure.**

Shipped as designed: `AI_PROVIDER_PURPOSES` enum
(`image_analysis`/`image_remediation`/`id_verification`/`likeness_matching`)
in `@vuekumi/shared`; `AiProvider.priority` column for fallback ordering;
`resolveProvider(purpose)` in `apps/api/src/lib/ai.ts` replaces
`resolveVisionProvider()`, dispatching to the highest-priority enabled row
for that purpose, falling back to the legacy single `ai.openai_api_key`
setting and the old untyped `vision`/`openai` row so pre-Phase-58 installs
keep working unchanged, then dev/no-op. `suggestFromContext`
(`image_analysis`), `compareLikeness` (`likeness_matching`), and
`screenImageForRights` (`image_analysis` — see §5 correction below) all
moved onto it. Admin AI-providers screen groups by purpose with a
priority field and a fallback "other" bucket for any legacy free-text
purpose value already in a database. Seed's `DEFAULT_AI_PROVIDERS`
purposes migrated from `vision`/`enhance` to the new enum values.

Original scope for reference:

Make the existing `AiProvider` table's `purpose` column do real work instead
of being decorative.

- Define a fixed enum of purposes matching the four requested functions,
  stored as `AiProviderPurpose`: `image_analysis`, `image_remediation`,
  `id_verification`, `likeness_matching`. (Keep `purpose` a string column for
  forward compatibility, validate against the enum at the application layer
  the way `licenseType` and similar fields already do elsewhere in this
  codebase.)
- Replace `resolveVisionProvider()` with `resolveProvider(purpose)`:
  look up `AiProvider` rows for that specific purpose (ordered, first
  `enabled` wins; admin can register more than one per purpose for
  fallback/failover), then fall back to the matching `ai.<purpose>_api_key`
  setting, then dev/no-op — same fallback shape as today, just parameterized.
- Add a thin provider-adapter interface so a purpose is not hard-locked to
  OpenAI's wire format:
  ```ts
  interface VisionAdapter {
    analyzeImage(input): Promise<...>       // image_analysis
    proposeRemediation(input): Promise<...> // image_remediation
    matchFaces(a, b): Promise<...>          // id_verification / likeness_matching (Tier B — kept behind the Dec-Bio flag from Phase 60)
  }
  ```
  Ship one adapter (`openaiAdapter`) that implements today's chat-completions
  call for `image_analysis`; that is enough to prove the interface without
  requiring a second vendor account to test it. Admins can already point
  `apiBaseUrl` at any OpenAI-compatible endpoint (Azure OpenAI, a
  self-hosted vLLM/Ollama gateway) with zero further code.
- Update the admin AI-providers screen (already shipped CRUD) to show
  provider health per purpose and let staff assign priority order when more
  than one is registered for the same purpose.
- `suggestFromContext` moves to purpose `image_analysis`; `compareLikeness`
  moves to purpose `likeness_matching` (same OpenAI adapter underneath,
  same discard-forever behavior — this phase does not change Phase 28's
  posture, only which registry row it reads its key from).

**Done when:** two providers can be registered for `image_analysis` (e.g. a
primary and a fallback), the code path picks the first enabled one and
degrades in order, and existing tagging-suggestion and likeness-check tests
still pass unmodified in behavior.

---

## 5. Phase 59 — AI subject quarantine (presence detection → contact or block) — **shipped**

**Not gated (Tier A only — presence, not identity).**

**Shipped scope, smaller than originally proposed**: items 1 and 2 below
turned out to already exist (see the correction note) — nothing needed
building for detection, cross-check, or blocking. The only real gap was
that the client's post-upload redirect used the contributor's *local*
checkbox state instead of the server's actual (post-AI-override)
`hasRecognizablePeople`, so a batch upload with an under-declared photo
never routed the uploader to the existing rights-clearance screen. Fixed in
`apps/web/src/pages/Contributor.tsx`: the submit handler now reads each
uploaded photo's server-returned `hasRecognizablePeople` (not the shared
checkbox) to decide whether to navigate to `/contributor/photos/:id` —
which already renders `PeopleIdentifier` (name/email/mobile → auto-fires
the Phase 24/25 invite email on submit) whenever `hasRecognizablePeople` is
true, per §5 item 3's already-shipped invite pipeline. When the checkbox was
left off but the server detected a person anyway, a distinct warning toast
uses the exact prompt language from item 3's "no contact info given" branch.
Item 4 (appeal path) also needed no new work — the existing rights-report
queue already covers a disputed flag; no new `AiSubjectDetection` model or
PDS action code was added, since the existing `RightsRecord` fields and
`commercialEligibilityBlock` already carry that decision with a clear
reason ("AWAITING MODEL CONSENT").

**Correction found while building Phase 58**: §1's audit undersold what
already exists. `apps/api/src/lib/screening.ts` (Phase 23) already runs
AI/heuristic person-presence detection (`screenImageForRights`,
`RightsScreeningDto` with `kind`/`possibleMinor`/`crowdBackground`/etc.) at
upload, and `applyScreeningToPeopleFlag` (`@vuekumi/shared`) already
**overrides** a contributor's `hasRecognizablePeople: false` to `true` when
AI detects a person or is uncertain — a contributor cannot self-declare
their way past detection. That in turn already sets
`modelReleaseRequired`/`modelReleaseStatus: 'pending'`, which the existing
two-party commercial-lock engine (`commercialEligibilityBlock`) already
blocks commercial licensing on ("AWAITING MODEL CONSENT"). **Detection and
blocking are shipped, not new.** What's below is now scoped to only the
genuinely missing piece: turning a silent "pending" state into the
uploader-visible prompt-or-auto-invite workflow the product described,
using `identifyAppearanceSchema` (already collects displayName/email/mobile)
as the contact-capture step. This is the "AI subjects" line item `08` §8
already names under P1, made concrete. Original proposal for reference
(superseded by the shipped scope above — kept so the reasoning is visible):

1. **Detection becomes a first-class signal, not just a suggestion field.**
   On upload processing (same pipeline as EXIF stripping / derivative
   generation, `apps/api/src/lib/process-photo.ts`), run the
   `image_analysis` provider and persist an `AiSubjectDetection` result on
   the photo (`personDetected: boolean`, `confidence`, `provider`,
   `policyVersion` — same shape discipline as PDS decisions) independent of
   whatever the contributor manually declared.
2. **Cross-check, don't just trust the checkbox.** At publish time, PDS gets
   a new action code, e.g. `content.publish_commercial`, whose check
   includes: if `AiSubjectDetection.personDetected = true` and the
   contributor declared `hasRecognizablePeople = false` **or** left zero
   appearances on the photo, return `DENY` (reason
   `undeclared_subject_detected`) instead of `ALLOW`. This closes the gap in
   §1 row 4 — a contributor can no longer silently skip past the suggestion.
3. **Two branches once a person is detected**, matching the request exactly:
   - **Uploader supplied contact info for the person** (an appearance row
     with an email/handle already exists, or the uploader adds one when
     prompted): auto-fire the **existing** Phase 24/25 invite pipeline
     (`contributor.ts` appearances → RightsHub email) instead of waiting for
     the contributor to remember to do it manually. No new legal surface —
     this wires an AI trigger onto an already-shipped, already-reviewed
     email/consent flow.
   - **No contact info given:** block commercial publish (editorial/personal
     use can still proceed, mirroring today's `permissionState` distinctions)
     and surface a mandatory prompt: *"Vuekumi's automated review detected a
     person in this photograph. Provide their contact details to request a
     release, or confirm you already hold independent written authorization,
     before this image can be commercially licensed."* This is a UI/workflow
     gate, not an identity claim — Vuekumi never asserts who the person is,
     only that presence was detected.
4. **False positives/negatives get a human appeal path**, consistent with
   UAT #11 in `08` §9 ("face-match false negative → manual appeal; no
   fabricated consent") — a contributor can dispute an `undeclared_subject_detected`
   DENY through the same rights-report/admin-override path Phase 51's rights
   ops SOP already defines, rather than a bespoke new dispute mechanism.

**Done when:** an upload with a visible face and no appearance/contact info
cannot reach `active`/commercial status without either an invite being sent
or an explicit authorization attestation; PDS decision + reason code is
logged like every other gate; existing photos with `hasRecognizablePeople`
already correctly declared are unaffected (no re-review flood on shipped
inventory — this phase gates new uploads and re-processed photos, not a
retroactive sweep, unless product asks for one separately).

---

## 6. One product decision Phase 62 needs (not a new Dec-*, a scope call)

"Image remediation" was named as a function but not defined. Phase 59
shipped without needing this — it reused the existing rights-lock
mechanism rather than a new `image_remediation` action. Before Phase 62
(image enhancement, §10) ships, product picks what an automated remediation
action actually is when `image_remediation` fires more broadly (e.g., on a
policy-violation flag, not just an undeclared subject):

- (A) **Quarantine only** — unpublish/hold the photo and notify the
  contributor; no image is altered. Lowest risk, recommended default.
- (B) **Auto-blur/redact** the detected face region in public previews until
  a release is on file, while the stored original is untouched. Higher
  engineering cost (region-aware redaction, cache invalidation on release)
  for a marginal trust benefit over (A) once publish is already blocked.
- (C) **Auto-reject and require re-upload** with the offending element
  removed. Harshest; likely wrong default for a first pass.

This is a UX/policy call, not a legal-gate decision — record it in `06` as a
short product note (not a numbered Dec-* — it doesn't touch money, biometric
retention, or country eligibility) before Phase 62 implementation starts.

---

## 7. Proposed Phase 60 — ID/face verification provider (Tier B, Dec-Bio gated)

**Spec only. Do not implement until Dec-Bio is signed**, per `06` Dec-Bio and
`07` §6 Gate K. Recorded here so the architecture is ready the day the
decision lands, not invented today.

Scope once unblocked:
- New `id_verification` purpose in the Phase 58 registry, pointed at a named
  KYC vendor (Dec-Bio option B) — this plan does not choose or default to
  one; per `06` non-goals, no vendor is invented here.
- Government-ID-photo ↔ profile-avatar match, used only where the product
  actually needs identity assurance (e.g., payee verification ahead of a
  payout — already foreshadowed by `08`'s P2 "tax/payee" line — or a
  higher-assurance rung above today's `claimed → documented → verified`
  quality ladder in `03`).
- Extending Phase 28's likeness check from "similar/not similar/inconclusive"
  to matching against a *specific claimed identity* (today it only compares
  two images handed to it in the same request; it does not look anyone up).
- Retention: defaults to Phase 28's discard-forever unless Dec-Bio option B
  (named vendor + numbered retention days) is signed. If discard-forever is
  reaffirmed (Dec-Bio option A), this phase still ships the registry
  plumbing but keeps the ephemeral-only behavior — multi-provider support
  does not itself require persisting biometric data.
- No public face database, no cross-photo embedding search — the two
  standing non-goals from `01` §5 and `07` §9 continue to apply verbatim.

**Done when:** Dec-Bio is signed with a chosen option; this section is
promoted into `01-IMPLEMENTATION-PLAN.md` as a numbered phase with the
signed vendor/retention values filled in (never invented ahead of the
signature).

---

## 8. Meta-naming / image profiling — already shipped, needs one UX change

Product asked whether AI can name/tag/describe photos for uploaders. **It
already does** (§1 row 3: `suggestFromContext`, `AiSuggestPanel`) — title,
description, category, country, tags, and an `hasRecognizablePeople`
suggestion, running on the same `image_analysis` purpose Phase 58 formalizes.

The gap is UX, not capability: today the contributor must open the panel and
click "Apply" per field, so it's easy to skip entirely (this is also *why*
Phase 59 exists — a skippable suggestion is not an enforcement point). Fold
into Phase 58/62: run the suggestion automatically at upload and pre-fill
the form fields (title/description/category/tags) as an editable draft the
contributor reviews before submitting, rather than a separate panel they may
never open. This is a UI default change, not a new AI capability, and it
never auto-publishes without the contributor seeing the draft first —
`suggestFromContext`'s existing prompt already tells the model "a human will
review every field" (`apps/api/src/lib/ai.ts:147`); this just makes that
review the normal upload path instead of an opt-in extra.

---

## 9. Phase 61 — AI-assisted account & content approval (criteria-based) — **shipped**

**Not gated as a whole, but must not swallow the two decisions that already
have their own gate.** Automated approve/deny of accounts and content is a
trust-and-safety surface, not a pure engineering one — get the contract
wrong and it either lets bad actors through or silently locks out a
legitimate African photographer. This phase adds a **second, independent
signal** alongside — never instead of — the checks that already own their
domains:

**Shipped scope (product decision: auto-approve is the default, admin can
flip it off)**: `apps/api/src/lib/moderation.ts` — `evaluateAccountApproval`
and `evaluateContentApproval`. Wired into `POST /auth/register` (replaces
the old hardcoded `agency ? pending : active`, generalizing the *existing*
agency `pending`-account pattern to `CREATOR_ACCOUNT_TYPES`) and into
`POST /contributor/photos` (runs after `processPhotoAssets` so real
width/height are available; auto-approval flips `Photo.status` to `active`
and the existing `ModerationItem` to `approved` with a reasons-bearing note,
rather than inventing a parallel queue). A `pending` creator account is now
actually blocked from uploading (previously `pending` existed on the User
model for agencies but nothing enforced it).

Criteria are admin-editable through the **existing** generic Settings
mechanism (`SETTING_DEFINITIONS`, new "Moderation" group — surfaces
automatically in the Admin Settings screen, no new UI needed), not a new
dedicated table:
- `moderation.ai_auto_approve_accounts` / `moderation.ai_auto_approve_content` — the on/off switch, **default `true`** per product's explicit instruction
- `moderation.disposable_email_domains` — comma list, seeded with common disposable-email providers
- `moderation.require_complete_metadata`, `moderation.min_photo_width`, `moderation.min_photo_height` — content criteria

**Safety floor that the toggle cannot disable**: `possibleMinor`,
`potentiallySensitive`, and `uncertainHumanDetection` (from Phase 23's
existing screening) always force manual review regardless of the
auto-approve setting — not exposed as a togglable criterion, so an admin
flipping the general switch can't accidentally wave through exactly the
cases screening exists to catch.

**Deliberately not built in this pass** (say so rather than overclaim):
duplicate-account fingerprinting (device/IP/payout-method reuse — no such
tracking exists yet), ToS/consent-checkbox completeness scoring (already a
hard requirement at signup, not a scored signal), exact/perceptual
duplicate-image hashing, and a policy-prohibited-content classifier
(violence/hate/CSAM-adjacent) — that last one needs its own prompt design,
accuracy bar, and likely legal sign-off before being trusted for
zero-tolerance auto-quarantine, not something to bolt on inside this phase.
These remain real gaps in the "criteria" list below, listed for the next
iteration rather than silently dropped.

Original proposal for reference (superseded by the shipped scope above):

- **Country/Africa eligibility stays owned by Phase 49's PDS `contributor.create`
  check.** Phase 61 does not re-decide it, re-score it, or let a high
  "quality" signal override a country DENY. Dec-AfricaElig is still
  unsigned (`06`); this phase invents nothing about it.
- **Identity/biometric determination stays owned by Phase 60 (Dec-Bio
  gated).** Phase 61's account-approval criteria are explicitly the
  non-biometric kind (below) — it never fingerprints a face to decide
  account approval.

What Phase 61 *does* add, using the same `ALLOW / DENY / REVIEW + reason
codes + policy version` contract the PDS already uses everywhere else (`08`
§5), so it plugs into the existing admin moderation queues rather than
inventing a parallel one:

| Surface | Example criteria (non-exhaustive, admin-editable) | Contract |
| --- | --- | --- |
| Account signup (beyond country) | Disposable/role email domain, duplicate-account fingerprint (device/IP/payout-method reuse), required profile fields incomplete, ToS/consent checkboxes unsigned | High-confidence clean → `ALLOW` (skips manual queue, speeds up onboarding); anything ambiguous or flagged → `REVIEW` in the existing admin accounts queue; **never an unappealable auto-DENY on an account** |
| Photo/content upload | Technical quality floor (resolution, blur, exact-duplicate hash against the catalog), copyright-attestation completeness, policy-prohibited categories (violence, hate symbols, CSAM-adjacent — zero tolerance) | Clean → `ALLOW` to normal moderation; policy-prohibited → immediate quarantine + mandatory human audit log entry (never a silent, unlogged removal); everything else → `REVIEW` |

This mirrors UAT #11 in `08` §9 ("face-match false negative → manual appeal;
no fabricated consent") applied to moderation generally: a DENY on a real
person's account or a real contributor's photo is never final without a
human able to see why and overturn it. The admin side of this is a
**recommendation with reasons**, not a black box — every `AiModerationDecision`
row logs the criteria that fired, same discipline as `AuditLog` elsewhere in
this codebase.

---

## 10. Phase 62 — Image enhancement & uploader recommendations — **shipped**

**Option A (quarantine and notify) is recorded in `06` §2b.** Advisory
quality notes ship with it. Opt-in preview brighten/crop does not replace
the original.

At upload, run an additional advisory pass: sharpness/exposure/composition
score, suggested crop or orientation fix, and a plain-language note to the
uploader ("this photo is underexposed — consider re-shooting or increasing
brightness before publishing"). Any actual pixel change (auto-crop,
auto-brighten) is **opt-in only** — the uploader clicks "apply," mirroring
the existing `AiSuggestPanel` per-field apply pattern — never a silent
rewrite of a contributor's copyrighted work. Duplicate-of-existing-catalog
detection (perceptual hash against already-live photos) belongs here too and
doubles as a cheap fraud/plagiarism signal for Phase 61's content criteria.

---

## 11. Proposed Phase 63 — AI analytics & reporting (views/comments → admin + uploader reports)

**Not gated — pure reporting, changes no account or content state.** New
purpose `analytics_reporting` (text-only; does not need a vision-capable
provider). A periodic job aggregates per-photo views, favorites, licence
conversions, and comments, and produces two report surfaces:

- **Contributor-facing**: a periodic summary in the existing Earnings/
  Dashboard tab of `Contributor.tsx` — top-performing photos, trending
  tags/categories worth shooting more of.
- **Admin-facing**: a new panel (or an extension of the existing
  `/admin/metrics` overview) — catalog health, category gaps, per-contributor
  performance trend, and moderation-queue volume/aging, so staff have one
  place to see what Phase 61's queue actually needs attention.

Because this phase only reads and summarizes existing data (views, licences,
comments already tracked elsewhere), it carries no PDS gating requirement —
it cannot deny a licence or an account by itself.

---

## 12. Sequencing

**Renumbered 2026-09-23**: this plan originally proposed 57–62, but a
different, unrelated Phase 57 ("asset quarantine reason codes" —
`Photo.commercialLockReason`, PR #23) merged to `main` first. Everything
here shifted up by one to 58–63 to avoid colliding with it; there is no
functional overlap between that phase and this plan.

| Phase | Name | Depends on | Gated? |
| --- | --- | --- | --- |
| **58** | AI Provider Registry (multi-provider dispatch) | — | No — **shipped** |
| **59** | AI subject quarantine (detect → auto-invite or block) | 58 | No — **shipped**, Tier A only |
| **60** | ID/face verification provider (KYC, identity-bound likeness) | 58; **Dec-Bio signed** | **Yes** |
| **61** | AI-assisted account & content approval (criteria-based) | 58; does not touch Phase 49 country gate or Phase 60 identity gate | No — **shipped**, additive signal only |
| **62** | Image enhancement & uploader recommendations | 58; 59 (shares the remediation UX) | No — **shipped**, option A |
| **63** | AI analytics & reporting | none (reads existing data) | No |

58, 59, 61, 62, and 63 can all build in parallel with any open Arc T / P1
work already in flight (T5/T6 compensation, still separately waiting on
Dec-PayBase) — none of them depends on model compensation, and only 60
depends on a human decision (Dec-Bio) outside this plan's control.

---

## 13. Explicit non-goals

- Choosing or defaulting to a specific ID-verification or facial-recognition
  vendor (Dec-Bio's decision, not this plan's)
- Persisting biometric embeddings, selfies, or ID-document images beyond the
  single request they were submitted for, ahead of a signed Dec-Bio
  retention window
- Treating an AI presence-detection flag, a likeness-similarity score, or an
  ID match as a legal release, consent, or proof of identity in itself
  (unchanged from `01`/`07` doctrine)
- Retroactively re-scanning the existing photo library for undeclared
  subjects as part of Phase 59 (a separate, explicitly product-approved
  backfill if ever wanted)
- Building a second, parallel consent/invite pipeline — Phase 59 reuses the
  Phase 24/25 appearance and RightsHub flows rather than inventing a new one
- Letting Phase 61's quality/fraud signal override or re-decide the Phase 49
  country-eligibility gate or the Phase 60 identity gate
- An unappealable, fully automatic DENY on a real account or a live photo —
  Phase 61 always leaves a human-visible reason and a review/appeal path
- Silently altering a contributor's uploaded image — Phase 62's fixes are
  opt-in, applied only when the uploader clicks apply

---

## 14. Immediate next action (human)

Phases 58, 59, 61, 62, 64, and 65 are shipped. Option A is recorded in
`06` §2b. Next build is Phase 63. No action on Phase 60 until Dec-Bio is
signed.
