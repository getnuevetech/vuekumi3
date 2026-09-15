import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidLicenceSplit } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'

test('paid licence split is two shares that sum to 100, never a 32% pool', () => {
  assert.deepEqual(paidLicenceSplit(0.5), { photographerPct: 50, platformPct: 50 })
  assert.deepEqual(paidLicenceSplit(0.6), { photographerPct: 60, platformPct: 40 })
  assert.equal(paidLicenceSplit(0.5).photographerPct + paidLicenceSplit(0.5).platformPct, 100)
  assert.equal(paidLicenceSplit(1.4).photographerPct, 100)
  assert.equal(paidLicenceSplit(-1).photographerPct, 0)
})

test('public config advertises the live contributor share', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/public/config' })
  assert.equal(res.statusCode, 200)
  const body = res.json() as { contributorShare?: number }
  assert.equal(body.contributorShare, 0.5)
  await app.close()
})
