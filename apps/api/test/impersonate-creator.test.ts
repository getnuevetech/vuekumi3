import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capabilitiesForPreset } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return { cookie: cookies(res), user: (res.json() as { user: { id: string } }).user }
}

test('presets: only super_admin gets content.impersonate_creator by default', () => {
  assert.equal(capabilitiesForPreset('super_admin').includes('content.impersonate_creator'), true)
  assert.equal(capabilitiesForPreset('support').includes('content.impersonate_creator'), false)
  assert.equal(capabilitiesForPreset('moderator').includes('content.impersonate_creator'), false)
  assert.equal(capabilitiesForPreset('finance').includes('content.impersonate_creator'), false)
})

test('act-as creator: staff needs userId; support forbidden; model blocked; payout writes blocked', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const support = await login(app, 'support@vuekumi.demo', 'User12345!')
  const kofi = await login(app, 'kofi-mensah@vuekumi.demo', 'User12345!')
  const ada = await login(app, 'ada@vuekumi.demo', 'User12345!')

  try {
    const supportStats = await app.inject({
      method: 'GET',
      url: '/api/contributor/stats',
      headers: { cookie: support.cookie },
    })
    assert.equal(supportStats.statusCode, 403)

    const missing = await app.inject({
      method: 'GET',
      url: '/api/contributor/stats',
      headers: { cookie: admin.cookie },
    })
    assert.equal(missing.statusCode, 400)

    const ok = await app.inject({
      method: 'GET',
      url: `/api/contributor/stats?userId=${kofi.user.id}`,
      headers: { cookie: admin.cookie },
    })
    assert.equal(ok.statusCode, 200, ok.body)
    const body = ok.json() as { name: string; handle: string; actingAsUserId: string | null }
    assert.equal(body.handle, 'kofi-mensah')
    assert.equal(body.actingAsUserId, kofi.user.id)

    const photos = await app.inject({
      method: 'GET',
      url: `/api/contributor/photos?userId=${kofi.user.id}`,
      headers: { cookie: admin.cookie },
    })
    assert.equal(photos.statusCode, 200, photos.body)

    const modelBlocked = await app.inject({
      method: 'GET',
      url: `/api/contributor/stats?userId=${ada.user.id}`,
      headers: { cookie: admin.cookie },
    })
    assert.equal(modelBlocked.statusCode, 400)

    const earnings = await app.inject({
      method: 'GET',
      url: `/api/contributor/earnings?userId=${kofi.user.id}`,
      headers: { cookie: admin.cookie },
    })
    assert.equal(earnings.statusCode, 200, earnings.body)
    assert.equal((earnings.json() as { canRequest: boolean }).canRequest, false)

    const payoutWrite = await app.inject({
      method: 'POST',
      url: `/api/contributor/payouts?userId=${kofi.user.id}`,
      headers: { cookie: admin.cookie },
      payload: {},
    })
    assert.equal(payoutWrite.statusCode, 403)
  } finally {
    await app.close()
  }
})
