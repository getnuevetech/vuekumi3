import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  IDENTITY_VERIFICATION_SETTING_KEY,
  recordIdentityEvidenceSchema,
  serializeIdentityEvidence,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { upsertSetting } from '../src/lib/settings.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('identity evidence schema never accepts biometric payload fields', () => {
  const parsed = recordIdentityEvidenceSchema.parse({
    verificationId: 'vrf_test_1',
    vendor: 'placeholder-vendor',
    result: 'passed',
    subjectMatchResult: 'matched',
    relatedImageIds: ['afr-001'],
    consentVersion: '1.0-id',
    documentCountry: 'ng',
    documentType: 'passport',
  })
  assert.equal(parsed.documentCountry, 'ng')
  assert.equal('embedding' in parsed, false)
  assert.equal('faceTemplate' in parsed, false)
  assert.equal('imageBase64' in parsed, false)

  const dto = serializeIdentityEvidence({
    id: 'ev1',
    verificationId: 'vrf_test_1',
    vendor: 'placeholder-vendor',
    verifiedPersonId: 'person_1',
    subjectUserId: null,
    photoId: null,
    appearanceId: null,
    result: 'passed',
    manualReviewStatus: 'not_required',
    consentVersion: '1.0-id',
    documentCountry: 'NG',
    documentType: 'passport',
    subjectMatchResult: 'matched',
    relatedImageIds: ['afr-001'],
    notes: null,
    verifiedAt: new Date('2026-09-28T00:00:00.000Z'),
    createdAt: new Date('2026-09-28T00:00:00.000Z'),
    updatedAt: new Date('2026-09-28T00:00:00.000Z'),
  })
  assert.equal(dto.biometricMaterialRetained, false)
})

test('public status reports Phase 60 flag OFF by default with no biometric DB', async () => {
  await upsertSetting(IDENTITY_VERIFICATION_SETTING_KEY, 'false')
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/identity/verification/status' })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as {
    enabled: boolean
    biometricDatabase: boolean
    retainsVerificationImagery: boolean
    faceMatchEqualsConsent: boolean
    providerConfigured: boolean
  }
  assert.equal(body.enabled, false)
  assert.equal(body.biometricDatabase, false)
  assert.equal(body.retainsVerificationImagery, false)
  assert.equal(body.faceMatchEqualsConsent, false)
  assert.equal(body.providerConfigured, false)
  await app.close()
})

test('start and evidence writes are refused while the flag is OFF', async () => {
  await upsertSetting(IDENTITY_VERIFICATION_SETTING_KEY, 'false')
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
    url: '/api/identity/verification/start',
    headers: { cookie },
    payload: { consentVersion: '1.0-id' },
  })
  assert.equal(start.statusCode, 403, start.body)
  assert.match((start.json() as { error: string }).error, /disabled|OFF|Phase 60/i)

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(adminLogin.statusCode, 200, adminLogin.body)
  const evidence = await app.inject({
    method: 'POST',
    url: '/api/identity/verification/evidence',
    headers: { cookie: cookies(adminLogin) },
    payload: {
      verificationId: 'vrf_off_1',
      vendor: 'placeholder-vendor',
      result: 'passed',
    },
  })
  assert.equal(evidence.statusCode, 403, evidence.body)
  await app.close()
})

test('when flag is ON without a provider, start returns 503; evidence can be recorded', async () => {
  await upsertSetting(IDENTITY_VERIFICATION_SETTING_KEY, 'true')
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
      url: '/api/identity/verification/start',
      headers: { cookie },
      payload: { consentVersion: '1.0-id' },
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
      url: '/api/identity/verification/evidence',
      headers: { cookie: admin },
      payload: {
        verificationId: 'vrf_on_1',
        vendor: 'placeholder-vendor',
        verifiedPersonId: 'person_on_1',
        subjectUserId: subjectId,
        result: 'passed',
        subjectMatchResult: 'matched',
        consentVersion: '1.0-id',
        documentCountry: 'NG',
        documentType: 'national_id',
        relatedImageIds: ['afr-001'],
        verifiedAt: new Date().toISOString(),
      },
    })
    assert.equal(created.statusCode, 201, created.body)
    const evidence = (created.json() as { evidence: { biometricMaterialRetained: boolean; verificationId: string } }).evidence
    assert.equal(evidence.biometricMaterialRetained, false)
    assert.equal(evidence.verificationId, 'vrf_on_1')

    const listed = await app.inject({
      method: 'GET',
      url: `/api/identity/verification/evidence?subjectUserId=${subjectId}`,
      headers: { cookie: admin },
    })
    assert.equal(listed.statusCode, 200, listed.body)
    assert.ok(((listed.json() as { items: unknown[] }).items.length) >= 1)

    const row = await prisma.identityVerificationEvidence.findFirst({
      where: { verificationId: 'vrf_on_1' },
    })
    assert.ok(row)
    assert.equal('embedding' in (row as object), false)
  } finally {
    await upsertSetting(IDENTITY_VERIFICATION_SETTING_KEY, 'false')
    await prisma.identityVerificationEvidence.deleteMany({ where: { verificationId: 'vrf_on_1' } })
    await app.close()
  }
})
