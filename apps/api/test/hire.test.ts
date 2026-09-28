import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatDayRateUsd,
  hireAvailabilityWhere,
  isHireableAvailability,
  photographerListQuerySchema,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'

test('hire helpers and list query accept availability filters', () => {
  assert.deepEqual(hireAvailabilityWhere('hireable'), { in: ['open', 'limited'] })
  assert.equal(hireAvailabilityWhere('open'), 'open')
  assert.equal(isHireableAvailability('open'), true)
  assert.equal(isHireableAvailability('unavailable'), false)
  assert.equal(formatDayRateUsd(450), '$450/day')
  assert.equal(formatDayRateUsd(null), null)

  const parsed = photographerListQuerySchema.parse({ availability: 'hireable', kind: 'photographer' })
  assert.equal(parsed.availability, 'hireable')
  assert.throws(() => photographerListQuerySchema.parse({ availability: 'maybe' }))
})

test('photographer and model lists filter by hireable availability', async () => {
  const app = await buildApp()

  const hireable = await app.inject({
    method: 'GET',
    url: '/api/photographers?availability=hireable&kind=photographer&limit=50',
  })
  assert.equal(hireable.statusCode, 200, hireable.body)
  const hireBody = hireable.json() as {
    items: { handle: string; availability: string; dayRateUsd: number | null }[]
  }
  assert.ok(hireBody.items.length > 0)
  for (const row of hireBody.items) {
    assert.ok(['open', 'limited'].includes(row.availability), `${row.handle} leaked ${row.availability}`)
  }
  assert.ok(hireBody.items.some((i) => i.handle === 'thandiwe-nkosi' || i.handle === 'kofi-mensah'))
  assert.equal(hireBody.items.some((i) => i.handle === 'amara-okafor'), false, 'unavailable influencer must not appear')

  const unavailable = await app.inject({
    method: 'GET',
    url: '/api/photographers?availability=unavailable&limit=50',
  })
  assert.equal(unavailable.statusCode, 200)
  const unavailableBody = unavailable.json() as { items: { handle: string; availability: string }[] }
  assert.ok(unavailableBody.items.every((i) => i.availability === 'unavailable'))

  const models = await app.inject({
    method: 'GET',
    url: '/api/models?availability=hireable&limit=50',
  })
  assert.equal(models.statusCode, 200, models.body)
  const modelBody = models.json() as { items: { handle: string; availability: string }[] }
  assert.ok(modelBody.items.every((i) => ['open', 'limited'].includes(i.availability)))
  assert.ok(modelBody.items.some((i) => i.handle === 'ada-molefe'))
})
