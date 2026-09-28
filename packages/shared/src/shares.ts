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

/**
 * Share of the Contributor Distributable Share (creator pool after RevenuePolicy).
 * Default 100% = photographer receives the full creator pool; platform cut is
 * stamped separately on RevenuePolicy, not here.
 */
export const DEFAULT_SHARE_FORMULA: ShareFormulaInput = {
  mode: 'percentage',
  percent: 100,
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

/** Fallback when no group/personal formula exists — full creator pool. */
export function fallbackShareFormula(_contributorShare?: number): ShareFormulaInput {
  return { ...DEFAULT_SHARE_FORMULA }
}

/**
 * Percentage takes that share of the creator-pool base (not raw sale).
 * Fixed pays the dollar amount, never more than the base.
 * Both adds the percentage and the fixed amount, then caps at the base.
 */
export function applyShareFormula(baseUsd: number, formula: ShareFormulaInput): number {
  const base = Math.round(Math.max(0, baseUsd) * 100) / 100
  if (base === 0) return 0
  const percent = Math.min(100, Math.max(0, formula.percent))
  const fixed = Math.max(0, formula.fixedUsd)
  let raw = 0
  if (formula.mode === 'percentage' || formula.mode === 'both') raw += base * (percent / 100)
  if (formula.mode === 'fixed' || formula.mode === 'both') raw += fixed
  return Math.round(Math.min(base, raw) * 100) / 100
}
