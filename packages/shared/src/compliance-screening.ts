import { z } from 'zod'

/**
 * T9 — person / entity / beneficial-owner / FI screening contracts.
 * Country matrix records which provider covers which function.
 * Not country-only reject. No OFAC vendor is invented here.
 */

export const COMPLIANCE_SCREENING_SETTING_KEY = 'compliance.screening_enabled'

export const COMPLIANCE_SUBJECT_TYPES = [
  'person',
  'entity',
  'beneficial_owner',
  'financial_institution',
] as const
export type ComplianceSubjectType = (typeof COMPLIANCE_SUBJECT_TYPES)[number]

export const COMPLIANCE_SCREENING_RESULTS = [
  'pending',
  'clear',
  'match',
  'inconclusive',
  'unavailable',
] as const
export type ComplianceScreeningResult = (typeof COMPLIANCE_SCREENING_RESULTS)[number]

/** Country-matrix functions G13 may cover via named partners (nullable until counsel). */
export const COMPLIANCE_SCREENING_FUNCTIONS = [
  'person',
  'entity',
  'beneficial_owner',
  'fi',
  'ofac_sop',
] as const
export type ComplianceScreeningFunction = (typeof COMPLIANCE_SCREENING_FUNCTIONS)[number]

export const recordComplianceScreeningSchema = z.object({
  screeningId: z.string().trim().min(1).max(200),
  vendor: z.string().trim().min(1).max(120),
  subjectType: z.enum(COMPLIANCE_SUBJECT_TYPES),
  subjectUserId: z.string().trim().min(1).max(80).optional().nullable(),
  countryCode: z.string().trim().length(2).optional().nullable(),
  result: z.enum(COMPLIANCE_SCREENING_RESULTS).default('pending'),
  notes: z.string().trim().max(2000).optional().nullable(),
  screenedAt: z.string().datetime().optional().nullable(),
})
export type RecordComplianceScreeningInput = z.infer<typeof recordComplianceScreeningSchema>

export const upsertCountryScreeningProviderSchema = z.object({
  countryCode: z.string().trim().length(2),
  screeningFunction: z.enum(COMPLIANCE_SCREENING_FUNCTIONS),
  providerSlug: z.string().trim().min(1).max(120).optional().nullable(),
  evidenceUrl: z.string().trim().url().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})
export type UpsertCountryScreeningProviderInput = z.infer<typeof upsertCountryScreeningProviderSchema>

export interface ComplianceScreeningEvidenceDto {
  id: string
  screeningId: string
  vendor: string
  subjectType: ComplianceSubjectType
  subjectUserId?: string | null
  countryCode?: string | null
  result: ComplianceScreeningResult
  notes?: string | null
  screenedAt?: string | null
  createdAt: string
  updatedAt: string
  /** Always false — list payloads / watchlist dumps are not stored. */
  listPayloadRetained: false
}

export interface CountryScreeningProviderSlotDto {
  id: string
  countryCode: string
  screeningFunction: ComplianceScreeningFunction
  providerSlug: string | null
  evidenceUrl: string | null
  notes: string | null
  updatedAt: string
}

/** Provider-agnostic adapter. No vendor ships while the flag is OFF. */
export interface ComplianceScreeningProvider {
  readonly vendor: string
  screen(input: {
    subjectType: ComplianceSubjectType
    subjectUserId?: string | null
    countryCode?: string | null
  }): Promise<{
    screeningId: string
    result: ComplianceScreeningResult
  }>
}

export function serializeComplianceScreening(row: {
  id: string
  screeningId: string
  vendor: string
  subjectType: string
  subjectUserId: string | null
  countryCode: string | null
  result: string
  notes: string | null
  screenedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ComplianceScreeningEvidenceDto {
  return {
    id: row.id,
    screeningId: row.screeningId,
    vendor: row.vendor,
    subjectType: row.subjectType as ComplianceSubjectType,
    subjectUserId: row.subjectUserId,
    countryCode: row.countryCode,
    result: row.result as ComplianceScreeningResult,
    notes: row.notes,
    screenedAt: row.screenedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    listPayloadRetained: false,
  }
}

export function serializeCountryScreeningProviderSlot(row: {
  id: string
  countryCode: string
  screeningFunction: string
  providerSlug: string | null
  evidenceUrl: string | null
  notes: string | null
  updatedAt: Date
}): CountryScreeningProviderSlotDto {
  return {
    id: row.id,
    countryCode: row.countryCode,
    screeningFunction: row.screeningFunction as ComplianceScreeningFunction,
    providerSlug: row.providerSlug,
    evidenceUrl: row.evidenceUrl,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  }
}
