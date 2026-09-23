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

  await app.close()
})

test('Phase 65: undeclared model upload stays likeness-locked and can invite the person', async () => {
  const app = await buildApp()
  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `mdl65-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Phase Sixty Five',
      accountType: 'model',
      country: 'KE',
      acceptAgreement: true,
    },
  })
  assert.equal(registered.statusCode, 200, registered.body)
  const cookie = cookies(registered)
  const submitted = await app.inject({
    method: 'POST',
    url: '/api/model/photos',
    headers: { cookie },
    payload: {
      title: 'Street corner',
      category: 'Urban',
      country: 'Kenya',
      hasRecognizablePeople: false,
      copyrightHolder: 'Phase Sixty Five',
      copyrightAttested: true,
      creationClaim: 'self_created',
      inPhotograph: false,
    },
  })
  assert.equal(submitted.statusCode, 200, submitted.body)
  const photo = (submitted.json() as {
    photo: {
      id: string
      hasRecognizablePeople: boolean
      rights?: { modelConsentStatus?: string; screeningKind?: string | null; commercialEligible?: boolean }
    }
  }).photo
  assert.equal(photo.hasRecognizablePeople, true)
  assert.equal(photo.rights?.screeningKind, 'uncertain_human_detection')
  assert.equal(photo.rights?.modelConsentStatus, 'required')
  assert.equal(photo.rights?.commercialEligible, false)

  const invited = await app.inject({
    method: 'POST',
    url: `/api/model/photos/${photo.id}/appearances`,
    headers: { cookie },
    payload: {
      displayName: 'Other Person',
      email: `other-${Date.now()}@vuekumi.demo`,
      mobile: '+254700000065',
    },
  })
  assert.equal(invited.statusCode, 200, invited.body)
  assert.match((invited.json() as { joinUrl: string }).joinUrl, /\/invite\/model\//)

  await app.close()
})

test('Phase 65: uncertain screening withholds self-shot auto-approval; confirm-self and other-person invite close the gap', async () => {
  const app = await buildApp()
  try {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'zuri-adewale@vuekumi.demo', password: 'User12345!' },
    })
    assert.equal(login.statusCode, 200, login.body)
    const cookie = cookies(login)

    // CI has no image-analysis provider configured, so Phase 64's
    // visionUnavailableScreen always returns 'uncertain_human_detection' —
    // self-shot must NOT auto-approve on an uncertain read.
    const submitted = await app.inject({
      method: 'POST',
      url: '/api/model/photos',
      headers: { cookie },
      payload: {
        title: 'Zuri portrait',
        category: 'People',
        country: 'Nigeria',
        hasRecognizablePeople: true,
        copyrightHolder: 'Zuri Adewale',
        copyrightAttested: true,
        creationClaim: 'self_created',
        inPhotograph: true,
        ownLikenessConfirmed: true,
        ownUsage: 'commercial',
      },
    })
    assert.equal(submitted.statusCode, 200, submitted.body)
    const submittedPhoto = (submitted.json() as {
      photo: { id: string; hasRecognizablePeople: boolean; appearances?: unknown[]; rights?: { modelConsentStatus: string; commercialEligible: boolean } }
    }).photo
    assert.equal(submittedPhoto.hasRecognizablePeople, true)
    assert.equal(submittedPhoto.rights?.modelConsentStatus, 'required')
    assert.equal(submittedPhoto.rights?.commercialEligible, false)
    assert.equal((submittedPhoto.appearances ?? []).length, 0)
    const photoId = submittedPhoto.id

    // The model explicitly confirms it's only them — a human override of
    // AI uncertainty, not the AI granting a release.
    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/model/photos/${photoId}/appearances/confirm-self`,
      headers: { cookie },
    })
    assert.equal(confirmed.statusCode, 200, confirmed.body)
    const confirmedPhoto = (confirmed.json() as { photo: { rights?: { modelConsentStatus: string; commercialEligible: boolean } } }).photo
    assert.equal(confirmedPhoto.rights?.modelConsentStatus, 'approved')
    assert.equal(confirmedPhoto.rights?.commercialEligible, true)

    const confirmAgain = await app.inject({
      method: 'POST',
      url: `/api/model/photos/${photoId}/appearances/confirm-self`,
      headers: { cookie },
    })
    assert.equal(confirmAgain.statusCode, 409, confirmAgain.body)

    // A second, fresh upload where the model instead identifies someone
    // else depicted — reuses the Phase 24/25 invite pipeline.
    const submitted2 = await app.inject({
      method: 'POST',
      url: '/api/model/photos',
      headers: { cookie },
      payload: {
        title: 'Zuri and a friend',
        category: 'People',
        country: 'Nigeria',
        hasRecognizablePeople: true,
        copyrightHolder: 'Zuri Adewale',
        copyrightAttested: true,
        creationClaim: 'self_created',
        inPhotograph: true,
        ownLikenessConfirmed: true,
        ownUsage: 'editorial',
      },
    })
    assert.equal(submitted2.statusCode, 200, submitted2.body)
    const photoId2 = (submitted2.json() as { photo: { id: string } }).photo.id

    const invited = await app.inject({
      method: 'POST',
      url: `/api/model/photos/${photoId2}/appearances`,
      headers: { cookie },
      payload: {
        displayName: 'Friend In Frame',
        email: `friend-${Date.now()}@vuekumi.demo`,
        mobile: '+2348033333333',
      },
    })
    assert.equal(invited.statusCode, 200, invited.body)
    const invitedBody = invited.json() as { appearance: { consentStatus: string }; joinUrl: string }
    assert.equal(invitedBody.appearance.consentStatus, 'invitation_sent')
    assert.ok(invitedBody.joinUrl)

    const stillLocked = await app.inject({ method: 'GET', url: `/api/model/photos/${photoId2}` , headers: { cookie }})
    const lockedPhoto = (stillLocked.json() as {
      photo: { rights?: { modelConsentStatus: string; commercialEligible: boolean } }
    }).photo
    // The invite is pending, so rollup reports the finer-grained
    // 'invitation_sent' rather than 'required' — commercial stays locked
    // either way, which is the property that actually matters here.
    assert.equal(lockedPhoto.rights?.modelConsentStatus, 'invitation_sent')
    assert.equal(lockedPhoto.rights?.commercialEligible, false)
  } finally {
    await app.close()
  }
})
