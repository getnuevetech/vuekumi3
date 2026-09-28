import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertMultiModelPercentCap,
  compensationRequestedFromProposals,
  modelAllocationFromAgreement,
  negotiationTermsSatisfied,
  termsRequestRevenue,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

/** Claimed-model people photo (Ada). Do not use afr-011 — models/permissions own Nomsa invite there. */
const COMP_PHOTO_ID = 'afr-001'
const PHOTOGRAPHER_EMAIL = 'thandiwe-nkosi@vuekumi.demo'
const MODEL_EMAIL = 'ada@vuekumi.demo'
const MODEL_PASSWORD = 'User12345!'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: MODEL_PASSWORD },
  })
  assert.equal(res.statusCode, 200, res.body)
  return cookies(res)
}

/** Open-tier prep for compensation gates; always restore afterward. */
async function prepareCompensationPhoto() {
  const appearance = await prisma.photoAppearance.findFirst({
    where: { photoId: COMP_PHOTO_ID, modelUserId: { not: null } },
    include: { modelUser: true },
  })
  assert.ok(appearance?.modelUserId, `claimed appearance required on ${COMP_PHOTO_ID}`)
  assert.ok(appearance.modelUser?.email)

  await prisma.photo.update({
    where: { id: COMP_PHOTO_ID },
    data: {
      libraryTier: 'OPEN',
      commercialStatus: 'ENABLED',
      commercialLocked: false,
      commercialLockReason: null,
      permissionState: 'commercial',
      hasRecognizablePeople: true,
    },
  })
  await prisma.rightsRecord.updateMany({
    where: { photoId: COMP_PHOTO_ID },
    data: { copyrightStatus: 'verified', modelConsentStatus: 'approved', commercialEligible: true },
  })
  await prisma.photoAppearance.updateMany({
    where: { photoId: COMP_PHOTO_ID, modelUserId: { not: null } },
    data: {
      consentQuality: 'verified',
      verificationLevel: 'vuekumi_verified',
      consentStatus: 'approved',
      status: 'approved',
      decisionKind: 'approved',
      confirmedLikeness: true,
      usage: 'commercial',
    },
  })
  await prisma.compensationProposal.deleteMany({ where: { photoId: COMP_PHOTO_ID } })
  return appearance
}

/** Restore afr-001 seed shape so permissions/models later in the suite stay green. */
async function restoreCompensationPhoto(extraAppearanceIds: string[] = []) {
  if (extraAppearanceIds.length) {
    await prisma.compensationProposal.deleteMany({
      where: { appearanceId: { in: extraAppearanceIds } },
    })
    await prisma.photoAppearance.deleteMany({ where: { id: { in: extraAppearanceIds } } })
  }
  await prisma.compensationProposal.deleteMany({ where: { photoId: COMP_PHOTO_ID } })
  await prisma.photo.update({
    where: { id: COMP_PHOTO_ID },
    data: {
      libraryTier: 'EDITORIAL',
      commercialStatus: 'ENABLED',
      commercialLocked: false,
      commercialLockReason: null,
      permissionState: 'editorial',
      hasRecognizablePeople: true,
    },
  })
  await prisma.rightsRecord.updateMany({
    where: { photoId: COMP_PHOTO_ID },
    data: { copyrightStatus: 'verified', modelConsentStatus: 'approved', commercialEligible: true },
  })
  await prisma.photoAppearance.updateMany({
    where: { photoId: COMP_PHOTO_ID, modelUserId: { not: null } },
    data: {
      consentQuality: 'verified',
      verificationLevel: 'vuekumi_verified',
      consentStatus: 'approved',
      status: 'approved',
      decisionKind: 'approved',
      confirmedLikeness: true,
      usage: 'editorial',
    },
  })
}

test('zero terms do not request revenue; percentage and fixed do', () => {
  assert.equal(termsRequestRevenue({ mode: 'zero', percent: 0, fixedUsd: 0 }), false)
  assert.equal(termsRequestRevenue({ mode: 'percentage', percent: 20, fixedUsd: 0 }), true)
  assert.equal(termsRequestRevenue({ mode: 'fixed', percent: 0, fixedUsd: 50 }), true)
})

test('Open compensationRequested derives from live non-zero proposals', () => {
  assert.equal(
    compensationRequestedFromProposals([
      { status: 'proposed', mode: 'percentage', percent: 20, fixedUsd: 0 },
    ]),
    true,
  )
  assert.equal(
    compensationRequestedFromProposals([
      { status: 'activated', mode: 'zero', percent: 0, fixedUsd: 0 },
    ]),
    false,
  )
  assert.equal(
    compensationRequestedFromProposals([
      { status: 'declined', mode: 'percentage', percent: 40, fixedUsd: 0 },
    ]),
    false,
  )
})

test('negotiation requires an activated agreement per required appearance', () => {
  const missing = negotiationTermsSatisfied({
    hasRecognizablePeople: true,
    requiredAppearanceIds: ['a1', 'a2'],
    proposals: [{ appearanceId: 'a1', status: 'activated' }],
  })
  assert.equal(missing.ok, false)
  assert.deepEqual(missing.missingAppearanceIds, ['a2'])

  const ok = negotiationTermsSatisfied({
    hasRecognizablePeople: true,
    requiredAppearanceIds: ['a1', 'a2'],
    proposals: [
      { appearanceId: 'a1', status: 'activated' },
      { appearanceId: 'a2', status: 'activated' },
    ],
  })
  assert.equal(ok.ok, true)
})

test('multi-model percent cap rejects sums over 100% of creator pool', () => {
  const ok = assertMultiModelPercentCap([
    { mode: 'percentage', percent: 40 },
    { mode: 'percentage', percent: 35 },
  ])
  assert.equal(ok.ok, true)

  const bad = assertMultiModelPercentCap([
    { mode: 'percentage', percent: 60 },
    { mode: 'both', percent: 50 },
  ])
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.ok(bad.totalPercent > 100)

  assert.equal(modelAllocationFromAgreement(100, { mode: 'percentage', percent: 20, fixedUsd: 0 }), 20)
  assert.equal(modelAllocationFromAgreement(100, { mode: 'zero', percent: 0, fixedUsd: 0 }), 0)
})

test('propose → accept → activate zero-fee Open path; revenue ask blocks Open', async () => {
  const app = await buildApp()
  try {
    const appearance = await prepareCompensationPhoto()
    const photoCookie = await login(app, PHOTOGRAPHER_EMAIL)

    const revenueAsk = await app.inject({
      method: 'POST',
      url: `/api/appearances/${appearance.id}/compensation`,
      headers: { cookie: photoCookie },
      payload: { mode: 'percentage', percent: 20, fixedUsd: 0 },
    })
    assert.equal(revenueAsk.statusCode, 201, revenueAsk.body)
    const revenueProposal = (revenueAsk.json() as { proposal: { id: string } }).proposal

    const openBlocked = await app.inject({
      method: 'POST',
      url: `/api/open/${COMP_PHOTO_ID}/download`,
      payload: { fileVariant: 'preview', source: 'test' },
    })
    assert.equal(openBlocked.statusCode, 403, openBlocked.body)
    assert.match((openBlocked.json() as { reason?: string }).reason ?? '', /compensation_requested/)

    await app.inject({
      method: 'POST',
      url: `/api/compensation/${revenueProposal.id}/decline`,
      headers: { cookie: photoCookie },
    })

    const zeroPropose = await app.inject({
      method: 'POST',
      url: `/api/appearances/${appearance.id}/compensation`,
      headers: { cookie: photoCookie },
      payload: { mode: 'zero', percent: 0, fixedUsd: 0 },
    })
    assert.equal(zeroPropose.statusCode, 201, zeroPropose.body)
    const zeroId = (zeroPropose.json() as { proposal: { id: string } }).proposal.id

    const modelCookie = await login(app, MODEL_EMAIL)

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/compensation/${zeroId}/accept`,
      headers: { cookie: modelCookie },
    })
    assert.equal(accepted.statusCode, 200, accepted.body)

    const activated = await app.inject({
      method: 'POST',
      url: `/api/compensation/${zeroId}/activate`,
      headers: { cookie: photoCookie },
    })
    assert.equal(activated.statusCode, 200, activated.body)
    assert.equal((activated.json() as { proposal: { status: string } }).proposal.status, 'activated')

    const openOk = await app.inject({
      method: 'POST',
      url: `/api/open/${COMP_PHOTO_ID}/download`,
      payload: { fileVariant: 'preview', source: 'test' },
    })
    assert.equal(openOk.statusCode, 200, openOk.body)
    assert.ok((openOk.json() as { openLicenseVersion: string }).openLicenseVersion)

    const listed = await app.inject({
      method: 'GET',
      url: `/api/photos/${COMP_PHOTO_ID}/compensation`,
      headers: { cookie: photoCookie },
    })
    assert.equal(listed.statusCode, 200, listed.body)
    assert.ok(((listed.json() as { items: unknown[] }).items.length) >= 2)
  } finally {
    await restoreCompensationPhoto()
    await app.close()
  }
})

test('activating percentage deals that exceed 100% of the creator pool is rejected', async () => {
  const app = await buildApp()
  const extraIds: string[] = []
  try {
    const firstAppearance = await prepareCompensationPhoto()
    const photoCookie = await login(app, PHOTOGRAPHER_EMAIL)

    const photo = await prisma.photo.findUniqueOrThrow({ where: { id: COMP_PHOTO_ID } })
    const extraModel = await prisma.user.findFirst({
      where: {
        accountType: 'model',
        email: { not: MODEL_EMAIL },
        modelProfile: { isNot: null },
      },
    })
    assert.ok(extraModel, 'need a second seeded model account')

    const second = await prisma.photoAppearance.create({
      data: {
        photoId: photo.id,
        displayName: extraModel.name,
        modelUserId: extraModel.id,
        invitedById: photo.contributorId,
        status: 'approved',
        consentStatus: 'approved',
        decisionKind: 'approved',
        verificationLevel: 'vuekumi_verified',
        consentQuality: 'verified',
        confirmedLikeness: true,
        usage: 'commercial',
        ageClass: 'adult',
      },
      include: { modelUser: true },
    })
    extraIds.push(second.id)
    assert.ok(second.modelUser?.email)

    async function activatePercent(appearanceId: string, modelEmail: string, percent: number) {
      const propose = await app.inject({
        method: 'POST',
        url: `/api/appearances/${appearanceId}/compensation`,
        headers: { cookie: photoCookie },
        payload: { mode: 'percentage', percent, fixedUsd: 0 },
      })
      assert.equal(propose.statusCode, 201, propose.body)
      const id = (propose.json() as { proposal: { id: string } }).proposal.id
      const modelCookie = await login(app, modelEmail)
      const accept = await app.inject({
        method: 'POST',
        url: `/api/compensation/${id}/accept`,
        headers: { cookie: modelCookie },
      })
      assert.equal(accept.statusCode, 200, accept.body)
      return app.inject({
        method: 'POST',
        url: `/api/compensation/${id}/activate`,
        headers: { cookie: photoCookie },
      })
    }

    const first = await activatePercent(firstAppearance.id, MODEL_EMAIL, 60)
    assert.equal(first.statusCode, 200, first.body)

    const secondAct = await activatePercent(second.id, second.modelUser!.email, 50)
    assert.equal(secondAct.statusCode, 400, secondAct.body)
    assert.match((secondAct.json() as { error: string }).error, /100%/)
  } finally {
    await restoreCompensationPhoto(extraIds)
    await app.close()
  }
})
