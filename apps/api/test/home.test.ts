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
  const byNewest = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, category: 'Culture' }))
  const byLikes = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, category: 'People' }))
  const slots = assignHomeSlots({ byDownloads, byNewest, byLikes })
  const ids = [...slots.hero, ...slots.edge, ...slots.editorial, ...slots.pricing, slots.statsBackground]
  assert.equal(slots.hero.length, 3)
  assert.equal(slots.edge.length, 4)
  assert.equal(slots.editorial.length, 2)
  assert.equal(slots.pricing.length, 3)
  assert.equal(slots.statsBackground, 'd11')
  assert.equal(new Set(ids).size, ids.length)
})

test('hero headline uses live counts instead of a 212,400 claim', () => {
  assert.equal(
    heroHeadline({ photosLive: 29, countries: 12 }),
    '29 authentic images from 12 countries. Free and premium.',
  )
  assert.match(heroHeadline({ photosLive: 0, countries: 0 }), /continent/)
})
