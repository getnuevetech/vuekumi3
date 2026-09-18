import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminCreateAccountBlocked } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}`)
  return cookies(res)
}

test('admin create guard: staff cannot mint admin accounts from this endpoint', () => {
  assert.equal(adminCreateAccountBlocked('photographer'), null)
  assert.equal(adminCreateAccountBlocked('model'), null)
  assert.equal(adminCreateAccountBlocked('admin')!.status, 403)
  assert.match(adminCreateAccountBlocked('admin')!.error, /POST \/admin\/admins/)
})

test('admin account management: photographers list, create types, reject admin, agency activate', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const member = await login(app, 'member@vuekumi.demo', 'User12345!')
  const stamp = Date.now()

  const forbidden = await app.inject({ method: 'GET', url: '/api/admin/photographers', headers: { cookie: member } })
  assert.equal(forbidden.statusCode, 403)

  const photographers = await app.inject({ method: 'GET', url: '/api/admin/photographers', headers: { cookie: admin } })
  assert.equal(photographers.statusCode, 200, photographers.body)
  const photoList = photographers.json() as { items: { email: string; accountType: string }[]; total: number }
  assert.equal(photoList.items.every((u) => u.accountType === 'photographer'), true)
  assert.equal(photoList.items.some((u) => u.email === 'kofi-mensah@vuekumi.demo'), true)
  assert.equal(photoList.items.some((u) => u.email === 'amara-okafor@vuekumi.demo'), false)
  assert.equal(photoList.items.some((u) => u.email === 'community@vuekumi.demo'), false)

  const influencers = await app.inject({ method: 'GET', url: '/api/admin/influencers', headers: { cookie: admin } })
  assert.equal(influencers.statusCode, 200, influencers.body)
  const influencerList = influencers.json() as { items: { email: string; accountType: string }[] }
  assert.equal(influencerList.items.every((u) => u.accountType === 'photo_influencer'), true)
  assert.equal(influencerList.items.some((u) => u.email === 'amara-okafor@vuekumi.demo'), true)
  assert.equal(influencerList.items.some((u) => u.email === 'kofi-mensah@vuekumi.demo'), false)

  const contributors = await app.inject({ method: 'GET', url: '/api/admin/contributors', headers: { cookie: admin } })
  assert.equal(contributors.statusCode, 200)
  const communityList = contributors.json() as { items: { email: string; accountType: string }[] }
  assert.equal(communityList.items.every((u) => u.accountType === 'contributor'), true)
  assert.equal(communityList.items.some((u) => u.email === 'community@vuekumi.demo'), true)
  assert.equal(communityList.items.some((u) => u.email === 'kofi-mensah@vuekumi.demo'), false)

  const mintAdmin = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `staff-${stamp}@vuekumi.demo`,
      name: 'Should Fail',
      accountType: 'admin',
      password: 'User12345!',
    },
  })
  assert.equal(mintAdmin.statusCode, 403, mintAdmin.body)

  const noCountry = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `photo-us-${stamp}@vuekumi.demo`,
      name: 'Ohio Shooter',
      accountType: 'photographer',
      password: 'User12345!',
      country: 'US',
    },
  })
  assert.equal(noCountry.statusCode, 400, noCountry.body)

  const createdPhoto = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `photo-${stamp}@vuekumi.demo`,
      name: 'Staff Photographer',
      accountType: 'photographer',
      password: 'User12345!',
      country: 'NG',
    },
  })
  assert.equal(createdPhoto.statusCode, 200, createdPhoto.body)
  const photographer = (createdPhoto.json() as { user: { id: string; accountType: string; handle: string; creatorKind: string; country: string } }).user
  assert.equal(photographer.accountType, 'photographer')
  assert.equal(photographer.creatorKind, 'photographer')
  assert.equal(photographer.country, 'NG')
  assert.ok(photographer.handle)

  const listedAgain = await app.inject({
    method: 'GET',
    url: `/api/admin/photographers?q=Staff%20Photographer`,
    headers: { cookie: admin },
  })
  assert.equal((listedAgain.json() as { items: { id: string }[] }).items.some((u) => u.id === photographer.id), true)

  const stillNotCommunity = await app.inject({
    method: 'GET',
    url: `/api/admin/contributors?q=photo-${stamp}`,
    headers: { cookie: admin },
  })
  assert.equal((stillNotCommunity.json() as { items: { id: string }[] }).items.some((u) => u.id === photographer.id), false)

  const createdInfluencer = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `influencer-${stamp}@vuekumi.demo`,
      name: 'Staff Influencer',
      accountType: 'photo_influencer',
      password: 'User12345!',
      country: 'GH',
    },
  })
  assert.equal(createdInfluencer.statusCode, 200, createdInfluencer.body)
  const influencer = (createdInfluencer.json() as { user: { id: string; accountType: string; creatorKind: string } }).user
  assert.equal(influencer.accountType, 'photo_influencer')
  assert.equal(influencer.creatorKind, 'photo_influencer')
  const inInfluencerList = await app.inject({
    method: 'GET',
    url: `/api/admin/influencers?q=Staff%20Influencer`,
    headers: { cookie: admin },
  })
  assert.equal((inInfluencerList.json() as { items: { id: string }[] }).items.some((u) => u.id === influencer.id), true)
  const notInPhotographers = await app.inject({
    method: 'GET',
    url: `/api/admin/photographers?q=Staff%20Influencer`,
    headers: { cookie: admin },
  })
  assert.equal((notInPhotographers.json() as { items: { id: string }[] }).items.some((u) => u.id === influencer.id), false)

  const createdCommunity = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `community-${stamp}@vuekumi.demo`,
      name: 'Staff Community',
      accountType: 'contributor',
      password: 'User12345!',
      country: 'KE',
    },
  })
  assert.equal(createdCommunity.statusCode, 200, createdCommunity.body)
  const community = (createdCommunity.json() as { user: { id: string; accountType: string } }).user
  assert.equal(community.accountType, 'contributor')
  const inCommunityList = await app.inject({
    method: 'GET',
    url: `/api/admin/contributors?q=Staff%20Community`,
    headers: { cookie: admin },
  })
  assert.equal((inCommunityList.json() as { items: { id: string }[] }).items.some((u) => u.id === community.id), true)

  const createdUser = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `buyer-${stamp}@vuekumi.demo`,
      name: 'Staff Buyer',
      accountType: 'user',
      password: 'User12345!',
    },
  })
  assert.equal(createdUser.statusCode, 200, createdUser.body)

  const createdModel = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `model-${stamp}@vuekumi.demo`,
      name: 'Staff Model',
      accountType: 'model',
      password: 'User12345!',
      country: 'FR',
    },
  })
  assert.equal(createdModel.statusCode, 200, createdModel.body)
  const model = (createdModel.json() as { user: { id: string; handle: string; accountType: string; country: string } }).user
  assert.equal(model.accountType, 'model')
  assert.equal(model.country, 'FR')
  assert.ok(model.handle)

  const createdAgency = await app.inject({
    method: 'POST',
    url: '/api/admin/accounts',
    headers: { cookie: admin },
    payload: {
      email: `agency-${stamp}@vuekumi.demo`,
      name: 'Staff Agency Lagos',
      accountType: 'agency',
      password: 'User12345!',
      country: 'NG',
    },
  })
  assert.equal(createdAgency.statusCode, 200, createdAgency.body)
  const agencyUser = (createdAgency.json() as {
    user: { id: string; agencyId: string; agencyStatus: string; status: string }
  }).user
  assert.equal(agencyUser.agencyStatus, 'pending')
  assert.equal(agencyUser.status, 'active')
  assert.ok(agencyUser.agencyId)

  const detail = await app.inject({
    method: 'GET',
    url: `/api/admin/accounts/${agencyUser.id}`,
    headers: { cookie: admin },
  })
  assert.equal(detail.statusCode, 200)
  assert.equal((detail.json() as { user: { agencyId: string } }).user.agencyId, agencyUser.agencyId)

  const activated = await app.inject({
    method: 'POST',
    url: `/api/admin/agencies/${agencyUser.agencyId}/status`,
    headers: { cookie: admin },
    payload: { status: 'active' },
  })
  assert.equal(activated.statusCode, 200, activated.body)
  assert.equal((activated.json() as { agency: { status: string }; user: { agencyStatus: string } }).agency.status, 'active')
  assert.equal((activated.json() as { user: { agencyStatus: string } }).user.agencyStatus, 'active')

  const suspended = await app.inject({
    method: 'POST',
    url: `/api/admin/agencies/${agencyUser.agencyId}/status`,
    headers: { cookie: admin },
    payload: { status: 'suspended' },
  })
  assert.equal(suspended.statusCode, 200)
  assert.equal((suspended.json() as { agency: { status: string } }).agency.status, 'suspended')

  await prisma.agency.deleteMany({ where: { id: agencyUser.agencyId } })
  await prisma.user.deleteMany({
    where: { email: { in: [
      `photo-${stamp}@vuekumi.demo`,
      `community-${stamp}@vuekumi.demo`,
      `buyer-${stamp}@vuekumi.demo`,
      `model-${stamp}@vuekumi.demo`,
      `agency-${stamp}@vuekumi.demo`,
    ] } },
  })

  await app.close()
})
