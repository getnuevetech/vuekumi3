import {
  DEFAULT_HIGH_VALUE_HOLD_USD,
  DEFAULT_NEW_SELLER_HOLD_DAYS,
  DEFAULT_REPEAT_INFRINGER_THRESHOLD,
  DEFAULT_COUNTER_WAIT_DAYS,
  DEFAULT_DMCA_AGENT,
  initialEarningsHold,
  type EarningsHoldDto,
  type EarningsHoldReason,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { getSettingSafe } from './settings.js'

export async function loadHoldSettings() {
  const [newSeller, highValue, threshold, waitDays, agentName, agentAddress, agentEmail, agentPhone] = await Promise.all([
    getSettingSafe('payouts.new_seller_hold_days'),
    getSettingSafe('payouts.high_value_hold_usd'),
    getSettingSafe('dmca.repeat_infringer_threshold'),
    getSettingSafe('dmca.counter_wait_days'),
    getSettingSafe('dmca.agent_name'),
    getSettingSafe('dmca.agent_address'),
    getSettingSafe('dmca.agent_email'),
    getSettingSafe('dmca.agent_phone'),
  ])
  return {
    newSellerHoldDays: parsePositiveInt(newSeller, DEFAULT_NEW_SELLER_HOLD_DAYS),
    highValueHoldUsd: parsePositiveInt(highValue, DEFAULT_HIGH_VALUE_HOLD_USD),
    repeatInfringerThreshold: parsePositiveInt(threshold, DEFAULT_REPEAT_INFRINGER_THRESHOLD),
    counterWaitDays: parsePositiveInt(waitDays, DEFAULT_COUNTER_WAIT_DAYS),
    agent: {
      name: agentName?.trim() || DEFAULT_DMCA_AGENT.name,
      address: agentAddress?.trim() || DEFAULT_DMCA_AGENT.address,
      email: agentEmail?.trim() || DEFAULT_DMCA_AGENT.email,
      phone: agentPhone?.trim() || DEFAULT_DMCA_AGENT.phone,
      copyrightOfficeFiling: 'ops_counsel' as const,
    },
  }
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.round(n)
}

export async function contributorHasVerifiedCopyright(contributorId: string): Promise<boolean> {
  const row = await prisma.rightsRecord.findFirst({
    where: { photo: { contributorId }, copyrightStatus: 'verified' },
    select: { id: true },
  })
  return Boolean(row)
}

export async function decideGrantEarningsStatus(input: {
  contributorId: string
  contributorCreatedAt: Date
  amountUsd: number
  commercialLocked: boolean
  copyrightStatus?: string | null
}) {
  const settings = await loadHoldSettings()
  const hasVerifiedCopyright = await contributorHasVerifiedCopyright(input.contributorId)
  return initialEarningsHold({
    contributorCreatedAt: input.contributorCreatedAt,
    hasVerifiedCopyright,
    amountUsd: input.amountUsd,
    commercialLocked: input.commercialLocked,
    copyrightDisputed: input.copyrightStatus === 'disputed',
    newSellerHoldDays: settings.newSellerHoldDays,
    highValueHoldUsd: settings.highValueHoldUsd,
  })
}

export async function holdAvailableEarnings(input: {
  photoIds: string[]
  reason: EarningsHoldReason
}) {
  if (input.photoIds.length === 0) return { count: 0 }
  const result = await prisma.earningsLedger.updateMany({
    where: { photoId: { in: input.photoIds }, status: 'available' },
    data: { status: 'held', holdReason: input.reason, heldAt: new Date() },
  })
  return { count: result.count }
}

export async function holdContributorAvailableEarnings(input: {
  contributorId: string
  reason: EarningsHoldReason
}) {
  return prisma.earningsLedger.updateMany({
    where: { contributorId: input.contributorId, status: 'available' },
    data: { status: 'held', holdReason: input.reason, heldAt: new Date() },
  })
}

export async function releaseEarningsHold(id: string) {
  const row = await prisma.earningsLedger.findUnique({ where: { id } })
  if (!row) return null
  if (row.status !== 'held') return row
  return prisma.earningsLedger.update({
    where: { id },
    data: { status: 'available', holdReason: null, heldAt: null },
  })
}

export async function releasePhotoHolds(photoId: string, reason?: EarningsHoldReason) {
  return prisma.earningsLedger.updateMany({
    where: {
      photoId,
      status: 'held',
      ...(reason ? { holdReason: reason } : {}),
    },
    data: { status: 'available', holdReason: null, heldAt: null },
  })
}

export function serializeEarningsHold(
  row: {
    id: string
    contributorId: string
    photoId: string
    amountUsd: number
    holdReason: string | null
    heldAt: Date | null
    createdAt: Date
    photo: { title: string }
    contributor: { name: string; contributorProfile: { handle: string } | null }
  },
): EarningsHoldDto {
  return {
    id: row.id,
    contributorId: row.contributorId,
    contributorName: row.contributor.name,
    contributorHandle: row.contributor.contributorProfile?.handle ?? null,
    photoId: row.photoId,
    photoTitle: row.photo.title,
    amountUsd: row.amountUsd,
    holdReason: row.holdReason,
    heldAt: row.heldAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
