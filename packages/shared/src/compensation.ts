import { z } from 'zod'
import { modelShareFromCreatorPool } from './revenue-policy.js'

/** Dec-PayBase: model % / fixed is of Contributor Distributable Share (creator pool). */
export const COMPENSATION_PAYMENT_BASE = 'contributor_distributable_share' as const

export const COMPENSATION_TERM_MODES = ['percentage', 'fixed', 'both', 'zero'] as const
export type CompensationTermMode = (typeof COMPENSATION_TERM_MODES)[number]

export const COMPENSATION_PROPOSAL_STATUSES = [
  'proposed',
  'countered',
  'accepted',
  'declined',
  'activated',
  'superseded',
] as const
export type CompensationProposalStatus = (typeof COMPENSATION_PROPOSAL_STATUSES)[number]

export const compensationTermsSchema = z
  .object({
    mode: z.enum(COMPENSATION_TERM_MODES),
    percent: z.number().min(0).max(100).default(0),
    fixedUsd: z.number().min(0).max(1_000_000).default(0),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'zero') {
      if (value.percent !== 0 || value.fixedUsd !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Zero-fee terms must have percent and fixedUsd at 0',
        })
      }
      return
    }
    if (value.mode === 'percentage' && value.percent <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Percentage terms require percent > 0' })
    }
    if (value.mode === 'fixed' && value.fixedUsd <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Fixed terms require fixedUsd > 0' })
    }
    if (value.mode === 'both' && value.percent <= 0 && value.fixedUsd <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Combined terms require percent and/or fixedUsd > 0' })
    }
  })
export type CompensationTermsInput = z.infer<typeof compensationTermsSchema>

export const proposeCompensationSchema = compensationTermsSchema
export const counterCompensationSchema = compensationTermsSchema

export interface CompensationProposalDto {
  id: string
  photoId: string
  appearanceId: string
  proposedById: string
  proposedAs: 'photographer' | 'model'
  status: CompensationProposalStatus
  mode: CompensationTermMode
  percent: number
  fixedUsd: number
  paymentBase: string
  notes?: string | null
  parentId?: string | null
  acceptedAt?: string | null
  declinedAt?: string | null
  activatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export function termsRequestRevenue(terms: Pick<CompensationTermsInput, 'mode' | 'percent' | 'fixedUsd'>): boolean {
  if (terms.mode === 'zero') return false
  return terms.percent > 0 || terms.fixedUsd > 0
}

/** Open is blocked when any live proposal/agreement asks for ongoing revenue. */
export function compensationRequestedFromProposals(
  proposals: Array<Pick<CompensationProposalDto, 'status' | 'mode' | 'percent' | 'fixedUsd'>>,
): boolean {
  return proposals.some((row) => {
    if (!['proposed', 'countered', 'accepted', 'activated'].includes(row.status)) return false
    return termsRequestRevenue(row)
  })
}

export function negotiationTermsSatisfied(input: {
  hasRecognizablePeople: boolean
  requiredAppearanceIds: string[]
  proposals: Array<Pick<CompensationProposalDto, 'appearanceId' | 'status'>>
}): { ok: boolean; reason?: string; missingAppearanceIds: string[] } {
  if (!input.hasRecognizablePeople || input.requiredAppearanceIds.length === 0) {
    return { ok: true, missingAppearanceIds: [] }
  }
  const activated = new Set(
    input.proposals.filter((p) => p.status === 'activated').map((p) => p.appearanceId),
  )
  const missing = input.requiredAppearanceIds.filter((id) => !activated.has(id))
  if (missing.length > 0) {
    return {
      ok: false,
      reason: 'Compensation agreement required for every depicted person before commercial licensing',
      missingAppearanceIds: missing,
    }
  }
  return { ok: true, missingAppearanceIds: [] }
}

/**
 * Multi-model cap: sum of activated percentage shares of the creator pool
 * cannot exceed 100%. Fixed fees are capped separately against a sale's pool at payout time (T6).
 */
export function assertMultiModelPercentCap(
  activated: Array<Pick<CompensationTermsInput, 'mode' | 'percent'>>,
): { ok: true } | { ok: false; reason: string; totalPercent: number } {
  const totalPercent = activated.reduce((sum, row) => {
    if (row.mode === 'zero' || row.mode === 'fixed') return sum
    return sum + Math.min(100, Math.max(0, row.percent))
  }, 0)
  if (totalPercent > 100.001) {
    return {
      ok: false,
      reason: `Model percentage allocations total ${Math.round(totalPercent * 100) / 100}% of the Contributor Distributable Share; maximum is 100%`,
      totalPercent,
    }
  }
  return { ok: true }
}

/** Illustrative allocation for a single activated agreement against a creator pool. */
export function modelAllocationFromAgreement(
  creatorPoolUsd: number,
  terms: Pick<CompensationTermsInput, 'mode' | 'percent' | 'fixedUsd'>,
): number {
  if (terms.mode === 'zero') return 0
  let amount = 0
  if (terms.mode === 'percentage' || terms.mode === 'both') {
    amount += modelShareFromCreatorPool(creatorPoolUsd, terms.percent)
  }
  if (terms.mode === 'fixed' || terms.mode === 'both') {
    amount += Math.max(0, terms.fixedUsd)
  }
  return Math.round(Math.min(creatorPoolUsd, amount) * 100) / 100
}

export function serializeCompensationProposal(row: {
  id: string
  photoId: string
  appearanceId: string
  proposedById: string
  proposedAs: string
  status: string
  mode: string
  percent: number
  fixedUsd: number
  paymentBase: string
  notes: string | null
  parentId: string | null
  acceptedAt: Date | null
  declinedAt: Date | null
  activatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): CompensationProposalDto {
  return {
    id: row.id,
    photoId: row.photoId,
    appearanceId: row.appearanceId,
    proposedById: row.proposedById,
    proposedAs: row.proposedAs === 'model' ? 'model' : 'photographer',
    status: row.status as CompensationProposalStatus,
    mode: row.mode as CompensationTermMode,
    percent: row.percent,
    fixedUsd: row.fixedUsd,
    paymentBase: row.paymentBase,
    notes: row.notes,
    parentId: row.parentId,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
