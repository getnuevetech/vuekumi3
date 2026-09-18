import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adminHas,
  capabilitiesForPreset,
  lastSuperAdminBlocked,
  resolveAdminCapabilities,
  selfCapabilityEditBlocked,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return { cookie: cookies(res), user: res.json() as { user: { id: string; adminCapabilities?: string[] } } }
}

test('capability helpers: presets, last super-admin, self-edit', () => {
  assert.equal(capabilitiesForPreset('finance').includes('payouts.pay'), true)
  assert.equal(capabilitiesForPreset('finance').includes('settings.write'), false)
  assert.equal(capabilitiesForPreset('support').includes('payouts.pay'), false)
  assert.equal(capabilitiesForPreset('moderator').includes('accounts.admins.manage'), false)
  assert.equal(capabilitiesForPreset('moderator').includes('dmca.manage'), true)
  assert.equal(capabilitiesForPreset('moderator').includes('content.featured'), true)
  assert.equal(capabilitiesForPreset('finance').includes('content.featured'), false)
  assert.equal(capabilitiesForPreset('finance').includes('payouts.holds.manage'), true)
  assert.equal(capabilitiesForPreset('finance').includes('dmca.manage'), false)
  assert.equal(capabilitiesForPreset('super_admin').includes('accounts.admins.manage'), true)

  const emptySuper = resolveAdminCapabilities({ adminRole: 'super_admin', capabilities: [], capabilitiesCustomized: false })
  assert.equal(emptySuper.includes('settings.write'), true)

  assert.equal(lastSuperAdminBlocked({ isLastSuperAdmin: true, nextRole: 'support' })?.status, 400)
  assert.equal(lastSuperAdminBlocked({ isLastSuperAdmin: true, nextStatus: 'suspended' })?.status, 400)
  assert.equal(lastSuperAdminBlocked({ isLastSuperAdmin: false, nextRole: 'support' }), null)
  assert.equal(selfCapabilityEditBlocked('a', 'a')?.status, 400)
  assert.equal(selfCapabilityEditBlocked('a', 'b'), null)

  assert.equal(adminHas({
    accountType: 'admin',
    adminRole: 'finance',
    adminCapabilities: capabilitiesForPreset('finance'),
    adminCapabilitiesCustomized: false,
  }, 'payouts.pay'), true)
  assert.equal(adminHas({
    accountType: 'admin',
    adminRole: 'finance',
    adminCapabilities: capabilitiesForPreset('finance'),
    adminCapabilitiesCustomized: false,
  }, 'settings.write'), false)
})

test('admin ACL: finance cannot settings.write; support cannot payouts.pay; moderator cannot manage staff; super-admin can', async () => {
  const app = await buildApp()
  const superAdmin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const finance = await login(app, 'finance@vuekumi.demo', 'User12345!')
  const support = await login(app, 'support@vuekumi.demo', 'User12345!')
  const moderator = await login(app, 'moderator@vuekumi.demo', 'User12345!')
  const stamp = Date.now()

  const financeSettings = await app.inject({
    method: 'PUT',
    url: '/api/admin/settings',
    headers: { cookie: finance.cookie },
    payload: { settings: [{ key: 'resend_api_key', value: 're_test' }] },
  })
  assert.equal(financeSettings.statusCode, 403, financeSettings.body)

  const financeSettingsRead = await app.inject({
    method: 'GET',
    url: '/api/admin/settings',
    headers: { cookie: finance.cookie },
  })
  assert.equal(financeSettingsRead.statusCode, 403)

  const financePayouts = await app.inject({
    method: 'GET',
    url: '/api/admin/payouts',
    headers: { cookie: finance.cookie },
  })
  assert.equal(financePayouts.statusCode, 200, financePayouts.body)

  const supportPay = await app.inject({
    method: 'POST',
    url: '/api/admin/payouts/does-not-exist/pay',
    headers: { cookie: support.cookie },
    payload: {},
  })
  assert.equal(supportPay.statusCode, 403, supportPay.body)

  const supportPayoutsList = await app.inject({
    method: 'GET',
    url: '/api/admin/payouts',
    headers: { cookie: support.cookie },
  })
  assert.equal(supportPayoutsList.statusCode, 403)

  const supportImpersonate = await app.inject({
    method: 'GET',
    url: '/api/contributor/stats',
    headers: { cookie: support.cookie },
  })
  assert.equal(supportImpersonate.statusCode, 403)

  const moderatorMint = await app.inject({
    method: 'POST',
    url: '/api/admin/admins',
    headers: { cookie: moderator.cookie },
    payload: {
      email: `mod-mint-${stamp}@vuekumi.demo`,
      name: 'Should Fail',
      password: 'User12345!',
      preset: 'support',
    },
  })
  assert.equal(moderatorMint.statusCode, 403, moderatorMint.body)

  const superSettings = await app.inject({
    method: 'GET',
    url: '/api/admin/settings',
    headers: { cookie: superAdmin.cookie },
  })
  assert.equal(superSettings.statusCode, 200, superSettings.body)

  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/admins',
    headers: { cookie: superAdmin.cookie },
    payload: {
      email: `acl-staff-${stamp}@vuekumi.demo`,
      name: 'ACL Staff',
      password: 'User12345!',
      preset: 'support',
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const createdUser = created.json() as { user: { id: string; adminRole: string; adminCapabilities: string[] } }
  assert.equal(createdUser.user.adminRole, 'support')
  assert.equal(createdUser.user.adminCapabilities.includes('accounts.users.list'), true)
  assert.equal(createdUser.user.adminCapabilities.includes('payouts.pay'), false)

  const selfEdit = await app.inject({
    method: 'PATCH',
    url: `/api/admin/admins/${superAdmin.user.user.id}`,
    headers: { cookie: superAdmin.cookie },
    payload: { preset: 'support' },
  })
  assert.equal(selfEdit.statusCode, 400, selfEdit.body)

  const demoteLast = await app.inject({
    method: 'PATCH',
    url: `/api/admin/admins/${superAdmin.user.user.id}`,
    headers: { cookie: superAdmin.cookie },
    payload: { preset: 'finance' },
  })
  assert.equal(demoteLast.statusCode, 400, demoteLast.body)

  const suspendLast = await app.inject({
    method: 'PATCH',
    url: `/api/admin/accounts/${superAdmin.user.user.id}`,
    headers: { cookie: superAdmin.cookie },
    payload: { status: 'suspended' },
  })
  assert.equal(suspendLast.statusCode, 400, suspendLast.body)

  const promote = await app.inject({
    method: 'PATCH',
    url: `/api/admin/admins/${createdUser.user.id}`,
    headers: { cookie: superAdmin.cookie },
    payload: { preset: 'finance' },
  })
  assert.equal(promote.statusCode, 200, promote.body)
  const promoted = promote.json() as { user: { adminRole: string; adminCapabilities: string[] } }
  assert.equal(promoted.user.adminRole, 'finance')
  assert.equal(promoted.user.adminCapabilities.includes('payouts.pay'), true)

  const superImpersonate = await app.inject({
    method: 'GET',
    url: '/api/contributor/stats',
    headers: { cookie: superAdmin.cookie },
  })
  assert.equal(superImpersonate.statusCode, 200, superImpersonate.body)

  const me = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: finance.cookie },
  })
  assert.equal(me.statusCode, 200, me.body)
  const meUser = me.json() as { user?: { adminCapabilities?: string[] }; adminCapabilities?: string[] }
  const caps = meUser.user?.adminCapabilities ?? (meUser as { adminCapabilities?: string[] }).adminCapabilities
  assert.ok(caps?.includes('payouts.pay'))
  assert.equal(caps?.includes('settings.write'), false)

  await app.close()
})
