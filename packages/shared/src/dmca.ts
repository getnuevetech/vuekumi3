import { z } from 'zod'

/** DMCA is copyright only. Likeness/privacy/contract stay on the rights-report path. */
export const DMCA_SCOPE = 'copyright' as const

export const DMCA_NOTICE_STATUSES = [
  'received',
  'processing',
  'waiting_counter',
  'counter_received',
  'waiting_restore',
  'restored',
  'rejected',
  'closed',
] as const
export const dmcaNoticeStatusSchema = z.enum(DMCA_NOTICE_STATUSES)
export type DmcaNoticeStatus = (typeof DMCA_NOTICE_STATUSES)[number]

export const RIGHTS_STRIKE_REASONS = [
  'fake_release',
  'fake_photographer',
  'false_creation_claim',
  'upheld_copyright_fraud',
  'upheld_likeness_fraud',
] as const
export const rightsStrikeReasonSchema = z.enum(RIGHTS_STRIKE_REASONS)
export type RightsStrikeReason = (typeof RIGHTS_STRIKE_REASONS)[number]

export const EARNINGS_HOLD_REASONS = [
  'dmca_notice',
  'copyright_dispute',
  'likeness_dispute',
  'safety_urgent',
  'new_seller',
  'unverified_seller',
  'high_value',
  'repeat_infringer',
] as const
export const earningsHoldReasonSchema = z.enum(EARNINGS_HOLD_REASONS)
export type EarningsHoldReason = (typeof EARNINGS_HOLD_REASONS)[number]

export const EARNINGS_LEDGER_STATUSES = ['available', 'reserved', 'paid', 'held'] as const
export type EarningsLedgerStatus = (typeof EARNINGS_LEDGER_STATUSES)[number]

export const DEFAULT_DMCA_AGENT = {
  name: 'VueKumi DMCA Agent',
  address: 'Designated agent address is set in Admin Settings. Copyright Office filing is ops/counsel.',
  email: 'dmca@vuekumi.com',
  phone: '',
}

export const DEFAULT_REPEAT_INFRINGER_THRESHOLD = 3
export const DEFAULT_COUNTER_WAIT_DAYS = 14
export const DEFAULT_NEW_SELLER_HOLD_DAYS = 14
export const DEFAULT_HIGH_VALUE_HOLD_USD = 500

export const REPEAT_INFRINGER_POLICY = [
  'VueKumi terminates accounts that accumulate upheld copyright or likeness fraud.',
  'A strike is recorded only after staff uphold fraud: a fake model release, a fake photographer identity, a false “I created this” claim, or other upheld copyright or likeness fraud.',
  'A DMCA notice by itself is not a strike. Filing a notice freezes new licensing and holds unpaid earnings on the named photographs while staff read it.',
  'The default threshold is three upheld strikes. Admin Settings can raise or lower that number. Reaching the threshold suspends the account. Photographs stay in the library; new licensing stays frozen; unpaid earnings stay held.',
  'DMCA covers copyright. Likeness, privacy, and contract complaints use the public rights-report form, not this notice.',
].join(' ')

export const createDmcaNoticeSchema = z.object({
  photoId: z.string().trim().min(1).max(80).optional(),
  photoUrl: z.string().trim().url().max(500).optional(),
  claimantName: z.string().trim().min(2).max(120),
  claimantEmail: z.string().trim().email().max(200),
  claimantAddress: z.string().trim().min(8).max(500),
  claimantPhone: z.string().trim().max(40).optional(),
  workDescription: z.string().trim().min(20, 'Describe the copyrighted work in at least 20 characters').max(4000),
  originalLocation: z.string().trim().min(4).max(500),
  infringingLocation: z.string().trim().min(4).max(500),
  goodFaith: z.literal(true),
  perjury: z.literal(true),
  signature: z.string().trim().min(2).max(120),
}).refine((body) => Boolean(body.photoId || body.photoUrl), {
  message: 'Name a VueKumi photograph id or URL',
  path: ['photoId'],
})
export type CreateDmcaNoticeInput = z.infer<typeof createDmcaNoticeSchema>

export const createDmcaCounterNoticeSchema = z.object({
  senderName: z.string().trim().min(2).max(120),
  senderEmail: z.string().trim().email().max(200),
  senderAddress: z.string().trim().min(8).max(500),
  senderPhone: z.string().trim().max(40).optional(),
  statement: z.string().trim().min(20, 'Explain the mistake or misidentification in at least 20 characters').max(4000),
  consentToJurisdiction: z.literal(true),
  perjury: z.literal(true),
  signature: z.string().trim().min(2).max(120),
})
export type CreateDmcaCounterNoticeInput = z.infer<typeof createDmcaCounterNoticeSchema>

export const decideDmcaNoticeSchema = z.object({
  action: z.enum(['process', 'reject', 'close', 'restore']),
  notes: z.string().trim().max(2000).optional(),
})
export type DecideDmcaNoticeInput = z.infer<typeof decideDmcaNoticeSchema>

export const createRightsStrikeSchema = z.object({
  userId: z.string().min(8).max(40),
  reason: rightsStrikeReasonSchema,
  photoId: z.string().min(1).max(80).optional(),
  noticeId: z.string().min(8).max(40).optional(),
  notes: z.string().trim().min(8).max(2000),
})
export type CreateRightsStrikeInput = z.infer<typeof createRightsStrikeSchema>

export const releaseEarningsHoldSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
})
export type ReleaseEarningsHoldInput = z.infer<typeof releaseEarningsHoldSchema>

export interface DmcaAgentDto {
  name: string
  address: string
  email: string
  phone: string
  copyrightOfficeFiling: 'ops_counsel'
}

export interface DmcaPublicPageDto {
  agent: DmcaAgentDto
  scope: typeof DMCA_SCOPE
  policy: string
  counterWaitDays: number
  repeatInfringerThreshold: number
  copyrightOfficeNote: string
}

export interface DmcaCounterNoticeDto {
  id: string
  senderName: string
  senderEmail: string
  senderAddress: string
  receivedAt: string
}

export interface DmcaNoticeDto {
  id: string
  photoId: string | null
  photoTitle: string | null
  photoSrc: string | null
  photographer: string | null
  claimantName: string
  claimantEmail: string
  claimantAddress: string
  claimantPhone: string | null
  workDescription: string
  originalLocation: string
  infringingLocation: string
  signature: string
  status: DmcaNoticeStatus
  restoreEligibleAt: string | null
  receivedAt: string
  reviewedAt: string | null
  staffNotes: string | null
  commercialLocked: boolean
  commercialLockReason?: string | null
  counter: DmcaCounterNoticeDto | null
}

export interface RightsStrikeDto {
  id: string
  userId: string
  userName: string
  userEmail: string
  reason: RightsStrikeReason
  photoId: string | null
  noticeId: string | null
  notes: string
  createdAt: string
  strikeCount: number
  terminated: boolean
}

export interface EarningsHoldDto {
  id: string
  contributorId: string
  contributorName: string
  contributorHandle: string | null
  photoId: string
  photoTitle: string
  amountUsd: number
  holdReason: EarningsHoldReason | string | null
  heldAt: string | null
  createdAt: string
}

export function parsePhotoIdFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/photo\/([^/]+)/)
    return match?.[1] || undefined
  } catch {
    const match = url.match(/\/photo\/([^/?#]+)/)
    return match?.[1] || undefined
  }
}

export function addBusinessDays(from: Date, days: number): Date {
  const next = new Date(from.getTime())
  let remaining = Math.max(0, days)
  while (remaining > 0) {
    next.setUTCDate(next.getUTCDate() + 1)
    const weekday = next.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return next
}

export function initialEarningsHold(input: {
  contributorCreatedAt: Date
  now?: Date
  hasVerifiedCopyright: boolean
  amountUsd: number
  commercialLocked?: boolean
  copyrightDisputed?: boolean
  newSellerHoldDays: number
  highValueHoldUsd: number
}): { status: 'available' | 'held'; holdReason: EarningsHoldReason | null } {
  if (input.copyrightDisputed) return { status: 'held', holdReason: 'copyright_dispute' }
  if (input.commercialLocked) return { status: 'held', holdReason: 'copyright_dispute' }
  const now = input.now ?? new Date()
  const ageMs = now.getTime() - input.contributorCreatedAt.getTime()
  if (ageMs < input.newSellerHoldDays * 24 * 60 * 60 * 1000) {
    return { status: 'held', holdReason: 'new_seller' }
  }
  if (!input.hasVerifiedCopyright) return { status: 'held', holdReason: 'unverified_seller' }
  if (input.amountUsd >= input.highValueHoldUsd) return { status: 'held', holdReason: 'high_value' }
  return { status: 'available', holdReason: null }
}

export function canRestoreDmcaNotice(input: {
  status: DmcaNoticeStatus
  restoreEligibleAt?: Date | string | null
  now?: Date
}): string | null {
  if (input.status === 'restored') return 'This notice is already restored'
  if (input.status === 'rejected' || input.status === 'closed') return 'This notice is closed'
  if (input.status !== 'counter_received' && input.status !== 'waiting_restore') {
    return 'Restore waits for a stored counter-notice and the statutory period'
  }
  if (!input.restoreEligibleAt) return 'Restore waits for the statutory period after a counter-notice'
  const ready = new Date(input.restoreEligibleAt)
  const now = input.now ?? new Date()
  if (ready.getTime() > now.getTime()) {
    return 'Restore waits for the statutory period after the counter-notice. Staff must still act — this is not automatic.'
  }
  return null
}
