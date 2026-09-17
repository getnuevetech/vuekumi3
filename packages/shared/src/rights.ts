import { z } from 'zod'

export const COPYRIGHT_STATUSES = ['claimed', 'verified', 'disputed', 'restricted'] as const
export const copyrightStatusSchema = z.enum(COPYRIGHT_STATUSES)
export type CopyrightStatus = z.infer<typeof copyrightStatusSchema>

export const MODEL_CONSENT_STATUSES = [
  'not_required',
  'required',
  'invitation_sent',
  'pending',
  'approved',
  'rejected',
  'revoked',
  'disputed',
] as const
export const modelConsentStatusSchema = z.enum(MODEL_CONSENT_STATUSES)
export type ModelConsentStatus = z.infer<typeof modelConsentStatusSchema>

export const RELEASE_VERIFICATION_LEVELS = ['photographer_provided', 'vuekumi_verified'] as const
export const releaseVerificationLevelSchema = z.enum(RELEASE_VERIFICATION_LEVELS)
export type ReleaseVerificationLevel = z.infer<typeof releaseVerificationLevelSchema>

export const APPEARANCE_DECISION_KINDS = ['approved', 'rejected', 'not_me', 'unauthorized'] as const
export const appearanceDecisionKindSchema = z.enum(APPEARANCE_DECISION_KINDS)
export type AppearanceDecisionKind = z.infer<typeof appearanceDecisionKindSchema>

export const SUBJECT_AGE_CLASSES = ['unknown', 'adult', 'minor'] as const
export const subjectAgeClassSchema = z.enum(SUBJECT_AGE_CLASSES)
export type SubjectAgeClass = z.infer<typeof subjectAgeClassSchema>

export const SCREENING_KINDS = [
  'no_recognizable_person',
  'one_recognizable_person',
  'multiple_recognizable_people',
  'crowd_background_persons',
  'uncertain_human_detection',
] as const
export const screeningKindSchema = z.enum(SCREENING_KINDS)
export type ScreeningKind = z.infer<typeof screeningKindSchema>

export const SCREENING_KIND_LABEL: Record<ScreeningKind, string> = {
  no_recognizable_person: 'No recognizable person',
  one_recognizable_person: 'One recognizable person',
  multiple_recognizable_people: 'Multiple recognizable people',
  crowd_background_persons: 'Crowd / background persons',
  uncertain_human_detection: 'Uncertain human detection',
}

export const COPYRIGHT_ATTESTATION =
  'I confirm that I created this image or possess the rights necessary to license it through VueKumi.'

export const MODEL_RELEASE_TERMS_VERSION = '1.0'

export const MODEL_RELEASE_ATTESTATION =
  'I confirm that I am the person depicted in these images and authorize the approved images to be displayed and licensed through VueKumi according to the Model Release Terms.'

export const COPYRIGHT_STATUS_LABEL: Record<CopyrightStatus, string> = {
  claimed: 'Copyright claimed',
  verified: 'Copyright verified',
  disputed: 'Copyright disputed',
  restricted: 'Copyright restricted',
}

export const MODEL_CONSENT_STATUS_LABEL: Record<ModelConsentStatus, string> = {
  not_required: 'Model release not required',
  required: 'Model release required',
  invitation_sent: 'Invitation sent',
  pending: 'Awaiting model consent',
  approved: 'Model release verified',
  rejected: 'Model consent rejected',
  revoked: 'Model consent revoked',
  disputed: 'Likeness rights disputed',
}

/**
 * Stage 1 is automatic person detection (no identity, no face geometry).
 * Stage 2 is photographer/model supplied identity in the rights workflow.
 * Stage 3 is biometric matching and must never run without a separate consent.
 */
export const BIOMETRIC_STAGES = {
  detection: 1,
  suppliedIdentity: 2,
  biometric: 3,
} as const

export const COPYRIGHT_CLEARED_STATUSES: readonly CopyrightStatus[] = ['claimed', 'verified']
export const LIKENESS_CLEARED_STATUSES: readonly ModelConsentStatus[] = ['not_required', 'approved']

export function copyrightCleared(status: CopyrightStatus | null | undefined): boolean {
  return status === 'claimed' || status === 'verified'
}

export function likenessRightsCleared(status: ModelConsentStatus | null | undefined): boolean {
  return status === 'not_required' || status === 'approved'
}

export function screeningIndicatesPerson(kind: ScreeningKind | null | undefined): boolean {
  return (
    kind === 'one_recognizable_person'
    || kind === 'multiple_recognizable_people'
    || kind === 'crowd_background_persons'
    || kind === 'uncertain_human_detection'
  )
}

export type RightsAppearanceInput = {
  status?: string
  consentStatus?: ModelConsentStatus | null
  usage?: string
  confirmedLikeness?: boolean
  isMinor?: boolean
  guardianAuthorizedAt?: string | Date | null
  decisionKind?: AppearanceDecisionKind | null
  selfShot?: boolean
}

function consentFromAppearance(row: RightsAppearanceInput): ModelConsentStatus {
  if (row.consentStatus) return row.consentStatus
  if (row.decisionKind === 'not_me' || row.decisionKind === 'unauthorized') return 'disputed'
  switch (row.status) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'claimed':
      return 'pending'
    case 'invited':
      return 'invitation_sent'
    case 'identified':
      return 'required'
    default:
      return 'required'
  }
}

export function appearanceConsentOutstanding(row: RightsAppearanceInput): boolean {
  if (row.isMinor && !row.guardianAuthorizedAt) return true
  const status = consentFromAppearance(row)
  if (status === 'approved' && row.confirmedLikeness !== false) return false
  return status !== 'approved'
}

export function rollupModelConsentStatus(input: {
  hasRecognizablePeople: boolean
  appearances: RightsAppearanceInput[]
}): ModelConsentStatus {
  if (!input.hasRecognizablePeople) return 'not_required'
  if (input.appearances.length === 0) return 'required'

  const statuses = input.appearances.map((row) => {
    if (row.isMinor && !row.guardianAuthorizedAt) return 'required' as ModelConsentStatus
    return consentFromAppearance(row)
  })

  if (statuses.some((s) => s === 'disputed')) return 'disputed'
  if (statuses.some((s) => s === 'rejected')) return 'rejected'
  if (statuses.some((s) => s === 'revoked')) return 'revoked'
  if (statuses.some((s) => s === 'required')) return 'required'
  if (statuses.some((s) => s === 'invitation_sent')) return 'invitation_sent'
  if (statuses.some((s) => s === 'pending')) return 'pending'
  if (statuses.every((s) => s === 'approved')) return 'approved'
  return 'required'
}

export function outstandingConsentCount(appearances: RightsAppearanceInput[]): number {
  return appearances.filter(appearanceConsentOutstanding).length
}

const COMMERCIAL_CLASS = new Set([
  'royalty_free',
  'commercial',
  'extended',
  'exclusive',
  'rights_managed',
])

export function isCommerciallyEligible(input: {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialLocked?: boolean
}): boolean {
  return copyrightCleared(input.copyrightStatus)
    && likenessRightsCleared(input.modelConsentStatus)
    && !input.commercialLocked
}

export function commercialEligibilityBlock(input: {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialLocked?: boolean
  appearances?: RightsAppearanceInput[]
  licenseType?: string
}): string | undefined {
  if (input.commercialLocked) return 'New licensing is paused while staff review a rights report'
  if (!copyrightCleared(input.copyrightStatus)) {
    if (input.copyrightStatus === 'disputed') return 'Photo copyright rights are disputed'
    if (input.copyrightStatus === 'restricted') return 'Photo copyright rights are restricted'
    return 'Photo copyright rights are not cleared'
  }
  if (!likenessRightsCleared(input.modelConsentStatus)) {
    const outstanding = outstandingConsentCount(input.appearances ?? [])
    if (input.modelConsentStatus === 'disputed') return 'Likeness / model release rights are disputed'
    if (input.modelConsentStatus === 'rejected') return 'A depicted person rejected likeness use'
    if (input.modelConsentStatus === 'revoked') return 'A depicted person revoked likeness consent'
    if (outstanding > 0) {
      return `LOCKED — ${outstanding} required consent${outstanding === 1 ? '' : 's'} outstanding`
    }
    if (input.modelConsentStatus === 'invitation_sent' || input.modelConsentStatus === 'pending') {
      return 'AWAITING MODEL CONSENT — the photograph cannot be commercially licensed yet'
    }
    return 'Likeness / model release rights are not cleared'
  }
  if (
    input.licenseType
    && COMMERCIAL_CLASS.has(input.licenseType)
    && (input.appearances ?? []).some((row) => {
      const status = consentFromAppearance(row)
      return status === 'approved' && row.usage !== 'commercial'
    })
  ) {
    return 'Commercial licensing requires commercial usage approval from every depicted person'
  }
  return undefined
}

export interface RightsScreeningDto {
  kind: ScreeningKind
  recognizablePersonCount: number | null
  possibleMinor: boolean
  crowdBackground: boolean
  selfPortraitLikely: boolean
  potentiallySensitive: boolean
  uncertainHumanDetection: boolean
  notes: string | null
  provider: 'openai' | 'dev'
  biometricUsed: false
}

export function defaultScreening(kind: ScreeningKind = 'uncertain_human_detection'): RightsScreeningDto {
  return {
    kind,
    recognizablePersonCount: kind === 'no_recognizable_person' ? 0 : kind === 'one_recognizable_person' ? 1 : null,
    possibleMinor: false,
    crowdBackground: kind === 'crowd_background_persons',
    selfPortraitLikely: false,
    potentiallySensitive: false,
    uncertainHumanDetection: kind === 'uncertain_human_detection',
    notes: null,
    provider: 'dev',
    biometricUsed: false,
  }
}

export function applyScreeningToPeopleFlag(input: {
  declaredPeople?: boolean
  screening: Pick<RightsScreeningDto, 'kind' | 'uncertainHumanDetection'>
}): boolean {
  if (input.screening.uncertainHumanDetection || input.screening.kind === 'uncertain_human_detection') return true
  if (screeningIndicatesPerson(input.screening.kind)) return true
  return Boolean(input.declaredPeople)
}

export const identifyAppearanceSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().email(),
    mobile: z.string().trim().min(7).max(32).regex(/^[+0-9 ().-]+$/, 'Enter a mobile number VueKumi can use to contact the model'),
    ageClass: subjectAgeClassSchema.optional(),
    isMinor: z.boolean().optional(),
    guardianName: z.string().trim().min(2).max(120).optional(),
    guardianEmail: z.string().email().optional(),
    guardianMobile: z.string().trim().min(7).max(32).optional(),
    shootId: z.string().min(1).max(40).optional(),
    shootTitle: z.string().trim().min(2).max(160).optional(),
    shotOn: z.string().min(4).max(40).optional(),
  })
  .superRefine((value, ctx) => {
    const minor = value.isMinor || value.ageClass === 'minor'
    if (minor && (!value.guardianName || !value.guardianEmail || !value.guardianMobile)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A parent or legal guardian name, email and mobile are required for a minor',
        path: ['guardianName'],
      })
    }
  })

export const uploadSignedReleaseSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  modelIdentity: z.string().trim().min(2).max(120),
  fileName: z.string().min(3).max(200),
  attestedGenuine: z.literal(true),
  applicableToThisImage: z.literal(true),
  email: z.string().email().optional(),
  mobile: z.string().trim().min(7).max(32).optional(),
  confirmWithModel: z.boolean().optional(),
  ageClass: subjectAgeClassSchema.optional(),
  isMinor: z.boolean().optional(),
})

export const guestConsentSchema = z.object({
  action: appearanceDecisionKindSchema,
  appearanceIds: z.array(z.string().min(1)).max(80).optional(),
  approveAll: z.boolean().optional(),
  confirmedLikeness: z.boolean(),
  usage: z.enum(['none', 'editorial', 'commercial']).optional(),
  acceptReleaseTerms: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const declareSubjectAgeSchema = z.object({
  appearanceId: z.string().min(1).optional(),
  ageClass: subjectAgeClassSchema,
  isMinor: z.boolean().optional(),
  guardianName: z.string().trim().min(2).max(120).optional(),
  guardianEmail: z.string().email().optional(),
  guardianMobile: z.string().trim().min(7).max(32).optional(),
})

export type UploadSignedReleaseInput = z.infer<typeof uploadSignedReleaseSchema>
export type GuestConsentInput = z.infer<typeof guestConsentSchema>
export type DeclareSubjectAgeInput = z.infer<typeof declareSubjectAgeSchema>

export interface VerifiedRightsRecordDto {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialEligible: boolean
  modelReleaseVerified: boolean
  releaseVerificationLevel: ReleaseVerificationLevel | null
  outstandingConsents: number
  awaitingModelConsent: boolean
  possibleMinor: boolean
}
