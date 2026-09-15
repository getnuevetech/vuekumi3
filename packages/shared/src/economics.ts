/** Paid-licence split. Free-collection RF grants are $0 and are not part of this split.
 *  Phase 24: models do not earn. Photographer/model/platform split is still undecided. */
export function paidLicenceSplit(contributorShare: number): {
  photographerPct: number
  platformPct: number
} {
  const n = Number.isFinite(contributorShare) ? contributorShare : 0.5
  const clamped = Math.min(1, Math.max(0, n))
  const photographerPct = Math.round(clamped * 100)
  return { photographerPct, platformPct: 100 - photographerPct }
}
