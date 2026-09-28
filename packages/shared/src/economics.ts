/** Paid-licence split derived from RevenuePolicy creator-pool rule (not a permanent rate lock).
 *  Free-collection RF grants are $0 and are not part of this split.
 *  Model % (T5) is of the Contributor Distributable Share after this split. */
export function paidLicenceSplit(contributorShare: number): {
  photographerPct: number
  platformPct: number
} {
  const n = Number.isFinite(contributorShare) ? contributorShare : 0.5
  const clamped = Math.min(1, Math.max(0, n))
  const photographerPct = Math.round(clamped * 100)
  return { photographerPct, platformPct: 100 - photographerPct }
}
