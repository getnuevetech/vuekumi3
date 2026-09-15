import { z } from 'zod'

export const PLUS_PLAN = 'plus' as const
export const FREE_PLAN = 'free' as const
export const PLUS_PRICE_USD = 19
export const PLUS_PERIOD_DAYS = 30
export const FREE_RF_DAILY_QUOTA = 50

export const startPlusSchema = z.object({
  provider: z.enum(['stripe', 'flutterwave']).optional(),
})

export type StartPlusInput = z.infer<typeof startPlusSchema>
export type SubscriptionPlan = typeof FREE_PLAN | typeof PLUS_PLAN
export type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired'

export interface SubscriptionDto {
  id: string
  plan: typeof PLUS_PLAN
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
  plan: SubscriptionPlan
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
