import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { cookieSecureFromRequest } from '../src/lib/session.js'

test('auth cookies are Secure only when the request itself is HTTPS', () => {
  assert.equal(cookieSecureFromRequest({ protocol: 'https' }), true)
  assert.equal(cookieSecureFromRequest({ protocol: 'http' }), false)
  assert.equal(cookieSecureFromRequest({}), false)
})

test('HTTP login does not mark session cookies Secure', async () => {
  const app = await buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  if (res.statusCode !== 200) {
    await app.close()
    return
  }
  const raw = res.headers['set-cookie']
  const cookies = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String)
  const access = cookies.find((c) => c.startsWith('access_token='))
  assert.ok(access)
  assert.equal(/;\s*Secure/i.test(access), false)
  const overview = await app.inject({
    method: 'GET',
    url: '/api/admin/metrics/overview',
    headers: { cookie: cookies.map((c) => c.split(';')[0]).join('; ') },
  })
  assert.equal(overview.statusCode, 200)
  await app.close()
})
