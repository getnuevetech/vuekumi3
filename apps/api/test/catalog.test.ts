import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildPhotoWhere,
  facetWhere,
  normalizeQuery,
  photoOrderBy,
  relatedPhotoWhere,
  wantsFacets,
} from '../src/lib/catalog.js'

test('normalizeQuery trims, collapses space, and caps length', () => {
  assert.equal(normalizeQuery('  Lagos   market  '), 'Lagos market')
  assert.equal(normalizeQuery('   '), undefined)
  assert.equal(normalizeQuery(undefined), undefined)
  assert.equal(normalizeQuery('x'.repeat(200))?.length, 120)
})

test('buildPhotoWhere searches title, description, tags, and photographer', () => {
  const where = buildPhotoWhere({
    page: 1,
    limit: 20,
    sort: 'newest',
    q: 'Lagos',
    tag: 'fashion',
    photographer: 'amara-okafor',
    category: 'All',
  })
  assert.equal(where.status, 'active')
  assert.deepEqual(where.permissionState, { in: ['editorial', 'restricted', 'commercial', 'exclusive'] })
  assert.equal(where.category, undefined)
  assert.deepEqual(where.contributor, {
    contributorProfile: { handle: { equals: 'amara-okafor', mode: 'insensitive' } },
  })
  assert.deepEqual(where.tags, { some: { tag: { equals: 'fashion', mode: 'insensitive' } } })
  const or = where.OR as { title?: { contains: string } }[]
  assert.ok(or.some((clause) => clause.title?.contains === 'Lagos'))
  assert.ok(or.some((clause) => 'description' in clause))
  assert.ok(or.some((clause) => 'tags' in clause))
  assert.ok(or.some((clause) => 'contributor' in clause))
})

test('buildPhotoWhere applies category, country, and license filters', () => {
  const where = buildPhotoWhere({
    page: 1,
    limit: 20,
    sort: 'newest',
    category: 'Wildlife',
    country: 'Kenya',
    license: 'premium',
  })
  assert.equal(where.category, 'Wildlife')
  assert.equal(where.country, 'Kenya')
  assert.equal(where.licenseType, 'premium')
  assert.equal(where.OR, undefined)
})

test('photoOrderBy maps sort keys with a createdAt tie-break', () => {
  assert.deepEqual(photoOrderBy('newest'), [{ createdAt: 'desc' }])
  assert.deepEqual(photoOrderBy('downloads'), [{ downloads: 'desc' }, { createdAt: 'desc' }])
  assert.deepEqual(photoOrderBy('views'), [{ views: 'desc' }, { createdAt: 'desc' }])
  assert.deepEqual(photoOrderBy('likes'), [{ likes: 'desc' }, { createdAt: 'desc' }])
})

test('related photos share category or country and exclude self', () => {
  assert.deepEqual(relatedPhotoWhere({ id: 'afr-011', category: 'Fashion', country: 'Nigeria' }), {
    status: 'active',
    permissionState: { in: ['editorial', 'restricted', 'commercial', 'exclusive'] },
    id: { not: 'afr-011' },
    OR: [{ category: 'Fashion' }, { country: 'Nigeria' }],
  })
})

test('facet helpers omit the counted dimension and skip homepage facets', () => {
  const where = { status: 'active' as const, category: 'Urban', country: 'Kenya' }
  assert.equal('category' in facetWhere(where, 'category'), false)
  assert.equal(facetWhere(where, 'category').country, 'Kenya')
  assert.equal(wantsFacets(undefined), true)
  assert.equal(wantsFacets('1'), true)
  assert.equal(wantsFacets('0'), false)
})
