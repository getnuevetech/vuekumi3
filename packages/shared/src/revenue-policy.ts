/**
 * Versioned RevenuePolicy — platform share and creator pool stay distinct.
 * Model percentages (T5) are calculated from Contributor Distributable Share
 * (= creator pool after platform share and refunds), before recipient tax/FX.
 */

export interface RevenuePolicyDto {
  policyId: string
  version: number
  effectiveFrom: string
  platformShareRule: number
  creatorPoolRule: number
  refundRule: string
  taxRule: string
  processingFeeRule: string
  licenseType: string
  current: boolean
  notes?: string | null
}

export interface RevenueAllocation {
  policyId: string
  version: number
  netCollectedUsd: number
  platformShareUsd: number
  creatorPoolUsd: number
}

/** Allocate Net Collected License Revenue under a stamped policy. */
export function allocateRevenue(
  netCollectedUsd: number,
  policy: Pick<RevenuePolicyDto, 'policyId' | 'version' | 'platformShareRule' | 'creatorPoolRule'>,
): RevenueAllocation {
  const net = Math.max(0, netCollectedUsd)
  const platform = Math.round(net * policy.platformShareRule * 100) / 100
  const creator = Math.round((net - platform) * 100) / 100
  return {
    policyId: policy.policyId,
    version: policy.version,
    netCollectedUsd: net,
    platformShareUsd: platform,
    creatorPoolUsd: creator,
  }
}

/**
 * Model % of Contributor Distributable Share (Dec-PayBase).
 * Does not silently reduce platform share (Dec-Split).
 */
export function modelShareFromCreatorPool(creatorPoolUsd: number, modelPercent: number): number {
  const pct = Math.min(100, Math.max(0, modelPercent))
  return Math.round(creatorPoolUsd * (pct / 100) * 100) / 100
}
