import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canRequestPayout,
  earningsMonthSeries,
  maskAccountRef,
  methodDisplay,
  roundUsd,
} from '../src/lib/payouts.js'

test('mask account refs keep the last four digits', () => {
  assert.equal(maskAccountRef('08031234567'), '••••4567')
  assert.equal(maskAccountRef('12 34'), '••••')
})

test('method display names bank vs mobile money', () => {
  assert.equal(methodDisplay('mobile_money', 'MTN MoMo'), 'Mobile money (MTN MoMo)')
  assert.equal(methodDisplay('bank', 'GTBank'), 'Bank transfer (GTBank)')
})

test('payout request requires a method, no pending, and the $10 minimum', () => {
  assert.equal(
    canRequestPayout({ availableUsd: 90, minUsd: 10, pendingCount: 0, hasMethod: true }),
    null,
  )
  assert.equal(
    canRequestPayout({ availableUsd: 90, minUsd: 10, pendingCount: 0, hasMethod: false }),
    'Add a payout method first',
  )
  assert.equal(
    canRequestPayout({ availableUsd: 90, minUsd: 10, pendingCount: 1, hasMethod: true }),
    'A payout is already in progress',
  )
  assert.equal(
    canRequestPayout({ availableUsd: 9.99, minUsd: 10, pendingCount: 0, hasMethod: true }),
    'Minimum payout is $10.00',
  )
})

test('month series buckets the last six months', () => {
  const now = new Date()
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 12))
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 8))
  const series = earningsMonthSeries([
    { createdAt: thisMonth, amountUsd: 48 },
    { createdAt: thisMonth, amountUsd: 12 },
    { createdAt: lastMonth, amountUsd: 24 },
  ])
  assert.equal(series.length, 6)
  assert.equal(series[5]?.earnings, 60)
  assert.equal(series[4]?.earnings, 24)
  assert.equal(roundUsd(12.555), 12.56)
})
