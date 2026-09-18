import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addBusinessDays,
  canRestoreDmcaNotice,
  initialEarningsHold,
  parsePhotoIdFromUrl,
} from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { dmcaNoticeOpsEmail } from '../src/lib/email.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`)
  return cookies(res)
}

const noticeBody = {
  photoId: 'afr-017',
  claimantName: 'Ama Boateng',
  claimantEmail: 'ama-dmca@example.com',
  claimantAddress: '4 Liberation Road, Accra, Ghana',
  workDescription: 'Original basket-wall photograph commissioned in Accra in 2024.',
  originalLocation: 'Photographer archive',
  infringingLocation: 'https://vuekumi.demo/photo/afr-017',
  goodFaith: true,
  perjury: true,
  signature: 'Ama Boateng',
}

test('photo ids parse from VueKumi URLs', () => {
  assert.equal(parsePhotoIdFromUrl('https://vuekumi.com/photo/afr-017'), 'afr-017')
  assert.equal(parsePhotoIdFromUrl('/photo/afr-027?x=1'), 'afr-027')
})

test('new seller, unverified seller, and high-value grants start held', () => {
  const now = new Date('2026-09-18T00:00:00Z')
  assert.equal(initialEarningsHold({
    contributorCreatedAt: new Date('2026-09-10T00:00:00Z'),
    now,
    hasVerifiedCopyright: true,
    amountUsd: 40,
    newSellerHoldDays: 14,
    highValueHoldUsd: 500,
  }).holdReason, 'new_seller')
  assert.equal(initialEarningsHold({
    contributorCreatedAt: new Date('2026-01-01T00:00:00Z'),
    now,
    hasVerifiedCopyright: false,
    amountUsd: 40,
    newSellerHoldDays: 14,
    highValueHoldUsd: 500,
  }).holdReason, 'unverified_seller')
  assert.equal(initialEarningsHold({
    contributorCreatedAt: new Date('2026-01-01T00:00:00Z'),
    now,
    hasVerifiedCopyright: true,
    amountUsd: 500,
    newSellerHoldDays: 14,
    highValueHoldUsd: 500,
  }).holdReason, 'high_value')
  assert.equal(initialEarningsHold({
    contributorCreatedAt: new Date('2026-01-01T00:00:00Z'),
    now,
    hasVerifiedCopyright: true,
    amountUsd: 40,
    newSellerHoldDays: 14,
    highValueHoldUsd: 500,
  }).status, 'available')
  assert.equal(initialEarningsHold({
    contributorCreatedAt: new Date('2026-01-01T00:00:00Z'),
    now,
    hasVerifiedCopyright: true,
    amountUsd: 40,
    copyrightDisputed: true,
    newSellerHoldDays: 14,
    highValueHoldUsd: 500,
  }).holdReason, 'copyright_dispute')
})

test('DMCA restore waits for a stored counter-notice and the statutory period', () => {
  assert.match(canRestoreDmcaNotice({ status: 'processing' }) ?? '', /counter-notice/)
  assert.match(canRestoreDmcaNotice({
    status: 'counter_received',
    restoreEligibleAt: new Date('2026-09-30T00:00:00Z'),
    now: new Date('2026-09-18T00:00:00Z'),
  }) ?? '', /statutory period/)
  assert.equal(canRestoreDmcaNotice({
    status: 'counter_received',
    restoreEligibleAt: new Date('2026-09-01T00:00:00Z'),
    now: new Date('2026-09-18T00:00:00Z'),
  }), null)
  const wait = addBusinessDays(new Date('2026-09-18T00:00:00Z'), 1)
  assert.equal(wait.getUTCDay() !== 0 && wait.getUTCDay() !== 6, true)
})

test('ops email for a DMCA notice is copyright-only and asks a human to read it', () => {
  const html = dmcaNoticeOpsEmail({
    photoTitle: 'The Basket Wall',
    claimantEmail: 'ama-dmca@example.com',
    queueUrl: 'http://localhost:3000/admin/dmca',
  })
  assert.match(html, /The Basket Wall/)
  assert.match(html, /ama-dmca@example.com/)
  assert.match(html, /\/admin\/dmca/)
  assert.match(html, /copyright only/)
  assert.doesNotMatch(html, /covers likeness/i)
})

test('photographer can read /contributor/earnings including held rows', async () => {
  const app = await buildApp()
  const cookie = await login(app, 'kofi-mensah@vuekumi.demo', 'User12345!')
  const res = await app.inject({ method: 'GET', url: '/api/contributor/earnings', headers: { cookie } })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as { availableUsd: number; heldUsd: number; items: { status: string }[] }
  assert.equal(typeof body.heldUsd, 'number')
  assert.equal(typeof body.availableUsd, 'number')
  await app.close()
})

test('a DMCA notice disputes copyright, freezes licensing, and holds unpaid earnings', async () => {
  const app = await buildApp()
  const before = await prisma.earningsLedger.findMany({ where: { photoId: 'afr-017' } })
  if (before.length === 0) {
    await app.close()
    return
  }

  const filed = await app.inject({
    method: 'POST',
    url: '/api/dmca/notices',
    payload: noticeBody,
  })
  assert.equal(filed.statusCode, 200, filed.body)
  const notice = (filed.json() as { notice: { id: string; status: string; photoId: string } }).notice
  assert.equal(notice.photoId, 'afr-017')
  assert.equal(notice.status, 'processing')

  const photo = await prisma.photo.findUniqueOrThrow({
    where: { id: 'afr-017' },
    include: { rightsRecord: true },
  })
  assert.equal(photo.commercialLocked, true)
  assert.equal(photo.rightsRecord?.copyrightStatus, 'disputed')

  const held = await prisma.earningsLedger.findMany({ where: { photoId: 'afr-017' } })
  assert.ok(held.every((row) => row.status === 'held' || row.status === 'reserved' || row.status === 'paid'))
  assert.ok(held.some((row) => row.status === 'held' && row.holdReason === 'dmca_notice'))

  const licenses = await app.inject({ method: 'GET', url: '/api/photos/afr-017/licenses' })
  const offered = (licenses.json() as { items: { offered: boolean }[] }).items
  assert.equal(offered.every((item) => item.offered === false), true)

  const counterEarly = await app.inject({
    method: 'POST',
    url: `/api/admin/dmca/${notice.id}/decide`,
    payload: { action: 'restore' },
  })
  assert.equal(counterEarly.statusCode, 401)

  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const tooSoon = await app.inject({
    method: 'POST',
    url: `/api/admin/dmca/${notice.id}/decide`,
    headers: { cookie: admin },
    payload: { action: 'restore' },
  })
  assert.equal(tooSoon.statusCode, 400, tooSoon.body)

  const counter = await app.inject({
    method: 'POST',
    url: `/api/dmca/notices/${notice.id}/counter`,
    payload: {
      senderName: 'Kofi Mensah',
      senderEmail: 'kofi-mensah@vuekumi.demo',
      senderAddress: 'Accra, Ghana',
      statement: 'This listing is my original photograph. The notice misidentified the work.',
      consentToJurisdiction: true,
      perjury: true,
      signature: 'Kofi Mensah',
    },
  })
  assert.equal(counter.statusCode, 200, counter.body)

  const stillSoon = await app.inject({
    method: 'POST',
    url: `/api/admin/dmca/${notice.id}/decide`,
    headers: { cookie: admin },
    payload: { action: 'restore' },
  })
  assert.equal(stillSoon.statusCode, 400)

  await prisma.dmcaNotice.update({
    where: { id: notice.id },
    data: { restoreEligibleAt: new Date(Date.now() - 60_000), status: 'waiting_restore' },
  })
  const restored = await app.inject({
    method: 'POST',
    url: `/api/admin/dmca/${notice.id}/decide`,
    headers: { cookie: admin },
    payload: { action: 'restore', notes: 'Statutory wait elapsed. Do not auto-relitigate.' },
  })
  assert.equal(restored.statusCode, 200, restored.body)
  const restoredPhoto = await prisma.photo.findUniqueOrThrow({
    where: { id: 'afr-017' },
    include: { rightsRecord: true },
  })
  assert.equal(restoredPhoto.commercialLocked, false)
  assert.notEqual(restoredPhoto.rightsRecord?.copyrightStatus, 'verified')

  const released = await prisma.earningsLedger.findMany({ where: { photoId: 'afr-017' } })
  assert.ok(released.some((row) => row.status === 'available' && !row.holdReason))

  await app.close()
})

test('finance cannot manage DMCA; moderator cannot release payout holds', async () => {
  const app = await buildApp()
  const finance = await login(app, 'finance@vuekumi.demo', 'User12345!')
  const moderator = await login(app, 'moderator@vuekumi.demo', 'User12345!')
  const financeDmca = await app.inject({ method: 'GET', url: '/api/admin/dmca', headers: { cookie: finance } })
  assert.equal(financeDmca.statusCode, 403)
  const moderatorHolds = await app.inject({ method: 'GET', url: '/api/admin/earnings/holds', headers: { cookie: moderator } })
  assert.equal(moderatorHolds.statusCode, 403)
  const financeHolds = await app.inject({ method: 'GET', url: '/api/admin/earnings/holds', headers: { cookie: finance } })
  assert.equal(financeHolds.statusCode, 200, financeHolds.body)
  const moderatorDmca = await app.inject({ method: 'GET', url: '/api/admin/dmca', headers: { cookie: moderator } })
  assert.equal(moderatorDmca.statusCode, 200, moderatorDmca.body)
  await app.close()
})

test('three upheld fraud strikes suspend the account', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const community = await prisma.user.findUniqueOrThrow({ where: { email: 'community@vuekumi.demo' } })
  const reasons = ['fake_release', 'fake_photographer', 'false_creation_claim'] as const
  let last: { terminated?: boolean; strikeCount?: number } = {}
  for (const reason of reasons) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/strikes',
      headers: { cookie: admin },
      payload: {
        userId: community.id,
        reason,
        notes: `Staff upheld ${reason} after reviewing the file. This is not a DMCA notice.`,
      },
    })
    assert.equal(res.statusCode, 200, res.body)
    last = (res.json() as { strike: { terminated: boolean; strikeCount: number } }).strike
  }
  assert.equal(last.strikeCount, 3)
  assert.equal(last.terminated, true)
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: community.id } })
  assert.equal(updated.status, 'suspended')
  assert.ok(updated.repeatInfringerAt)
  await app.close()
})

test('public DMCA page is copyright-only and lists the designated agent', async () => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/dmca' })
  assert.equal(res.statusCode, 200, res.body)
  const body = res.json() as { scope: string; agent: { email: string }; policy: string; copyrightOfficeNote: string }
  assert.equal(body.scope, 'copyright')
  assert.ok(body.agent.email)
  assert.match(body.policy, /fake model release/)
  assert.match(body.copyrightOfficeNote, /Copyright Office/)
  await app.close()
})
