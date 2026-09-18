import type { GrantLicenseType } from '@prisma/client'

export const CURRENT_AGREEMENT_VERSION = '1.0'
export const COMMUNITY_AGREEMENT_VERSION = '1.0-community'
export const PHOTO_INFLUENCER_AGREEMENT_VERSION = '1.0-photo-influencer'
export const MODEL_UPLOADER_AGREEMENT_VERSION = '1.0-model'

export const VUEKUMI_AGREEMENT = {
  version: CURRENT_AGREEMENT_VERSION,
  title: 'VueKumi Photographer Licensing Agreement',
  body: `Vuekumi is a marketplace for usage permission, not ownership.

1. Photo copyright rights. You retain copyright in every photograph you submit. The person who takes the photograph ordinarily owns that copyright. You warrant that you created the work or hold the exclusive right to license it through VueKumi.

2. Platform license. By accepting this agreement you grant Vuekumi a non-exclusive licence to host, display, market and sublicense the work to buyers under the licence types you enable. Vuekumi does not take ownership of your photographs.

3. Likeness / model release rights. Copyright in the photograph is separate from the depicted person's right to control use of their likeness. If a photograph shows a recognisable person, commercial licensing requires every required likeness right to be cleared. A photographer-provided signed release is supporting evidence, not automatically VueKumi-verified consent. VueKumi may contact the depicted person directly.

4. Two rights. (1) Photo copyright rights belong to the photographer. (2) Likeness / model release rights belong to the person depicted. Commercial eligibility = copyright cleared + required likeness rights cleared.

5. Four layers at sale. Every sale checks (1) photo copyright, (2) likeness/model release where required, (3) this photographer agreement, and (4) a buyer licence grant. AI person detection is a screening mechanism; it does not decide whether consent legally exists.

6. Exclusive. Exclusive sale is opt-in per photograph. Once an exclusive licence is granted, Vuekumi delists the image from further sale.

7. Rights-managed. Custom territory, duration and channel deals are quoted — they are not a fixed price.

8. Revenue. Premium and paid licences split 50/50 between the photographer and Vuekumi after payment clears. Models do not earn from licences.

9. Africa-only photographers. Only professional photographers based in African Union member states may license commercial inventory. Buyers may be anywhere.`,
}

export const COMMUNITY_CONTRIBUTOR_AGREEMENT = {
  version: COMMUNITY_AGREEMENT_VERSION,
  title: 'VueKumi Community Contributor Terms',
  body: `Vuekumi community contributors share photographs for portfolio, editorial and community use. This is not the professional photographer commercial inventory path.

1. Photo copyright rights. You retain copyright in work you upload and warrant that you created it or have the right to share it.

2. No commercial stock. Community contributor uploads default to portfolio. They cannot be commercially licensed as VueKumi stock until you register as a professional photographer and complete photographer rights clearance.

3. Likeness. If a photograph shows a recognisable person, it stays out of commercial inventory. VueKumi does not treat an upload as consent from anyone depicted.

4. Africa-only. Community contributors must be based in African Union member states.

5. Usage permission. Vuekumi hosts and displays community work under these terms. A download is not ownership.`,
}

export const PHOTO_INFLUENCER_AGREEMENT = {
  version: PHOTO_INFLUENCER_AGREEMENT_VERSION,
  title: 'VueKumi Photo Influencer Terms',
  body: `Vuekumi photo influencers are social and discovery creators. This is not the professional photographer commercial inventory path, and it is not a community contributor account.

1. Separate account type. Photographers and photo influencers cannot be mixed or converted on the same email. Requirements, agreements, and admin surfaces are distinct.

2. Photo copyright rights. You retain copyright in work you upload and warrant that you created it or have the right to share it.

3. No commercial stock. Photo influencer uploads are for portfolio, editorial, and discovery. They cannot be commercially licensed as VueKumi stock. Do not invent a new earnings share for this role.

4. Likeness. If a photograph shows a recognisable person, it stays out of commercial inventory. VueKumi does not treat an upload as consent from anyone depicted.

5. Africa-only. Photo influencers must be based in African Union member states.

6. Usage permission. Vuekumi hosts and displays this work under these terms. A download is not ownership.`,
}

export const MODEL_UPLOADER_AGREEMENT = {
  version: MODEL_UPLOADER_AGREEMENT_VERSION,
  title: 'VueKumi Model Uploader Agreement',
  body: `Vuekumi models may register and upload photographs. This is not a photographer commercial inventory path unless you also accept the photographer licensing agreement on the same email.

1. Two independent rights. Photo copyright and likeness / model consent are separate. Whoever uploads must prove the rights they do not personally control. A claim is not documented evidence, and documented evidence is not VueKumi-verified.

2. Representations. You warrant that you have the right to upload each photograph for the usage you select, that contact details you supply for photographers are accurate and provided only for rights clearance, and that you indemnify VueKumi against false claims.

3. VueKumi may contact named photographers. First contact is a rights-clearance notice, not a marketing list. Photographer contact details are not shown to other users.

4. Display is not commercial licensing. Portfolio or editorial permission does not unlock stock sale. Commercial licensing requires VueKumi-verified copyright (including the photographer's confirmation when another person may own the work) and VueKumi-verified likeness where people appear, plus commercial scopes.

5. Self-shot commercial path. If you took the photograph yourself, commercial stock still requires the photographer licensing agreement, an African Union country, and a contributor profile on this same email. Your account type stays model. You then earn the photographer 50% as photographer, not as model.

6. Models do not earn from likeness. The photographer/model/platform split remains undecided.

7. Africa. Models as subjects are not Africa-restricted. Africa is required only if you accept the photographer agreement to enter commercial inventory.

8. Usage permission, not ownership. VueKumi hosts, displays, and — only when both rights tracks verify and commercial scopes are granted — sublicenses usage. AI-training consent is not included.`,
}

export const TERMS_AGREEMENT = {
  version: '1.0-terms',
  kind: 'terms',
  title: 'VueKumi Platform Terms',
  counselStatus: 'placeholder',
  body: `Placeholder (counsel-gated, not legal advice). VueKumi is a U.S. company. These terms are product rules the engine enforces; they are not signed counsel copy.

1. VueKumi sells usage permission, not ownership.
2. Photo copyright and likeness consent are independent. Claim ≠ documented ≠ verified.
3. Do not read this as “exclusively U.S. law regardless of the user’s country.” Country overlays add notice. They never weaken the VueKumi Global Rights Standard.
4. DMCA covers copyright only. Likeness, privacy, and contract complaints use the photograph report.
5. AI-training consent is not included (Phase 34 parked).
6. Existing licence certificates are not silently voided if consent is later withdrawn. New licensing stops. Contest a past grant with a rights report.`,
}

export const BUYER_LICENCE_AGREEMENT = {
  version: '1.0-buyer',
  kind: 'buyer_licence',
  title: 'Buyer licence grant',
  counselStatus: 'placeholder',
  body: `Placeholder (counsel-gated, not legal advice). This grant is usage permission, not ownership of the photograph.

1. The licence type on the certificate is the scope. It is not a transfer of copyright.
2. AI-training use is not included.
3. VueKumi verified rights at the time of grant. A later consent withdrawal does not silently void this certificate. A dispute uses the rights-report path.
4. Models do not earn from this grant. Photographer revenue share is 50% of paid licences.`,
}

export function agreementForAccountType(accountType: string) {
  if (accountType === 'contributor') return COMMUNITY_CONTRIBUTOR_AGREEMENT
  if (accountType === 'photo_influencer') return PHOTO_INFLUENCER_AGREEMENT
  if (accountType === 'model') return MODEL_UPLOADER_AGREEMENT
  if (accountType === 'user' || accountType === 'agency') return TERMS_AGREEMENT
  return VUEKUMI_AGREEMENT
}

export function agreementVersionForAccountType(accountType: string) {
  return agreementForAccountType(accountType).version
}

export interface LicenseCatalogItem {
  id: GrantLicenseType
  type: GrantLicenseType
  name: string
  description: string
  defaultUsd: number
  points: string[]
  commercialAllowed: boolean
  requiresModelRelease: boolean
  agencyPreferred: boolean
  quoteOnly: boolean
  exclusiveOptIn: boolean
  sortOrder: number
  active: boolean
}

export const LICENSE_CATALOG: LicenseCatalogItem[] = [
  {
    id: 'royalty_free',
    type: 'royalty_free',
    name: 'Royalty-Free',
    description: 'Standard usage permission for personal and commercial work. You do not own the image.',
    defaultUsd: 0,
    points: [
      'Personal & commercial use',
      'Attribution appreciated',
      'Standard resolution',
      'Usage permission — not ownership',
    ],
    commercialAllowed: true,
    requiresModelRelease: true,
    agencyPreferred: false,
    quoteOnly: false,
    exclusiveOptIn: false,
    sortOrder: 10,
    active: true,
  },
  {
    id: 'commercial',
    type: 'commercial',
    name: 'Commercial',
    description: 'Full-resolution commercial licence. The photographer earns 50%.',
    defaultUsd: 12,
    points: [
      'Full resolution, no attribution',
      'Print runs up to 500,000',
      'Photographer earns 50%',
      'Usage permission — not ownership',
    ],
    commercialAllowed: true,
    requiresModelRelease: true,
    agencyPreferred: false,
    quoteOnly: false,
    exclusiveOptIn: false,
    sortOrder: 20,
    active: true,
  },
  {
    id: 'extended',
    type: 'extended',
    name: 'Extended Commercial',
    description: 'Merchandise, unlimited print and broadcast. The photographer earns 50%.',
    defaultUsd: 49,
    points: [
      'Merchandise & resale of end products',
      'Unlimited print runs',
      'Broadcast & out-of-home',
      'Usage permission — not ownership',
    ],
    commercialAllowed: true,
    requiresModelRelease: true,
    agencyPreferred: false,
    quoteOnly: false,
    exclusiveOptIn: false,
    sortOrder: 30,
    active: true,
  },
  {
    id: 'editorial',
    type: 'editorial',
    name: 'Editorial',
    description: 'News, commentary and education only. Not for advertising.',
    defaultUsd: 8,
    points: [
      'News, commentary, education',
      'Not for advertising or merchandise',
      'Model release not required',
      'Usage permission — not ownership',
    ],
    commercialAllowed: false,
    requiresModelRelease: false,
    agencyPreferred: false,
    quoteOnly: false,
    exclusiveOptIn: false,
    sortOrder: 40,
    active: true,
  },
  {
    id: 'rights_managed',
    type: 'rights_managed',
    name: 'Rights-Managed',
    description: 'Quoted by scope: territory, duration and channels. Agency preferred.',
    defaultUsd: 0,
    points: [
      'Custom territory, duration, channels',
      'Quoted — not a fixed price',
      'Preferred for agencies',
      'Usage permission — not ownership',
    ],
    commercialAllowed: true,
    requiresModelRelease: true,
    agencyPreferred: true,
    quoteOnly: true,
    exclusiveOptIn: false,
    sortOrder: 50,
    active: true,
  },
  {
    id: 'exclusive',
    type: 'exclusive',
    name: 'Exclusive',
    description: 'Sole licensed use of this photograph. The image is delisted after sale.',
    defaultUsd: 499,
    points: [
      'Sole licensed use of this photo',
      'Image is delisted after sale',
      'Contributor must opt in',
      'Usage permission — not ownership',
    ],
    commercialAllowed: true,
    requiresModelRelease: true,
    agencyPreferred: true,
    quoteOnly: false,
    exclusiveOptIn: true,
    sortOrder: 60,
    active: true,
  },
]
