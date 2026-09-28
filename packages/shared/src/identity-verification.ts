import { z } from 'zod'

/**
 * Phase 60 / Dec-Bio — identity verification evidence contracts.
 * Face match / subject match never equals commercial consent.
 * VueKumi does not store face templates, embeddings, or raw verification imagery.
 */

export const IDENTITY_VERIFICATION_SETTING_KEY = 'identity.verification_enabled'

export const IDENTITY_VERIFICATION_RESULTS = [
  'pending',
  'passed',
  'failed',
  'inconclusive',
  'unavailable',
] as const
export type IdentityVerificationResult = (typeof IDENTITY_VERIFICATION_RESULTS)[number]

export const IDENTITY_MANUAL_REVIEW_STATUSES = [
  'not_required',
  'pending',
  'approved',
  'rejected',
] as const
export type IdentityManualReviewStatus = (typeof IDENTITY_MANUAL_REVIEW_STATUSES)[number]

export const SUBJECT_MATCH_RESULTS = [
  'not_run',
  'matched',
  'not_matched',
  'inconclusive',
  'unavailable',
] as const
export type SubjectMatchResult = (typeof SUBJECT_MATCH_RESULTS)[number]

export const recordIdentityEvidenceSchema = z.object({
  verificationId: z.string().trim().min(1).max(200),
  vendor: z.string().trim().min(1).max(120),
  verifiedPersonId: z.string().trim().min(1).max(200).optional().nullable(),
  subjectUserId: z.string().trim().min(1).max(80).optional().nullable(),
  photoId: z.string().trim().min(1).max(80).optional().nullable(),
  appearanceId: z.string().trim().min(1).max(80).optional().nullable(),
  result: z.enum(IDENTITY_VERIFICATION_RESULTS).default('pending'),
  manualReviewStatus: z.enum(IDENTITY_MANUAL_REVIEW_STATUSES).default('not_required'),
  consentVersion: z.string().trim().min(1).max(80).optional().nullable(),
  documentCountry: z.string().trim().length(2).optional().nullable(),
  documentType: z.string().trim().min(1).max(80).optional().nullable(),
  subjectMatchResult: z.enum(SUBJECT_MATCH_RESULTS).default('not_run'),
  relatedImageIds: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
  verifiedAt: z.string().datetime().optional().nullable(),
})
export type RecordIdentityEvidenceInput = z.infer<typeof recordIdentityEvidenceSchema>

export interface IdentityVerificationEvidenceDto {
  id: string
  verificationId: string
  vendor: string
  verifiedPersonId?: string | null
  subjectUserId?: string | null
  photoId?: string | null
  appearanceId?: string | null
  result: IdentityVerificationResult
  manualReviewStatus: IdentityManualReviewStatus
  consentVersion?: string | null
  documentCountry?: string | null
  documentType?: string | null
  subjectMatchResult: SubjectMatchResult
  relatedImageIds: string[]
  notes?: string | null
  verifiedAt?: string | null
  createdAt: string
  updatedAt: string
  /** Always false — VueKumi does not retain biometric material from this record. */
  biometricMaterialRetained: false
}

/** Provider-agnostic adapter contract. No vendor implementation ships while the flag is OFF. */
export interface IdentityVerificationProvider {
  readonly vendor: string
  /** ID + liveness → identity verified. Must not return embeddings or image bytes. */
  verifyIdentity(input: {
    subjectUserId?: string | null
    consentVersion: string
  }): Promise<{
    verificationId: string
    verifiedPersonId?: string | null
    result: IdentityVerificationResult
    documentCountry?: string | null
    documentType?: string | null
  }>
  /** Verified live person → person in uploaded image. Never grants commercial consent. */
  matchSubject(input: {
    verificationId: string
    photoId: string
  }): Promise<{ subjectMatchResult: SubjectMatchResult }>
}

export function serializeIdentityEvidence(row: {
  id: string
  verificationId: string
  vendor: string
  verifiedPersonId: string | null
  subjectUserId: string | null
  photoId: string | null
  appearanceId: string | null
  result: string
  manualReviewStatus: string
  consentVersion: string | null
  documentCountry: string | null
  documentType: string | null
  subjectMatchResult: string
  relatedImageIds: string[]
  notes: string | null
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): IdentityVerificationEvidenceDto {
  return {
    id: row.id,
    verificationId: row.verificationId,
    vendor: row.vendor,
    verifiedPersonId: row.verifiedPersonId,
    subjectUserId: row.subjectUserId,
    photoId: row.photoId,
    appearanceId: row.appearanceId,
    result: row.result as IdentityVerificationResult,
    manualReviewStatus: row.manualReviewStatus as IdentityManualReviewStatus,
    consentVersion: row.consentVersion,
    documentCountry: row.documentCountry,
    documentType: row.documentType,
    subjectMatchResult: row.subjectMatchResult as SubjectMatchResult,
    relatedImageIds: row.relatedImageIds ?? [],
    notes: row.notes,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    biometricMaterialRetained: false,
  }
}
