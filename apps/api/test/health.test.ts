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

test('public home returns live library stats without auth', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/public/home' })
  assert.equal(res.statusCode, 200)
  const body = res.json() as {
    stats?: { photosLive?: number; countries?: number; categories?: unknown[] }
    featured?: { hero?: unknown[]; edge?: unknown[] }
  }
  assert.equal(typeof body.stats?.photosLive, 'number')
  assert.equal(typeof body.stats?.countries, 'number')
  assert.ok(Array.isArray(body.stats?.categories))
  assert.ok(Array.isArray(body.featured?.hero))
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

test('auth rate limit returns the 429 envelope', async () => {
  const app = await buildApp()
  let last = { statusCode: 0, body: { error: '' } }
  for (let i = 0; i < 16; i += 1) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'wrong-password' },
    })
    last = { statusCode: res.statusCode, body: res.json() as { error: string } }
  }
  assert.equal(last.statusCode, 429)
  assert.equal(last.body.error, 'Too many requests')
  await app.close()
})

test('admin quotes require a session', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/licenses/quotes' })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('admin test email requires an admin session', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/admin/email/test' })
  assert.equal(res.statusCode, 401)
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
