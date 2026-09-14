import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sentryReady } from '../src/lib/sentry.js'

test('Sentry stays a no-op without a DSN', () => {
  assert.equal(sentryReady(null), false)
  assert.equal(sentryReady(undefined), false)
  assert.equal(sentryReady(''), false)
  assert.equal(sentryReady('not-a-url'), false)
})

test('Sentry accepts http(s) DSNs', () => {
  assert.equal(sentryReady('https://key@o0.ingest.sentry.io/1'), true)
  assert.equal(sentryReady('http://localhost/dsn'), true)
})
