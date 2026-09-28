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

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
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
  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(photographer.statusCode, 200, photographer.body)
  const photoCookie = cookies(photographer)

  const appearance = await prisma.photoAppearance.findFirst({
    where: { photoId: 'afr-011', modelUserId: { not: null } },
    include: { modelUser: true, photo: true },
  })
  assert.ok(appearance?.modelUserId)
  assert.ok(appearance.modelUser?.email)

  // Ensure photo is Open-tier for the download gate test.
  await prisma.photo.update({
    where: { id: appearance.photoId },
    data: { libraryTier: 'OPEN', commercialStatus: 'ENABLED', commercialLocked: false },
  })
  await prisma.rightsRecord.updateMany({
    where: { photoId: appearance.photoId },
    data: { copyrightStatus: 'verified', modelConsentStatus: 'approved' },
  })
  await prisma.photoAppearance.updateMany({
    where: { photoId: appearance.photoId },
    data: { consentQuality: 'verified', verificationLevel: 'vuekumi_verified', consentStatus: 'approved', status: 'approved' },
  })
  await prisma.compensationProposal.deleteMany({ where: { photoId: appearance.photoId } })

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
    url: `/api/open/${appearance.photoId}/download`,
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

  const modelLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: appearance.modelUser!.email, password: 'User12345!' },
  })
  assert.equal(modelLogin.statusCode, 200, modelLogin.body)
  const modelCookie = cookies(modelLogin)

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
    url: `/api/open/${appearance.photoId}/download`,
    payload: { fileVariant: 'preview', source: 'test' },
  })
  assert.equal(openOk.statusCode, 200, openOk.body)
  assert.ok((openOk.json() as { openLicenseVersion: string }).openLicenseVersion)

  const listed = await app.inject({
    method: 'GET',
    url: `/api/photos/${appearance.photoId}/compensation`,
    headers: { cookie: photoCookie },
  })
  assert.equal(listed.statusCode, 200, listed.body)
  assert.ok(((listed.json() as { items: unknown[] }).items.length) >= 2)

  await app.close()
})

test('activating percentage deals that exceed 100% of the creator pool is rejected', async () => {
  const app = await buildApp()
  const photographer = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'amara-okafor@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(photographer.statusCode, 200, photographer.body)
  const photoCookie = cookies(photographer)

  const appearances = await prisma.photoAppearance.findMany({
    where: { photoId: 'afr-011', modelUserId: { not: null } },
    include: { modelUser: true },
    take: 2,
  })
  if (appearances.length < 2) {
    // Seed may only have one claimed model on this photo — create a synthetic second appearance.
    const photo = await prisma.photo.findUniqueOrThrow({ where: { id: 'afr-011' } })
    const extraModel = await prisma.user.findFirst({
      where: { accountType: 'model', email: { not: appearances[0]?.modelUser?.email ?? '' } },
    })
    assert.ok(extraModel)
    const second = await prisma.photoAppearance.create({
      data: {
        photoId: photo.id,
        displayName: extraModel.name,
        modelUserId: extraModel.id,
        invitedById: photo.contributorId,
        status: 'approved',
        consentStatus: 'approved',
        usage: 'commercial',
        confirmedLikeness: true,
      },
      include: { modelUser: true },
    })
    appearances.push(second)
  }

  await prisma.compensationProposal.deleteMany({ where: { photoId: 'afr-011' } })

  async function activatePercent(appearanceId: string, modelEmail: string, percent: number) {
    const propose = await app.inject({
      method: 'POST',
      url: `/api/appearances/${appearanceId}/compensation`,
      headers: { cookie: photoCookie },
      payload: { mode: 'percentage', percent, fixedUsd: 0 },
    })
    assert.equal(propose.statusCode, 201, propose.body)
    const id = (propose.json() as { proposal: { id: string } }).proposal.id
    const modelLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: modelEmail, password: 'User12345!' },
    })
    assert.equal(modelLogin.statusCode, 200, modelLogin.body)
    const accept = await app.inject({
      method: 'POST',
      url: `/api/compensation/${id}/accept`,
      headers: { cookie: cookies(modelLogin) },
    })
    assert.equal(accept.statusCode, 200, accept.body)
    return app.inject({
      method: 'POST',
      url: `/api/compensation/${id}/activate`,
      headers: { cookie: photoCookie },
    })
  }

  const first = await activatePercent(appearances[0]!.id, appearances[0]!.modelUser!.email, 60)
  assert.equal(first.statusCode, 200, first.body)

  const second = await activatePercent(appearances[1]!.id, appearances[1]!.modelUser!.email, 50)
  assert.equal(second.statusCode, 400, second.body)
  assert.match((second.json() as { error: string }).error, /100%/)

  await app.close()
})
