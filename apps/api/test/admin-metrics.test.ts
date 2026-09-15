import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import {
  attributedAt,
  currentMonthLabel,
  emptyMonthBuckets,
  revenuePayoutSeries,
} from '../src/lib/admin-metrics.js'

test('admin overview requires a session', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/metrics/overview' })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('month buckets are the last six UTC months, current last', () => {
  const now = new Date('2026-09-15T12:00:00.000Z')
  const buckets = emptyMonthBuckets(6, now)
  assert.deepEqual(buckets.map((b) => b.label), ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'])
  assert.equal(currentMonthLabel(now), 'September')
})

test('revenue series buckets paid licence sales and subscriptions vs payouts', () => {
  const now = new Date('2026-09-15T12:00:00.000Z')
  const series = revenuePayoutSeries(
    [
      { amountUsd: 48, at: new Date('2026-09-10T00:00:00.000Z') },
      { amountUsd: 12.555, at: new Date('2026-09-12T00:00:00.000Z') },
      { amountUsd: 24, at: new Date('2026-08-08T00:00:00.000Z') },
      { amountUsd: 99, at: new Date('2026-02-01T00:00:00.000Z') },
    ],
    [{ amountUsd: 18, at: new Date('2026-09-14T00:00:00.000Z') }],
    6,
    now,
  )
  assert.equal(series.length, 6)
  assert.equal(series[4]?.month, 'Aug')
  assert.equal(series[4]?.revenue, 24)
  assert.equal(series[5]?.month, 'Sep')
  assert.equal(series[5]?.revenue, 60.56)
  assert.equal(series[5]?.payouts, 18)
  assert.equal(series.every((p) => p.month !== 'Feb'), true)
})

test('attribution prefers paidAt, then processedAt, then periodStart', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(
    attributedAt({ paidAt: new Date('2026-09-01T00:00:00.000Z'), createdAt }).toISOString(),
    '2026-09-01T00:00:00.000Z',
  )
  assert.equal(
    attributedAt({ processedAt: new Date('2026-08-01T00:00:00.000Z'), createdAt }).toISOString(),
    '2026-08-01T00:00:00.000Z',
  )
  assert.equal(
    attributedAt({ periodStart: new Date('2026-07-01T00:00:00.000Z'), createdAt }).toISOString(),
    '2026-07-01T00:00:00.000Z',
  )
  assert.equal(attributedAt({ createdAt }).toISOString(), '2026-01-01T00:00:00.000Z')
})
