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
  slugModelHandle,
} from '../src/lib/models.js'
import { inviteAccountBlocked } from '../src/lib/agency.js'
import { modelInviteEmail } from '../src/lib/email.js'
import { isLicenseOffered } from '../src/lib/rights.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('one type per email: photographers, admins, and agencies cannot become models', () => {
  assert.equal(modelAccountBlocked('user'), null)
  assert.equal(modelAccountBlocked('model'), null)
  assert.equal(modelAccountBlocked(undefined), null)
  assert.match(modelAccountBlocked('contributor') ?? '', /Photographers cannot become models/)
  assert.match(modelAccountBlocked('admin') ?? '', /Administrators/)
  assert.match(modelAccountBlocked('agency') ?? '', /Agency/)
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

  const contributorInvite = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos/afr-009/appearances',
    headers: { cookie },
    payload: { displayName: 'Amara', email: 'amara-okafor@vuekumi.demo' },
  })
  let contribToken: string | undefined
  let contribAppearanceId: string | undefined
  if (contributorInvite.statusCode === 200) {
    const body = contributorInvite.json() as { appearance: { id: string }; joinUrl: string }
    contribToken = body.joinUrl.split('/invite/model/')[1]
    contribAppearanceId = body.appearance.id
  } else {
    const photo = await app.inject({
      method: 'GET',
      url: '/api/contributor/photos/afr-009',
      headers: { cookie },
    })
    const row = (photo.json() as { photo: { appearances?: { id: string; inviteEmail?: string }[] } })
      .photo.appearances?.find((item) => item.inviteEmail === 'amara-okafor@vuekumi.demo')
    if (row) {
      const resend = await app.inject({
        method: 'POST',
        url: `/api/contributor/photos/afr-009/appearances/${row.id}/resend`,
        headers: { cookie },
        payload: {},
      })
      contribToken = (resend.json() as { joinUrl: string }).joinUrl.split('/invite/model/')[1]
      contribAppearanceId = row.id
    }
  }
  assert.ok(contribToken)
  const blockedClaim = await app.inject({
    method: 'POST',
    url: `/api/model/invite/${contribToken}`,
    headers: { cookie },
    payload: {},
  })
  assert.equal(blockedClaim.statusCode, 403)
  if (contribAppearanceId) {
    await app.inject({
      method: 'DELETE',
      url: `/api/contributor/photos/afr-009/appearances/${contribAppearanceId}`,
      headers: { cookie },
    })
  }

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
  const adminItems = (models.json() as { items: { email: string }[] }).items
  assert.ok(adminItems.some((row) => row.email === 'ada@vuekumi.demo'))

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
