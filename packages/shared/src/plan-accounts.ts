import { z } from 'zod'

/** Who a subscription plan is for. A buyer plan cannot be bought by a photographer, contributor, or model. */
export const PLAN_AUDIENCES = ['buyer', 'photographer', 'contributor', 'model'] as const
export type PlanAudience = (typeof PLAN_AUDIENCES)[number]

export const DOWNGRADE_MODES = ['prorate', 'refund', 'neither'] as const
export type DowngradeMode = (typeof DOWNGRADE_MODES)[number]

export const CANCELLATION_REASONS = ['too_expensive', 'not_using', 'missing_features', 'switching', 'other'] as const
export type CancellationReason = (typeof CANCELLATION_REASONS)[number]

export const CANCELLATION_REASON_LABEL: Record<CancellationReason, string> = {
  too_expensive: 'Too expensive',
  not_using: 'Not using it',
  missing_features: 'Missing features',
  switching: 'Switching to something else',
  other: 'Other',
}

export const PROFILE_FIELD_KEYS = ['avatar', 'phone', 'address', 'bio', 'location'] as const
export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number]

export const PROFILE_FIELD_LABEL: Record<ProfileFieldKey, string> = {
  avatar: 'Profile picture',
  phone: 'Mobile number',
  address: 'Address',
  bio: 'Bio',
  location: 'Public location',
}

export const DEFAULT_PROFILE_REQUIREMENTS: Record<string, ProfileFieldKey[]> = {
  user: [],
  agency: [],
  photographer: ['phone', 'bio'],
  photo_influencer: ['phone', 'bio'],
  contributor: ['phone', 'bio'],
  model: ['phone', 'avatar'],
  admin: [],
}

export function planAudienceForAccount(accountType: string | null | undefined): PlanAudience | null {
  if (accountType === 'user' || accountType === 'agency') return 'buyer'
  if (accountType === 'photographer' || accountType === 'photo_influencer') return 'photographer'
  if (accountType === 'contributor') return 'contributor'
  if (accountType === 'model') return 'model'
  return null
}

export function unusedCreditUsd(amountUsd: number, periodStart: Date, periodEnd: Date, now = new Date()) {
  const total = periodEnd.getTime() - periodStart.getTime()
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || total <= 0) return 0
  const remaining = Math.max(0, periodEnd.getTime() - now.getTime())
  return Math.round((amountUsd * (remaining / total)) * 100) / 100
}

export interface PlanChangeQuote {
  kind: 'upgrade' | 'downgrade' | 'same'
  chargeUsd: number
  refundUsd: number
  mode: DowngradeMode
}

/** Upgrade charges the new price minus unused credit. Downgrade follows the admin mode. */
export function quotePlanChange(input: {
  currentPrice: number
  nextPrice: number
  creditUsd: number
  mode: DowngradeMode
}): PlanChangeQuote {
  const credit = Math.max(0, input.creditUsd)
  const round = (n: number) => Math.round(n * 100) / 100
  if (input.nextPrice === input.currentPrice) {
    return { kind: 'same', chargeUsd: 0, refundUsd: 0, mode: input.mode }
  }
  if (input.nextPrice > input.currentPrice) {
    return { kind: 'upgrade', chargeUsd: round(Math.max(0, input.nextPrice - credit)), refundUsd: 0, mode: input.mode }
  }
  if (input.mode === 'prorate') {
    return { kind: 'downgrade', chargeUsd: round(Math.max(0, input.nextPrice - credit)), refundUsd: 0, mode: input.mode }
  }
  if (input.mode === 'refund') {
    return { kind: 'downgrade', chargeUsd: input.nextPrice, refundUsd: credit, mode: input.mode }
  }
  return { kind: 'downgrade', chargeUsd: input.nextPrice, refundUsd: 0, mode: input.mode }
}

export const cancelSubscriptionSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  detail: z.string().trim().max(500).optional(),
})

export const patchPlanPolicySchema = z.object({
  downgradeMode: z.enum(DOWNGRADE_MODES),
})

export const patchProfileRequirementsSchema = z.object({
  items: z.array(z.object({
    accountType: z.string().trim().min(1).max(40),
    fields: z.array(z.enum(PROFILE_FIELD_KEYS)).max(PROFILE_FIELD_KEYS.length),
  })).min(1).max(12),
})

export const changePlanSchema = z.object({
  plan: z.string().trim().min(1).max(40),
})
