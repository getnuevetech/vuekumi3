import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  COMPLIANCE_SCREENING_SETTING_KEY,
  recordComplianceScreeningSchema,
  serializeComplianceScreening,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { upsertSetting } from '../src/lib/settings.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('compliance screening schema never accepts list-payload fields', () => {
  const parsed = recordComplianceScreeningSchema.parse({
    screeningId: 'scr_test_1',
    vendor: 'placeholder-kyc',
    subjectType: 'person',
    result: 'clear',
    countryCode: 'ng',
  })
  assert.equal(parsed.countryCode, 'ng')
  assert.equal('listPayload' in parsed, false)
  assert.equal('ofacHits' in parsed, false)
  assert.equal('watchlistDump' in parsed, false)

  const dto = serializeComplianceScreening({
    id: 'cs1',
    screeningId: 'scr_test_1',
    vendor: 'placeholder-kyc',
    subjectType: 'person',
    subjectUserId: null,
    countryCode: 'NG',
    result: 'clear',
    notes: null,
    screenedAt: new Date('2026-09-28T00:00:00.000Z'),
    createdAt: new Date('2026-09-28T00:00:00.000Z'),
    updatedAt: new Date('2026-09-28T00:00:00.000Z'),
  })
  assert.equal(dto.listPayloadRetained, false)
})

test('public status reports T9 flag OFF by default with no invented vendor', async () => {
  await upsertSetting(COMPLIANCE_SCREENING_SETTING_KEY, 'false')
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/compliance/screening/status' })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as {
    enabled: boolean
    countryOnlyReject: boolean
    listPayloadRetained: boolean
    inventsVendor: boolean
    providerConfigured: boolean
  }
  assert.equal(body.enabled, false)
  assert.equal(body.countryOnlyReject, false)
  assert.equal(body.listPayloadRetained, false)
  assert.equal(body.inventsVendor, false)
  assert.equal(body.providerConfigured, false)
  await app.close()
})

test('start and evidence writes are refused while the screening flag is OFF', async () => {
  await upsertSetting(COMPLIANCE_SCREENING_SETTING_KEY, 'false')
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const cookie = cookies(login)

  const start = await app.inject({
    method: 'POST',
    url: '/api/compliance/screening/start',
    headers: { cookie },
    payload: { subjectType: 'person', countryCode: 'NG' },
  })
  assert.equal(start.statusCode, 403, start.body)
  assert.match((start.json() as { error: string }).error, /disabled|OFF|T9/i)

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(adminLogin.statusCode, 200, adminLogin.body)
  const evidence = await app.inject({
    method: 'POST',
    url: '/api/compliance/screening/evidence',
    headers: { cookie: cookies(adminLogin) },
    payload: {
      screeningId: 'scr_off_1',
      vendor: 'placeholder-kyc',
      subjectType: 'person',
      result: 'clear',
    },
  })
  assert.equal(evidence.statusCode, 403, evidence.body)
  await app.close()
})

test('country matrix provider slots can be recorded without enabling screening', async () => {
  await upsertSetting(COMPLIANCE_SCREENING_SETTING_KEY, 'false')
  const app = await buildApp()
  try {
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
    })
    assert.equal(adminLogin.statusCode, 200, adminLogin.body)
    const admin = cookies(adminLogin)

    const put = await app.inject({
      method: 'PUT',
      url: '/api/admin/compliance/screening/providers',
      headers: { cookie: admin },
      payload: {
        countryCode: 'NG',
        screeningFunction: 'ofac_sop',
        providerSlug: null,
        evidenceUrl: 'https://example.com/counsel-ofac-sop',
        notes: 'Counsel SOP link placeholder — not a KYC vendor',
      },
    })
    assert.equal(put.statusCode, 200, put.body)
    const slot = (put.json() as { slot: { countryCode: string; screeningFunction: string; providerSlug: string | null } }).slot
    assert.equal(slot.countryCode, 'NG')
    assert.equal(slot.screeningFunction, 'ofac_sop')
    assert.equal(slot.providerSlug, null)

    const listed = await app.inject({
      method: 'GET',
      url: '/api/admin/compliance/screening/providers?country=NG',
      headers: { cookie: admin },
    })
    assert.equal(listed.statusCode, 200, listed.body)
    assert.ok(((listed.json() as { items: unknown[] }).items.length) >= 1)

    const status = await app.inject({ method: 'GET', url: '/api/compliance/screening/status' })
    assert.equal((status.json() as { enabled: boolean }).enabled, false)
  } finally {
    await prisma.countryScreeningProviderSlot.deleteMany({
      where: { countryCode: 'NG', screeningFunction: 'ofac_sop' },
    })
    await app.close()
  }
})

test('when flag is ON without a provider, start returns 503; evidence can be recorded', async () => {
  await upsertSetting(COMPLIANCE_SCREENING_SETTING_KEY, 'true')
  const app = await buildApp()
  try {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
    })
    assert.equal(login.statusCode, 200, login.body)
    const cookie = cookies(login)
    const start = await app.inject({
      method: 'POST',
      url: '/api/compliance/screening/start',
      headers: { cookie },
      payload: { subjectType: 'person', countryCode: 'NG' },
    })
    assert.equal(start.statusCode, 503, start.body)

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
    })
    assert.equal(adminLogin.statusCode, 200, adminLogin.body)
    const admin = cookies(adminLogin)
    const subjectId = (login.json() as { user: { id: string } }).user.id

    const created = await app.inject({
      method: 'POST',
      url: '/api/compliance/screening/evidence',
      headers: { cookie: admin },
      payload: {
        screeningId: 'scr_on_1',
        vendor: 'placeholder-kyc',
        subjectType: 'person',
        subjectUserId: subjectId,
        countryCode: 'NG',
        result: 'clear',
        screenedAt: new Date().toISOString(),
      },
    })
    assert.equal(created.statusCode, 201, created.body)
    const evidence = (created.json() as { evidence: { listPayloadRetained: boolean; screeningId: string } }).evidence
    assert.equal(evidence.listPayloadRetained, false)
    assert.equal(evidence.screeningId, 'scr_on_1')
  } finally {
    await upsertSetting(COMPLIANCE_SCREENING_SETTING_KEY, 'false')
    await prisma.complianceScreeningEvidence.deleteMany({ where: { screeningId: 'scr_on_1' } })
    await app.close()
  }
})
