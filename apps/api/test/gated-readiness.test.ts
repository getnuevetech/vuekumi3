import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MODEL_WITHDRAWAL_SETTING_KEY, modelWithdrawalBlocker } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { upsertSetting } from '../src/lib/settings.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('modelWithdrawalBlocker is finance-gated when flag is OFF', () => {
  assert.match(modelWithdrawalBlocker(false) ?? '', /finance-gated/)
  assert.equal(modelWithdrawalBlocker(true), null)
})

test('model can read earnings; request payout blocked while model withdrawal is OFF', async () => {
  await upsertSetting(MODEL_WITHDRAWAL_SETTING_KEY, 'false')
  const app = await buildApp()
  try {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ada@vuekumi.demo', password: 'User12345!' },
    })
    assert.equal(login.statusCode, 200, login.body)
    const cookie = cookies(login)
    const accountType = (login.json() as { user: { accountType: string } }).user.accountType
    assert.equal(accountType, 'model')

    const earnings = await app.inject({
      method: 'GET',
      url: '/api/contributor/earnings',
      headers: { cookie },
    })
    assert.equal(earnings.statusCode, 200, earnings.body)
    const body = earnings.json() as {
      canRequest: boolean
      requestBlocker: string | null
      modelWithdrawalEnabled: boolean
      payoutProvider: string
    }
    assert.equal(body.modelWithdrawalEnabled, false)
    assert.equal(body.payoutProvider, 'manual')
    assert.equal(body.canRequest, false)
    assert.match(body.requestBlocker ?? '', /finance-gated/)

    const request = await app.inject({
      method: 'POST',
      url: '/api/contributor/payouts',
      headers: { cookie },
      payload: {},
    })
    assert.equal(request.statusCode, 403, request.body)
  } finally {
    await upsertSetting(MODEL_WITHDRAWAL_SETTING_KEY, 'false')
    await app.close()
  }
})

test('admin counsel-status reports pending placeholders without inventing entity', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const res = await app.inject({
    method: 'GET',
    url: '/api/admin/legal/counsel-status',
    headers: { cookie: cookies(login) },
  })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as {
    complete: boolean
    operatorCounselPending: boolean
    dmcaCounselPending: boolean
    copyrightOfficeFiling: string
    message: string
  }
  assert.equal(body.complete, false)
  assert.equal(body.operatorCounselPending, true)
  assert.equal(body.dmcaCounselPending, true)
  assert.equal(body.copyrightOfficeFiling, 'ops_counsel')
  assert.match(body.message, /Do not invent/)
  await app.close()
})

test('admin compliance readiness keeps T9 and Bio flags OFF with no invented vendor', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const res = await app.inject({
    method: 'GET',
    url: '/api/admin/compliance/readiness',
    headers: { cookie: cookies(login) },
  })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as {
    screening: { enabled: boolean; inventsVendor: boolean; countryOnlyReject: boolean }
    identity: { enabled: boolean; biometricDatabase: boolean; faceMatchEqualsConsent: boolean }
    activationAllowed: boolean
  }
  assert.equal(body.screening.enabled, false)
  assert.equal(body.screening.inventsVendor, false)
  assert.equal(body.screening.countryOnlyReject, false)
  assert.equal(body.identity.enabled, false)
  assert.equal(body.identity.biometricDatabase, false)
  assert.equal(body.identity.faceMatchEqualsConsent, false)
  assert.equal(body.activationAllowed, false)
  await app.close()
})
