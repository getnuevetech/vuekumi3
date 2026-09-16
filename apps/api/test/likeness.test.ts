import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import {
  likenessCheckGrantsRights,
  twoPartyBlocksLicense,
  verifyLikenessSchema,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import {
  decodeReferenceImage,
  likenessCheckBlocked,
  parseLikenessVerdict,
} from '../src/lib/likeness.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('similarity never grants commercial rights', () => {
  assert.equal(likenessCheckGrantsRights('similar'), false)
  assert.equal(likenessCheckGrantsRights('not_similar'), false)
  assert.equal(likenessCheckGrantsRights(null), false)
  assert.match(
    twoPartyBlocksLicense({
      hasRecognizablePeople: true,
      appearances: [{ status: 'claimed', usage: 'none', confirmedLikeness: false }],
      licenseType: 'commercial',
      requiresModelRelease: true,
    }) ?? '',
    /confirm likeness/,
  )
})

test('opt-in likeness check requires consent and a claimed appearance', () => {
  assert.match(likenessCheckBlocked({ consented: false, claimed: true }) ?? '', /opt-in/i)
  assert.match(likenessCheckBlocked({ consented: true, claimed: false }) ?? '', /Claim this invite/)
  assert.equal(likenessCheckBlocked({ consented: true, claimed: true }), null)
  assert.equal(verifyLikenessSchema.safeParse({ consented: false, imageBase64: 'x'.repeat(40), mimeType: 'image/jpeg' }).success, false)
  assert.equal(parseLikenessVerdict({ verdict: 'similar' }), 'similar')
  assert.equal(parseLikenessVerdict({ verdict: 'not_similar' }), 'not_similar')
  assert.equal(parseLikenessVerdict({ verdict: 'maybe' }), 'inconclusive')
  assert.equal(parseLikenessVerdict({}), 'inconclusive')
})

test('Ada can run an opt-in check; the selfie is not kept and public JSON hides it', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ada@vuekumi.demo', password: 'User12345!' },
  })
  assert.equal(login.statusCode, 200)
  const cookie = cookies(login)

  const listed = await app.inject({ method: 'GET', url: '/api/model/appearances', headers: { cookie } })
  assert.equal(listed.statusCode, 200)
  const items = (listed.json() as { items: { id: string; photoId: string; verification?: unknown }[] }).items
  const ada = items.find((row) => row.photoId === 'afr-001')
  assert.ok(ada)

  const refused = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${ada!.id}/verify`,
    headers: { cookie },
    payload: { consented: false, imageBase64: 'a'.repeat(40), mimeType: 'image/jpeg' },
  })
  assert.equal(refused.statusCode, 400)

  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).jpeg().toBuffer()
  const ran = await app.inject({
    method: 'POST',
    url: `/api/model/appearances/${ada!.id}/verify`,
    headers: { cookie },
    payload: {
      consented: true,
      imageBase64: jpeg.toString('base64'),
      mimeType: 'image/jpeg',
    },
  })
  assert.equal(ran.statusCode, 200)
  const appearance = (ran.json() as {
    appearance: {
      verification: {
        status: string
        provider: string
        referenceDeleted: boolean
        notes: string | null
      } | null
    }
  }).appearance
  assert.ok(appearance.verification)
  assert.equal(appearance.verification?.status, 'unavailable')
  assert.equal(appearance.verification?.provider, 'none')
  assert.equal(appearance.verification?.referenceDeleted, true)
  assert.match(appearance.verification?.notes ?? '', /did not keep the selfie|not keep the selfie/i)
  assert.equal(JSON.stringify(ran.json()).includes('imageBase64'), false)

  const publicPhoto = await app.inject({ method: 'GET', url: '/api/photos/afr-001' })
  assert.equal(publicPhoto.statusCode, 200)
  const publicJson = JSON.stringify(publicPhoto.json())
  assert.equal(publicJson.includes('"verification"'), false)
  assert.equal(publicJson.includes('ada@vuekumi.demo'), false)

  const publicModel = await app.inject({ method: 'GET', url: '/api/models/ada-molefe' })
  assert.equal(publicModel.statusCode, 200)
  assert.equal(JSON.stringify(publicModel.json()).includes('"verification"'), false)

  const tooBig = decodeReferenceImage
  assert.throws(() => tooBig('A'.repeat(20)), /too small/)

  await app.close()
})
