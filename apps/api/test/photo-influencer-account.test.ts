import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('photo influencers register as their own account type and stay off the photographer list', async () => {
  const app = await buildApp()
  const stamp = Date.now()
  const email = `inf-${stamp}@vuekumi.demo`

  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email,
      password: 'User12345!',
      name: 'Nia Influencer',
      accountType: 'photo_influencer',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.equal(registered.statusCode, 200, registered.body)
  const user = (registered.json() as { user: { accountType: string; creatorKind: string } }).user
  assert.equal(user.accountType, 'photo_influencer')
  assert.equal(user.creatorKind, 'photo_influencer')

  const cookie = cookies(registered)
  const commercial = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie },
    payload: {
      title: 'Discovery shot',
      category: 'Fashion',
      country: 'NG',
      tags: ['lagos'],
      licenseType: 'premium',
      permissionState: 'commercial',
      hasRecognizablePeople: false,
      copyrightHolder: 'Nia Influencer',
      copyrightAttested: true,
    },
  })
  assert.equal(commercial.statusCode, 400)
  assert.match((commercial.json() as { error: string }).error, /Photo influencers cannot enter commercial inventory/)

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(adminLogin.statusCode, 200)
  const admin = cookies(adminLogin)

  const photographers = await app.inject({
    method: 'GET',
    url: `/api/admin/photographers?q=Nia%20Influencer`,
    headers: { cookie: admin },
  })
  assert.equal((photographers.json() as { items: { email: string }[] }).items.some((u) => u.email === email), false)

  const influencers = await app.inject({
    method: 'GET',
    url: `/api/admin/influencers?q=Nia%20Influencer`,
    headers: { cookie: admin },
  })
  assert.equal((influencers.json() as { items: { email: string; accountType: string }[] }).items.some((u) => u.email === email && u.accountType === 'photo_influencer'), true)

  const directoryPhotographers = await app.inject({ method: 'GET', url: '/api/photographers?kind=photographer&limit=50' })
  const photographerHandles = (directoryPhotographers.json() as { items: { handle: string; creatorKind: string }[] }).items
  assert.equal(photographerHandles.every((row) => row.creatorKind === 'photographer'), true)
  assert.equal(photographerHandles.some((row) => row.handle === 'amara-okafor'), false)

  const directoryInfluencers = await app.inject({ method: 'GET', url: '/api/photographers?kind=photo_influencer&limit=50' })
  const influencerHandles = (directoryInfluencers.json() as { items: { handle: string; creatorKind: string }[] }).items
  assert.equal(influencerHandles.every((row) => row.creatorKind === 'photo_influencer'), true)
  assert.equal(influencerHandles.some((row) => row.handle === 'amara-okafor'), true)

  await app.close()
})
