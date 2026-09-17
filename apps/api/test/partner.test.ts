import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partnerAuthBlocked, STOCK_PERMISSION_STATES } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { extractPartnerKey, generatePartnerKey, hashPartnerKey } from '../src/lib/partner.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('partner key material: format, hashing, extraction, auth guard', () => {
  const { key, hash, prefix } = generatePartnerKey()
  assert.match(key, /^vk_live_[0-9a-f]{48}$/)
  assert.equal(hash, hashPartnerKey(key))
  assert.equal(prefix, key.slice(0, 15))
  assert.notEqual(generatePartnerKey().key, key)

  assert.equal(extractPartnerKey({ authorization: `Bearer ${key}` }), key)
  assert.equal(extractPartnerKey({ 'x-api-key': key }), key)
  assert.equal(extractPartnerKey({}), null)

  assert.equal(partnerAuthBlocked({ keyProvided: false, keyFound: false })!.status, 401)
  assert.equal(partnerAuthBlocked({ keyProvided: true, keyFound: false })!.status, 401)
  assert.match(partnerAuthBlocked({ keyProvided: true, keyFound: true, status: 'revoked' })!.error, /revoked/)
  assert.equal(partnerAuthBlocked({ keyProvided: true, keyFound: true, status: 'active' }), null)
})

test('partner API: admin issues key, cleared inventory only, honest licences, usage count, revocation', async () => {
  const app = await buildApp()
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(adminLogin.statusCode, 200)
  const admin = cookies(adminLogin)

  // Issue a key — the raw key comes back exactly once.
  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/partner-keys',
    headers: { cookie: admin },
    payload: { name: 'Acme CMS integration', note: 'Editorial embeds' },
  })
  assert.equal(created.statusCode, 200, created.body)
  const { key, partnerKey } = created.json() as { key: string; partnerKey: { id: string; keyPrefix: string } }
  assert.match(key, /^vk_live_/)
  assert.equal(partnerKey.keyPrefix, key.slice(0, 15))
  const stored = await prisma.partnerApiKey.findUniqueOrThrow({ where: { id: partnerKey.id } })
  assert.notEqual(stored.keyHash, key, 'raw key must not be stored')

  // Non-admin cannot manage keys.
  const memberLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'member@vuekumi.demo', password: 'User12345!' },
  })
  const memberKeys = await app.inject({
    method: 'GET',
    url: '/api/admin/partner-keys',
    headers: { cookie: cookies(memberLogin) },
  })
  assert.equal(memberKeys.statusCode, 403)

  // No key / bad key → 401.
  const anon = await app.inject({ method: 'GET', url: '/api/partner/v1/photos' })
  assert.equal(anon.statusCode, 401)
  const bad = await app.inject({
    method: 'GET',
    url: '/api/partner/v1/photos',
    headers: { authorization: 'Bearer vk_live_wrong' },
  })
  assert.equal(bad.statusCode, 401)

  // Authenticated list: cleared inventory only, no account emails leaked.
  const list = await app.inject({
    method: 'GET',
    url: '/api/partner/v1/photos?limit=50',
    headers: { authorization: `Bearer ${key}` },
  })
  assert.equal(list.statusCode, 200, list.body)
  const body = list.json() as {
    items: { id: string; photographer: { profileUrl: string }; licenses: { type: string; offered: boolean }[] }[]
    terms: string
  }
  assert.ok(body.items.length > 0, 'catalog is not empty')
  assert.match(body.terms, /AI training is not permitted/)
  assert.equal(list.body.includes('@vuekumi.demo'), false, 'no emails in partner payloads')

  const returned = await prisma.photo.findMany({
    where: { id: { in: body.items.map((i) => i.id) } },
    select: { permissionState: true, status: true },
  })
  for (const photo of returned) {
    assert.equal(photo.status, 'active')
    assert.ok(
      (STOCK_PERMISSION_STATES as string[]).includes(photo.permissionState),
      `non-stock state ${photo.permissionState} leaked through the partner API`,
    )
  }

  // Non-stock photographs are unreachable one-by-one too.
  const hidden = await prisma.photo.findFirst({
    where: { permissionState: { in: ['private', 'portfolio', 'agency_protected'] } },
    select: { id: true },
  })
  if (hidden) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/partner/v1/photos/${hidden.id}`,
      headers: { authorization: `Bearer ${key}` },
    })
    assert.equal(res.statusCode, 404, 'non-stock inventory must 404 through the partner API')
  }

  // Licence flags stay honest: an uncleared people photo never offers commercial.
  const peoplePhoto = await prisma.photo.findFirst({
    where: {
      ...{ status: 'active' },
      permissionState: 'editorial',
      hasRecognizablePeople: true,
    },
    select: { id: true },
  })
  if (peoplePhoto) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/partner/v1/photos/${peoplePhoto.id}`,
      headers: { 'x-api-key': key },
    })
    assert.equal(res.statusCode, 200)
    const licenses = (res.json() as { photo: { licenses: { type: string; offered: boolean }[] } }).photo.licenses
    for (const type of ['commercial', 'extended', 'exclusive']) {
      const item = licenses.find((l) => l.type === type)
      if (item) assert.equal(item.offered, false, `${type} must not be offered on an editorial people photo`)
    }
  }

  // Rate-limit headers are present on partner responses.
  assert.ok(list.headers['x-ratelimit-limit'], 'partner responses carry rate-limit headers')

  // Usage is counted.
  const used = await prisma.partnerApiKey.findUniqueOrThrow({ where: { id: partnerKey.id } })
  assert.ok(used.requestCount >= 2)
  assert.ok(used.lastUsedAt)

  // Revocation cuts access immediately.
  const revoked = await app.inject({
    method: 'POST',
    url: `/api/admin/partner-keys/${partnerKey.id}/revoke`,
    headers: { cookie: admin },
  })
  assert.equal(revoked.statusCode, 200, revoked.body)
  const after = await app.inject({
    method: 'GET',
    url: '/api/partner/v1/photos',
    headers: { authorization: `Bearer ${key}` },
  })
  assert.equal(after.statusCode, 401)
  assert.match((after.json() as { error: string }).error, /revoked/)
})
