import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { ensureDigitalIdCard } from '../src/lib/digital-id.js'

test('digital ID public payload excludes private fields and links to profile', async () => {
  const app = await buildApp()
  const influencer = await prisma.contributorProfile.findFirst({
    where: { handle: 'amara-okafor' },
    include: { user: { select: { name: true, email: true, phone: true } } },
  })
  assert.ok(influencer)

  // Clear any prior seed card so preferredToken is applied deterministically.
  await prisma.digitalIdentityCard.deleteMany({
    where: { profileId: influencer.id, cardType: 'photo_influencer' },
  })

  const preview = await ensureDigitalIdCard({
    profileId: influencer.id,
    cardType: 'photo_influencer',
    handle: influencer.handle,
    preferredToken: 'seed-amara-okafor-photo_influencer-id',
  })
  assert.equal(preview.token, 'seed-amara-okafor-photo_influencer-id')
  assert.equal(preview.cardType, 'photo_influencer')

  const res = await app.inject({ method: 'GET', url: `/api/digital-id/${preview.token}` })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as Record<string, unknown>
  assert.equal(body.handle, 'amara-okafor')
  assert.equal(body.cardType, 'photo_influencer')
  assert.equal(body.profilePath, '/p/amara-okafor')
  assert.equal(body.badge, 'Open Creator')
  assert.equal(body.email, undefined)
  assert.equal(body.phone, undefined)
  assert.equal(body.documents, undefined)
  assert.equal(body.ledger, undefined)
  assert.equal(body.earnings, undefined)
  assert.ok(typeof body.publicId === 'string')
  assert.ok(!JSON.stringify(body).includes(influencer.user.email))

  const photographer = await app.inject({ method: 'GET', url: '/api/photographers/amara-okafor?limit=1' })
  assert.equal(photographer.statusCode, 200, photographer.body)
  const profile = photographer.json() as { photographer: { digitalId?: { token: string; cardType: string }; creatorKind: string } }
  assert.equal(profile.photographer.creatorKind, 'photo_influencer')
  assert.equal(profile.photographer.digitalId?.token, 'seed-amara-okafor-photo_influencer-id')
  assert.equal(profile.photographer.digitalId?.cardType, 'photo_influencer')

  const modelProfile = await prisma.modelProfile.findFirst({ where: { handle: 'ada-molefe' } })
  assert.ok(modelProfile)
  await prisma.digitalIdentityCard.deleteMany({
    where: { profileId: modelProfile.id, cardType: 'model' },
  })
  await ensureDigitalIdCard({
    profileId: modelProfile.id,
    cardType: 'model',
    handle: 'ada-molefe',
    preferredToken: 'seed-ada-molefe-model-id',
  })
  const model = await app.inject({ method: 'GET', url: '/api/models/ada-molefe?limit=1' })
  assert.equal(model.statusCode, 200, model.body)
  const modelBody = model.json() as { model: { digitalId?: { token: string }; commercialAppearanceCount?: number } }
  assert.equal(modelBody.model.digitalId?.token, 'seed-ada-molefe-model-id')
  assert.ok(typeof modelBody.model.commercialAppearanceCount === 'number')

  const directory = await app.inject({ method: 'GET', url: '/api/models?limit=10' })
  assert.equal(directory.statusCode, 200, directory.body)
  const dirBody = directory.json() as { items: { handle: string }[]; total: number }
  assert.ok(dirBody.total > 0)
  assert.ok(dirBody.items.some((row) => row.handle === 'ada-molefe'))

  const missing = await app.inject({ method: 'GET', url: '/api/digital-id/does-not-exist' })
  assert.equal(missing.statusCode, 404)

  await app.close()
})

test('admin can revoke and reinstate a Digital ID from the account screen', async () => {
  function cookies(res: { headers: Record<string, unknown> }) {
    const raw = res.headers['set-cookie']
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
  }

  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const admin = cookies(login)

  const influencer = await prisma.contributorProfile.findFirst({
    where: { handle: 'amara-okafor' },
    include: { user: { select: { id: true } } },
  })
  assert.ok(influencer)
  await ensureDigitalIdCard({
    profileId: influencer.id,
    cardType: 'photo_influencer',
    handle: influencer.handle,
    preferredToken: 'seed-amara-okafor-photo_influencer-id',
  })

  const detail = await app.inject({
    method: 'GET',
    url: `/api/admin/accounts/${influencer.user.id}`,
    headers: { cookie: admin },
  })
  assert.equal(detail.statusCode, 200, detail.body)
  const account = detail.json() as {
    user: { digitalIds?: { id: string; token: string; status: string }[] }
  }
  const card = account.user.digitalIds?.find((row) => row.token === 'seed-amara-okafor-photo_influencer-id')
  assert.ok(card)

  const revoke = await app.inject({
    method: 'POST',
    url: `/api/admin/accounts/${influencer.user.id}/digital-id/${card.id}/revoke`,
    headers: { cookie: admin },
    payload: {},
  })
  assert.equal(revoke.statusCode, 200, revoke.body)
  const revoked = revoke.json() as { user: { digitalIds: { id: string; status: string }[] } }
  assert.equal(revoked.user.digitalIds.find((row) => row.id === card.id)?.status, 'revoked')

  const publicCard = await app.inject({
    method: 'GET',
    url: '/api/digital-id/seed-amara-okafor-photo_influencer-id',
  })
  assert.equal(publicCard.statusCode, 200)
  assert.equal((publicCard.json() as { status: string }).status, 'revoked')

  const reinstate = await app.inject({
    method: 'POST',
    url: `/api/admin/accounts/${influencer.user.id}/digital-id/${card.id}/reinstate`,
    headers: { cookie: admin },
    payload: {},
  })
  assert.equal(reinstate.statusCode, 200, reinstate.body)
  const active = reinstate.json() as { user: { digitalIds: { id: string; status: string }[] } }
  assert.equal(active.user.digitalIds.find((row) => row.id === card.id)?.status, 'active')

  await app.close()
})
