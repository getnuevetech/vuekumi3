import { z } from 'zod'

export const PLUS_PLAN = 'plus' as const
export const FREE_PLAN = 'free' as const
export const PLUS_PRICE_USD = 19
export const PLUS_PERIOD_DAYS = 30
export const FREE_RF_DAILY_QUOTA = 50

export const startPlusSchema = z.object({
  provider: z.enum(['stripe', 'flutterwave']).optional(),
  plan: z.string().trim().min(1).max(40).optional(),
})

export type StartPlusInput = z.infer<typeof startPlusSchema>
export type SubscriptionPlan = typeof FREE_PLAN | typeof PLUS_PLAN
export type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired'

export interface BuyerPlanDto {
  id: string
  slug: string
  name: string
  priceUsd: number
  periodDays: number
  description: string | null
  enabled: boolean
  sortOrder: number
}

export const buyerPlanSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a short slug of lowercase letters, numbers, and hyphens')

export const createBuyerPlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: buyerPlanSlugSchema.optional(),
  priceUsd: z.number().min(0).max(100000),
  periodDays: z.number().int().min(1).max(3650),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
})
export type CreateBuyerPlanInput = z.infer<typeof createBuyerPlanSchema>

export const patchBuyerPlanSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  priceUsd: z.number().min(0).max(100000).optional(),
  periodDays: z.number().int().min(1).max(3650).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
})
export type PatchBuyerPlanInput = z.infer<typeof patchBuyerPlanSchema>

export interface SubscriptionDto {
  id: string
  plan: string
  status: SubscriptionStatus
  amountUsd: number
  currency: string
  amountLocal: number
  provider: 'stripe' | 'flutterwave' | 'dev'
  checkoutUrl: string | null
  periodStart: string | null
  periodEnd: string | null
  cancelledAt: string | null
  createdAt: string
}

export interface QuotaDto {
  used: number
  limit: number | null
  remaining: number | null
  unlimited: boolean
  resetAt: string
}

export interface SubscriptionStatusDto {
  plan: string
  planName: string | null
  plusUntil: string | null
  status: 'none' | SubscriptionStatus
  quota: QuotaDto
  current: SubscriptionDto | null
  pending: SubscriptionDto | null
  priceUsd: number
  periodDays: number
}

export interface SubscriptionCheckoutDto {
  subscriptionId: string
  provider: 'stripe' | 'flutterwave' | 'dev'
  url: string
  amountUsd: number
  currency: string
  amountLocal: number
}
