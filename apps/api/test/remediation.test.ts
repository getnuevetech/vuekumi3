import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { applyPreviewAdjustment, differenceHash, proposeRemediation } from '../src/lib/remediation.js'
import { getObjectBuffer, originalKeyFor, putObject } from '../src/lib/storage.js'

async function jpeg(width: number, height: number, color: { r: number; g: number; b: number }) {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer()
}

async function patterned(seed: number) {
  const block = await sharp({
    create: {
      width: 24,
      height: 36,
      channels: 3,
      background: { r: 255 - seed, g: seed, b: 40 },
    },
  })
    .png()
    .toBuffer()
  return sharp({
    create: { width: 96, height: 72, channels: 3, background: { r: seed, g: 30, b: 90 } },
  })
    .composite([{ input: block, left: 8 + (seed % 12), top: 10 }])
    .jpeg()
    .toBuffer()
}

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('difference hash is stable and changes when the picture changes', async () => {
  const left = await patterned(20)
  const right = await patterned(180)
  assert.equal(await differenceHash(left), await differenceHash(await patterned(20)))
  assert.notEqual(await differenceHash(left), await differenceHash(right))
  assert.match(await differenceHash(left), /^[0-9a-f]{16}$/)
})

test('a tiny or nearly black file is quarantined and the buffer is not rewritten', async () => {
  const dark = await jpeg(120, 90, { r: 4, g: 4, b: 4 })
  const before = Buffer.from(dark)
  const proposal = await proposeRemediation(dark)
  assert.equal(proposal.decision, 'quarantine')
  assert.equal(proposal.provider, 'dev')
  assert.ok(proposal.notes.some((note) => /unchanged|not altered|too low|Resolution/i.test(note)))
  assert.ok(dark.equals(before))
})

test('a normal exposure is advisory only', async () => {
  const block = await jpeg(280, 220, { r: 12, g: 12, b: 12 })
  const normal = await sharp({
    create: { width: 900, height: 700, channels: 3, background: { r: 150, g: 120, b: 70 } },
  })
    .composite([{ input: block, left: 40, top: 40 }])
    .jpeg()
    .toBuffer()
  const proposal = await proposeRemediation(normal)
  assert.equal(proposal.decision, 'advisory')
  assert.equal(proposal.contentHash?.length, 16)
})

test('preview brighten and crop return a new buffer', async () => {
  const src = await jpeg(400, 300, { r: 80, g: 90, b: 100 })
  const bright = await applyPreviewAdjustment(src, 'brighten')
  const cropped = await applyPreviewAdjustment(src, 'crop')
  assert.ok(!bright.equals(src))
  assert.ok(!cropped.equals(src))
  const cropMeta = await sharp(cropped).metadata()
  assert.ok((cropMeta.width ?? 0) < 400)
  assert.ok((cropMeta.height ?? 0) < 300)
})

test('Phase 62: a low-quality upload stays pending and a preview does not replace the original', async () => {
  const app = await buildApp()
  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `remediation-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Ada Remediation',
      accountType: 'photographer',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.ok(registered.statusCode === 200 || registered.statusCode === 201, registered.body)
  const cookie = cookies(registered)
  const userId = (registered.json() as { user: { id: string } }).user.id
  const file = await jpeg(100, 80, { r: 2, g: 2, b: 2 })
  const key = originalKeyFor(userId, 'jpg')
  await putObject(key, file, 'image/jpeg')

  const submitted = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie },
    payload: {
      title: 'Nearly black frame',
      category: 'Landscape',
      country: 'Nigeria',
      licenseType: 'free',
      hasRecognizablePeople: false,
      copyrightHolder: 'Ada Remediation',
      copyrightAttested: true,
      permissionState: 'editorial',
      originalKey: key,
    },
  })
  assert.equal(submitted.statusCode, 200, submitted.body)
  const body = submitted.json() as {
    photo: { id: string; status: string }
    remediation: { decision: string; notes: string[]; contentHash: string | null } | null
  }
  assert.equal(body.remediation?.decision, 'quarantine')
  assert.equal(body.photo.status, 'pending')
  assert.equal(body.remediation?.contentHash?.length, 16)

  const stored = await prisma.photo.findUnique({ where: { id: body.photo.id }, select: { contentHash: true } })
  assert.equal(stored?.contentHash, body.remediation?.contentHash)

  const originalBefore = await getObjectBuffer(key)
  const preview = await app.inject({
    method: 'POST',
    url: `/api/contributor/photos/${body.photo.id}/remediation`,
    headers: { cookie },
    payload: { action: 'brighten' },
  })
  assert.equal(preview.statusCode, 200, preview.body)
  assert.equal((preview.json() as { originalUntouched: boolean }).originalUntouched, true)
  const originalAfter = await getObjectBuffer(key)
  assert.ok(originalBefore.equals(originalAfter))

  await prisma.photo.delete({ where: { id: body.photo.id } })
  await app.close()
})

test('Phase 62: an exact match of a live photograph is quarantined', async () => {
  const app = await buildApp()
  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `dup-${Date.now()}@vuekumi.demo`,
      password: 'User12345!',
      name: 'Kofi Duplicate',
      accountType: 'photographer',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.ok(registered.statusCode === 200 || registered.statusCode === 201, registered.body)
  const cookie = cookies(registered)
  const userId = (registered.json() as { user: { id: string } }).user.id
  const file = await patterned(40)
  const hash = await differenceHash(file)
  const live = await prisma.photo.create({
    data: {
      id: `live-hash-${Date.now().toString(36)}`,
      contributorId: userId,
      title: 'Already live',
      category: 'Landscape',
      country: 'Nigeria',
      status: 'active',
      src: '/placeholder.jpg',
      contentHash: hash,
    },
  })
  const key = originalKeyFor(userId, 'jpg')
  await putObject(key, file, 'image/jpeg')

  const submitted = await app.inject({
    method: 'POST',
    url: '/api/contributor/photos',
    headers: { cookie },
    payload: {
      title: 'Copy of a live frame',
      category: 'Landscape',
      country: 'Nigeria',
      licenseType: 'free',
      hasRecognizablePeople: false,
      copyrightHolder: 'Kofi Duplicate',
      copyrightAttested: true,
      permissionState: 'editorial',
      originalKey: key,
    },
  })
  assert.equal(submitted.statusCode, 200, submitted.body)
  const body = submitted.json() as {
    photo: { id: string; status: string }
    remediation: { decision: string; notes: string[] } | null
  }
  assert.equal(body.photo.status, 'pending')
  assert.equal(body.remediation?.decision, 'quarantine')
  assert.match(body.remediation?.notes.join(' ') ?? '', new RegExp(live.id))

  await prisma.photo.deleteMany({ where: { id: { in: [body.photo.id, live.id] } } })
  await app.close()
})
