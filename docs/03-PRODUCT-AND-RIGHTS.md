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

The contributor agreement already in code (`apps/api/src/data/licenses.ts`) states the same
four layers. The **enforcement path for model rights does not yet match this doctrine**
(see §8).

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
3. They verify identity, confirm they are the person depicted, approve or reject the image,
   and choose acceptable usages.
4. They may then earn from the image (split **undecided**).

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

Shipped through Phase 28, the marketplace is a **stock + licensing MVP** with photographer
accounts, photo permission states, invite-only model accounts, self-shot dual role, a
two-approval commercial lock, public model portfolios, and an opt-in visual likeness check
that cannot grant rights. Models do **not** earn and do **not** gain copyright.

| Doctrine | In production now |
| --- | --- |
| Photographer keeps copyright; VueKumi gets a platform licence | Yes — contributor agreement + upload attestation |
| Buyer receives a usage licence, not ownership | Yes — RF / Commercial / Extended / Editorial / RM quotes / Exclusive opt-in; certificates |
| Four layers checked at grant time | Yes — copyright flag, two-party model clearance where required, platform agreement, then grant. PDF status is supporting evidence. |
| Model is a first-class account | **Yes** — fifth type `model`, invite-only. User→model upgrade is allowed. Photographers may add a `ModelProfile` on the same email (Phase 26). Admin/agency cannot. Public registration cannot create `model`. |
| Two-party approval | **Yes** — commercial-class licences (`requiresModelRelease`) of people photographs need every appearance approved with confirmed likeness and commercial usage. Empty appearances block commercial. Editorial products stay offered. Admin `verify-process` records that staff checked the process; it cannot invent clearance. |
| Invite-the-model | **Yes** — contributor names a person; VueKumi emails a claim link. Typed name is not identity. Checkbox is not consent. Photographers cannot invite their own email; they self-identify instead. |
| Permission states (portfolio / editorial / restricted / agency-protected) | **Yes** — `PermissionState` on each photo; catalog is stock states; profile can show portfolio |
| Self-shot dual role | **Yes** — photographer confirms likeness and usage on their own photograph. `accountType` stays `contributor`. |
| Public model portfolio | **Yes** — `/m/:handle` and `/models` list photographs a model approved with confirmed likeness. Copyright stays with the photographer. No booking CTA. |
| Visual verification | **Yes** — opt-in per photograph. Model uploads a selfie; Vuekumi compares it to the photograph (OpenAI vision when a key is in Admin Settings, otherwise records `unavailable`), stores a discrete result, and discards the selfie. No embedding store. Public profile does not show the check. **Similarity cannot grant commercial rights.** |
| Public report / takedown | **Yes** — anyone can report; staff can freeze new licensing without delisting |
| VueQuatro product surface | **No** — `agency_protected` is a not-stock label, not a second product |
| Photo influencer role | **No** |
| Talent booking | **No** |
| Partner/API distribution | **No** |
| Separate AI-training consent | **No** |
| Model share of royalties | **Undecided** — Phase 24 recorded that models do not earn. Ledger still pays the photographer 50% of paid licences. |

Rights-managed products `requiresModelRelease: true`, same as other commercial grants.
Two-approval commercial lock shipped in Phase 25. Self-shot dual role shipped in Phase 26.
Public model portfolio shipped in Phase 27. Opt-in visual verification shipped in Phase 28.

---

## 9. Initial creator roles (launch focus)

Keep v1 of the identity graph to:

1. Photographers (already live as `contributor`)
2. Models (invite-only accounts; claim, confirm likeness, approve/reject usage per image)
3. Photo influencers (social/discovery creators; not built)

Stylists, MUAs, directors, production crews come later. The first network to establish is
**photographer–model–image**.

Profiles are part of the asset: a photographer portfolio (`/p/:handle`), and a model
portfolio (`/m/:handle`) assembled from images they approved across photographers. That is
how stock becomes talent discovery
(“license this image” → “hire this photographer” / “book this model”). Booking itself is
still Phase 30 — the public model page licenses photographs, it does not book talent.

---

## 10. Decisions that were **not** recovered

Do not treat these as already decided:

- Photographer vs model vs platform split when a model is a party to the sale
- Booking / production commission rates
- Exclusive premiums beyond the current default exclusive list price
- Vuekumi+ price as a long-term locked number (the live product has a Plus plan; treat
  pricing as revisable)
- Whether VueQuatro is a separate app, a legal entity only, or a VueKumi staff mode
- Biometric vendor / retention period for visual verification. Phase 28 uses the existing
  OpenAI vision key when present and does **not** keep the selfie. A dedicated vendor and a
  numbered retention window remain undecided; do not invent either.

Those are Phase-gate decisions immediately before the relevant build, not this document.
