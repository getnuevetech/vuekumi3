import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

test('liveness probe is unauthenticated and helmet-hardened', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/health' })
  assert.equal(res.statusCode, 200)
  const body = res.json() as { status: string }
  assert.equal(body.status, 'ok')
  assert.equal(res.headers['x-content-type-options'], 'nosniff')
  assert.ok(!res.headers['x-powered-by'])
  await app.close()
})

test('public config advertises OAuth and Sentry without auth', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/public/config' })
  assert.equal(res.statusCode, 200)
  const body = res.json() as { oauth?: { google?: boolean; dev?: boolean }; sentryDsn?: string | null }
  assert.equal(typeof body.oauth?.google, 'boolean')
  assert.equal(typeof body.oauth?.dev, 'boolean')
  assert.ok('sentryDsn' in body)
  await app.close()
})

test('unknown routes return a JSON 404 envelope', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/this-route-does-not-exist' })
  assert.equal(res.statusCode, 404)
  const body = res.json() as { error?: string; message?: string }
  assert.ok(body.error || body.message)
  await app.close()
})

test('Google OAuth start redirects to login when keys are missing', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/auth/oauth/google/start?redirect=/licenses' })
  assert.equal(res.statusCode, 302)
  const location = String(res.headers.location ?? '')
  assert.match(location, /oauth_error=not_configured/)
  assert.match(location, /redirect=%2Flicenses/)
  await app.close()
})

test('invalid login body returns a 400 error envelope', async () => {
  const app = await buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'not-an-email' },
  })
  assert.equal(res.statusCode, 400)
  const body = res.json() as { error: string }
  assert.equal(typeof body.error, 'string')
  await app.close()
})
