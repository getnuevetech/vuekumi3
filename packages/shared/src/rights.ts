import { z } from 'zod'

export const COPYRIGHT_STATUSES = ['claimed', 'documented', 'verified', 'disputed', 'restricted'] as const
export const copyrightStatusSchema = z.enum(COPYRIGHT_STATUSES)
export type CopyrightStatus = z.infer<typeof copyrightStatusSchema>

export const COPYRIGHT_METHODS = ['attestation', 'document', 'vuekumi_direct'] as const
export const copyrightMethodSchema = z.enum(COPYRIGHT_METHODS)
export type CopyrightMethod = z.infer<typeof copyrightMethodSchema>

export const LIKENESS_QUALITIES = ['claimed', 'documented', 'verified'] as const
export const likenessQualitySchema = z.enum(LIKENESS_QUALITIES)
export type LikenessQuality = z.infer<typeof likenessQualitySchema>

export const CREATION_CLAIMS = [
  'self_created',
  'photographer_took',
  'assigned',
  'licensed',
  'unknown',
] as const
export const creationClaimSchema = z.enum(CREATION_CLAIMS)
export type CreationClaim = z.infer<typeof creationClaimSchema>

export const RIGHTS_LEDGER_ACTOR_KINDS = ['user', 'guest', 'staff', 'system'] as const
export const rightsLedgerActorKindSchema = z.enum(RIGHTS_LEDGER_ACTOR_KINDS)
export type RightsLedgerActorKind = z.infer<typeof rightsLedgerActorKindSchema>

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

export const APPEARANCE_DECISION_KINDS = ['approved', 'rejected', 'not_me', 'unauthorized', 'revoked'] as const
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

export const COPYRIGHT_SCOPES = [
  'portfolio_display',
  'editorial',
  'commercial_sublicensing',
  'exclusive',
  'ai_training',
] as const
export const copyrightScopeSchema = z.enum(COPYRIGHT_SCOPES)
export type CopyrightScope = z.infer<typeof copyrightScopeSchema>

export const COPYRIGHT_AUTHORIZATION_TERMS_VERSION = '1.0'

export const COPYRIGHT_AUTHORIZATION_ATTESTATION =
  'I confirm that I own or control the copyright in these photographs and authorize the selected usage through VueKumi. A claim is not verification. VueKumi sells usage permission, not ownership. AI-training use is a separate opt-in and is not granted by this authorization unless I tick that box.'

export const COPYRIGHT_ATTESTATION =
  'I confirm that I created this image or possess the rights necessary to license it through VueKumi.'

export const MODEL_RELEASE_TERMS_VERSION = '1.0'

export const MODEL_RELEASE_ATTESTATION =
  'I confirm that I am the person depicted in these images and authorize the approved images to be displayed and licensed through VueKumi according to the Model Release Terms. AI-training use is a separate opt-in and is not granted by editorial or commercial approval alone.'

export const COPYRIGHT_STATUS_LABEL: Record<CopyrightStatus, string> = {
  claimed: 'Copyright claimed',
  documented: 'Copyright documented',
  verified: 'Copyright verified',
  disputed: 'Copyright disputed',
  restricted: 'Copyright restricted',
}

export const COPYRIGHT_METHOD_LABEL: Record<CopyrightMethod, string> = {
  attestation: 'Uploader attestation',
  document: 'Supporting document',
  vuekumi_direct: 'VueKumi-verified with the rightsholder',
}

export const LIKENESS_QUALITY_LABEL: Record<LikenessQuality, string> = {
  claimed: 'Likeness claimed',
  documented: 'Likeness documented',
  verified: 'Likeness verified',
}

export const CREATION_CLAIM_LABEL: Record<CreationClaim, string> = {
  self_created: 'Uploader created this photograph',
  photographer_took: 'Another photographer took this photograph',
  assigned: 'Copyright assigned to the uploader',
  licensed: 'Copyright licensed to the uploader',
  unknown: 'Copyright owner is unknown',
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

export const COPYRIGHT_CLEARED_STATUSES: readonly CopyrightStatus[] = ['claimed', 'documented', 'verified']
export const LIKENESS_CLEARED_STATUSES: readonly ModelConsentStatus[] = ['not_required', 'approved']

export function thirdPartyCopyright(claim: CreationClaim | null | undefined): boolean {
  return claim === 'photographer_took' || claim === 'assigned' || claim === 'licensed' || claim === 'unknown'
}

export function copyrightCleared(status: CopyrightStatus | null | undefined): boolean {
  return status === 'claimed' || status === 'documented' || status === 'verified'
}

export function copyrightAuthoritySufficient(input: {
  copyrightStatus: CopyrightStatus | null | undefined
  thirdPartyCopyright?: boolean
  creationClaim?: CreationClaim | null
}): boolean {
  const status = input.copyrightStatus
  if (!status || status === 'disputed' || status === 'restricted') return false
  const thirdParty = input.thirdPartyCopyright ?? thirdPartyCopyright(input.creationClaim)
  if (thirdParty) return status === 'verified'
  return copyrightCleared(status)
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
  verificationLevel?: ReleaseVerificationLevel | null
  consentQuality?: LikenessQuality | null
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

export function appearanceLikenessQuality(row: RightsAppearanceInput): LikenessQuality {
  if (row.consentQuality) return row.consentQuality
  if (row.verificationLevel === 'vuekumi_verified') return 'verified'
  if (row.verificationLevel === 'photographer_provided') return 'documented'
  return 'claimed'
}

export function likenessAuthorizationSufficient(input: {
  modelConsentStatus: ModelConsentStatus
  appearances?: RightsAppearanceInput[]
}): boolean {
  if (input.modelConsentStatus === 'not_required') return true
  if (!likenessRightsCleared(input.modelConsentStatus)) return false
  const appearances = input.appearances ?? []
  if (appearances.length === 0) return false
  return appearances.every((row) => {
    if (appearanceConsentOutstanding(row)) return false
    return appearanceLikenessQuality(row) === 'verified'
  })
}

export function publicRightsVerified(input: {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  appearances?: RightsAppearanceInput[]
}): boolean {
  if (input.copyrightStatus !== 'verified') return false
  if (input.modelConsentStatus === 'not_required') return true
  return likenessAuthorizationSufficient(input)
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

export function copyrightCommercialScopeGranted(input: {
  creationClaim?: CreationClaim | null
  thirdPartyCopyright?: boolean
  copyrightCommercialScope?: boolean | null
}): boolean {
  const thirdParty = input.thirdPartyCopyright ?? thirdPartyCopyright(input.creationClaim)
  if (!thirdParty) return true
  if (input.copyrightCommercialScope == null) return true
  return input.copyrightCommercialScope === true
}

export function isCommerciallyEligible(input: {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialLocked?: boolean
  thirdPartyCopyright?: boolean
  creationClaim?: CreationClaim | null
  appearances?: RightsAppearanceInput[]
  copyrightCommercialScope?: boolean | null
}): boolean {
  return copyrightAuthoritySufficient(input)
    && likenessAuthorizationSufficient(input)
    && copyrightCommercialScopeGranted(input)
    && !input.commercialLocked
}

export function commercialEligibilityBlock(input: {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialLocked?: boolean
  appearances?: RightsAppearanceInput[]
  licenseType?: string
  thirdPartyCopyright?: boolean
  creationClaim?: CreationClaim | null
  copyrightCommercialScope?: boolean | null
}): string | undefined {
  if (input.commercialLocked) return 'New licensing is paused while staff review a rights report'
  const thirdParty = input.thirdPartyCopyright ?? thirdPartyCopyright(input.creationClaim)
  if (!copyrightAuthoritySufficient({ ...input, thirdPartyCopyright: thirdParty })) {
    if (input.copyrightStatus === 'disputed') return 'Photo copyright rights are disputed'
    if (input.copyrightStatus === 'restricted') return 'Photo copyright rights are restricted'
    if (thirdParty) {
      return 'Copyright must be VueKumi-verified because another person may own it. A declaration does not unlock commercial licensing'
    }
    if (input.copyrightStatus === 'documented') {
      return 'Copyright is documented but not VueKumi-verified'
    }
    return 'Photo copyright rights are not cleared'
  }
  if (!copyrightCommercialScopeGranted({ ...input, thirdPartyCopyright: thirdParty })) {
    return 'The copyright holder authorized display only. Commercial sublicensing through VueKumi was not granted'
  }
  if (!likenessAuthorizationSufficient(input)) {
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
    if (likenessRightsCleared(input.modelConsentStatus)) {
      return 'Likeness is not VueKumi-verified. A photographer-provided PDF or a claimed consent does not unlock commercial licensing'
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
  aiTraining: z.boolean().optional(),
  acceptReleaseTerms: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const identifyCopyrightHolderSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().trim().min(7).max(32).regex(/^[+0-9 ().-]+$/, 'Enter a mobile number VueKumi can use to contact the photographer'),
})

export const guestCopyrightConsentSchema = z.object({
  action: appearanceDecisionKindSchema,
  confirmedIdentity: z.boolean(),
  usage: z.enum(['none', 'editorial', 'commercial']).optional(),
  aiTraining: z.boolean().optional(),
  acceptAuthorizationTerms: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const acceptPhotographerAgreementSchema = z.object({
  country: z.string().length(2),
  acceptAgreement: z.literal(true),
})

export const submitModelPhotoSchema = z
  .object({
    title: z.string().min(2).max(160),
    description: z.string().max(2000).optional(),
    category: z.string().min(1).max(80),
    country: z.string().min(2).max(80),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    hasRecognizablePeople: z.boolean(),
    copyrightHolder: z.string().min(2).max(200),
    copyrightAttested: z.literal(true),
    creationClaim: creationClaimSchema,
    inPhotograph: z.boolean(),
    ownLikenessConfirmed: z.boolean().optional(),
    ownUsage: z.enum(['editorial', 'commercial']).optional(),
    photographerName: z.string().trim().min(2).max(120).optional(),
    photographerEmail: z.string().email().optional(),
    photographerMobile: z.string().trim().min(7).max(32).regex(/^[+0-9 ().-]+$/).optional(),
    assignmentDocumentName: z.string().min(3).max(200).optional(),
    src: z.string().max(500).optional(),
    originalKey: z.string().min(8).max(400).optional(),
  })
  .superRefine((value, ctx) => {
    const needsPhotographer = value.creationClaim === 'photographer_took'
      || value.creationClaim === 'assigned'
      || value.creationClaim === 'licensed'
    if (needsPhotographer && (!value.photographerName || !value.photographerEmail || !value.photographerMobile)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name, email and mobile are required so VueKumi can contact the photographer',
        path: ['photographerEmail'],
      })
    }
    if (value.inPhotograph && !value.ownLikenessConfirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Confirm your likeness before submitting a photograph you appear in',
        path: ['ownLikenessConfirmed'],
      })
    }
    if (value.inPhotograph && (!value.ownUsage || value.ownUsage === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose editorial or commercial usage for your own likeness',
        path: ['ownUsage'],
      })
    }
  })

export const declareSubjectAgeSchema = z.object({
  appearanceId: z.string().min(1).optional(),
  ageClass: subjectAgeClassSchema,
  isMinor: z.boolean().optional(),
  guardianName: z.string().trim().min(2).max(120).optional(),
  guardianEmail: z.string().email().optional(),
  guardianMobile: z.string().trim().min(7).max(32).optional(),
  guardianAuthorized: z.boolean().optional(),
})

export const authorizeGuardianSchema = z.object({
  authorized: z.literal(true),
})

export type UploadSignedReleaseInput = z.infer<typeof uploadSignedReleaseSchema>
export type GuestConsentInput = z.infer<typeof guestConsentSchema>
export type DeclareSubjectAgeInput = z.infer<typeof declareSubjectAgeSchema>
export type AuthorizeGuardianInput = z.infer<typeof authorizeGuardianSchema>
export type IdentifyCopyrightHolderInput = z.infer<typeof identifyCopyrightHolderSchema>
export type GuestCopyrightConsentInput = z.infer<typeof guestCopyrightConsentSchema>
export type AcceptPhotographerAgreementInput = z.infer<typeof acceptPhotographerAgreementSchema>
export type SubmitModelPhotoInput = z.infer<typeof submitModelPhotoSchema>

export const COPYRIGHT_AUTHORIZATION_STATUSES = ['identified', 'invited', 'claimed', 'approved', 'rejected'] as const
export const copyrightAuthorizationStatusSchema = z.enum(COPYRIGHT_AUTHORIZATION_STATUSES)
export type CopyrightAuthorizationStatus = z.infer<typeof copyrightAuthorizationStatusSchema>

export interface CopyrightAuthorizationDto {
  id: string
  photoId: string
  photoTitle?: string
  photoSrc?: string
  modelName?: string
  displayName: string
  inviteEmail?: string | null
  inviteMobile?: string | null
  status: CopyrightAuthorizationStatus
  decisionKind?: AppearanceDecisionKind | null
  usage: 'none' | 'editorial' | 'commercial'
  portfolioDisplay: boolean
  commercialSublicensing: boolean
  aiTraining?: boolean
  quality: CopyrightStatus
  documentFileName?: string | null
  invitedAt?: string | null
  decidedAt?: string | null
  inviteExpiresAt?: string | null
}

export interface CopyrightInvitePreviewDto {
  email: string
  displayName: string
  photoTitle: string
  modelName: string
  expiresAt: string
  needsAccount: boolean
  membershipRequired: false
  imageCount: number
  images: {
    authorizationId: string
    photoId: string
    photoTitle: string
    photoSrc?: string
    status: CopyrightAuthorizationStatus
  }[]
  terms: string
  notice: string
}

/** Phase 52 / T4 — unified preview for `/rights?token=`. */
export type RightsPreviewDto =
  | { kind: 'likeness'; invite: import('./models.js').ModelInvitePreviewDto }
  | { kind: 'copyright'; invite: CopyrightInvitePreviewDto }

export interface VerifiedRightsRecordDto {
  copyrightStatus: CopyrightStatus
  modelConsentStatus: ModelConsentStatus
  commercialEligible: boolean
  modelReleaseVerified: boolean
  rightsVerified: boolean
  releaseVerificationLevel: ReleaseVerificationLevel | null
  outstandingConsents: number
  awaitingModelConsent: boolean
  possibleMinor: boolean
}

export interface RightsLedgerEventDto {
  id: string
  photoId: string
  actorKind: RightsLedgerActorKind
  actorId: string | null
  actorName: string | null
  action: string
  agreementVersion: string | null
  channel: string | null
  previousCopyright: CopyrightStatus | null
  nextCopyright: CopyrightStatus | null
  previousLikeness: ModelConsentStatus | null
  nextLikeness: ModelConsentStatus | null
  previousQuality: string | null
  nextQuality: string | null
  commercialEligible: boolean
  createdAt: string
}

export interface RightsLedgerDto {
  photoId: string
  title: string
  uploadedBy: { id: string; name: string; accountType: string } | null
  creationClaim: CreationClaim
  thirdPartyCopyright: boolean
  copyright: {
    status: CopyrightStatus
    method: CopyrightMethod
    holder: string | null
    attestedAt: string | null
  }
  likeness: {
    status: ModelConsentStatus
    quality: LikenessQuality | null
  }
  commercialEligible: boolean
  commercialLocked: boolean
  rightsVerified: boolean
  events: RightsLedgerEventDto[]
}
