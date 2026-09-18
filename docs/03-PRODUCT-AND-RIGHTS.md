# VueKumi / VueQuatro — product concept and rights operating model

Recovered from the May 17–18 2026 project discussion, then checked against the code
that shipped through Phase 19 (September 2026).

**This document is doctrine, not a build ticket.** Nothing here starts until explicitly
approved. Numbers that were never signed off (photographer/model splits, booking fees,
exclusivity premiums, AI-dataset prices) are marked **undecided** and are not invented.

---

## 1. What VueKumi is

VueKumi is not “African Unsplash.” It is **African visual identity infrastructure**.

The intended stack of businesses, in order:

Stock media → creator discovery → African talent → commercial licensing → brand production →
distribution/API → consented AI datasets.

The original problem: imagery that represents Africa online is often generic, stereotypical,
tourism- or poverty-focused, foreign-produced, or unusable for ordinary commercial work.
African and international buyers need photographs of professionals, families, technology,
business, fashion, food, finance, education, cities, nightlife, healthcare, entrepreneurs,
students, luxury, middle-class life, and day-to-day culture — **commercially cleared**.

Unsplash’s lesson was kept: free high-quality discovery drives adoption and SEO; curation
and search make the library useful; APIs expand distribution; monetisation follows. The
Unsplash weakness was also kept: contributors generate platform value and often earn little.
VueKumi differentiates by **building contributor (and later model) monetisation into the
system**, not treating photographs as anonymous commodities.

Nueve Technologies explored this as an **additional** opportunity. SquadPay stays a separate
product. VueKumi does not replace it.

---

## 2. VueKumi vs VueQuatro

The split is deliberate:

| Layer | Role |
| --- | --- |
| **VueKumi** (`vuekumi.com`) | Marketplace and creator-facing platform. Photographers upload, models (later) build profiles, images become discoverable, buyers license usage, brands discover and eventually book talent. |
| **VueQuatro** | Parent / company layer. Rights administration, licensing infrastructure, copyright protection, commercial representation, and potentially model/creator agency services. |

VueKumi is the scalable technology and marketplace. VueQuatro is the higher-touch rights and
agency infrastructure behind it. Early product work lives on VueKumi; VueQuatro surfaces
appear when representation, agency-protected inventory, and enforcement are real.

---

## 3. Four rights layers (the central rule)

**Uploading gives VueKumi possession of a file. It does not automatically give VueKumi the
legal right to commercially exploit everything represented in that file.**

Commercial rights are unlocked progressively by verification, ownership representations, and
consent.

| Party | What they control |
| --- | --- |
| Photographer | Copyright in the photograph (normally remains with the photographer). |
| Model / depicted person | Permission relating to likeness, image, and commercial use. |
| VueKumi / VueQuatro | Contractual licence to host, display, market, sublicense where authorised, collect money, enforce terms, and protect the work. **Not blanket copyright ownership.** |
| Buyer | A **defined usage licence**. A download is not ownership and is not unlimited. |

Photographer ownership ≠ model consent ≠ platform distribution rights ≠ buyer usage rights.

This exists specifically to avoid the stock-platform mistake: “uploaded” does not mean
“commercially cleared.”

The photographer licensing agreement already in code (`apps/api/src/data/licenses.ts`) states the same
four layers. Photographers and community contributors are separate account types. Photo
copyright rights and likeness / model-release rights are tracked separately; commercial
licensing unlocks only after both required rights are cleared (see §8).

---

## 4. The two-approval rule

For a photograph classified as showing a recognisable person, **commercial listing requires
approval from both the photographer and the model.**

Photographer upload alone is not enough. If either party does not approve, the platform
cannot sell the image as commercially cleared stock.

Photographer approval + Model approval = potentially commercially licensable.

The model’s likeness rights do **not** transfer copyright to the model. The photographer
cannot commercially exploit the likeness without permission. Neither party can independently
license the other’s right.

Self-shot creators (self-portrait, tripod, influencer content) may occupy **both roles on
one account**. The product must not force a fake photographer/model split onto that work.

---

## 5. An image can exist without becoming stock

Do not delete every photograph that lacks commercial approval. Permission is a **status**,
not a binary public/private flag.

Intended states (names can be refined in UI):

| State | Meaning |
| --- | --- |
| Private | Only the uploader (and staff) can see it. |
| Portfolio-only | Visible on the creator’s profile; not stock inventory. |
| Editorial | Licensable for news/commentary/education; not advertising. |
| Restricted | Specific channels, territories, or parties blocked. |
| Commercial | Cleared for commercial stock licences. |
| Exclusive | Opt-in sole licensed use; delisted after sale. |
| Agency-protected | VueQuatro representation / restricted marketplace handling. |

“Not commercial” means commercial rights unavailable — editorial or portfolio restrictions
may still apply.

---

## 6. Model identity must be real

A photographer typing “Model: Jane Doe” proves nothing: that Jane exists, that she is the
person in the frame, that she authorised the upload, or that she granted commercial rights.

A checkbox plus an uploaded PDF is **not** sufficient protection for commercial licensing.

Until the depicted person has a verified VueKumi identity and has consented, commercial
rights stay locked.

### Invite-the-model (growth + compliance)

Do not make the photographer obtain a paper release off-platform and upload a PDF as the
primary path.

Intended flow:

1. Photographer uploads the photograph and identifies the person(s) in it.
2. VueKumi invites that person to claim or create a profile.
3. They confirm they are the person depicted, approve or reject the image,
   and choose acceptable usages. Membership is not required to decide.
4. Models do not earn from licences. The photographer share of paid licences stays 50%.

Compliance is also acquisition: photographers bring models to clear images; models claim
portfolios; models bring other photographers.

### Visual verification

Likeness matching may help confirm that the person approving is the person depicted.

Hard limits:

- Voluntary, consented, privacy-minimising. Not “scan everyone’s face forever.”
- Public profile ≠ internal verification record.
- **AI similarity cannot grant commercial rights.** Technology verifies identity; it cannot
  manufacture permission.

Phase 28 ships that opt-in check. Commercial licensing of recognisable people is still
gated by two-party approval. A visual result cannot manufacture permission.

---

## 7. Records, reporting, and AI

Behind every commercially cleared image the valuable object is:

photograph + verified provenance + verified participants + recorded permissions.

Conceptual rights record: photographer identity, upload provenance, copyright representation,
declared/detected people, invitations, identity verification, approve/reject, consent
date/version, permitted usage, restrictions, licensing history, disputes/takedowns.

The platform still needs: rights reporting, takedown, dispute handling, uploader
representations, consent records, and an internal review trail. Commercial licensing cannot
depend solely on “the uploader said it was okay.”

**AI / training rights are a separate consent**, not silently included in a standard
commercial or royalty-free grant. Africa is underrepresented in training sets; a consented
library is a future revenue line only if creators and models can opt in (and, later, earn).

---

## 8. What production actually does today (honest)

Shipped through the photographer / likeness-rights overhaul plus Phases 29–33, the marketplace is a **stock + licensing MVP** with distinct **photographer** (professional commercial inventory), **photo influencer** (social/discovery, not commercial stock), and **community contributor** (portfolio/editorial) accounts. Photographers and photo influencers are never mixed.

| Doctrine | In production now |
| --- | --- |
| Photographer keeps copyright; VueKumi gets a platform licence | Yes — photographer licensing agreement + copyright attestation (`COPYRIGHT_STATUS`) |
| Buyer receives a usage licence, not ownership | Yes — RF / Commercial / Extended / Editorial / RM quotes / Exclusive opt-in; certificates |
| Four layers checked at grant time | Yes — photo copyright rights, likeness / model release rights where required, platform agreement, then grant. A photographer-provided PDF is not VueKumi-verified consent. |
| Model is a first-class account | **Yes** — invite-only `model`. Photographers may add a `ModelProfile` on the same email. Community contributors are a sixth public type and cannot enter commercial inventory. |
| Two-party approval | **Yes** — `COMMERCIAL_ELIGIBILITY = copyright cleared + required likeness rights cleared`. Multi-model photos stay locked until every required consent is approved. |
| Invite-the-model | **Yes** — photographer supplies name, email and private mobile; VueKumi contacts the model. Guest approve / reject / not me / unauthorized. Membership is not required to decide. |
| Permission states (portfolio / editorial / restricted / agency-protected) | **Yes** — `PermissionState` on each photo; catalog is stock states; profile can show portfolio |
| Self-shot dual role | **Yes** — photographer confirms likeness and usage on their own photograph. `accountType` stays `photographer`. |
| Public model portfolio | **Yes** — `/m/:handle` and `/models`. Public pages may show **Model Release Verified ✓**. They never show the model's phone, email, or documents. |
| Visual verification | **Yes** — Stage 1 is automatic person detection (no identity, no face geometry). Stage 2 is photographer/model supplied identity. Stage 3 is the opt-in likeness check. Similarity cannot grant commercial rights. |
| Public report / takedown | **Yes** — anyone can report; staff can freeze new licensing without delisting |
| VueQuatro product surface | **Yes** (Phase 31) — a staff mode, not a second app. Contributors opt in to representation; staff approve, decline, or end it, and either side can end it. Only represented contributors can have photographs marked `agency_protected`; those photographs leave self-serve checkout and buyers send licensing inquiries that staff handle at `/admin/representation`. **No representation commission** (rate undecided) and copyright never moves. Ending representation reverts protected photographs to portfolio-only — no clearance is invented. |
| Photo influencer role | **Yes** — first-class `accountType: photo_influencer`. Own signup card, own admin Users list (`/admin/influencers`), own terms. Photographers and photo influencers cannot be mixed or converted. Photo influencers are Africa-only discovery creators and **cannot enter commercial stock**. Do not invent an influencer share. |
| Talent booking | **Yes** (Phase 30) — hire a photographer (`/hire/:handle`) or book a model (`/book/:handle`): brief → quote → accept/decline/withdraw, with availability and an optional indicative day rate on public profiles. Vuekumi records the agreement only. **No booking payments, no commission** — the rate is undecided, and booking money never touches the earnings ledger. Booking does not license any photograph. |
| Brand production | **Yes** (Phase 32) — campaign briefs at `/campaigns`: buyer/agency accounts post a brief (deliverables, usage, dates, indicative budget), contributors pitch with an optional rate, the brand accepts or declines, and the owner (or staff) closes the campaign. Vuekumi records everything; **no production payments, no commission** (rate undecided). Accepting a pitch licenses nothing — photographs are still licensed through checkout with every rights guard. |
| Partner/API distribution | **Yes** (Phase 33) — read-only `GET /api/partner/v1/photos[/:id]` behind admin-issued bearer keys (hash-stored, shown once, revocable, 120 req/min per key). Serves **cleared inventory only** (active + stock permission states; never private/portfolio/agency-protected), with attribution and licence flags computed by the same guards as checkout. Licences are granted on VueKumi, not by the API. Terms explicitly **forbid AI training** — no AI-training consent exists. |
| Separate AI-training consent | **No** |
| Model share of royalties | **Undecided** — Phase 24 recorded that models do not earn. Ledger still pays the photographer 50% of paid licences. |

Rights-managed products `requiresModelRelease: true`, same as other commercial grants.
Two-approval commercial lock shipped in Phase 25. Self-shot dual role shipped in Phase 26.
Public model portfolio shipped in Phase 27. Opt-in visual verification shipped in Phase 28.
Photo influencer is a separate account type. Talent booking (no payments, no
commission) shipped in Phase 30. VueQuatro representation (opt-in, no commission, staff
mode only) shipped in Phase 31. Brand production campaigns (no payments, no commission)
shipped in Phase 32. Partner distribution API (read-only, cleared inventory, no
AI-training use) shipped in Phase 33.

---

## 9. Initial creator roles (launch focus)

Keep v1 of the identity graph to:

1. Photographers (professional commercial inventory; `accountType: photographer`)
2. Community contributors (portfolio / editorial sharing; not commercial stock)
3. Models (invite-only accounts; claim, confirm likeness, approve/reject usage per image)
4. Photo influencers (social/discovery creators; `accountType: photo_influencer` — not a photographer kind)

Stylists, MUAs, directors, production crews come later. The first network to establish is
**photographer–model–image**.

Profiles are part of the asset: a photographer portfolio (`/p/:handle`), and a model
portfolio (`/m/:handle`) assembled from images they approved across photographers. That is
how stock becomes talent discovery
(“license this image” → “hire this photographer” / “book this model”). Booking shipped in
Phase 30: public profiles carry a hire/book CTA when the creator is available. A booking is
a recorded brief + quote + decision — it does not license photographs and it moves no money
through the platform.

---

## 10. Decisions that were **not** recovered

Do not treat these as already decided:

- Photographer vs model vs platform split when a model is a party to the sale
- Booking / production commission rates — Phases 30 and 32 shipped booking and campaigns
  with **zero** platform fee and off-platform settlement precisely because this number was
  never decided
- Exclusive premiums beyond the current default exclusive list price
- Vuekumi+ price as a long-term locked number (the live product has a Plus plan; treat
  pricing as revisable)
- Whether VueQuatro is a separate app, a legal entity only, or a VueKumi staff mode —
  Phase 31 shipped it as a staff mode without closing this question
- Representation commission — Phase 31 shipped representation with **zero** platform fee
  for the same reason booking has none: the number was never decided
- Biometric vendor / retention period for visual verification. Phase 28 uses the existing
  OpenAI vision key when present and does **not** keep the selfie. A dedicated vendor and a
  numbered retention window remain undecided; do not invent either.

Those are Phase-gate decisions immediately before the relevant build, not this document.

---

## 11. Proposed next arc (not shipped)

Staff ACL, model-as-uploader, claimed/documented/verified quality, Rights Ledger, DMCA,
and the U.S. + Global Rights Standard + country-overlay legal philosophy are **proposed**
in [`04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md`](./04-ADMIN-ACL-AND-SYMMETRIC-RIGHTS.md).
Phases 35–37 are shipped. Nothing in Phases 38–40 starts until you approve a phase. Models remain
invite-only and cannot upload until Phase 38. `AdminRole` is a capability preset (Phase 36).
Third-party copyright at `claimed` or `documented` never unlocks commercial licensing.
Staff can create and edit members, photographers, community contributors,
agencies, models, and **admins** from the portal; each staff user is limited to selected
features. Support cannot enter the photographer workspace unless given
`content.impersonate_creator`.

