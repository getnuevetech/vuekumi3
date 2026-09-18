import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canEnterCommercialInventory,
  commercialEligibilityBlock,
  isCommerciallyEligible,
  registerSchema,
  submitModelPhotoSchema,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('model public register is allowed without an African country', () => {
  const parsed = registerSchema.safeParse({
    email: 'model-public@example.com',
    password: 'password1',
    name: 'Model',
    accountType: 'model',
    acceptAgreement: true,
  })
  assert.equal(parsed.success, true)
  assert.equal(canEnterCommercialInventory('model'), false)
  assert.equal(canEnterCommercialInventory('model', { hasPhotographerAgreement: true }), true)
})

test('model upload requires a creation claim and photographer contact when someone else took it', () => {
  const missing = submitModelPhotoSchema.safeParse({
    title: 'Studio',
    category: 'People',
    country: 'Botswana',
    hasRecognizablePeople: true,
    copyrightHolder: 'Ada',
    copyrightAttested: true,
    creationClaim: 'photographer_took',
    inPhotograph: true,
    ownLikenessConfirmed: true,
    ownUsage: 'editorial',
  })
  assert.equal(missing.success, false)
  const ok = submitModelPhotoSchema.safeParse({
    title: 'Studio',
    category: 'People',
    country: 'Botswana',
    hasRecognizablePeople: true,
    copyrightHolder: 'Ada',
    copyrightAttested: true,
    creationClaim: 'photographer_took',
    inPhotograph: true,
    ownLikenessConfirmed: true,
    ownUsage: 'editorial',
    photographerName: 'Lena Khumalo',
    photographerEmail: 'lena@example.com',
    photographerMobile: '+26771100000',
  })
  assert.equal(ok.success, true)
})

test('photographer_took without a photographer decision never unlocks commercial', () => {
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'claimed',
    modelConsentStatus: 'approved',
    creationClaim: 'photographer_took',
    appearances: [{ status: 'approved', consentStatus: 'approved', usage: 'commercial', confirmedLikeness: true, consentQuality: 'verified' }],
  }), false)
  assert.match(commercialEligibilityBlock({
    copyrightStatus: 'claimed',
    modelConsentStatus: 'approved',
    creationClaim: 'photographer_took',
    appearances: [{ status: 'approved', consentStatus: 'approved', usage: 'commercial', confirmedLikeness: true, consentQuality: 'verified' }],
  }) ?? '', /VueKumi-verified/)
})

test('photographer display-only approval verifies copyright but not commercial sublicensing', () => {
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'verified',
    modelConsentStatus: 'approved',
    creationClaim: 'photographer_took',
    copyrightCommercialScope: false,
    appearances: [{ status: 'approved', consentStatus: 'approved', usage: 'editorial', confirmedLikeness: true, consentQuality: 'verified' }],
  }), false)
  assert.match(commercialEligibilityBlock({
    copyrightStatus: 'verified',
    modelConsentStatus: 'approved',
    creationClaim: 'photographer_took',
    copyrightCommercialScope: false,
    appearances: [{ status: 'approved', consentStatus: 'approved', usage: 'editorial', confirmedLikeness: true, consentQuality: 'verified' }],
  }) ?? '', /display only/)
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'verified',
    modelConsentStatus: 'approved',
    creationClaim: 'photographer_took',
    copyrightCommercialScope: true,
    appearances: [{ status: 'approved', consentStatus: 'approved', usage: 'commercial', confirmedLikeness: true, consentQuality: 'verified' }],
  }), true)
})

test('documented third-party copyright without photographer confirm stays documented', () => {
  assert.equal(isCommerciallyEligible({
    copyrightStatus: 'documented',
    modelConsentStatus: 'approved',
    creationClaim: 'assigned',
    appearances: [{ status: 'approved', consentStatus: 'approved', usage: 'commercial', confirmedLikeness: true, consentQuality: 'verified' }],
  }), false)
})

test('model register, upload, photographer display-only, and dual-role self-shot', async () => {
  const app = await buildApp()
  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `mdl-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Public Model',
      accountType: 'model',
      country: 'US',
      acceptAgreement: true,
    },
  })
  assert.equal(registered.statusCode, 200)
  const user = (registered.json() as { user: { accountType: string; hasPhotographerAgreement?: boolean; modelHandle: string | null } }).user
  assert.equal(user.accountType, 'model')
  assert.equal(user.hasPhotographerAgreement, false)
  assert.ok(user.modelHandle)
  const cookie = cookies(registered)

  const africaBlocked = await app.inject({
    method: 'POST',
    url: '/api/model/photographer-agreement',
    headers: { cookie },
    payload: { country: 'US', acceptAgreement: true },
  })
  assert.equal(africaBlocked.statusCode, 400)

  const submitted = await app.inject({
    method: 'POST',
    url: '/api/model/photos',
    headers: { cookie },
    payload: {
      title: 'Awaiting photographer',
      category: 'People',
      country: 'United States',
      hasRecognizablePeople: true,
      copyrightHolder: 'Guest Photographer',
      copyrightAttested: true,
      creationClaim: 'photographer_took',
      inPhotograph: true,
      ownLikenessConfirmed: true,
      ownUsage: 'commercial',
      photographerName: 'Guest Photographer',
      photographerEmail: `gp-${Date.now()}@vuekumi.demo`,
      photographerMobile: '+12025550123',
    },
  })
  assert.equal(submitted.statusCode, 200)
  const submittedBody = submitted.json() as {
    photo: { id: string; permissionState?: string; rights?: { commercialEligible: boolean; copyrightStatus: string } }
    joinUrl?: string
  }
  assert.equal(submittedBody.photo.permissionState, 'portfolio')
  assert.equal(submittedBody.photo.rights?.commercialEligible, false)
  assert.equal(submittedBody.photo.rights?.copyrightStatus, 'claimed')
  assert.ok(submittedBody.joinUrl)
  const token = submittedBody.joinUrl!.split('/').pop()!

  const previewLive = await app.inject({ method: 'GET', url: `/api/copyright/invite/${token}` })
  assert.equal(previewLive.statusCode, 200)

  const displayLive = await app.inject({
    method: 'POST',
    url: `/api/copyright/invite/${token}/decide`,
    payload: {
      action: 'approved',
      confirmedIdentity: true,
      usage: 'editorial',
      acceptAuthorizationTerms: true,
    },
  })
  assert.equal(displayLive.statusCode, 200)
  const liveLicenses = await app.inject({ method: 'GET', url: `/api/photos/${submittedBody.photo.id}/licenses` })
  const liveCommercial = (liveLicenses.json() as { items: { type: string; offered: boolean }[] }).items.find((i) => i.type === 'commercial')
  assert.equal(liveCommercial?.offered, false)

  const documented = await app.inject({
    method: 'POST',
    url: '/api/model/photos',
    headers: { cookie },
    payload: {
      title: 'Assigned still',
      category: 'People',
      country: 'United States',
      hasRecognizablePeople: true,
      copyrightHolder: 'Public Model',
      copyrightAttested: true,
      creationClaim: 'assigned',
      inPhotograph: true,
      ownLikenessConfirmed: true,
      ownUsage: 'editorial',
      photographerName: 'Assignor',
      photographerEmail: `as-${Date.now()}@vuekumi.demo`,
      photographerMobile: '+12025550124',
      assignmentDocumentName: 'assignment.pdf',
    },
  })
  assert.equal(documented.statusCode, 200)
  assert.equal((documented.json() as { photo: { rights?: { copyrightStatus: string } } }).photo.rights?.copyrightStatus, 'documented')

  const ada = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ada@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(ada.statusCode, 200)
  const adaCookie = cookies(ada)
  const pending = await app.inject({
    method: 'GET',
    url: '/api/copyright/invite/seed-lena-photographer-invite',
  })
  assert.equal(pending.statusCode, 200)
  const preview = pending.json() as { invite: { modelName: string; membershipRequired: boolean } }
  assert.equal(preview.invite.modelName, 'Ada Molefe')
  assert.equal(preview.invite.membershipRequired, false)

  const displayOnly = await app.inject({
    method: 'POST',
    url: '/api/copyright/invite/seed-lena-photographer-invite/decide',
    payload: {
      action: 'approved',
      confirmedIdentity: true,
      usage: 'editorial',
      acceptAuthorizationTerms: true,
    },
  })
  assert.equal(displayOnly.statusCode, 200)

  const licenses = await app.inject({ method: 'GET', url: '/api/photos/mdl-pending-copy/licenses' })
  assert.equal(licenses.statusCode, 200)
  const commercial = (licenses.json() as { items: { type: string; offered: boolean; blockedReason?: string }[] }).items.find((i) => i.type === 'commercial')
  assert.equal(commercial?.offered, false)

  const dual = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'zuri-adewale@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(dual.statusCode, 200)
  const zuri = (dual.json() as { user: { accountType: string; hasPhotographerAgreement?: boolean } }).user
  assert.equal(zuri.accountType, 'model')
  assert.equal(zuri.hasPhotographerAgreement, true)
  const zuriLicenses = await app.inject({ method: 'GET', url: '/api/photos/mdl-self-shot/licenses' })
  const zuriCommercial = (zuriLicenses.json() as { items: { type: string; offered: boolean }[] }).items.find((i) => i.type === 'commercial')
  assert.equal(zuriCommercial?.offered, true)

  const selfShotBlocked = await app.inject({
    method: 'POST',
    url: '/api/model/photos',
    headers: { cookie: adaCookie },
    payload: {
      title: 'Ada self-shot',
      category: 'People',
      country: 'Botswana',
      hasRecognizablePeople: true,
      copyrightHolder: 'Ada Molefe',
      copyrightAttested: true,
      creationClaim: 'self_created',
      inPhotograph: true,
      ownLikenessConfirmed: true,
      ownUsage: 'commercial',
    },
  })
  assert.equal(selfShotBlocked.statusCode, 200)
  const selfShot = (selfShotBlocked.json() as { photo: { permissionState?: string; rights?: { commercialEligible: boolean } } }).photo
  assert.equal(selfShot.permissionState, 'portfolio')
  assert.equal(selfShot.rights?.commercialEligible, false)

  const patchCommercial = await app.inject({
    method: 'PATCH',
    url: `/api/model/photos/${(selfShotBlocked.json() as { photo: { id: string } }).photo.id}`,
    headers: { cookie: adaCookie },
    payload: { permissionState: 'commercial' },
  })
  assert.equal(patchCommercial.statusCode, 400)
})
