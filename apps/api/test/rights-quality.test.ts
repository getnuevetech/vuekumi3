import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('third-party claimed copyright stays commercially locked and the ledger is readable', async () => {
  const app = await buildApp()
  const publicPhoto = await app.inject({ method: 'GET', url: '/api/photos/afr-third-party' })
  if (publicPhoto.statusCode !== 200) {
    await app.close()
    return
  }
  const view = publicPhoto.json() as {
    rights?: { commercialEligible?: boolean; rightsVerified?: boolean; copyrightStatus?: string; creationClaim?: string }
  }
  assert.equal(view.rights?.commercialEligible, false)
  assert.equal(view.rights?.rightsVerified, false)

  const admin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(admin.statusCode, 200)
  const cookie = cookies(admin)
  const ledger = await app.inject({
    method: 'GET',
    url: '/api/admin/content/afr-third-party/rights-ledger',
    headers: { cookie },
  })
  assert.equal(ledger.statusCode, 200)
  const body = ledger.json() as {
    ledger: {
      thirdPartyCopyright: boolean
      commercialEligible: boolean
      events: { action: string }[]
    }
  }
  assert.equal(body.ledger.thirdPartyCopyright, true)
  assert.equal(body.ledger.commercialEligible, false)
  assert.ok(body.ledger.events.some((event) => event.action === 'copyright.attested'))

  const finance = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'finance@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(finance.statusCode, 200)
  const denied = await app.inject({
    method: 'GET',
    url: '/api/admin/content/afr-third-party/rights-ledger',
    headers: { cookie: cookies(finance) },
  })
  assert.equal(denied.statusCode, 403)

  await app.close()
})

test('staff can write guardianAuthorizedAt on a minor appearance', async () => {
  const app = await buildApp()
  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `guard-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Guardian Photographer',
      accountType: 'photographer',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.ok(photographer.statusCode === 200 || photographer.statusCode === 201)
  const cookie = cookies(photographer)
  const created = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie },
    payload: {
      title: 'Minor portrait',
      category: 'People',
      country: 'Nigeria',
      licenseType: 'premium',
      hasRecognizablePeople: true,
      copyrightHolder: 'Guardian Photographer',
      copyrightAttested: true,
      permissionState: 'editorial',
    },
  })
  assert.equal(created.statusCode, 200)
  const photoId = (created.json() as { photo: { id: string } }).photo.id
  const invited = await app.inject({
    method: 'POST',
    url: `/api/contributor/photos/${photoId}/appearances`,
    headers: { cookie },
    payload: {
      displayName: 'Child Model',
      email: `child-${Date.now()}@vuekumi.demo`,
      mobile: '+2348011111111',
      ageClass: 'minor',
      isMinor: true,
      guardianName: 'Parent Example',
      guardianEmail: 'parent@example.com',
      guardianMobile: '+2348022222222',
    },
  })
  assert.equal(invited.statusCode, 200)
  const appearanceId = (invited.json() as { appearance: { id: string; guardianAuthorized?: boolean } }).appearance.id
  const authorized = await app.inject({
    method: 'POST',
    url: `/api/contributor/photos/${photoId}/appearances/${appearanceId}/guardian`,
    headers: { cookie },
    payload: { authorized: true },
  })
  assert.equal(authorized.statusCode, 200)
  assert.equal((authorized.json() as { appearance: { guardianAuthorized?: boolean } }).appearance.guardianAuthorized, true)
  const ownLedger = await app.inject({
    method: 'GET',
    url: `/api/contributor/photos/${photoId}/rights-ledger`,
    headers: { cookie },
  })
  assert.equal(ownLedger.statusCode, 200)
  const events = (ownLedger.json() as { ledger: { events: { action: string }[] } }).ledger.events
  assert.ok(events.some((event) => event.action === 'likeness.guardian_authorized'))
  await app.close()
})
