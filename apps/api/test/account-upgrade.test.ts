import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accountUpgradeBlocked } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { withAfricaListOnboarding } from './helpers/onboarding.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('Dec-Upgrade helpers only allow Photo Influencer sources', () => {
  assert.equal(accountUpgradeBlocked('photo_influencer', 'photographer'), undefined)
  assert.match(accountUpgradeBlocked('contributor', 'photographer') ?? '', /Photo Influencer/)
})

test('photo influencer upgrades to photographer on the same email with agreement', async () => {
  await withAfricaListOnboarding(async () => {
    const app = await buildApp()
    const email = `upgrade-${Date.now()}@vuekumi.demo`
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'User12345!',
        name: 'Upgrade Influencer',
        accountType: 'photo_influencer',
        country: 'NG',
        acceptAgreement: true,
      },
    })
    assert.equal(registered.statusCode, 200, registered.body)
    const cookie = cookies(registered)

    const openPhoto = await app.inject({
      method: 'POST',
      url: '/api/contributor/photos',
      headers: { cookie },
      payload: {
        title: 'Free Library keep',
        category: 'Urban',
        country: 'Nigeria',
        licenseType: 'free',
        hasRecognizablePeople: false,
        copyrightHolder: 'Upgrade Influencer',
        copyrightAttested: true,
        permissionState: 'editorial',
      },
    })
    assert.equal(openPhoto.statusCode, 200, openPhoto.body)
    const photoId = (openPhoto.json() as { photo: { id: string; libraryTier?: string } }).photo.id
    assert.equal((openPhoto.json() as { photo: { libraryTier?: string } }).photo.libraryTier, 'OPEN')

    const denied = await app.inject({
      method: 'POST',
      url: '/api/account/upgrade',
      headers: { cookie },
      payload: { targetAccountType: 'photographer', acceptAgreement: false },
    })
    assert.equal(denied.statusCode, 400)

    const upgraded = await app.inject({
      method: 'POST',
      url: '/api/account/upgrade',
      headers: { cookie },
      payload: { targetAccountType: 'photographer', acceptAgreement: true },
    })
    assert.equal(upgraded.statusCode, 200, upgraded.body)
    const body = upgraded.json() as { user: { accountType: string }; upgradedTo: string }
    assert.equal(body.user.accountType, 'photographer')
    assert.equal(body.upgradedTo, 'photographer')

    const kept = await prisma.photo.findUnique({ where: { id: photoId }, select: { libraryTier: true } })
    assert.equal(kept?.libraryTier, 'OPEN')

    const again = await app.inject({
      method: 'POST',
      url: '/api/account/upgrade',
      headers: { cookie },
      payload: { targetAccountType: 'contributor', acceptAgreement: true },
    })
    assert.equal(again.statusCode, 400)

    await app.close()
  })
})
