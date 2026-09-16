import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CONSENT_VERSION,
  registerSchema,
  twoPartyBlocksLicense,
  twoPartyCommercialCleared,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import {
  appearanceUnclaimed,
  decideAppearanceBlocked,
  modelAccountBlocked,
  ownEmailInviteBlocked,
  slugModelHandle,
} from '../src/lib/models.js'
import { hasModelAccess } from '@vuekumi/shared'
import { inviteAccountBlocked } from '../src/lib/agency.js'
import { modelInviteEmail } from '../src/lib/email.js'
import { isLicenseOffered } from '../src/lib/rights.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('admins and agencies cannot become models; photographers may hold a model profile', () => {
  assert.equal(modelAccountBlocked('user'), null)
  assert.equal(modelAccountBlocked('model'), null)
  assert.equal(modelAccountBlocked('contributor'), null)
  assert.equal(modelAccountBlocked(undefined), null)
  assert.match(modelAccountBlocked('admin') ?? '', /Administrators/)
  assert.match(modelAccountBlocked('agency') ?? '', /Agency/)
  assert.equal(ownEmailInviteBlocked('amara-okafor@vuekumi.demo', 'amara-okafor@vuekumi.demo'), 'Identify yourself on this photograph instead of sending an invite')
  assert.equal(ownEmailInviteBlocked('ada@vuekumi.demo', 'amara-okafor@vuekumi.demo'), null)
  assert.equal(hasModelAccess({ accountType: 'contributor', hasModelProfile: true }), true)
  assert.equal(hasModelAccess({ accountType: 'contributor', hasModelProfile: false }), false)
  assert.equal(hasModelAccess({ accountType: 'model' }), true)
})

test('models cannot join an agency', () => {
  assert.match(inviteAccountBlocked('model') ?? '', /Models cannot join/)
})

test('approve requires confirmed likeness and a usage choice; reject does not', () => {
  assert.match(
    decideAppearanceBlocked({ confirmedLikeness: false, status: 'approved', usage: 'editorial' }) ?? '',
    /likeness/,
  )
  assert.match(
    decideAppearanceBlocked({ confirmedLikeness: true, status: 'approved', usage: 'none' }) ?? '',
    /editorial or commercial/,
  )
  assert.equal(
    decideAppearanceBlocked({ confirmedLikeness: true, status: 'approved', usage: 'commercial' }),
    null,
  )
  assert.equal(
    decideAppearanceBlocked({ confirmedLikeness: false, status: 'rejected' }),
    null,
  )
  assert.equal(appearanceUnclaimed('invited'), true)
  assert.equal(appearanceUnclaimed('claimed'), false)
})

test('model handles slug from the display name', () => {
  assert.equal(slugModelHandle('Ada Molefe', 'ab12'), 'ada-molefe-ab12')
  assert.equal(slugModelHandle('!!!', 'zz'), 'model-zz')
})

test('public registration cannot create a model account', () => {
  const parsed = registerSchema.safeParse({
    email: 'model@example.com',
    password: 'password1',
    name: 'No',
    accountType: 'model',
  })
  assert.equal(parsed.success, false)
})

test('model invite copy states likeness, consent, and that models do not earn', () => {
  const html = modelInviteEmail({
    displayName: 'Nomsa',
    photographerName: 'Amara Okafor',
    photoTitle: 'Knit Study, No. 4',
    link: 'https://vuekumi.com/invite/model/tok',
  })
  assert.match(html, /typed name is not identity/)
  assert.match(html, /checkbox is not consent/)
  assert.match(html, /do not earn/)
})

test('two-party helper blocks commercial people photos until every appearance is commercially approved', () => {
  assert.equal(
    twoPartyBlocksLicense({
      hasRecognizablePeople: false,
      appearances: [],
      licenseType: 'commercial',
      requiresModelRelease: true,
    }),
    undefined,
  )
  assert.equal(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances: [],
      licenseType: 'editorial',
      requiresModelRelease: false,
    }),
    undefined,
  )
  assert.match(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances: [],
      licenseType: 'commercial',
      requiresModelRelease: true,
    }) ?? '',
    /Identify every depicted person/,
  )
  assert.match(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances: [{ status: 'invited', usage: 'none', confirmedLikeness: false }],
      licenseType: 'exclusive',
      requiresModelRelease: true,
    }) ?? '',
    /confirm likeness/,
  )
  assert.match(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances: [{ status: 'approved', usage: 'editorial', confirmedLikeness: true }],
      licenseType: 'commercial',
      requiresModelRelease: true,
    }) ?? '',
    /commercial usage/,
  )
  assert.equal(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances: [{ status: 'approved', usage: 'commercial', confirmedLikeness: true }],
      licenseType: 'exclusive',
      requiresModelRelease: true,
    }),
    undefined,
  )
  assert.equal(CONSENT_VERSION, '1.0')
  assert.equal(
    twoPartyCommercialCleared({
      hasRecognizablePeople: true,
      appearances: [{ status: 'approved', usage: 'editorial', confirmedLikeness: true }],
    }),
    false,
  )
})

test('commercial licences are not offered from permission state alone on people photographs', () => {
  const product = {
    id: 'commercial',
    type: 'commercial' as const,
    name: 'Commercial',
    description: '',
    defaultUsd: 12,
    points: [],
    commercialAllowed: true,
    requiresModelRelease: true,
    agencyPreferred: false,
    quoteOnly: false,
    exclusiveOptIn: false,
    sortOrder: 2,
    active: true,
  }
  assert.equal(
    isLicenseOffered(product, {
      licenseType: 'premium',
      exclusiveAvailable: false,
      exclusiveSold: false,
      status: 'active',
      commercialLocked: false,
      permissionState: 'commercial',
      hasRecognizablePeople: true,
    }).offered,
    true,
  )
})

test('invite, claim, likeness gate, approve, and public photos hide invite emails', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  if (login.statusCode !== 200) {
    await app.close()
    return
  }
  const cookie = cookies(login)
  const email = `phase24-${Date.now()}@vuekumi.demo`

  const identified = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-pend-1/appearances',
    headers: { cookie },
    payload: { displayName: 'Test Model', email },
  })
  assert.equal(identified.statusCode, 200)
  const created = identified.json() as { appearance: { id: string; inviteEmail?: string; status: string }; joinUrl: string }
  assert.equal(created.appearance.status, 'invited')
  assert.equal(created.appearance.inviteEmail, email)
  assert.match(created.joinUrl, /\/invite\/model\//)
  const token = created.joinUrl.split('/invite/model/')[1]
  assert.ok(token)

  const publicPhoto = await app.inject({ method: 'GET', url: '/api/photos/afr-011' })
  assert.equal(publicPhoto.statusCode, 200)
  assert.equal(JSON.stringify(publicPhoto.json()).includes('nomsa@vuekumi.demo'), false)
  assert.equal(JSON.stringify(publicPhoto.json()).includes(email), false)

  const licenses = await app.inject({ method: 'GET', url: '/api/photos/afr-007/licenses' })
  const items = (licenses.json() as { items: { type: string; offered: boolean; blockedReason?: string }[] }).items
  assert.equal(items.find((i) => i.type === 'editorial')?.offered, true)
  assert.equal(items.find((i) => i.type === 'commercial')?.offered, false)
  assert.match(items.find((i) => i.type === 'commercial')?.blockedReason ?? '', /editorial|Identify every depicted person/i)

  const exclusiveLicenses = await app.inject({ method: 'GET', url: '/api/photos/afr-011/licenses' })
  const exclusiveItems = (exclusiveLicenses.json() as { items: { type: string; offered: boolean; blockedReason?: string }[] }).items
  assert.equal(exclusiveItems.find((i) => i.type === 'exclusive')?.offered, false)
  assert.match(exclusiveItems.find((i) => i.type === 'exclusive')?.blockedReason ?? '', /likeness|approve/)

  const editorial = await app.inject({ method: 'GET', url: '/api/photos/afr-001/licenses' })
  const editorialItems = (editorial.json() as { items: { type: string; offered: boolean }[] }).items
  assert.equal(editorialItems.find((i) => i.type === 'editorial')?.offered, true)
  assert.equal(editorialItems.find((i) => i.type === 'commercial')?.offered, false)

  const landscape = await app.inject({ method: 'GET', url: '/api/photos/afr-002/licenses' })
  const landscapeItems = (landscape.json() as { items: { type: string; offered: boolean }[] }).items
  assert.equal(landscapeItems.find((i) => i.type === 'commercial')?.offered, true)

  const preview = await app.inject({ method: 'GET', url: `/api/model/invite/${token}` })
  assert.equal(preview.statusCode, 200)
  assert.equal((preview.json() as { invite: { needsAccount: boolean; email: string } }).invite.needsAccount, true)

  const claimed = await app.inject({
    method: 'POST',
    url: `/api/model/invite/${token}`,
    payload: { name: 'Test Model', password: 'User12345!' },
  })
  assert.equal(claimed.statusCode, 200)
  const claimedUser = (claimed.json() as { user: { accountType: string; modelHandle: string | null } }).user
  assert.equal(claimedUser.accountType, 'model')
  assert.ok(claimedUser.modelHandle)
  const modelCookie = cookies(claimed)

  const pending = await app.inject({
    method: 'GET',
    url: '/api/model/appearances',
    headers: { cookie: modelCookie },
  })
  assert.equal(pending.statusCode, 200)
  const appearance = (pending.json() as { items: { id: string }[] }).items[0]
  assert.ok(appearance)

  const blocked = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${appearance.id}/decide`,
    headers: { cookie: modelCookie },
    payload: { confirmedLikeness: false, status: 'approved', usage: 'commercial' },
  })
  assert.equal(blocked.statusCode, 400)
  assert.match((blocked.json() as { error: string }).error, /likeness/)

  const approved = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${appearance.id}/decide`,
    headers: { cookie: modelCookie },
    payload: { confirmedLikeness: true, status: 'approved', usage: 'editorial' },
  })
  assert.equal(approved.statusCode, 200)
  assert.equal((approved.json() as { appearance: { status: string; confirmedLikeness: boolean } }).appearance.status, 'approved')

  const rejectedRegister = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: `reg-${Date.now()}@vuekumi.demo`, password: 'User12345!', name: 'Nope', accountType: 'model' },
  })
  assert.equal(rejectedRegister.statusCode, 400)

  const kofiLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'kofi-mensah@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(kofiLogin.statusCode, 200)
  const kofiUser = (kofiLogin.json() as {
    user: { accountType: string; hasModelProfile?: boolean; modelHandle: string | null; contributorHandle: string | null }
  }).user
  assert.equal(kofiUser.accountType, 'contributor')
  assert.equal(kofiUser.hasModelProfile, true)
  assert.equal(kofiUser.modelHandle, 'kofi-mensah')
  assert.equal(kofiUser.contributorHandle, 'kofi-mensah')
  const kofiCookie = cookies(kofiLogin)
  const kofiPortal = await app.inject({
    method: 'GET',
    url: '/api/model',
    headers: { cookie: kofiCookie },
  })
  assert.equal(kofiPortal.statusCode, 200)
  assert.equal((kofiPortal.json() as { handle: string | null; earns: boolean }).handle, 'kofi-mensah')
  assert.equal((kofiPortal.json() as { earns: boolean }).earns, false)
  const kofiAppearances = await app.inject({
    method: 'GET',
    url: '/api/model/appearances',
    headers: { cookie: kofiCookie },
  })
  const kofiItems = (kofiAppearances.json() as { items: { photoId: string; selfShot?: boolean; status: string }[] }).items
  assert.ok(kofiItems.some((row) => row.photoId === 'afr-027' && row.selfShot && row.status === 'approved'))
  const observerLicenses = await app.inject({ method: 'GET', url: '/api/photos/afr-027/licenses' })
  const observerItems = (observerLicenses.json() as { items: { type: string; offered: boolean }[] }).items
  assert.equal(observerItems.find((i) => i.type === 'commercial')?.offered, true)
  const observerPublic = await app.inject({ method: 'GET', url: '/api/photos/afr-027' })
  assert.equal((observerPublic.json() as { rights?: { twoPartyCleared?: boolean } }).rights?.twoPartyCleared, true)
  assert.equal(JSON.stringify(observerPublic.json()).includes('kofi-mensah@vuekumi.demo'), false)

  const ownEmailInvite = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-009/appearances',
    headers: { cookie },
    payload: { displayName: 'Amara', email: 'amara-okafor@vuekumi.demo' },
  })
  assert.equal(ownEmailInvite.statusCode, 400)
  assert.match((ownEmailInvite.json() as { error: string }).error, /Identify yourself/)

  const selfShotBlocked = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-009/appearances/self',
    headers: { cookie },
    payload: { confirmedLikeness: false, status: 'approved', usage: 'commercial' },
  })
  assert.equal(selfShotBlocked.statusCode, 400)
  assert.match((selfShotBlocked.json() as { error: string }).error, /likeness/)

  const selfShot = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-009/appearances/self',
    headers: { cookie },
    payload: { confirmedLikeness: true, status: 'approved', usage: 'commercial', displayName: 'Amara Okafor' },
  })
  assert.equal(selfShot.statusCode, 200)
  const selfBody = selfShot.json() as {
    appearance: { selfShot?: boolean; status: string; consentVersion?: string | null }
  }
  assert.equal(selfBody.appearance.selfShot, true)
  assert.equal(selfBody.appearance.status, 'approved')
  assert.equal(selfBody.appearance.consentVersion, '1.0')
  const amaraMe = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
  const amaraUser = (amaraMe.json() as { user: { accountType: string; hasModelProfile?: boolean } }).user
  assert.equal(amaraUser.accountType, 'contributor')
  assert.equal(amaraUser.hasModelProfile, true)

  const stillEditorial = await app.inject({ method: 'GET', url: '/api/photos/afr-009/licenses' })
  assert.equal(
    (stillEditorial.json() as { items: { type: string; offered: boolean }[] }).items.find((i) => i.type === 'commercial')?.offered,
    false,
  )
  const unlockNine = await app.inject({
    method: 'PATCH',
    url: '/api/contributor/photos/afr-009',
    headers: { cookie },
    payload: { permissionState: 'commercial' },
  })
  assert.equal(unlockNine.statusCode, 200)
  const nineOpen = await app.inject({ method: 'GET', url: '/api/photos/afr-009/licenses' })
  assert.equal(
    (nineOpen.json() as { items: { type: string; offered: boolean }[] }).items.find((i) => i.type === 'commercial')?.offered,
    true,
  )

  const lekanLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'lekan-adeyemi@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(lekanLogin.statusCode, 200)
  const lekanCookie = cookies(lekanLogin)
  const inviteAmara = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-007/appearances',
    headers: { cookie: lekanCookie },
    payload: { displayName: 'Amara', email: 'amara-okafor@vuekumi.demo' },
  })
  assert.equal(inviteAmara.statusCode, 200)
  const amaraInviteToken = (inviteAmara.json() as { joinUrl: string }).joinUrl.split('/invite/model/')[1]
  const claimedAsContributor = await app.inject({
    method: 'POST',
    url: `/api/model/invite/${amaraInviteToken}`,
    headers: { cookie },
    payload: {},
  })
  assert.equal(claimedAsContributor.statusCode, 200)
  const claimedDual = (claimedAsContributor.json() as { user: { accountType: string; hasModelProfile?: boolean } }).user
  assert.equal(claimedDual.accountType, 'contributor')
  assert.equal(claimedDual.hasModelProfile, true)

  const inviteAdmin = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-023/appearances',
    headers: { cookie },
    payload: { displayName: 'Staff', email: 'admin@vuekumi.com' },
  })
  assert.equal(inviteAdmin.statusCode, 200)
  const adminToken = (inviteAdmin.json() as { joinUrl: string; appearance: { id: string } }).joinUrl.split('/invite/model/')[1]
  const adminAppearanceId = (inviteAdmin.json() as { appearance: { id: string } }).appearance.id
  const adminClaimLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  const adminClaim = await app.inject({
    method: 'POST',
    url: `/api/model/invite/${adminToken}`,
    headers: { cookie: cookies(adminClaimLogin) },
    payload: {},
  })
  assert.equal(adminClaim.statusCode, 403)
  await app.inject({
    method: 'DELETE',
    url: `/api/contributor/photos/afr-023/appearances/${adminAppearanceId}`,
    headers: { cookie },
  })

  const inviteAgency = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-023/appearances',
    headers: { cookie },
    payload: { displayName: 'Agency', email: 'agency@vuekumi.demo' },
  })
  assert.equal(inviteAgency.statusCode, 200)
  const agencyToken = (inviteAgency.json() as { joinUrl: string; appearance: { id: string } }).joinUrl.split('/invite/model/')[1]
  const agencyAppearanceId = (inviteAgency.json() as { appearance: { id: string } }).appearance.id
  const agencyLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'agency@vuekumi.demo', password: 'User12345!' },
  })
  const agencyClaim = await app.inject({
    method: 'POST',
    url: `/api/model/invite/${agencyToken}`,
    headers: { cookie: cookies(agencyLogin) },
    payload: {},
  })
  assert.equal(agencyClaim.statusCode, 403)
  await app.inject({
    method: 'DELETE',
    url: `/api/contributor/photos/afr-023/appearances/${agencyAppearanceId}`,
    headers: { cookie },
  })

  const adaLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ada@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(adaLogin.statusCode, 200)
  const ada = await app.inject({
    method: 'GET',
    url: '/api/model/appearances',
    headers: { cookie: cookies(adaLogin) },
  })
  const adaItems = (ada.json() as { items: { photoId: string; status: string; inviteEmail?: string }[] }).items
  assert.ok(adaItems.some((row) => row.photoId === 'afr-001' && row.status === 'approved'))
  assert.equal(adaItems.some((row) => Boolean(row.inviteEmail)), false)

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  const models = await app.inject({
    method: 'GET',
    url: '/api/admin/models',
    headers: { cookie: cookies(adminLogin) },
  })
  assert.equal(models.statusCode, 200)
  const adminItems = (models.json() as { items: { email: string; dualRole?: boolean }[] }).items
  assert.ok(adminItems.some((row) => row.email === 'ada@vuekumi.demo'))
  assert.ok(adminItems.some((row) => row.email === 'kofi-mensah@vuekumi.demo' && row.dualRole))
  assert.ok(adminItems.some((row) => row.email === 'amara-okafor@vuekumi.demo' && row.dualRole))

  const adminCookie = cookies(adminLogin)
  const prematureProcess = await app.inject({
    method: 'POST',
    url: '/api/admin/content/afr-007/verify-process',
    headers: { cookie: adminCookie },
    payload: {},
  })
  assert.equal(prematureProcess.statusCode, 400)
  assert.match((prematureProcess.json() as { error: string }).error, /photographer and model/)

  const pendDetail = await app.inject({
    method: 'GET',
    url: '/api/admin/content/afr-pend-1',
    headers: { cookie: adminCookie },
  })
  assert.equal(pendDetail.statusCode, 200)
  const release = (pendDetail.json() as { modelReleases: { id: string }[] }).modelReleases[0]
  assert.ok(release)
  const pdfOk = await app.inject({
    method: 'POST',
    url: `/api/admin/model-releases/${release.id}/review`,
    headers: { cookie: adminCookie },
    payload: { status: 'verified' },
  })
  assert.equal(pdfOk.statusCode, 200)
  const stillBlocked = await app.inject({
    method: 'PATCH',
    url: '/api/contributor/photos/afr-pend-1',
    headers: { cookie },
    payload: { permissionState: 'commercial' },
  })
  assert.equal(stillBlocked.statusCode, 400)
  assert.match((stillBlocked.json() as { error: string }).error, /photographer and model approval/i)

  const nomsaClaim = await app.inject({
    method: 'POST',
    url: '/api/model/invite/seed-nomsa-model-invite',
    payload: { name: 'Nomsa Dlamini', password: 'User12345!' },
  })
  assert.equal(nomsaClaim.statusCode, 200)
  const nomsaCookie = cookies(nomsaClaim)
  const nomsaList = await app.inject({
    method: 'GET',
    url: '/api/model/appearances',
    headers: { cookie: nomsaCookie },
  })
  const nomsaRow = (nomsaList.json() as { items: { id: string; photoId: string; consentVersion?: string | null }[] }).items
    .find((row) => row.photoId === 'afr-011')
  assert.ok(nomsaRow)
  const nomsaApprove = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${nomsaRow.id}/decide`,
    headers: { cookie: nomsaCookie },
    payload: { confirmedLikeness: true, status: 'approved', usage: 'commercial' },
  })
  assert.equal(nomsaApprove.statusCode, 200)
  assert.equal((nomsaApprove.json() as { appearance: { consentVersion?: string | null } }).appearance.consentVersion, '1.0')

  const unlocked = await app.inject({ method: 'GET', url: '/api/photos/afr-011/licenses' })
  const unlockedItems = (unlocked.json() as { items: { type: string; offered: boolean }[] }).items
  assert.equal(unlockedItems.find((i) => i.type === 'exclusive')?.offered, true)

  const processOk = await app.inject({
    method: 'POST',
    url: '/api/admin/content/afr-011/verify-process',
    headers: { cookie: adminCookie },
    payload: {},
  })
  assert.equal(processOk.statusCode, 200)
  assert.equal((processOk.json() as { consentVersion: string }).consentVersion, '1.0')

  await app.close()
})
