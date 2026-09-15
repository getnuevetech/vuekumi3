import type { GrantLicenseType } from '@prisma/client'

export const CURRENT_AGREEMENT_VERSION = '1.0'

export const VUEKUMI_AGREEMENT = {
  version: CURRENT_AGREEMENT_VERSION,
  title: 'VueKumi Contributor Platform Agreement',
  body: `Vuekumi is a marketplace for usage permission, not ownership.

1. Copyright. You retain copyright in every photograph you submit. You warrant that you created the work or hold the exclusive right to license it.

2. Platform license. By accepting this agreement you grant Vuekumi a non-exclusive licence to host, display, market and sublicense the work to buyers under the licence types you enable. Vuekumi does not take ownership of your photographs.

3. Model and property rights. If a photograph shows a recognisable person, you must supply a model release before commercial, royalty-free, extended or exclusive licences can be sold. Editorial use may proceed without a release.

4. Four rights layers. Every sale checks (1) your copyright, (2) model rights where required, (3) this VueKumi agreement, and (4) a buyer licence grant. A live listing requires layers 1–3. A download requires layer 4.

5. Exclusive. Exclusive sale is opt-in per photograph. Once an exclusive licence is granted, Vuekumi delists the image from further sale.

6. Rights-managed. Custom territory, duration and channel deals are quoted — they are not a fixed price.

7. Revenue. Premium and paid licences split 50/50 between you and Vuekumi after payment clears.

8. Africa-only contributors. Only photographers based in African Union member states may contribute. Buyers may be anywhere.`,
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
