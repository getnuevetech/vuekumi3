import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rateLimitErrorBody, shouldSkipRateLimit } from '../src/lib/rate-limit.js'

test('health, ready, and public config skip the global limiter', () => {
  assert.equal(shouldSkipRateLimit('/api/health'), true)
  assert.equal(shouldSkipRateLimit('/api/ready'), true)
  assert.equal(shouldSkipRateLimit('/api/public/config'), true)
  assert.equal(shouldSkipRateLimit('/api/health?warm=1'), true)
})

test('auth and downloads stay rate limited', () => {
  assert.equal(shouldSkipRateLimit('/api/auth/login'), false)
  assert.equal(shouldSkipRateLimit('/api/auth/oauth/google/start'), false)
  assert.equal(shouldSkipRateLimit('/api/media/abc/original'), false)
})

test('rate limit envelope matches the API error shape', () => {
  const body = rateLimitErrorBody()
  assert.equal(body.statusCode, 429)
  assert.equal(body.error, 'Too many requests')
})
