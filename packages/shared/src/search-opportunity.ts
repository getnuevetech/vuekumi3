import { z } from 'zod'
import { LIBRARY_TIERS } from './library-tiers.js'

/**
 * Content Opportunity Engine — search demand signals from the public catalog.
 *
 * Logs intentional marketplace searches (query and/or filters) so contributors
 * and staff can see what buyers look for when supply is thin or empty.
 * Does not auto-create briefs, campaigns, or recommendations engines.
 */

export const searchOpportunityFiltersSchema = z.object({
  category: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
  license: z.enum(['free', 'premium']).optional(),
  libraryTier: z.enum(LIBRARY_TIERS).optional(),
  tag: z.string().max(60).optional(),
  photographer: z.string().max(60).optional(),
})
export type SearchOpportunityFilters = z.infer<typeof searchOpportunityFiltersSchema>

export interface SearchOpportunityRowDto {
  /** Display label — normalized query or primary filter. */
  label: string
  qNorm: string
  category: string | null
  country: string | null
  license: string | null
  libraryTier: string | null
  tag: string | null
  searches: number
  /** Lowest result count observed for this key in the window. */
  minResults: number
  /** Mean result count across logged searches. */
  avgResults: number
  /** True when any logged search returned zero photos. */
  hasZeroResults: boolean
  lastSearchedAt: string
}

export interface SearchOpportunitySummaryDto {
  windowDays: number
  totalSearches: number
  zeroResultSearches: number
  items: SearchOpportunityRowDto[]
}

/** Collapse whitespace and lowercase for rollup keys. */
export function normalizeSearchOpportunityQuery(q?: string | null): string {
  if (!q) return ''
  return q.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 120)
}

/**
 * Whether a catalog list request is intentional demand (not bare browse).
 * Page > 1 is ignored by the recorder to avoid pagination noise.
 */
export function isSearchOpportunitySignal(input: {
  q?: string | null
  category?: string | null
  country?: string | null
  license?: string | null
  libraryTier?: string | null
  tag?: string | null
  photographer?: string | null
}): boolean {
  if (normalizeSearchOpportunityQuery(input.q)) return true
  if (input.tag?.trim()) return true
  if (input.photographer?.trim()) return true
  if (input.category && input.category !== 'All') return true
  if (input.country?.trim()) return true
  if (input.license) return true
  if (input.libraryTier) return true
  return false
}

/** Stable rollup key: qNorm plus sorted filter fragments. */
export function searchOpportunityGroupKey(input: {
  qNorm: string
  category?: string | null
  country?: string | null
  license?: string | null
  libraryTier?: string | null
  tag?: string | null
  photographer?: string | null
}): string {
  const parts = [
    input.qNorm || '',
    input.category ? `cat:${input.category}` : '',
    input.country ? `co:${input.country}` : '',
    input.license ? `lic:${input.license}` : '',
    input.libraryTier ? `tier:${input.libraryTier}` : '',
    input.tag ? `tag:${input.tag.toLowerCase()}` : '',
    input.photographer ? `ph:${input.photographer.toLowerCase()}` : '',
  ].filter(Boolean)
  return parts.join('|') || '(browse)'
}

export function searchOpportunityLabel(input: {
  qNorm: string
  category?: string | null
  country?: string | null
  license?: string | null
  libraryTier?: string | null
  tag?: string | null
  photographer?: string | null
}): string {
  if (input.qNorm) return input.qNorm
  if (input.tag) return `tag:${input.tag}`
  if (input.photographer) return `photographer:${input.photographer}`
  const bits = [
    input.category,
    input.country,
    input.libraryTier,
    input.license,
  ].filter(Boolean)
  return bits.join(' · ') || 'catalog'
}
