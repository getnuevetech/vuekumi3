import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capabilitiesForPreset } from '@vuekumi/shared'
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

test('moderator preset includes bookings/campaigns list; support and finance do not', () => {
  assert.equal(capabilitiesForPreset('moderator').includes('bookings.list'), true)
  assert.equal(capabilitiesForPreset('moderator').includes('campaigns.list'), true)
  assert.equal(capabilitiesForPreset('moderator').includes('campaigns.close'), true)
  assert.equal(capabilitiesForPreset('support').includes('bookings.list'), false)
  assert.equal(capabilitiesForPreset('finance').includes('campaigns.list'), false)
})

test('staff booking queue: moderator lists; support forbidden; no fee invented', async () => {
  const app = await buildApp()
  const moderator = await login(app, 'moderator@vuekumi.demo', 'User12345!')
  const support = await login(app, 'support@vuekumi.demo', 'User12345!')
  const member = await login(app, 'member@vuekumi.demo', 'User12345!')

  const created = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { cookie: member },
    payload: {
      kind: 'photographer',
      handle: 'kofi-mensah',
      title: 'Admin queue fixture',
      brief: 'Brief long enough for the create schema validation path.',
      budgetUsd: 200,
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const bookingId = (created.json() as { booking: { id: string } }).booking.id

  try {
    const forbidden = await app.inject({ method: 'GET', url: '/api/admin/bookings', headers: { cookie: support } })
    assert.equal(forbidden.statusCode, 403)

    const queue = await app.inject({ method: 'GET', url: '/api/admin/bookings', headers: { cookie: moderator } })
    assert.equal(queue.statusCode, 200, queue.body)
    const items = (queue.json() as { items: { id: string; requesterEmail: string; budgetUsd: number | null }[] }).items
    const row = items.find((i) => i.id === bookingId)
    assert.ok(row)
    assert.equal(row.requesterEmail, 'member@vuekumi.demo')
    assert.equal(row.budgetUsd, 200)
  } finally {
    await prisma.bookingRequest.delete({ where: { id: bookingId } }).catch(() => undefined)
    await app.close()
  }
})

test('staff campaign queue: list + close behind capabilities; owner close still works', async () => {
  const app = await buildApp()
  const moderator = await login(app, 'moderator@vuekumi.demo', 'User12345!')
  const support = await login(app, 'support@vuekumi.demo', 'User12345!')
  const finance = await login(app, 'finance@vuekumi.demo', 'User12345!')
  const brand = await login(app, 'agency@vuekumi.demo', 'User12345!')

  const created = await app.inject({
    method: 'POST',
    url: '/api/campaigns',
    headers: { cookie: brand },
    payload: {
      title: 'Admin campaign fixture',
      brief: 'Enough text for createCampaignSchema validation on the staff queue path.',
      budgetUsd: 1000,
    },
  })
  assert.equal(created.statusCode, 200, created.body)
  const campaignId = (created.json() as { campaign: { id: string } }).campaign.id

  try {
    const supportList = await app.inject({ method: 'GET', url: '/api/admin/campaigns', headers: { cookie: support } })
    assert.equal(supportList.statusCode, 403)

    const list = await app.inject({ method: 'GET', url: '/api/admin/campaigns', headers: { cookie: moderator } })
    assert.equal(list.statusCode, 200, list.body)
    const items = (list.json() as { items: { id: string; ownerEmail: string }[] }).items
    assert.ok(items.some((i) => i.id === campaignId && i.ownerEmail === 'agency@vuekumi.demo'))

    const financeClose = await app.inject({
      method: 'POST',
      url: `/api/admin/campaigns/${campaignId}/close`,
      headers: { cookie: finance },
    })
    assert.equal(financeClose.statusCode, 403)

    // Public owner close path still works without admin capability.
    const ownerClose = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaignId}/close`,
      headers: { cookie: brand },
    })
    assert.equal(ownerClose.statusCode, 200, ownerClose.body)

    const reopen = await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'open' } })
    assert.equal(reopen.status, 'open')

    const staffClose = await app.inject({
      method: 'POST',
      url: `/api/admin/campaigns/${campaignId}/close`,
      headers: { cookie: moderator },
    })
    assert.equal(staffClose.statusCode, 200, staffClose.body)
    assert.equal((staffClose.json() as { campaign: { status: string } }).campaign.status, 'closed')
  } finally {
    await prisma.campaignPitch.deleteMany({ where: { campaignId } })
    await prisma.campaign.delete({ where: { id: campaignId } }).catch(() => undefined)
    await app.close()
  }
})
