import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('professional photographers enter commercial inventory; community contributors cannot', async () => {
  const app = await buildApp()

  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `photo-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Tunde Photographer',
      accountType: 'photographer',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.ok(photographer.statusCode === 200 || photographer.statusCode === 201)
  assert.equal((photographer.json() as { user: { accountType: string } }).user.accountType, 'photographer')

  const community = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `comm-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Imani Community',
      accountType: 'contributor',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.ok(community.statusCode === 200 || community.statusCode === 201)
  assert.equal((community.json() as { user: { accountType: string } }).user.accountType, 'contributor')

  const blocked = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie: cookies(community) },
    payload: {
      title: 'Market stall',
      category: 'Urban',
      country: 'Nigeria',
      licenseType: 'premium',
      hasRecognizablePeople: false,
      copyrightHolder: 'Imani Community',
      copyrightAttested: true,
      permissionState: 'commercial',
    },
  })
  assert.equal(blocked.statusCode, 400)
  assert.match((blocked.json() as { error: string }).error, /professional photographer/)

  const landscape = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie: cookies(photographer) },
    payload: {
      title: 'Lagos shoreline',
      category: 'Coast',
      country: 'Nigeria',
      licenseType: 'premium',
      hasRecognizablePeople: false,
      copyrightHolder: 'Tunde Photographer',
      copyrightAttested: true,
    },
  })
  assert.equal(landscape.statusCode, 200)
  const landscapePhoto = (landscape.json() as {
    photo: {
      status?: string
      hasRecognizablePeople?: boolean
      permissionState?: string
      rights?: {
        copyrightStatus?: string
        modelConsentStatus?: string
        commercialEligible?: boolean
        screeningKind?: string | null
      }
    }
  }).photo
  assert.equal(landscapePhoto.rights?.copyrightStatus, 'claimed')
  // Phase 64 — no vision provider in CI. A failed read is uncertain, not "no person".
  assert.equal(landscapePhoto.rights?.screeningKind, 'uncertain_human_detection')
  assert.equal(landscapePhoto.hasRecognizablePeople, true)
  assert.equal(landscapePhoto.rights?.modelConsentStatus, 'required')
  assert.equal(landscapePhoto.rights?.commercialEligible, false)
  assert.equal(landscapePhoto.permissionState, 'editorial')
  assert.equal(landscapePhoto.status, 'pending')

  await app.close()
})

test('VueKumi contacts the model with a private mobile number and guest consent does not leak PII', async () => {
  const app = await buildApp()
  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `rights-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Nia Photographer',
      accountType: 'photographer',
      country: 'KE',
      acceptAgreement: true,
    },
  })
  assert.ok(photographer.statusCode === 200 || photographer.statusCode === 201)
  const cookie = cookies(photographer)
  const peoplePhoto = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie },
    payload: {
      title: 'Studio portrait',
      category: 'People',
      country: 'Kenya',
      licenseType: 'premium',
      hasRecognizablePeople: true,
      copyrightHolder: 'Nia Photographer',
      copyrightAttested: true,
      permissionState: 'editorial',
    },
  })
  assert.equal(peoplePhoto.statusCode, 200)
  const submitted = peoplePhoto.json() as { photo: { id: string; rights?: { modelConsentStatus?: string } } }
  assert.equal(submitted.photo.rights?.modelConsentStatus, 'required')
  const peopleId = submitted.photo.id

  const email = `guest-${Date.now()}@vuekumi.demo`
  const invited = await app.inject({
    method: 'POST',
    url: `/api/contributor/photos/${peopleId}/appearances`,
    headers: { cookie },
    payload: { displayName: 'Guest Model', email, mobile: '+254711000001', shootTitle: 'Lagos Fashion Shoot — August 8, 2026' },
  })
  assert.equal(invited.statusCode, 200)
  const body = invited.json() as {
    appearance: { inviteEmail?: string; inviteMobile?: string; consentStatus?: string }
    joinUrl: string
  }
  assert.equal(body.appearance.inviteEmail, email)
  assert.equal(body.appearance.inviteMobile, '+254711000001')
  assert.equal(body.appearance.consentStatus, 'invitation_sent')
  const token = body.joinUrl.split('/invite/model/')[1]
  const preview = await app.inject({ method: 'GET', url: `/api/model/invite/${token}` })
  assert.equal(preview.statusCode, 200)
  const invite = (preview.json() as { invite: { membershipRequired: boolean; terms: string; imageCount: number; shootTitle?: string | null } }).invite
  assert.equal(invite.membershipRequired, false)
  assert.match(invite.terms, /person depicted/)
  assert.ok(invite.imageCount >= 1)
  assert.equal(invite.shootTitle, 'Lagos Fashion Shoot — August 8, 2026')

  const decided = await app.inject({
    method: 'POST',
    url: `/api/model/invite/${token}/decide`,
    payload: {
      action: 'approved',
      confirmedLikeness: true,
      usage: 'commercial',
      acceptReleaseTerms: true,
    },
  })
  assert.equal(decided.statusCode, 200)

  const ownerView = await app.inject({
    method: 'GET',
    url: `/api/contributor/photos/${peopleId}`,
    headers: { cookie },
  })
  const ownerDump = JSON.stringify(ownerView.json())
  assert.equal(ownerDump.includes(email), true)
  const publicPhoto = await app.inject({ method: 'GET', url: `/api/photos/${peopleId}` })
  const dumped = JSON.stringify(publicPhoto.json())
  assert.equal(dumped.includes(email), false)
  assert.equal(dumped.includes('+254711000001'), false)

  const release = await app.inject({
    method: 'POST',
    url: `/api/contributor/photos/${peopleId}/releases`,
    headers: { cookie },
    payload: {
      displayName: 'Another Person',
      modelIdentity: 'Another Person',
      fileName: 'release-another.pdf',
      attestedGenuine: true,
      applicableToThisImage: true,
    },
  })
  assert.equal(release.statusCode, 200)
  assert.equal((release.json() as { release: { verificationLevel: string } }).release.verificationLevel, 'photographer_provided')

  await app.close()
})
