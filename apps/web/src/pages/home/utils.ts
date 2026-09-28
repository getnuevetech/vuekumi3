import type { SiteFacts } from '@vuekumi/shared'
import { isCreatorAccount } from '@vuekumi/shared'

export const SELL_HREF = '/login?redirect=/contributor/upload&signup=photographer'
export const INFLUENCER_JOIN = '/login?redirect=/contributor/upload&signup=photo_influencer'

export function siteTokens(facts: SiteFacts, extra: Record<string, string | number> = {}) {
  return {
    share: `${facts.photographerPct}%`,
    minimum: facts.payoutMinimumUsd,
    photographerPct: facts.photographerPct,
    platformPct: 100 - facts.photographerPct,
    ...extra,
  }
}

export function contributorPortalHref(accountType?: string) {
  return isCreatorAccount(accountType) ? '/contributor' : SELL_HREF
}
