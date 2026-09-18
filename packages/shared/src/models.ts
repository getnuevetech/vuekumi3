import { z } from 'zod'
import {
  commercialEligibilityBlock,
  identifyAppearanceSchema,
  rollupModelConsentStatus,
  type AppearanceDecisionKind,
  type ModelConsentStatus,
  type ReleaseVerificationLevel,
  type SubjectAgeClass,
} from './rights.js'

export { identifyAppearanceSchema }

export const MODEL_APPEARANCE_STATUSES = [
  'identified',
  'invited',
  'claimed',
  'approved',
  'rejected',
] as const

export const modelAppearanceStatusSchema = z.enum(MODEL_APPEARANCE_STATUSES)
export type ModelAppearanceStatus = z.infer<typeof modelAppearanceStatusSchema>

export const MODEL_USAGE_PREFERENCES = ['none', 'editorial', 'commercial'] as const
export const modelUsagePreferenceSchema = z.enum(MODEL_USAGE_PREFERENCES)
export type ModelUsagePreference = z.infer<typeof modelUsagePreferenceSchema>

export const decideAppearanceSchema = z.object({
  confirmedLikeness: z.boolean(),
  status: z.enum(['approved', 'rejected', 'not_me', 'unauthorized']),
  usage: modelUsagePreferenceSchema.optional(),
  acceptReleaseTerms: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const selfShotAppearanceSchema = decideAppearanceSchema.extend({
  displayName: z.string().trim().min(2).max(120).optional(),
})

export const acceptModelInviteSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).optional(),
})

export const LIKENESS_CHECK_STATUSES = [
  'similar',
  'not_similar',
  'inconclusive',
  'unavailable',
] as const
export const likenessCheckStatusSchema = z.enum(LIKENESS_CHECK_STATUSES)
export type LikenessCheckStatus = z.infer<typeof likenessCheckStatusSchema>

export const verifyLikenessSchema = z.object({
  consented: z.literal(true),
  imageBase64: z.string().min(20).max(6_000_000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export type VerifyLikenessInput = z.infer<typeof verifyLikenessSchema>

export interface LikenessCheckDto {
  status: LikenessCheckStatus
  consentedAt: string
  comparedAt: string
  provider: 'openai' | 'none'
  referenceDeleted: true
  notes?: string | null
}

export type IdentifyAppearanceInput = z.infer<typeof identifyAppearanceSchema>
export type DecideAppearanceInput = z.infer<typeof decideAppearanceSchema>
export type SelfShotAppearanceInput = z.infer<typeof selfShotAppearanceSchema>
export type AcceptModelInviteInput = z.infer<typeof acceptModelInviteSchema>

export interface PhotoAppearanceDto {
  id: string
  photoId: string
  photoTitle?: string
  photoSrc?: string
  photographerName?: string
  displayName: string
  inviteEmail?: string | null
  inviteMobile?: string | null
  status: ModelAppearanceStatus
  consentStatus?: ModelConsentStatus
  decisionKind?: AppearanceDecisionKind | null
  usage: ModelUsagePreference
  confirmedLikeness: boolean
  modelHandle?: string | null
  invitedAt?: string | null
  claimedAt?: string | null
  decidedAt?: string | null
  inviteExpiresAt?: string | null
  consentVersion?: string | null
  selfShot?: boolean
  notes?: string | null
  verification?: LikenessCheckDto | null
  ageClass?: SubjectAgeClass
  isMinor?: boolean
  guardianAuthorized?: boolean
  releaseVerificationLevel?: ReleaseVerificationLevel | null
  consentQuality?: import('./rights.js').LikenessQuality
  modelReleaseVerified?: boolean
}

export function hasModelAccess(user: {
  accountType: string
  hasModelProfile?: boolean | null
}): boolean {
  return user.accountType === 'model' || Boolean(user.hasModelProfile)
}

export interface ModelInvitePreviewImageDto {
  appearanceId: string
  photoId: string
  photoTitle: string
  photoSrc?: string
  status: ModelAppearanceStatus
  consentStatus?: ModelConsentStatus
}

export interface ModelInvitePreviewDto {
  email: string
  displayName: string
  photoTitle: string
  photographerName: string
  expiresAt: string
  needsAccount: boolean
  membershipRequired: false
  shootTitle?: string | null
  shotOn?: string | null
  imageCount: number
  images: ModelInvitePreviewImageDto[]
  terms: string
}

export const MODEL_APPEARANCE_LABEL: Record<ModelAppearanceStatus, string> = {
  identified: 'Named only',
  invited: 'Invited',
  claimed: 'Claimed — awaiting decision',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const MODEL_USAGE_LABEL: Record<ModelUsagePreference, string> = {
  none: 'No usage',
  editorial: 'Editorial only',
  commercial: 'Editorial and commercial',
}

export const LIKENESS_CHECK_LABEL: Record<LikenessCheckStatus, string> = {
  similar: 'Similar — not a release',
  not_similar: 'Not similar — not a release',
  inconclusive: 'Inconclusive — not a release',
  unavailable: 'Check unavailable — not a release',
}

export const CONSENT_VERSION = '1.0'

/** Visual similarity is evidence for staff. It never unlocks a licence. */
export function likenessCheckGrantsRights(_status?: LikenessCheckStatus | null): false {
  return false
}

export const COMMERCIAL_CLASS_LICENSES = [
  'royalty_free',
  'commercial',
  'extended',
  'exclusive',
  'rights_managed',
] as const

export type TwoPartyAppearanceInput = {
  status: ModelAppearanceStatus
  usage: ModelUsagePreference
  confirmedLikeness: boolean
  consentStatus?: ModelConsentStatus | null
  isMinor?: boolean
  guardianAuthorizedAt?: string | Date | null
  decisionKind?: AppearanceDecisionKind | null
  selfShot?: boolean
  verificationLevel?: ReleaseVerificationLevel | null
  consentQuality?: import('./rights.js').LikenessQuality | null
}

export function isCommercialClassLicense(licenseType: string): boolean {
  return (COMMERCIAL_CLASS_LICENSES as readonly string[]).includes(licenseType)
}

export function twoPartyBlocksLicense(input: {
  hasRecognizablePeople: boolean
  appearances: TwoPartyAppearanceInput[]
  licenseType: string
  requiresModelRelease: boolean
  copyrightStatus?: import('./rights.js').CopyrightStatus
  thirdPartyCopyright?: boolean
  creationClaim?: import('./rights.js').CreationClaim | null
}): string | undefined {
  if (!input.hasRecognizablePeople) return undefined
  if (!input.requiresModelRelease) return undefined
  if (input.appearances.length === 0) {
    return 'Identify every depicted person and wait until they approve usage'
  }
  if (input.appearances.some((row) => row.status === 'approved' && !row.confirmedLikeness)) {
    return 'Every depicted person must confirm likeness and approve usage'
  }
  return commercialEligibilityBlock({
    copyrightStatus: input.copyrightStatus ?? 'claimed',
    modelConsentStatus: rollupModelConsentStatus({
      hasRecognizablePeople: true,
      appearances: input.appearances,
    }),
    appearances: input.appearances,
    licenseType: input.licenseType,
    thirdPartyCopyright: input.thirdPartyCopyright,
    creationClaim: input.creationClaim,
  })
}

export function twoPartyCommercialCleared(input: {
  hasRecognizablePeople: boolean
  appearances: TwoPartyAppearanceInput[]
}): boolean {
  return !twoPartyBlocksLicense({
    hasRecognizablePeople: input.hasRecognizablePeople,
    appearances: input.appearances,
    licenseType: 'commercial',
    requiresModelRelease: input.hasRecognizablePeople,
  })
}
