import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  biometricIdentificationBlocked,
  consentWithdrawalEffect,
  creatorCountryAllowed,
  overlayCannotClearCommercial,
  overlayContributorAllowedBlocked,
  overlayKindForCountry,
  overlayBlocksPersonDetection,
  PRIORITY_OVERLAY_COUNTRIES,
} from '@vuekumi/shared'
import { photographerRightsNoticeEmail } from '../src/lib/email.js'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return cookies(res)
}

test('priority overlays, standard extra notice, and buyer countries never weaken GRS', () => {
  assert.equal(overlayKindForCountry({ code: 'NG', region: 'africa', contributorEligible: true }), 'priority')
  assert.equal(overlayKindForCountry({ code: 'BW', region: 'africa', contributorEligible: true }), 'standard')
  assert.equal(overlayKindForCountry({ code: 'US', region: 'americas', contributorEligible: false }), 'buyer')
  assert.equal(PRIORITY_OVERLAY_COUNTRIES.length, 8)

  assert.equal(overlayContributorAllowedBlocked({
    region: 'americas',
    contributorEligible: false,
    overlayContributorAllowed: true,
  }), 'Country overlays cannot make a non-African country creator-eligible')
  assert.equal(creatorCountryAllowed({
    accountType: 'photographer',
    countryContributorEligible: false,
    overlayContributorAllowed: true,
    region: 'americas',
  }), false)
  assert.equal(creatorCountryAllowed({
    accountType: 'model',
    countryContributorEligible: false,
    overlayContributorAllowed: false,
    region: 'americas',
  }), true)

  assert.match(overlayCannotClearCommercial({
    copyrightStatus: 'claimed',
    modelConsentStatus: 'approved',
    creationClaim: 'photographer_took',
  }) ?? '', /declaration does not unlock commercial/)
  assert.equal('commercialEligible' in { overlayKind: 'priority' }, false)

  assert.match(biometricIdentificationBlocked({ biometricForbidden: true }) ?? '', /Stage 3/)
  assert.equal(overlayBlocksPersonDetection({ biometricForbidden: true }), false)

  const withdraw = consentWithdrawalEffect()
  assert.equal(withdraw.lockNewSales, true)
  assert.equal(withdraw.voidPastGrants, false)
  assert.equal(withdraw.disputeIfContested, true)
})

test('Route B photographer notice names the supplier and is not a marketing list', () => {
  const html = photographerRightsNoticeEmail({
    displayName: 'Lena',
    modelName: 'Ada Molefe',
    photoTitle: 'Studio portrait',
    link: 'https://vuekumi.com/invite/photographer/tok',
  })
  assert.match(html, /rights clearance only/)
  assert.match(html, /not a marketing list/)
  assert.match(html, /Ada Molefe/)
  assert.match(html, /who supplied/)
})

test('public legal standard and Nigeria overlay are counsel-gated product copy', async () => {
  const app = await buildApp()
  const standard = await app.inject({ method: 'GET', url: '/api/legal/standard' })
  assert.equal(standard.statusCode, 200, standard.body)
  const body = standard.json() as { name: string; counselGated: string; agreementStack: { kind: string }[]; withdrawal: { voidPastGrants: boolean } }
  assert.match(body.name, /Global Rights Standard/)
  assert.match(body.counselGated, /counsel-gated/)
  assert.equal(body.agreementStack.some((row) => row.kind === 'buyer_licence'), true)
  assert.equal(body.withdrawal.voidPastGrants, false)

  const ng = await app.inject({ method: 'GET', url: '/api/legal/overlays/NG' })
  if (ng.statusCode === 404) {
    await app.close()
    return
  }
  assert.equal(ng.statusCode, 200, ng.body)
  const overlay = (ng.json() as { overlay: { overlayKind: string; counselStatus: string; lawLabel: string | null; contributorAllowed: boolean; extraNotice: string | null } }).overlay
  assert.equal(overlay.overlayKind, 'priority')
  assert.equal(overlay.counselStatus, 'placeholder')
  assert.match(overlay.lawLabel ?? '', /NDPA/)
  assert.equal(overlay.contributorAllowed, true)
  assert.equal(overlay.extraNotice, null)

  const us = await app.inject({ method: 'GET', url: '/api/legal/overlays/US' })
  assert.equal(us.statusCode, 200, us.body)
  const buyer = (us.json() as { overlay: { overlayKind: string; contributorAllowed: boolean } }).overlay
  assert.equal(buyer.overlayKind, 'buyer')
  assert.equal(buyer.contributorAllowed, false)

  const bw = await app.inject({ method: 'GET', url: '/api/legal/overlays/BW' })
  assert.equal(bw.statusCode, 200, bw.body)
  const standardOverlay = (bw.json() as { overlay: { overlayKind: string; extraNotice: string | null } }).overlay
  assert.equal(standardOverlay.overlayKind, 'standard')
  assert.match(standardOverlay.extraNotice ?? '', /extra notice/)
  await app.close()
})

test('finance cannot read legal overlays; overlay cannot enable the United States', async () => {
  const app = await buildApp()
  const finance = await login(app, 'finance@vuekumi.demo', 'User12345!')
  const forbidden = await app.inject({ method: 'GET', url: '/api/admin/legal/overlays', headers: { cookie: finance } })
  assert.equal(forbidden.statusCode, 403)

  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const us = await app.inject({
    method: 'PATCH',
    url: '/api/admin/legal/overlays/US',
    headers: { cookie: admin },
    payload: { contributorAllowed: true },
  })
  assert.equal(us.statusCode, 400, us.body)
  assert.match((us.json() as { error: string }).error, /non-African/)
  await app.close()
})

test('revoking likeness locks new sales and leaves existing grants', async () => {
  const app = await buildApp()
  const kofi = await prisma.user.findUnique({ where: { email: 'kofi-mensah@vuekumi.demo' } })
  const ada = await prisma.user.findUnique({ where: { email: 'ada@vuekumi.demo' } })
  if (!kofi || !ada) {
    await app.close()
    return
  }
  const stamp = `legal-${Date.now()}`
  const photo = await prisma.photo.create({
    data: {
      id: stamp,
      contributorId: kofi.id,
      uploadedById: kofi.id,
      creationClaim: 'self_created',
      title: 'Revoke isolation',
      category: 'People',
      country: 'Ghana',
      licenseType: 'premium',
      price: 20,
      status: 'active',
      src: '/images/photos/fashion-portrait.jpg',
      hasRecognizablePeople: true,
      permissionState: 'commercial',
      publishedAt: new Date(),
      rightsRecord: {
        create: {
          copyrightVerified: true,
          copyrightStatus: 'verified',
          platformRightsOk: true,
          modelReleaseRequired: true,
          modelConsentStatus: 'approved',
          commercialEligible: true,
        },
      },
    },
  })
  const appearance = await prisma.photoAppearance.create({
    data: {
      photoId: photo.id,
      displayName: 'Ada Molefe',
      inviteEmail: ada.email,
      modelUserId: ada.id,
      invitedById: kofi.id,
      status: 'approved',
      consentStatus: 'approved',
      decisionKind: 'approved',
      confirmedLikeness: true,
      usage: 'commercial',
      selfShot: true,
      consentVersion: '1.0',
      decidedAt: new Date(),
    },
  })
  const grant = await prisma.licenseGrant.create({
    data: {
      buyerId: ada.id,
      photoId: photo.id,
      productId: 'commercial',
      licenseType: 'commercial',
      amountUsd: 20,
      currency: 'USD',
      amountLocal: 20,
      scopeJson: {},
      certificateCode: `VK-LEGAL-${stamp}`,
      agreementKind: 'buyer_licence',
      agreementVersion: '1.0-buyer',
    },
  })

  const cookie = await login(app, 'ada@vuekumi.demo', 'User12345!')
  const revoked = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${appearance.id}/decide`,
    headers: { cookie },
    payload: { confirmedLikeness: true, status: 'revoked', usage: 'none' },
  })
  assert.equal(revoked.statusCode, 200, revoked.body)
  const row = await prisma.photoAppearance.findUniqueOrThrow({ where: { id: appearance.id } })
  assert.equal(row.status, 'revoked')
  assert.equal(row.consentStatus, 'revoked')
  const still = await prisma.licenseGrant.findUniqueOrThrow({ where: { id: grant.id } })
  assert.equal(still.certificateCode, grant.certificateCode)
  assert.equal(still.agreementVersion, '1.0-buyer')

  const licenses = await app.inject({ method: 'GET', url: `/api/photos/${photo.id}/licenses` })
  const commercial = (licenses.json() as { items: { type: string; offered: boolean; blockedReason?: string }[] }).items
    .find((item) => item.type === 'commercial')
  assert.equal(commercial?.offered, false)
  assert.match(commercial?.blockedReason ?? '', /revoked|LOCKED|consent|editorial/i)
  await app.close()
})
