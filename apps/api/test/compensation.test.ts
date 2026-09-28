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
import {
  splitCreatorPoolForModels,
} from '../src/lib/compensation.js'
import { issueGrant, LIKENESS_COMPENSATION_SOURCE } from '../src/lib/grants.js'
import { buildCertificatePdf } from '../src/lib/certificate.js'

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

test('splitCreatorPoolForModels pays models from creator pool and leaves photographer residual', () => {
  const split = splitCreatorPoolForModels(100, [
    {
      id: 'p1',
      appearanceId: 'a1',
      mode: 'percentage',
      percent: 20,
      fixedUsd: 0,
      appearance: { modelUserId: 'model-1' },
    },
    {
      id: 'p2',
      appearanceId: 'a2',
      mode: 'zero',
      percent: 0,
      fixedUsd: 0,
      appearance: { modelUserId: 'model-2' },
    },
  ])
  assert.equal(split.modelLines.length, 1)
  assert.equal(split.modelLines[0]!.amountUsd, 20)
  assert.equal(split.photographerPoolUsd, 80)
})

test('buyer certificate PDF never lists model economics', () => {
  const pdf = buildCertificatePdf({
    code: 'VK-TEST',
    issuedAt: '2026-09-28',
    photoTitle: 'Mirrored Giants',
    photoId: 'afr-020',
    photographer: 'Thandiwe Nkosi',
    licensee: 'Buyer',
    licenseeEmail: 'buyer@example.com',
    licenseName: 'Commercial',
    amountLabel: 'USD 16.00',
    scopeLines: ['Usage permission only'],
  }).toString('latin1')
  assert.match(pdf, /LICENSE CERTIFICATE/)
  assert.doesNotMatch(pdf, /model %|contributor pool|20%|likeness compensation/i)
})

test('issuing a paid grant writes likeness_compensation ledger lines from activated agreements', async () => {
  const appearance = await prepareCompensationPhoto()
  const ada = await prisma.user.findUniqueOrThrow({ where: { email: MODEL_EMAIL } })
  const thandiwe = await prisma.user.findUniqueOrThrow({ where: { email: PHOTOGRAPHER_EMAIL } })
  const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@vuekumi.demo' } })

  await prisma.compensationProposal.deleteMany({ where: { photoId: COMP_PHOTO_ID } })
  await prisma.compensationProposal.create({
    data: {
      photoId: COMP_PHOTO_ID,
      appearanceId: appearance.id,
      proposedById: thandiwe.id,
      proposedAs: 'photographer',
      status: 'activated',
      mode: 'percentage',
      percent: 20,
      fixedUsd: 0,
      paymentBase: 'contributor_distributable_share',
      activatedAt: new Date(),
    },
  })

  // Clear prior test grants/earnings for this buyer+photo+product.
  await prisma.earningsLedger.deleteMany({
    where: { photoId: COMP_PHOTO_ID, grantId: { not: null } },
  })
  await prisma.licenseGrant.deleteMany({
    where: { buyerId: member.id, photoId: COMP_PHOTO_ID, licenseType: 'commercial' },
  })

  try {
    const grant = await issueGrant({
      buyerId: member.id,
      photoId: COMP_PHOTO_ID,
      productId: 'commercial',
      licenseType: 'commercial',
      amountUsd: 100,
      currency: 'USD',
      amountLocal: 100,
      scopeJson: {},
    })

    const modelRows = await prisma.earningsLedger.findMany({
      where: { grantId: grant.id, source: LIKENESS_COMPENSATION_SOURCE },
    })
    assert.equal(modelRows.length, 1)
    assert.equal(modelRows[0]!.contributorId, ada.id)
    // RevenuePolicy 50/50 → creator pool 50; model 20% of 50 = 10
    assert.equal(modelRows[0]!.amountUsd, 10)

    const photoRows = await prisma.earningsLedger.findMany({
      where: { grantId: grant.id, source: 'licence_sale' },
    })
    assert.equal(photoRows.length, 1)
    assert.equal(photoRows[0]!.contributorId, thandiwe.id)
    assert.equal(photoRows[0]!.amountUsd, 40)
  } finally {
    await prisma.earningsLedger.deleteMany({ where: { photoId: COMP_PHOTO_ID, source: LIKENESS_COMPENSATION_SOURCE } })
    await prisma.licenseGrant.deleteMany({
      where: { buyerId: member.id, photoId: COMP_PHOTO_ID, licenseType: 'commercial' },
    })
    await restoreCompensationPhoto()
  }
})
