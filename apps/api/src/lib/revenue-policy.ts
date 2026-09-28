import type { Prisma, PrismaClient } from '@prisma/client'
import { allocateRevenue, type RevenueAllocation, type RevenuePolicyDto } from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { getContributorShare } from './payments-config.js'

type Db = Prisma.TransactionClient | PrismaClient

const DEFAULT_POLICY_ID = 'RP-2026-001'

export async function ensureDefaultRevenuePolicy(client: Db = prisma) {
  const existing = await client.revenuePolicy.findFirst({ where: { current: true } })
  if (existing) return existing
  return client.revenuePolicy.create({
    data: {
      id: 'rp_2026_001_v1',
      policyId: DEFAULT_POLICY_ID,
      version: 1,
      platformShareRule: 0.5,
      creatorPoolRule: 0.5,
      current: true,
      notes: 'Initial policy mirroring legacy 50/50. Rates are versioned, not permanent.',
    },
  })
}

export async function getCurrentRevenuePolicy(client: Db = prisma) {
  await ensureDefaultRevenuePolicy(client)
  const row = await client.revenuePolicy.findFirst({
    where: { current: true },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
  })
  if (!row) throw new Error('No current RevenuePolicy')
  return row
}

export function toRevenuePolicyDto(row: {
  policyId: string
  version: number
  effectiveFrom: Date
  platformShareRule: number
  creatorPoolRule: number
  refundRule: string
  taxRule: string
  processingFeeRule: string
  licenseType: string
  current: boolean
  notes: string | null
}): RevenuePolicyDto {
  return {
    policyId: row.policyId,
    version: row.version,
    effectiveFrom: row.effectiveFrom.toISOString(),
    platformShareRule: row.platformShareRule,
    creatorPoolRule: row.creatorPoolRule,
    refundRule: row.refundRule,
    taxRule: row.taxRule,
    processingFeeRule: row.processingFeeRule,
    licenseType: row.licenseType,
    current: row.current,
    notes: row.notes,
  }
}

/**
 * Allocate sale under current RevenuePolicy.
 * Falls back to payments.contributor_share only if policy missing creator pool
 * (should not happen after ensureDefaultRevenuePolicy).
 */
export async function allocateUnderCurrentPolicy(
  netCollectedUsd: number,
  client: Db = prisma,
): Promise<RevenueAllocation & { dto: RevenuePolicyDto }> {
  const row = await getCurrentRevenuePolicy(client)
  let platformRule = row.platformShareRule
  let creatorRule = row.creatorPoolRule
  if (!Number.isFinite(platformRule + creatorRule) || Math.abs(platformRule + creatorRule - 1) > 0.001) {
    const contributor = await getContributorShare()
    platformRule = 1 - contributor
    creatorRule = contributor
  }
  const allocation = allocateRevenue(netCollectedUsd, {
    policyId: row.policyId,
    version: row.version,
    platformShareRule: platformRule,
    creatorPoolRule: creatorRule,
  })
  return { ...allocation, dto: toRevenuePolicyDto(row) }
}
