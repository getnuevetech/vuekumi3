import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cancelKeepsAccess,
  displayPlan,
  displayQuota,
  isPlusActive,
  plusPeriod,
  quotaAfterConsume,
  utcDayStart,
} from '../src/lib/subscriptions.js'
import { FREE_RF_DAILY_QUOTA, PLUS_PERIOD_DAYS, PLUS_PRICE_USD } from '@vuekumi/shared'

const day = utcDayStart(new Date('2026-09-15T15:30:00Z'))

test('UTC day start is midnight UTC regardless of local hour', () => {
  assert.equal(utcDayStart(new Date('2026-09-15T23:59:59Z')).toISOString(), '2026-09-15T00:00:00.000Z')
  assert.equal(utcDayStart(new Date('2026-09-16T00:00:01Z')).toISOString(), '2026-09-16T00:00:00.000Z')
})

test('free quota resets on a new UTC day and blocks at 50', () => {
  const now = new Date('2026-09-15T12:00:00Z')
  const yesterday = utcDayStart(new Date('2026-09-14T12:00:00Z'))
  const first = quotaAfterConsume({
    plan: 'free',
    plusUntil: null,
    used: 49,
    resetAt: yesterday,
  }, now)
  assert.equal(first.ok, true)
  assert.equal(first.next?.used, 1)
  assert.equal(first.next?.resetAt.toISOString(), day.toISOString())

  const blocked = quotaAfterConsume({
    plan: 'free',
    plusUntil: null,
    used: 50,
    resetAt: day,
  }, now)
  assert.equal(blocked.ok, false)
  assert.match(blocked.error ?? '', /Daily royalty-free download limit/)
})

test('Vuekumi+ is unlimited for royalty-free grants while plusUntil is in the future', () => {
  const now = new Date('2026-09-15T12:00:00Z')
  const plusUntil = new Date('2026-10-15T12:00:00Z')
  const result = quotaAfterConsume({
    plan: 'plus',
    plusUntil,
    used: 50,
    resetAt: day,
  }, now)
  assert.equal(result.ok, true)
  assert.equal(result.unlimited, true)
  assert.equal(displayQuota({
    subscriptionPlan: 'plus',
    plusUntil,
    downloadQuotaUsed: 50,
    downloadQuotaReset: day,
  }, now).unlimited, true)
  assert.equal(displayPlan({ subscriptionPlan: 'plus', plusUntil }, now), 'plus')
})

test('expired Plus drops to the free 50/day quota', () => {
  const now = new Date('2026-09-15T12:00:00Z')
  const plusUntil = new Date('2026-09-14T12:00:00Z')
  assert.equal(isPlusActive({ subscriptionPlan: 'plus', plusUntil }, now), false)
  const quota = displayQuota({
    subscriptionPlan: 'plus',
    plusUntil,
    downloadQuotaUsed: 50,
    downloadQuotaReset: day,
  }, now)
  assert.equal(quota.unlimited, false)
  assert.equal(quota.limit, FREE_RF_DAILY_QUOTA)
  assert.equal(quota.remaining, 0)
})

test('cancelled Plus keeps access until period end', () => {
  const now = new Date('2026-09-15T12:00:00Z')
  const { periodEnd } = plusPeriod(now)
  assert.equal(cancelKeepsAccess(periodEnd, now), true)
  assert.equal(cancelKeepsAccess(new Date('2026-09-14T00:00:00Z'), now), false)
  assert.equal(PLUS_PRICE_USD, 19)
  assert.equal(PLUS_PERIOD_DAYS, 30)
  assert.equal(FREE_RF_DAILY_QUOTA, 50)
})
