import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isSearchOpportunitySignal,
  normalizeSearchOpportunityQuery,
  searchOpportunityGroupKey,
  searchOpportunityLabel,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import {
  loadSearchOpportunitySummary,
  rankSearchOpportunities,
  recordSearchOpportunity,
} from '../src/lib/search-opportunity.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('search opportunity helpers: normalize, signal, group, rank', () => {
  assert.equal(normalizeSearchOpportunityQuery('  Lagos   Night '), 'lagos night')
  assert.equal(isSearchOpportunitySignal({}), false)
  assert.equal(isSearchOpportunitySignal({ q: 'baobab' }), true)
  assert.equal(isSearchOpportunitySignal({ category: 'All' }), false)
  assert.equal(isSearchOpportunitySignal({ category: 'People' }), true)
  assert.equal(isSearchOpportunitySignal({ libraryTier: 'VERIFIED_PLUS' }), true)

  assert.equal(
    searchOpportunityGroupKey({ qNorm: 'lagos', category: 'People' }),
    'lagos|cat:People',
  )
  assert.equal(searchOpportunityLabel({ qNorm: 'lagos' }), 'lagos')
  assert.equal(searchOpportunityLabel({ qNorm: '', tag: 'sahel' }), 'tag:sahel')

  const ranked = rankSearchOpportunities([
    {
      label: 'hit',
      qNorm: 'hit',
      category: null,
      country: null,
      license: null,
      libraryTier: null,
      tag: null,
      searches: 10,
      minResults: 5,
      avgResults: 5,
      hasZeroResults: false,
      lastSearchedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      label: 'gap',
      qNorm: 'gap',
      category: null,
      country: null,
      license: null,
      libraryTier: null,
      tag: null,
      searches: 2,
      minResults: 0,
      avgResults: 0,
      hasZeroResults: true,
      lastSearchedAt: '2026-09-02T00:00:00.000Z',
    },
  ])
  assert.equal(ranked[0]?.label, 'gap')
})

test('catalog search logs opportunity; contributor and admin surfaces rollups', async () => {
  const marker = `coe-gap-${Date.now()}`
  await prisma.searchOpportunityEvent.deleteMany({ where: { qNorm: marker } })

  const app = await buildApp()

  // Bare browse (no filters) should not log.
  const beforeBrowse = await prisma.searchOpportunityEvent.count()
  const browse = await app.inject({ method: 'GET', url: '/api/photos?limit=5&facets=0' })
  assert.equal(browse.statusCode, 200)
  assert.equal(await prisma.searchOpportunityEvent.count(), beforeBrowse)

  // Intentional search with zero expected inventory logs a demand signal.
  const search = await app.inject({
    method: 'GET',
    url: `/api/photos?q=${encodeURIComponent(marker)}&limit=5&facets=0`,
  })
  assert.equal(search.statusCode, 200)
  const searchBody = search.json() as { total: number }
  assert.equal(searchBody.total, 0)

  // Allow fire-and-forget write to settle.
  await new Promise((r) => setTimeout(r, 50))
  const logged = await prisma.searchOpportunityEvent.findFirst({
    where: { qNorm: marker },
    orderBy: { createdAt: 'desc' },
  })
  assert.ok(logged, 'search should create a SearchOpportunityEvent')
  assert.equal(logged.resultCount, 0)

  // Explicit recorder for a second hit-style query.
  await recordSearchOpportunity({
    query: {
      page: 1,
      limit: 20,
      q: 'baobab',
      sort: 'newest',
    },
    resultCount: 3,
    source: 'test',
  })

  const summary = await loadSearchOpportunitySummary({ limit: 20 })
  assert.ok(summary.totalSearches >= 1)
  assert.ok(summary.items.some((i) => i.qNorm === marker && i.hasZeroResults))

  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(photographer.statusCode, 200)
  const stats = await app.inject({
    method: 'GET',
    url: '/api/contributor/stats',
    headers: { cookie: cookies(photographer) },
  })
  assert.equal(stats.statusCode, 200, stats.body)
  const statsBody = stats.json() as {
    opportunities: { items: { qNorm: string; hasZeroResults: boolean }[]; zeroResultSearches: number }
  }
  assert.ok(statsBody.opportunities)
  assert.ok(statsBody.opportunities.items.some((i) => i.qNorm === marker))

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(adminLogin.statusCode, 200)
  const overview = await app.inject({
    method: 'GET',
    url: '/api/admin/metrics/overview',
    headers: { cookie: cookies(adminLogin) },
  })
  assert.equal(overview.statusCode, 200, overview.body)
  const overviewBody = overview.json() as {
    searchOpportunities: { items: { qNorm: string }[]; totalSearches: number }
  }
  assert.ok(overviewBody.searchOpportunities.totalSearches >= 1)
  assert.ok(overviewBody.searchOpportunities.items.some((i) => i.qNorm === marker))

  await prisma.searchOpportunityEvent.deleteMany({ where: { qNorm: marker } })
})
