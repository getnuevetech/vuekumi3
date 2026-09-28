import type {
  PhotoListQuery,
  SearchOpportunityRowDto,
  SearchOpportunitySummaryDto,
} from '@vuekumi/shared'
import {
  isSearchOpportunitySignal,
  normalizeSearchOpportunityQuery,
  searchOpportunityGroupKey,
  searchOpportunityLabel,
} from '@vuekumi/shared'
import { prisma } from './prisma.js'

const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_LIMIT = 12

export type RecordSearchOpportunityInput = {
  query: PhotoListQuery
  resultCount: number
  userId?: string | null
  anonymousSessionId?: string | null
  referrer?: string | null
  source?: string
}

/** Persist a demand signal when the list request carries intentional search filters. */
export async function recordSearchOpportunity(
  input: RecordSearchOpportunityInput,
): Promise<void> {
  const { query, resultCount } = input
  if (query.page !== 1) return
  if (!isSearchOpportunitySignal(query)) return

  const qNorm = normalizeSearchOpportunityQuery(query.q)
  await prisma.searchOpportunityEvent.create({
    data: {
      q: query.q?.trim().slice(0, 120) ?? '',
      qNorm,
      category: query.category && query.category !== 'All' ? query.category : null,
      country: query.country?.trim() || null,
      license: query.license ?? null,
      libraryTier: query.libraryTier ?? null,
      tag: query.tag?.trim() || null,
      photographer: query.photographer?.trim() || null,
      resultCount,
      page: query.page,
      userId: input.userId ?? null,
      anonymousSessionId: input.anonymousSessionId ?? null,
      source: input.source ?? 'catalog',
      referrer: input.referrer?.slice(0, 500) || null,
    },
  })
}

/** Fire-and-forget wrapper — never fails the catalog response. */
export function recordSearchOpportunitySafe(input: RecordSearchOpportunityInput): void {
  void recordSearchOpportunity(input).catch(() => {
    /* demand logging must not break search */
  })
}

type EventRow = {
  qNorm: string
  category: string | null
  country: string | null
  license: string | null
  libraryTier: string | null
  tag: string | null
  photographer: string | null
  resultCount: number
  createdAt: Date
}

function toRowDto(group: EventRow[]): SearchOpportunityRowDto {
  const head = group[0]!
  const searches = group.length
  const minResults = Math.min(...group.map((g) => g.resultCount))
  const avgResults = Math.round(
    (group.reduce((sum, g) => sum + g.resultCount, 0) / searches) * 10,
  ) / 10
  const lastSearchedAt = group.reduce(
    (latest, g) => (g.createdAt > latest ? g.createdAt : latest),
    group[0]!.createdAt,
  )
  return {
    label: searchOpportunityLabel(head),
    qNorm: head.qNorm,
    category: head.category,
    country: head.country,
    license: head.license,
    libraryTier: head.libraryTier,
    tag: head.tag,
    searches,
    minResults,
    avgResults,
    hasZeroResults: minResults === 0,
    lastSearchedAt: lastSearchedAt.toISOString(),
  }
}

/**
 * Rank unmet demand: zero-result first, then low avg results, then search volume.
 */
export function rankSearchOpportunities(rows: SearchOpportunityRowDto[]): SearchOpportunityRowDto[] {
  return [...rows].sort((a, b) => {
    if (a.hasZeroResults !== b.hasZeroResults) return a.hasZeroResults ? -1 : 1
    if (a.minResults !== b.minResults) return a.minResults - b.minResults
    if (a.searches !== b.searches) return b.searches - a.searches
    return b.lastSearchedAt.localeCompare(a.lastSearchedAt)
  })
}

export async function loadSearchOpportunitySummary(input?: {
  windowDays?: number
  limit?: number
}): Promise<SearchOpportunitySummaryDto> {
  const windowDays = input?.windowDays ?? DEFAULT_WINDOW_DAYS
  const limit = input?.limit ?? DEFAULT_LIMIT
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const events = await prisma.searchOpportunityEvent.findMany({
    where: { createdAt: { gte: since } },
    select: {
      qNorm: true,
      category: true,
      country: true,
      license: true,
      libraryTier: true,
      tag: true,
      photographer: true,
      resultCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  })

  const totalSearches = events.length
  const zeroResultSearches = events.filter((e) => e.resultCount === 0).length

  const groups = new Map<string, EventRow[]>()
  for (const event of events) {
    const key = searchOpportunityGroupKey(event)
    const list = groups.get(key)
    if (list) list.push(event)
    else groups.set(key, [event])
  }

  const items = rankSearchOpportunities([...groups.values()].map(toRowDto)).slice(0, limit)

  return {
    windowDays,
    totalSearches,
    zeroResultSearches,
    items,
  }
}
