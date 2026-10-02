import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

test('photographer profile supports libraryTier portfolio filter and facets', async () => {
  const app = await buildApp()
  const profile = await app.inject({
    method: 'GET',
    url: '/api/photographers/thandiwe-nkosi?limit=50',
  })
  assert.equal(profile.statusCode, 200, profile.body)
  const body = profile.json() as {
    items: { id: string; libraryTier?: string }[]
    libraryTierFacets?: { value: string; count: number }[]
    total: number
  }
  assert.ok(Array.isArray(body.libraryTierFacets))
  assert.ok((body.libraryTierFacets?.length ?? 0) > 0)

  const licensedOnly = await app.inject({
    method: 'GET',
    url: '/api/photographers/thandiwe-nkosi?libraryTier=LICENSED&limit=50',
  })
  assert.equal(licensedOnly.statusCode, 200, licensedOnly.body)
  const licensed = licensedOnly.json() as { items: { libraryTier?: string }[]; total: number }
  assert.ok(licensed.items.every((photo) => photo.libraryTier === 'LICENSED'))
  assert.ok(licensed.total <= body.total)

  await app.close()
})
