import { z } from 'zod'

/** Contributor payout formula. Models are not a share group and do not earn from licences. */
export const SHARE_GROUPS = ['photographer', 'photo_influencer', 'contributor'] as const
export type ShareGroup = (typeof SHARE_GROUPS)[number]

export const SHARE_MODES = ['percentage', 'fixed', 'both'] as const
export type ShareMode = (typeof SHARE_MODES)[number]

export const SHARE_GROUP_LABEL: Record<ShareGroup, string> = {
  photographer: 'Photographers',
  photo_influencer: 'Photo influencers',
  contributor: 'Contributors',
}

export const shareFormulaSchema = z.object({
  mode: z.enum(SHARE_MODES),
  percent: z.number().min(0).max(100),
  fixedUsd: z.number().min(0).max(1_000_000),
})
export type ShareFormulaInput = z.infer<typeof shareFormulaSchema>

/** Matches the live 50/50 ledger until an admin saves another formula. */
export const DEFAULT_SHARE_FORMULA: ShareFormulaInput = {
  mode: 'percentage',
  percent: 50,
  fixedUsd: 0,
}

export interface ShareGroupDto extends ShareFormulaInput {
  groupKey: ShareGroup
}

export interface ShareOverrideDto extends ShareFormulaInput {
  userId: string
  email: string
  name: string
  accountType: string
  handle: string | null
}

export interface ShareAdminDto {
  groups: ShareGroupDto[]
  overrides: ShareOverrideDto[]
}

export interface ShareAccountSearchDto {
  userId: string
  email: string
  name: string
  accountType: string
  handle: string | null
  formula: ShareFormulaInput | null
}

export function isShareGroup(value: string | null | undefined): value is ShareGroup {
  return (SHARE_GROUPS as readonly string[]).includes(value ?? '')
}

export function fallbackShareFormula(contributorShare: number): ShareFormulaInput {
  const ratio = Number.isFinite(contributorShare) ? contributorShare : 0.5
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  return { mode: 'percentage', percent, fixedUsd: 0 }
}

/**
 * Percentage takes that share of the sale.
 * Fixed pays the dollar amount, never more than the sale.
 * Both adds the percentage and the fixed amount, then caps the payout at the sale.
 */
export function applyShareFormula(saleUsd: number, formula: ShareFormulaInput): number {
  const sale = Math.round(Math.max(0, saleUsd) * 100) / 100
  if (sale === 0) return 0
  const percent = Math.min(100, Math.max(0, formula.percent))
  const fixed = Math.max(0, formula.fixedUsd)
  let raw = 0
  if (formula.mode === 'percentage' || formula.mode === 'both') raw += sale * (percent / 100)
  if (formula.mode === 'fixed' || formula.mode === 'both') raw += fixed
  return Math.round(Math.min(sale, raw) * 100) / 100
}
