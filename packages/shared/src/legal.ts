import { z } from 'zod'
import { isCreatorAccount } from './accounts.js'
import { commercialEligibilityBlock } from './rights.js'
import type { CopyrightStatus, CreationClaim, ModelConsentStatus } from './rights.js'

/** Priority counsel-fill set from Phase 40. The rest of Africa uses the standard overlay. */
export const PRIORITY_OVERLAY_COUNTRIES = ['NG', 'GH', 'KE', 'ZA', 'RW', 'TZ', 'UG', 'SN'] as const
export type PriorityOverlayCountry = (typeof PRIORITY_OVERLAY_COUNTRIES)[number]

export const LEGAL_OVERLAY_KINDS = ['priority', 'standard', 'buyer'] as const
export const legalOverlayKindSchema = z.enum(LEGAL_OVERLAY_KINDS)
export type LegalOverlayKind = z.infer<typeof legalOverlayKindSchema>

export const COUNSEL_STATUSES = ['placeholder', 'counsel_signed'] as const
export const counselStatusSchema = z.enum(COUNSEL_STATUSES)
export type CounselStatus = z.infer<typeof counselStatusSchema>

export const AGREEMENT_KINDS = [
  'terms',
  'photographer',
  'community',
  'photo_influencer',
  'model',
  'copyright_authorization',
  'model_release',
  'buyer_licence',
] as const
export const agreementKindSchema = z.enum(AGREEMENT_KINDS)
export type AgreementKind = z.infer<typeof agreementKindSchema>

export const TERMS_AGREEMENT_VERSION = '1.0-terms'
export const BUYER_LICENCE_AGREEMENT_VERSION = '1.0-buyer'
export const PHOTOGRAPHER_AGREEMENT_VERSION = '1.0'
export const COMMUNITY_AGREEMENT_VERSION = '1.0-community'
export const PHOTO_INFLUENCER_AGREEMENT_VERSION = '1.0-photo-influencer'
export const MODEL_UPLOADER_AGREEMENT_VERSION = '1.0-model'
export const COPYRIGHT_AUTHORIZATION_AGREEMENT_VERSION = '1.0'
export const MODEL_RELEASE_AGREEMENT_VERSION = '1.0'

export const AGREEMENT_STACK: {
  kind: AgreementKind
  version: string
  title: string
  counselStatus: CounselStatus
}[] = [
  { kind: 'terms', version: TERMS_AGREEMENT_VERSION, title: 'VueKumi Platform Terms', counselStatus: 'placeholder' },
  { kind: 'photographer', version: PHOTOGRAPHER_AGREEMENT_VERSION, title: 'VueKumi Photographer Licensing Agreement', counselStatus: 'placeholder' },
  { kind: 'community', version: COMMUNITY_AGREEMENT_VERSION, title: 'VueKumi Community Contributor Terms', counselStatus: 'placeholder' },
  { kind: 'photo_influencer', version: PHOTO_INFLUENCER_AGREEMENT_VERSION, title: 'VueKumi Photo Influencer Terms', counselStatus: 'placeholder' },
  { kind: 'model', version: MODEL_UPLOADER_AGREEMENT_VERSION, title: 'VueKumi Model Uploader Agreement', counselStatus: 'placeholder' },
  { kind: 'copyright_authorization', version: COPYRIGHT_AUTHORIZATION_AGREEMENT_VERSION, title: 'Copyright authorization (photographer guest)', counselStatus: 'placeholder' },
  { kind: 'model_release', version: MODEL_RELEASE_AGREEMENT_VERSION, title: 'Model release / likeness consent', counselStatus: 'placeholder' },
  { kind: 'buyer_licence', version: BUYER_LICENCE_AGREEMENT_VERSION, title: 'Buyer licence grant', counselStatus: 'placeholder' },
]

export const GLOBAL_RIGHTS_STANDARD = {
  name: 'VueKumi Global Rights Standard',
  contractingNote:
    'VueKumi / VueQuatro is a U.S. company. U.S. platform compliance (Copyright Act, FTC, §512) is the contract home. Country overlays add notice; they do not rewrite 54 national contracts and they never weaken this standard.',
  counselGated:
    'Agreement copy, DMCA Copyright Office filing, insurance, and any VueQuatro entity split remain counsel-gated. This page is the product engine, not legal advice.',
  rules: [
    'Photo copyright and likeness/model consent are independent tracks.',
    'Claim ≠ documented ≠ verified. Only verified gets a public Rights Verified mark.',
    'A third-party copyright declaration never unlocks commercial licensing.',
    'Display/portfolio permission is not commercial licensing permission.',
    'Typed name ≠ identity. Checkbox ≠ consent. PDF ≠ VueKumi-verified.',
    'VueKumi sells usage permission, not ownership.',
    'Models do not earn from likeness. Photographer 50% of paid licences is unchanged.',
    'Africa-only creators (photographer / photo influencer / community). Models as subjects are not Africa-restricted.',
    'Stage 1 AI is person detection only. Stage 3 biometric identification is forbidden without separate counsel-approved consent.',
    'AI-training consent is Phase 34 and remains off.',
    'DMCA is copyright only. Likeness stays on the rights-report path.',
    'Consent withdrawal locks new sales. Existing certificates are not silently voided. Contest a past grant with a rights report.',
    'Do not write “exclusively U.S. law regardless of the user’s country” into Terms.',
  ],
} as const

export const RIGHTS_CLEARANCE_CONTACT_COPY =
  'Only provide this contact for rights clearance. VueKumi will name who supplied it. This is not a marketing list.'

export const PRIORITY_LAW_LABEL: Record<PriorityOverlayCountry, string> = {
  NG: 'Nigeria NDPA',
  GH: 'Ghana Data Protection Act',
  KE: 'Kenya Data Protection Act',
  ZA: 'South Africa POPIA',
  RW: 'Rwanda Law on Data Protection',
  TZ: 'Tanzania Personal Data Protection Act',
  UG: 'Uganda Data Protection and Privacy Act',
  SN: 'Senegal Personal Data Protection Act',
}

export interface LegalOverlayDto {
  countryCode: string
  countryName?: string
  region?: string
  overlayKind: LegalOverlayKind
  contributorAllowed: boolean
  countryContributorEligible: boolean
  dataTransferNotice: string
  commissionedPhotoPrompt: string
  extraNotice: string | null
  biometricForbidden: boolean
  counselStatus: CounselStatus
  lawLabel: string | null
}

export interface LegalStandardDto {
  name: string
  contractingNote: string
  counselGated: string
  rules: readonly string[]
  priorityCountries: readonly string[]
  agreementStack: typeof AGREEMENT_STACK
  rightsClearanceContactCopy: string
  withdrawal: ReturnType<typeof consentWithdrawalEffect>
}

export const patchLegalOverlaySchema = z.object({
  dataTransferNotice: z.string().trim().min(8).max(4000).optional(),
  commissionedPhotoPrompt: z.string().trim().min(8).max(2000).optional(),
  extraNotice: z.string().trim().max(2000).optional().nullable(),
  biometricForbidden: z.boolean().optional(),
  contributorAllowed: z.boolean().optional(),
})
export type PatchLegalOverlayInput = z.infer<typeof patchLegalOverlaySchema>

export function isPriorityOverlayCountry(code?: string | null): code is PriorityOverlayCountry {
  return Boolean(code && (PRIORITY_OVERLAY_COUNTRIES as readonly string[]).includes(code.toUpperCase()))
}

export function overlayKindForCountry(input: {
  code: string
  region: string
  contributorEligible: boolean
}): LegalOverlayKind {
  if (isPriorityOverlayCountry(input.code)) return 'priority'
  if (input.region === 'africa' && input.contributorEligible) return 'standard'
  return 'buyer'
}

export function creatorAccountType(accountType?: string | null): boolean {
  return isCreatorAccount(accountType)
}

/**
 * Overlays may be stricter than the country table. They must never make a non-African
 * country creator-eligible. Models as subjects are not Africa-gated.
 */
export function creatorCountryAllowed(input: {
  accountType?: string | null
  countryContributorEligible: boolean
  overlayContributorAllowed: boolean
  region?: string | null
}): boolean {
  if (!creatorAccountType(input.accountType)) return true
  if (input.region && input.region !== 'africa') return false
  return input.countryContributorEligible && input.overlayContributorAllowed
}

export function overlayContributorAllowedBlocked(input: {
  region: string
  contributorEligible: boolean
  overlayContributorAllowed: boolean
}): string | null {
  if (!input.overlayContributorAllowed) return null
  if (input.region !== 'africa' || !input.contributorEligible) {
    return 'Country overlays cannot make a non-African country creator-eligible'
  }
  return null
}

export function biometricIdentificationBlocked(overlay: { biometricForbidden: boolean } | null | undefined): string | null {
  if (!overlay || overlay.biometricForbidden) {
    return 'Stage 3 biometric identification is forbidden. Stage 1 person detection remains screening only.'
  }
  return null
}

/** Stage 1 person detection is not biometric identification. */
export function overlayBlocksPersonDetection(_overlay: { biometricForbidden: boolean } | null | undefined): false {
  return false
}

export function consentWithdrawalEffect(): {
  lockNewSales: boolean
  voidPastGrants: boolean
  disputeIfContested: true
  copy: string
} {
  return {
    lockNewSales: true,
    voidPastGrants: false,
    disputeIfContested: true,
    copy: 'Withdrawing consent locks new licensing. Existing certificates are not silently voided. If you contest a past grant, file a rights report. Counsel has not signed a sentence that voids past grants.',
  }
}

/**
 * Country overlays never grant commercial licensing the Global Rights Standard would block.
 * There is no overlay.commercialEligible flag on purpose.
 */
export function overlayCannotClearCommercial(input: {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialLocked?: boolean
  creationClaim?: CreationClaim | null
}): string | undefined {
  return commercialEligibilityBlock(input)
}

export function placeholderDataTransferNotice(input: {
  countryName: string
  kind: LegalOverlayKind
  lawLabel?: string | null
}): string {
  const law = input.lawLabel ? ` ${input.lawLabel} may apply in addition to the Global Rights Standard.` : ''
  if (input.kind === 'buyer') {
    return `Placeholder (counsel-gated, not legal advice): Buyer personal data for ${input.countryName} may be processed by VueKumi, a U.S. company, to complete a licence. This is a product notice, not a signed transfer basis.`
  }
  return `Placeholder (counsel-gated, not legal advice): Creator personal data for ${input.countryName} may be processed by VueKumi, a U.S. company, for the account, rights clearance, and payouts.${law} This notice does not replace a signed transfer basis.`
}

export function placeholderCommissionedPhotoPrompt(): string {
  return 'If someone else commissioned this photograph, they may own the copyright. Name that person so VueKumi can contact them for rights clearance only — not a marketing list.'
}

export function placeholderExtraNotice(kind: LegalOverlayKind): string | null {
  if (kind !== 'standard') return null
  return 'This country uses the VueKumi Global Rights Standard plus this extra notice. Counsel has not signed a country-specific overlay. Do not treat this as legal advice. The Global Rights Standard still applies in full.'
}

export function agreementKindForAccountType(accountType: string): AgreementKind {
  if (accountType === 'contributor') return 'community'
  if (accountType === 'photo_influencer') return 'photo_influencer'
  if (accountType === 'model') return 'model'
  if (accountType === 'photographer') return 'photographer'
  return 'terms'
}
