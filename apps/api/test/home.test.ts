import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignHomeSlots, categoryShares, heroHeadline } from '../src/lib/home.js'

test('category shares are a percent of the live library, not fake rings', () => {
  const shares = categoryShares(
    [
      { value: 'Urban', count: 10 },
      { value: 'Wildlife', count: 5 },
      { value: 'People', count: 5 },
    ],
    20,
  )
  assert.deepEqual(shares.map((s) => s.sharePct), [50, 25, 25])
  assert.equal(categoryShares([], 0)[0], undefined)
})

test('home slots prefer unique photos across hero, edge, editorial, and pricing', () => {
  const byDownloads = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, category: i === 11 ? 'Landscape' : 'Urban' }))
  const byNewest = Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, category: 'Culture' }))
  const byLikes = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, category: 'People' }))
  const slots = assignHomeSlots({ byDownloads, byNewest, byLikes })
  const ids = [...slots.hero, ...slots.edge, ...slots.editorial, ...slots.pricing, slots.statsBackground]
  assert.equal(slots.hero.length, 3)
  assert.equal(slots.edge.length, 16)
  assert.equal(slots.editorial.length, 6)
  assert.equal(slots.pricing.length, 3)
  assert.equal(slots.statsBackground, 'd11')
  assert.equal(new Set(ids).size, ids.length)
})

test('pinned ids take their slot and leftover positions stay unique auto fills', () => {
  const byDownloads = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, category: i === 11 ? 'Landscape' : 'Urban' }))
  const byNewest = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, category: 'Culture' }))
  const byLikes = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, category: 'People' }))
  const slots = assignHomeSlots({
    byDownloads,
    byNewest,
    byLikes,
    pins: { hero: ['n0', null, null], stats_background: ['d11'] },
    liveIds: new Set([...byDownloads, ...byNewest, ...byLikes].map((p) => p.id)),
  })
  assert.equal(slots.hero[0], 'n0')
  assert.equal(slots.sources.hero[0], 'pinned')
  assert.equal(slots.statsBackground, 'd11')
  assert.equal(slots.sources.stats_background[0], 'pinned')
  const ids = [...slots.hero, ...slots.edge, ...slots.editorial, ...slots.pricing, slots.statsBackground]
  assert.equal(new Set(ids).size, ids.length)
})

test('inactive pins are skipped so ranking still fills the homepage', () => {
  const byDownloads = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, category: i === 11 ? 'Landscape' : 'Urban' }))
  const byNewest = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, category: 'Culture' }))
  const byLikes = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, category: 'People' }))
  const slots = assignHomeSlots({
    byDownloads,
    byNewest,
    byLikes,
    pins: { hero: ['gone', 'd0', null] },
    liveIds: new Set(byDownloads.map((p) => p.id)),
  })
  assert.notEqual(slots.hero[0], 'gone')
  assert.equal(slots.hero[1], 'd0')
  assert.equal(slots.sources.hero[1], 'pinned')
  assert.equal(slots.hero.length, 3)
})

test('hero headline uses live counts instead of a 212,400 claim', () => {
  assert.equal(
    heroHeadline({ photosLive: 29, countries: 12 }),
    '29 authentic images from 12 countries. Free and premium.',
  )
  assert.match(heroHeadline({ photosLive: 0, countries: 0 }), /continent/)
})
