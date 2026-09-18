# VueKumi — Admin ACL, model upload, and symmetric rights

**Status: Phases 35–37 shipped. Remaining phases still require approval before implementation.**

This is the implementation procedure for three product decisions:

1. Staff manage every account type from the admin portal.
2. Super-admin creates admin users and limits each one to selected features.
3. Models may register and upload photographs under the same two-rights standard as photographers — whoever uploads must prove the rights they do not personally control.

It also records the legal operating philosophy (U.S. contracts + VueKumi Global Rights Standard + country overlays) as **product rules the engine will enforce**. Agreement copy, DMCA agent registration with the Copyright Office, insurance, and entity split remain **counsel-gated**. The engine ships the structure; we do not invent signed legal language.

Phases 0–33 are shipped on `main`. Phase 34 (AI-training consent) stays parked. This work is **Arc D (Phases 35–40)**.

---

## 0. Locked rules (do not reopen in implementation)

These are already in code or are locked by this plan. Implementers must not weaken them.

| Rule | Status |
| --- | --- |
| VueKumi is a **rights-verification platform**, not photographer-first or model-first | **Lock now** |
| Photo copyright and likeness/model consent are **independent** tracks | Shipped; extend, do not replace |
| **Claim ≠ documented ≠ verified.** Only verified gets a public “Rights Verified” mark | **Lock now** |
| When VueKumi knows **another identifiable person may own the copyright**, an uploader’s declaration **never** unlocks commercial licensing | **Lock now** (tightens today’s `claimed` = cleared) |
| Display/portfolio permission is **not** commercial licensing permission | **Lock now** |
| Self-shot: one person may satisfy both tracks because they are creator and subject | Shipped (photographer→model); mirror (model→photographer) |
| Multiple people / multiple rightsholders: **all** required rights cleared before commercial | Shipped for likeness; extend to copyright holders |
| Models **do not earn from likeness**. Photographer 50% of paid licences unchanged. Model/platform split **undecided — do not invent** | Shipped (Phase 24) |
| If a model is also the photographer (self-shot + photographer agreement), they earn the **photographer** 50% as photographer, not as model | **Lock now** |
| Africa-only **creators** (photographer / community contributor). Models as subjects are **not** Africa-restricted | Creators shipped; models **lock now** |
| One account type per email except dual-role on the same user | Shipped |
| Typed name ≠ identity. Checkbox ≠ consent. PDF ≠ VueKumi-verified | Shipped |
| Stage 1 AI = person **detection** only. No identity, no face geometry, no biometrics without separate consent | Shipped |
| AI-training consent is Phase 34 and remains **off** | Shipped exclusion |
| Commercial lock ≠ takedown. A dispute **suspends new licensing** immediately | Shipped freeze; extend to copyright/likeness dispute states |
| Booking / campaigns / partner API do not grant licences and do not invent commissions | Shipped |
| Do not write “exclusively U.S. law regardless of the user’s country” into Terms | **Lock now** |

Counsel still owns: governing-law clause wording, indemnity/clawback language, DMCA agent filing, POPIA/NDPA/Kenya DPA transfer bases, insurance, VueKumi vs VueQuatro contracting entity.

---

## 1. What already exists (map new work here)

Do **not** build a parallel rights system or a parallel admin app.

| Surface | Today | Gap |
| --- | --- | --- |
| `AccountType` | `admin`, `photographer`, `contributor`, `user`, `agency`, `model` | Models cannot public-register or upload |
| `PUBLIC_REGISTER_ACCOUNT_TYPES` | photographer, contributor, user, agency | Model excluded |
| `AdminRole` | `super_admin`, `moderator`, `finance`, `support` | **Decorative** — any `accountType=admin` has full access |
| Admin portal accounts | List/edit name, email, country, status for users, **community** contributors, agencies, models, admins | No create. No photographers list. No role/capability assignment. No agency activation. `GET /admin/accounts/:id` unused |
| Admin auth | `requireAccountTypes(app, 'admin')` | No `requireAdminCapability` |
| Copyright status | `claimed \| verified \| disputed \| restricted` | No `documented`. **`claimed` currently clears commercial** |
| Likeness status | workflow enum (`required`, `invitation_sent`, `pending`, `approved`, …) | Verification **quality** (claimed / documented / verified) is not a first-class field |
| Photographer upload | Screening → Route A PDF / Route B VueKumi contacts model | No mirror for model upload |
| Model account | Invite-only; appearances + public `/m/:handle`; no upload | — |
| Dual-role | Photographer + `ModelProfile`; `accountType` stays photographer | No model-primary + photographer profile |
| Reports | Public report + staff commercial lock + `AuditLog` | Not a DMCA process; no repeat-infringer; no payout hold |
| Earnings | `available → reserved → paid` | No dispute hold / reserve |
| Rights record | `RightsRecord` + `PhotoAppearance` + `ModelRelease` + grants + audit | No unified Rights Ledger API |
| Legal | Africa-only creators; photographer / community agreements in `apps/api/src/data/licenses.ts` | No model uploader agreement; no Global Rights Standard module; no country overlay engine |
| Guardian | Schema fields exist | `guardianAuthorizedAt` is never written |

Agency RBAC (`AgencyRole`, `canManageTeam`) is the pattern to copy for admin capabilities.

---

## 2. Operating principle (the symmetry)

```
                         IMAGE UPLOAD
                              │
                     Who uploaded it?
                    ┌─────────┴─────────┐
                    │                   │
              PHOTOGRAPHER            MODEL
                    │                   │
             Copyright claim       Likeness consent
                    │                   │
           Models detected?       Who took this photo?
                    │                   │
              YES ──┘              Another person / assigned / licensed / unknown
                    │                   │
             Model consent        Photographer / copyright
             (Route A or B)       authorization (mirror)
                    │                   │
                    └─────────┬─────────┘
                              │
                       RIGHTS LEDGER
                              │
                 ┌────────────┴────────────┐
                 │                         │
             INCOMPLETE                 VERIFIED
                 │                         │
        Commercial licensing        Commercial licensing
             LOCKED                    ENABLED
```

**Whoever uploads must prove the rights they do not personally control.**

Two questions, always, and they are not the same:

1. Do you have permission to **upload / display** this image?
2. Do you have permission to **commercially license** this image through VueKumi?

---

## 3. Rights model (Phase 37 — shipped)

### 3.1 Two dimensions, not one collapsed enum

Keep **workflow** (how we got here) separate from **verification quality** (how much we trust it).

**Copyright quality** (extend `CopyrightStatus`):

`claimed → documented → verified → disputed | restricted`

**Likeness quality** (new field on `RightsRecord` / each `PhotoAppearance`, do not destroy the workflow enum):

`claimed → documented → verified → rejected | disputed`

Likeness **workflow** stays: `not_required | required | invitation_sent | pending | approved | rejected | revoked | disputed`.

`approved` (workflow) without VueKumi-verified quality is **claimed or documented consent**, not a public “Model Release Verified ✓”.

### 3.2 How each rung is reached

| Rung | Meaning | How it is set | Public mark |
| --- | --- | --- | --- |
| **Claimed** | Uploader attested | Checkbox + agreement version + IP/time stored | None |
| **Documented** | Supporting file uploaded (assignment, licence, release, shoot agreement) | File stored; optional AI extract is **advisory only** | None |
| **Verified** | VueKumi obtained confirmation from the other rightsholder, or staff verified a self-shot dual-role identity | Guest/secure rights page decision **or** staff process-verify of self-shot | “Rights Verified” / “Model Release Verified” only at this rung |
| **Disputed** | Competing claim or qualifying complaint | Report, DMCA notice, or rightsholder “unauthorized” | Licensing suspended |

Hierarchy: **user assertion < uploaded document < direct rightsholder confirmation**.

AI may extract photographer, model, dates, grant scope, commercial/sublicence, territory, term, restrictions. AI **must not** set `verified`.

### 3.3 Commercial eligibility (breaking change — call it out)

**Today:** `copyrightCleared = claimed | verified`. That treats a checkbox as clearance.

**After Phase 37:**

```
commercialEligible =
    copyrightAuthoritySufficient
    AND likenessAuthorizationSufficient
    AND displayAndCommercialScopesAllowSale
    AND NOT commercialLocked
    AND neither track is disputed/rejected/restricted
```

| Situation | Copyright sufficient for **commercial** | Likeness sufficient for **commercial** |
| --- | --- | --- |
| Photographer uploads work they created; **no** other copyright owner identified | `claimed` or higher (attestation + photographer agreement) | If people: likeness quality `verified` (VueKumi contacted model **or** self-shot on same verified identity). PDF alone stays `documented` |
| Photographer uploads; another person identified as copyright owner (commission, employment, assignment-in) | **`verified` only** | Same as today |
| Model uploads; “I took this myself” | Not commercial until they hold a photographer agreement on the same email (dual-role). Then same as photographer self-created | Self-shot likeness on the uploading model can reach `verified` because they are the subject |
| Model uploads; another photographer took it / assigned / licensed / unknown | **`verified` only** (VueKumi contacts the photographer). Claimed or documented **never** unlocks commercial | Uploading model’s own likeness may be claimed→verified via their decision; **other** people in the frame still need their own consent |
| Portfolio/display only | `claimed` or `documented` **display** scope may allow `/m/:handle` or portfolio permission states | Display usage ≠ commercial usage |

**Public “Rights Verified ✓”** requires copyright quality `verified` **and** likeness quality `verified` (or likeness `not_required`).

This is the single strictest product rule in the plan: **declaration alone never unlocks commercial licensing when another identifiable person may own the copyright.**

### 3.4 Display vs commercial scopes

Every copyright authorization and every likeness decision stores **scope**:

- `portfolio_display`
- `editorial`
- `commercial_sublicensing` (required for stock)
- `exclusive` (optional)
- `ai_training` — always stored `false` until Phase 34

A photographer can authorize a model to **show** the photo on VueKumi and still refuse commercial sublicensing. The photo may live in portfolio/editorial; checkout stays locked.

### 3.5 Who took this photograph? (required on model upload)

Exactly one answer, required before submit:

| Answer | Copyright track |
| --- | --- |
| I took this photograph myself | Uploader is copyright claimant. Commercial stock requires photographer dual-role + Africa + photographer agreement |
| A photographer took it | VueKumi must contact them (name + email + mobile). Commercial locked until they verify |
| A photographer took it and transferred copyright to me | Documented assignment; still contact the named photographer for commercially important / all commercial unlocks (prefer direct confirm) |
| A photographer took it and licensed it to me | Documented licence; VueKumi still contacts them for commercial unlock |
| I don’t know who took it | Copyright `restricted`. Display may stay private/portfolio. Commercial **impossible** until a rightsholder is identified |

Mirror of Route B: name + email + mobile, VueKumi contacts the photographer, PII not leaked to the model, first message is a **rights-clearance notice** (who supplied the contact and why), not a marketing signup.

### 3.6 Rights Ledger (read model + append-only events)

Do not replace `RightsRecord`. Add:

1. **`RightsLedgerEvent`** — immutable append-only row per image: actor, action, agreement version, scopes granted/denied, IP/user-agent (where lawful), channel (email/mobile), related IDs, previous/next quality, commercialEligible snapshot.
2. **`GET /photos/:id/rights-ledger`** (admin capability) and a contributor/model **own-photo** view — the product “ledger card” (image id, uploader, copyright block, likeness block, status, commercial flag).
3. On every licence grant, snapshot the ledger head onto `LicenseGrant` (already has `scope` JSON — extend, don’t fork).

Complaint path: any qualifying copyright/likeness complaint sets the relevant track to `disputed` and `commercialLocked=true` **before** staff decide who is right. Existing grants remain recorded; new sales stop.

### 3.7 Schema sketch (implementation, not a migration yet)

- `Photo.uploadedById` (who put the file on the platform)
- Keep `Photo.contributorId` as the **copyright-side catalog owner** once known (photographer user). Null until identified on model uploads.
- `Photo.creationClaim` enum matching the five answers above
- `CopyrightAuthorization` (mirror of `PhotoAppearance`): named person, email, mobile, token hash, decision, scopes, quality, document keys
- `RightsRecord.copyrightQuality` — or fold `documented` into `CopyrightStatus` and add `copyrightMethod`: `attestation | document | vuekumi_direct`
- `PhotoAppearance.consentQuality`: `claimed | documented | verified`
- `User.rightsStrikeCount`, `User.repeatInfringerAt` (Phase 39)
- `EarningsLedger.status` adds `held` (Phase 39)

Earnings on a commercially sold model-uploaded photo: photographer share pays **`contributorId`** (copyright owner), never the model, unless they are the same user via dual-role.

---

## 4. Admin portal (Phases 35–36)

### 4.1 Account management — what staff can do after Phase 35

| Account bucket | List | Create | Edit | Status | Extra |
| --- | --- | --- | --- | --- | --- |
| Members (`user`) | Yes (exists) | Yes | Yes | active / suspended / pending | Password reset (exists) |
| Photographers | **New page** (today they are missing from Contributors) | Yes | Yes | + handle view | Dual-role badge |
| Community contributors | Yes | Yes | Yes | | |
| Agencies | Yes | Yes | Yes | **Activate / suspend the Agency entity**, not only the user | |
| Models | Yes | Yes (invite or create) | Yes | | Appearances count |
| Admins | Yes | **Super-admin only** (Phase 36) | Super-admin only for role/capabilities | Cannot demote the last super-admin | |

Create flow: email, name, account type, country (required for creators), temporary password **or** invite email, optional send-reset. Every create writes `AuditLog`.

Photographers vs community contributors stay separate lists. The current Contributors page copy (“photographers and photo influencers”) is wrong against the API filter.

### 4.2 Capability catalog (Phase 36)

`AdminRole` becomes a **preset**, not the authorization primitive. Authorization is a set of capability keys on `AdminProfile`.

Super-admin always has all capabilities (`*` internally). Super-admin may tick a custom subset per staff user. Changing a preset later does not silently rewrite customised users (store `capabilities[]` + `preset: AdminRole | custom`).

**Presets (defaults, editable):**

| Preset | Intent |
| --- | --- |
| `super_admin` | Everything, including staff and settings |
| `moderator` | Content, moderation, reports, likeness/copyright review, quotes |
| `finance` | Payouts, FX, quotes view, metrics, not settings secrets |
| `support` | Account read/update, password reset, read-only content, not payouts/settings |

#### Capability keys (1:1 with today’s admin surfaces)

**Overview**

| Key | Covers |
| --- | --- |
| `metrics.view` | `GET /admin/metrics/overview`, `/admin` dashboard |

**Accounts**

| Key | Covers |
| --- | --- |
| `accounts.users.list` | `/admin/users` |
| `accounts.users.write` | create/update members |
| `accounts.photographers.list` | `/admin/photographers` (new) |
| `accounts.photographers.write` | create/update photographers |
| `accounts.contributors.list` | `/admin/contributors` |
| `accounts.contributors.write` | create/update community contributors |
| `accounts.agencies.list` | `/admin/agencies` |
| `accounts.agencies.write` | create/update agency users |
| `accounts.agencies.activate` | set `Agency.status` active/suspended |
| `accounts.models.list` | `/admin/models` |
| `accounts.models.write` | create/update/invite models |
| `accounts.admins.list` | `/admin/admins` |
| `accounts.admins.manage` | **create admin, set preset/capabilities, suspend admin** — super-admin only in presets |
| `accounts.password_reset` | `POST /auth/admin/send-password-reset/:userId` |
| `accounts.read` | `GET /admin/accounts/:id` |

**Content and rights**

| Key | Covers |
| --- | --- |
| `content.list` | photo search |
| `content.read` | photo rights panel |
| `content.rights.edit` | PATCH permission / copyright flags |
| `content.two_party.verify` | staff process-verify |
| `content.model_release.review` | Route A PDF review |
| `content.commercial_lock` | freeze/unlock licensing |
| `content.rights_ledger.read` | ledger view (Phase 37) |
| `moderation.list` | publish queue |
| `moderation.decide` | approve/reject |
| `reports.list` | rights reports |
| `reports.decide` | lock/unlock/dismiss/resolve |
| `quotes.list` | RM quotes |
| `quotes.manage` | price/decline |

**VueQuatro / partner**

| Key | Covers |
| --- | --- |
| `representation.list` | representation queue |
| `representation.decide` | approve/decline/end |
| `representation.inquiry.manage` | inquiry answer/close |
| `partner.keys.list` | list keys |
| `partner.keys.create` | issue key |
| `partner.keys.revoke` | revoke key |

**Money**

| Key | Covers |
| --- | --- |
| `payouts.list` | payout queue |
| `payouts.pay` | mark paid |
| `payouts.reject` | reject |
| `payouts.holds.manage` | Phase 39 holds |

**Platform**

| Key | Covers |
| --- | --- |
| `geo.countries.list` / `geo.countries.write` | countries |
| `geo.fx.list` / `geo.fx.sync` / `geo.fx.override` | FX |
| `integrations.gateways.read` / `integrations.gateways.write` | payment rails |
| `integrations.ai.read` / `integrations.ai.write` | AI providers |
| `settings.read` / `settings.write` | Stripe, Resend, S3, OAuth, share rate |
| `settings.email.test` | test email |
| `audit.read` | **new** audit log viewer (logs already written) |
| `dmca.manage` | Phase 39 |

Nav and routes hide what the signed-in admin cannot access. API returns 403 with the same keys (web must not be the only gate).

**Hard rules**

- Only `accounts.admins.manage` can create/alter admins.
- `settings.write`, `integrations.*.write`, `partner.keys.create` default to super-admin.
- An admin cannot edit their own capabilities.
- Last super-admin cannot be suspended or stripped.
- Admins keep using `/contributor` only if they have an explicit `content.impersonate_creator` flag (**default off**). Today every admin can enter the photographer portal; that is too broad once support staff exist.

### 4.3 Implementation procedure — Phase 35 then 36

**Phase 35 — Admin user management (no ACL yet)**

1. Shared DTOs: create-user schema, photographer list kind, agency activate schema.
2. API: `POST /admin/accounts`, `POST /admin/agencies/:id/status`, list photographers (`accountType=photographer`).
3. UI: Photographers page; Create button on each account list; agency activate control; wire `GET /admin/accounts/:id` into the sheet.
4. Tests: create each type; reject public-shaped admin create; agency pending → active; photographer appears in photographers list not community list.
5. Seed unchanged except document the new screens.

**Phase 36 — Granular ACL (shipped)**

1. Schema: `AdminProfile.capabilities String[]`, `capabilitiesCustomized Boolean`.
2. Shared: `ADMIN_CAPABILITIES` catalog, `adminHas(user, key)`, preset maps.
3. API: `requireAdminCapability(app, key)` on every admin route; `POST /admin/admins`; `PATCH /admin/admins/:id`; serialize capabilities on `AuthUser`.
4. UI: create-admin form with preset + checkbox matrix; nav filtered by capabilities; ProtectedRoute accepts capability.
5. Tests: finance cannot `settings.write`; support cannot `payouts.pay`; moderator cannot `accounts.admins.manage`; super-admin can.

**Phase 37 — Rights quality + ledger (shipped)**

1. Shared: `documented` copyright; `creationClaim`; `copyrightAuthoritySufficient`; likeness quality `claimed|documented|verified`; public mark only at `verified`.
2. Schema: `Photo.creationClaim` / `uploadedById`; `PhotoAppearance.consentQuality`; `RightsLedgerEvent`; `guardianAuthorizedAt` write path.
3. API: commercial eligibility refuses claimed/documented third-party copyright; `GET /admin/content/:id/rights-ledger`; contributor own-photo ledger; guardian authorize; report filings freeze and dispute the matching track.
4. UI: admin content sheet shows quality, ledger, guardian write; public “Rights Verified ✓” only at the verified rung.
5. Tests: self-created claimed still commercial; third-party claimed is not; PDF is documented not verified; finance 403 on ledger; guardian write lands on the ledger.

Do not ship model-upload in the same PRs. Ops can use staff ACL while rights work continues.

---

## 5. Model registration and upload (Phase 38 — after 37)

### 5.1 Registration

- Add `model` to **public** register (Africa **not** required).
- Model agreement (new versioned document) — representations and warranties, indemnity, “claim ≠ verification”, VueKumi may contact named photographers, data used only for rights clearance until they opt into an account.
- Photographer invite path **stays**. Dual-role **stays**.
- Admin/agency still cannot become models.
- OAuth signup remains members-only (existing rule).

### 5.2 Upload

New model portal section (`/model/upload` + `/model/photos/:id`), **not** the photographer commercial editor.

Submit requires:

1. Stage 1 screening (same `screening.ts`).
2. Creation claim (five answers).
3. Own likeness consent for the uploading model (they are in the photo, or they declare they are not — if not, they are a copyright claimant only and still need photographer dual-role for commercial).
4. If another photographer: contact fields → VueKumi Route B mirror (`CopyrightAuthorization`).
5. Optional document upload → quality `documented`, never `verified`.
6. Permission state defaults to `portfolio`. Commercial state refused until both tracks verify **and** commercial scopes are granted.

Self-shot commercial path: prompt to accept the **photographer** agreement on the same email (create `ContributorProfile`, Africa required at that moment, `canEnterCommercialInventory` true for that user). `accountType` stays `model` (mirror of photographer dual-role staying `photographer`).

### 5.3 Guest photographer rights page

Mirror `JoinModel.tsx` / `POST /model/invite/:token/decide`:

- Approve display
- Approve commercial sublicensing through VueKumi
- Reject
- Not me
- Unauthorized (dispute)

Token not consumed on GET. PII of the model limited. First email/SMS explains the photographer was identified by the model and this is rights clearance, not a marketing list.

### 5.4 Catalog / earnings

- Model-uploaded photos appear on `/m/:handle` when display is allowed.
- They do **not** enter stock search until commercially eligible under §3.3.
- `contributorId` set when the copyright owner is a VueKumi photographer user; payouts follow that user.
- Models still `earns: false` on the model profile.

---

## 6. Enforcement, money, legal overlays (Phases 39–40)

### Phase 39 — DMCA, repeat infringer, payout holds

| Piece | Plan |
| --- | --- |
| Public DMCA page | Designated agent name, address, email, phone (values from Admin Settings; **Copyright Office filing is ops/counsel**, not a code task) |
| Notice intake | Structured form → `DmcaNotice` row → auto `disputed` + commercial lock on named photos; ops email that someone **reads** |
| Counter-notice | Stored; restore only after statutory wait **and** staff action — do not auto-relitigate |
| Repeat infringer | Strike on upheld copyright/likeness fraud (fake release, fake photographer, false “I created this”); thresholds in settings; termination of account; seed a documented policy |
| Payout holds | New ledger `held`; auto-hold on disputed photos’ unpaid earnings; hold window/settings for new/unverified sellers and high-value grants; trusted-creator fast path later, not v1 |
| Fix | `GET /contributor/earnings` must allow `photographer` (today 403) |

DMCA is **copyright only**. Likeness/privacy/contract complaints stay on the existing rights-report path. Do not tell staff “DMCA covers everything.”

### Phase 40 — Legal architecture (docs + engine hooks, counsel-gated copy)

```
              VUEKUMI / VUEQUATRO  (U.S. company)
                         │
              U.S. platform compliance
              (contract home + federal: Copyright Act, FTC, §512)
                         │
              VueKumi Global Rights Standard  ← product engine
                         │
            ┌────────────┼────────────┐
         Nigeria       Kenya      South Africa  …launch set
         overlay       overlay     overlay
```

**In product (can ship as data, not as “we are your lawyer”):**

- `LegalOverlay` per ISO country: contributor allowed, data-transfer notice, commissioned-photo prompt, biometric forbidden flag.
- Launch set of contributor countries stays the current Africa list for **creators**; overlays filled first for a **priority subset** (recommend NG, GH, KE, ZA, RW, TZ, UG, SN) with a fallback “standard + extra notice” for the rest.
- Registration and Route B copy: “only provide this contact for rights clearance”; first message names the supplier; no marketing list.
- Agreement stack (versioned, stored on every decision): Terms, Photographer, Community Contributor, **Model**, **Copyright authorization** (photographer guest), **Model release** (existing), Buyer licence. Each records version + timestamp.
- Consent withdrawal: future uses stop; **already granted licences are not silently voided** — that rule must be in the model/photographer agreements before we change the consent UI. Until counsel signs the sentence, the engine keeps: revoke → new sales locked, past grants remain, dispute if they contest a past grant.

**Not in these phases:** insurance procurement, incorporating VueQuatro as a separate contracting party, rewriting 54 national contracts, “U.S. law only” clauses.

Phase 34 (AI-training) remains after this arc unless redirected.

---

## 7. Sequence and dependencies

```
35 Admin account CRUD + photographers list + agency activate
        │
36 Admin capability ACL (uses 35 create-admin)
        │
37 Symmetric rights quality + eligibility tighten + ledger + guardian write
        │
38 Model public register + model upload + photographer contact mirror
        │
39 DMCA + strikes + payout holds
        │
40 Overlay module + versioned agreement hooks (copy still counsel)
```

35 and 36 do not wait on legal copy.  
38 **must not** start before 37 (otherwise model upload inherits “claimed = commercially cleared”).  
39 can overlap 38’s UI but should land before model upload is advertised as commercial.  
40 can be drafted in parallel as docs; engine hooks land with 37–38.

**Default next slice after approval: Phase 38.**

---

## 8. Implementation procedure (every phase)

Same discipline as Phases 16–33:

1. **Shared first** — enums, Zod schemas, DTOs in `packages/shared`.
2. **Prisma migration** — additive; never reuse `claimed` to mean `verified`.
3. **API** — routes + `requireAdminCapability` / rights guards + `AuditLog` on every privileged mutation.
4. **UI** — admin or model/photographer portal; hide unauthorized nav.
5. **Seed** — demo accounts for new paths (staff roles; a model-uploaded photo stuck on photographer contact; a verified self-shot).
6. **Tests** — unit guards for eligibility; inject tests for ACL 403s; rights tests that **claimed third-party copyright does not unlock commercial**.
7. **Docs** — update `01` shipped table and `03` honest-status row in the same PR.
8. **CI** — existing `db:migrate:deploy` + seed + `npm test`.
9. **Merge to `main`** when the phase is complete. `main` is the single source of truth.

Vertical slices. No “schema-only” PR that leaves the old eligibility function selling on `claimed` for third-party copyright.

### Suggested test anchors (Phase 37+)

- Photographer self-created, no people → commercial possible on `claimed` copyright (unchanged for that case).
- Photographer + recognizable person, model not verified → commercial locked (already true).
- Model upload, “photographer took it”, photographer has not decided → commercial locked even with model’s own commercial checkbox.
- Model upload, photographer verifies **display only** → portfolio allowed, checkout locked.
- Model upload, photographer verifies commercial sublicensing + model likeness verified → commercial enabled; earnings ledger `contributorId` is the photographer.
- Document upload without direct confirm → quality `documented`, public mark absent, commercial still locked if third-party copyright.
- Rights report on a verified image → `disputed` + freeze **before** staff resolve.

---

## 9. Explicitly out of Arc D

- Phase 34 AI-training licence / dataset pricing
- Inventing a model revenue share
- Biometric identification (Stage 3) as a rights grant
- Public face database
- Booking/production commissions
- A public VueQuatro app
- Stylists / MUA / crew types
- Auto-filing with the U.S. Copyright Office
- Treating DMCA as a shield for likeness claims
- Country-specific commercial eligibility **weaker** than the Global Rights Standard

---

## 10. Approval checklist

Reply with which of these is approved. Nothing in Arc D starts without a phase number.

- [ ] Locked rules in §0 (especially: third-party copyright never commercially cleared by declaration; models as subjects not Africa-gated; dual-role earnings as photographer only)
- [ ] Capability catalog in §4.2 (add/remove keys now — changing keys after 36 is a migration)
- [ ] Commercial eligibility matrix in §3.3
- [ ] Model public registration (vs stay invite-only **plus** upload for invited models only)
- [ ] Sequence: start at **Phase 35**
- [ ] Counsel track (parallel, not blocking 35–36): agreement stack, DMCA agent identity, withdrawal-vs-past-grants sentence

**Not approved in this document:** insurance, VueQuatro as a separate legal entity, Texas vs Delaware governing law, the exact repeat-infringer strike count (ship as a setting with a conservative default, e.g. 3 upheld strikes).
