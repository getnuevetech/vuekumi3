import { z } from 'zod'

export const payoutKindSchema = z.enum(['bank', 'mobile_money'])
export const payoutStatusSchema = z.enum(['requested', 'paid', 'rejected'])

/** T6 — model likeness_compensation withdrawal. Default OFF until finance readiness. */
export const MODEL_WITHDRAWAL_SETTING_KEY = 'payouts.model_withdrawal_enabled'

export const payoutMethodSchema = z.object({
  kind: payoutKindSchema,
  label: z.string().min(2).max(80),
  accountName: z.string().min(2).max(120),
  accountRef: z.string().min(4).max(80),
  bankName: z.string().min(2).max(80).optional(),
  country: z.string().max(2).optional(),
  isDefault: z.boolean().optional(),
})

export const requestPayoutSchema = z.object({
  methodId: z.string().min(8).max(40).optional(),
})

export const adminPayoutActionSchema = z.object({
  notes: z.string().max(2000).optional(),
})

export type PayoutKind = z.infer<typeof payoutKindSchema>
export type PayoutStatus = z.infer<typeof payoutStatusSchema>
export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>

export interface PayoutMethodDto {
  id: string
  kind: PayoutKind
  label: string
  accountName: string
  accountRefMasked: string
  bankName: string | null
  country: string | null
  isDefault: boolean
}

export interface PayoutDto {
  id: string
  amountUsd: number
  status: PayoutStatus
  methodLabel: string
  methodKind: PayoutKind
  accountRefMasked: string
  contributorHandle: string | null
  contributorName: string
  notes: string | null
  requestedAt: string
  processedAt: string | null
}

/** How a contributor's USD ledger is shown in their home currency. */
export interface EarningsPayoutQuote {
  countryCode: string | null
  countryName: string | null
  currency: string
  currencyName: string
  /** Local currency units for 1 USD. Null when no payout partner has returned a rate. */
  rateToUsd: number | null
  partnerName: string | null
  partnerSlug: string | null
  source: 'primary' | 'alternate' | 'usd' | 'unavailable'
  fetchedAt: string | null
}

export interface EarningsSummaryDto {
  availableUsd: number
  pendingUsd: number
  heldUsd: number
  paidUsd: number
  thisMonthUsd: number
  allTimeUsd: number
  minPayoutUsd: number
  canRequest: boolean
  requestBlocker: string | null
  /** True when the payee is a model and model withdrawal flag is ON. */
  modelWithdrawalEnabled: boolean
  /** Provider stays manual — no invented processor. */
  payoutProvider: 'manual'
  payout: EarningsPayoutQuote
  items: {
    id: string
    photoTitle: string
    amountUsd: number
    source: string
    status: string
    holdReason?: string | null
    createdAt: string
  }[]
  series: { month: string; earnings: number }[]
  methods: PayoutMethodDto[]
  payouts: PayoutDto[]
}

export function modelWithdrawalBlocker(enabled: boolean): string | null {
  if (enabled) return null
  return 'Model likeness payout withdrawal is finance-gated. Ledger lines remain; request payout when finance enables model withdrawal.'
}
