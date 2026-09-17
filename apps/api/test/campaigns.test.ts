import assert from 'node:assert/strict'
import { test } from 'node:test'
import { campaignCloseBlocked, campaignPitchBlocked, pitchActionBlocked } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'User12345!' },
  })
  assert.equal(res.statusCode, 200, `login ${email}`)
  return cookies(res)
}

test('campaign guards: pitch, decide, close', () => {
  // Pitching.
  assert.equal(campaignPitchBlocked({ campaignFound: false, campaignOpen: false, isOwner: false, isContributor: true, alreadyPitched: false })!.status, 404)
  assert.equal(campaignPitchBlocked({ campaignFound: true, campaignOpen: true, isOwner: false, isContributor: false, alreadyPitched: false })!.status, 403)
  assert.match(campaignPitchBlocked({ campaignFound: true, campaignOpen: true, isOwner: true, isContributor: true, alreadyPitched: false })!.error, /own campaign/)
  assert.match(campaignPitchBlocked({ campaignFound: true, campaignOpen: false, isOwner: false, isContributor: true, alreadyPitched: false })!.error, /closed/)
  assert.match(campaignPitchBlocked({ campaignFound: true, campaignOpen: true, isOwner: false, isContributor: true, alreadyPitched: true })!.error, /already pitched/)
  assert.equal(campaignPitchBlocked({ campaignFound: true, campaignOpen: true, isOwner: false, isContributor: true, alreadyPitched: false }), null)

  // Deciding: only the owner accepts/declines; only the contributor withdraws.
  assert.equal(pitchActionBlocked({ action: 'accept', status: 'pending', isOwner: false, isContributor: true })!.status, 403)
  assert.equal(pitchActionBlocked({ action: 'withdraw', status: 'pending', isOwner: true, isContributor: false })!.status, 403)
  assert.equal(pitchActionBlocked({ action: 'accept', status: 'pending', isOwner: true, isContributor: false }), null)
  assert.equal(pitchActionBlocked({ action: 'decline', status: 'pending', isOwner: true, isContributor: false }), null)
  assert.equal(pitchActionBlocked({ action: 'withdraw', status: 'pending', isOwner: false, isContributor: true }), null)
  for (const status of ['accepted', 'declined', 'withdrawn'] as const) {
    assert.equal(pitchActionBlocked({ action: 'accept', status, isOwner: true, isContributor: false })!.status, 400)
    assert.equal(pitchActionBlocked({ action: 'withdraw', status, isOwner: false, isContributor: true })!.status, 400)
  }

  // Closing: owner or staff, once.
  assert.equal(campaignCloseBlocked({ campaignFound: true, campaignOpen: true, isOwner: false, isAdmin: false })!.status, 403)
  assert.equal(campaignCloseBlocked({ campaignFound: true, campaignOpen: true, isOwner: false, isAdmin: true }), null)
  assert.equal(campaignCloseBlocked({ campaignFound: true, campaignOpen: true, isOwner: true, isAdmin: false }), null)
  assert.equal(campaignCloseBlocked({ campaignFound: true, campaignOpen: false, isOwner: true, isAdmin: false })!.status, 400)
})

test('campaign lifecycle: brief → pitches → accept/decline → close, no ledger rows', async () => {
  const app = await buildApp()
  const brand = await login(app, 'member@vuekumi.demo')
  const kofi = await login(app, 'kofi-mensah@vuekumi.demo')
  const thandiwe = await login(app, 'thandiwe-nkosi@vuekumi.demo')

  const created = await app.inject({
    method: 'POST',
    url: '/api/campaigns',
    headers: { cookie: brand },
    payload: {
      title: 'Lagos fintech launch campaign',
      brief: 'Campaign-shaped sourcing: lifestyle and product photography across Lagos for a Q4 launch. Multiple shoots, multiple creators possible.',
      deliverables: '40 final images, 3 shoot days, usage cleared for digital + OOH',
      usage: '12 months, Nigeria + Ghana, digital and out-of-home',
      location: 'Lagos, Nigeria',
      startDate: '2026-11-02',
      endDate: '2026-11-20',
      budgetUsd: 15000,
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const campaign = (created.json() as { campaign: { id: string; status: string; mine: boolean } }).campaign
  assert.equal(campaign.status, 'open')
  assert.equal(campaign.mine, true)

  // A buyer account cannot pitch (route is contributor-only).
  const buyerPitch = await app.inject({
    method: 'POST',
    url: `/api/campaigns/${campaign.id}/pitch`,
    headers: { cookie: brand },
    payload: { note: 'I would like to shoot my own campaign, which makes no sense.' },
  })
  assert.equal(buyerPitch.statusCode, 403)

  // Contributors see the open campaign and pitch it.
  const listed = await app.inject({ method: 'GET', url: '/api/campaigns', headers: { cookie: kofi } })
  const visible = (listed.json() as { items: { id: string }[] }).items.find((c) => c.id === campaign.id)
  assert.ok(visible, 'open campaign visible to contributors')

  const pitched = await app.inject({
    method: 'POST',
    url: `/api/campaigns/${campaign.id}/pitch`,
    headers: { cookie: kofi },
    payload: { note: 'Accra-based but I shoot Lagos monthly. Portfolio covers fintech lifestyle work.', rateUsd: 4500 },
  })
  assert.equal(pitched.statusCode, 200, pitched.body)
  const kofiPitch = (pitched.json() as { pitch: { id: string; status: string } }).pitch
  assert.equal(kofiPitch.status, 'pending')

  const dupe = await app.inject({
    method: 'POST',
    url: `/api/campaigns/${campaign.id}/pitch`,
    headers: { cookie: kofi },
    payload: { note: 'Pitching twice should be rejected outright.' },
  })
  assert.equal(dupe.statusCode, 400)

  const second = await app.inject({
    method: 'POST',
    url: `/api/campaigns/${campaign.id}/pitch`,
    headers: { cookie: thandiwe },
    payload: { note: 'Cape Town-based, available to travel with a full lighting kit.' },
  })
  assert.equal(second.statusCode, 200, second.body)
  const thandiwePitch = (second.json() as { pitch: { id: string } }).pitch

  // Only the owner sees the full pitch list.
  const forbidden = await app.inject({ method: 'GET', url: `/api/campaigns/${campaign.id}/pitches`, headers: { cookie: kofi } })
  assert.equal(forbidden.statusCode, 403)
  const pitchList = await app.inject({ method: 'GET', url: `/api/campaigns/${campaign.id}/pitches`, headers: { cookie: brand } })
  assert.equal((pitchList.json() as { items: unknown[] }).items.length, 2)

  // The contributor cannot decide; the owner accepts one and declines the other.
  const notOwner = await app.inject({ method: 'POST', url: `/api/campaigns/pitches/${kofiPitch.id}/accept`, headers: { cookie: kofi } })
  assert.equal(notOwner.statusCode, 403)

  const accepted = await app.inject({ method: 'POST', url: `/api/campaigns/pitches/${kofiPitch.id}/accept`, headers: { cookie: brand } })
  assert.equal(accepted.statusCode, 200, accepted.body)
  assert.equal((accepted.json() as { pitch: { status: string } }).pitch.status, 'accepted')

  const declined = await app.inject({ method: 'POST', url: `/api/campaigns/pitches/${thandiwePitch.id}/decline`, headers: { cookie: brand } })
  assert.equal(declined.statusCode, 200, declined.body)

  // Decided pitches are final.
  const lateWithdraw = await app.inject({ method: 'POST', url: `/api/campaigns/pitches/${kofiPitch.id}/withdraw`, headers: { cookie: kofi } })
  assert.equal(lateWithdraw.statusCode, 400)

  // Undecided commission — campaign money never touches the platform rails.
  const kofiRows = await prisma.earningsLedger.count({
    where: { contributor: { email: 'kofi-mensah@vuekumi.demo' }, createdAt: { gte: new Date(Date.now() - 60_000) } },
  })
  assert.equal(kofiRows, 0, 'accepting a pitch must not create earnings')

  // Close the campaign; new pitches bounce.
  const closed = await app.inject({ method: 'POST', url: `/api/campaigns/${campaign.id}/close`, headers: { cookie: brand } })
  assert.equal(closed.statusCode, 200, closed.body)
  assert.equal((closed.json() as { campaign: { status: string } }).campaign.status, 'closed')

  const amara = await login(app, 'amara-okafor@vuekumi.demo')
  const late = await app.inject({
    method: 'POST',
    url: `/api/campaigns/${campaign.id}/pitch`,
    headers: { cookie: amara },
    payload: { note: 'This pitch should bounce because the campaign is closed.' },
  })
  assert.equal(late.statusCode, 400)

  // Contributors with a pitch still see the closed campaign in their list.
  const kofiList = await app.inject({ method: 'GET', url: '/api/campaigns', headers: { cookie: kofi } })
  const mine = (kofiList.json() as { items: { id: string; myPitch: { status: string } | null }[] }).items
    .find((c) => c.id === campaign.id)
  assert.equal(mine?.myPitch?.status, 'accepted')
})
