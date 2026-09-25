import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quotePlanChange, unusedCreditUsd } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  assert.equal(res.statusCode, 200, res.body)
  return cookies(res)
}

test('plan change quotes follow the admin downgrade mode', () => {
  const start = new Date('2026-09-01T00:00:00Z')
  const end = new Date('2026-10-01T00:00:00Z')
  const now = new Date('2026-09-16T00:00:00Z')
  const credit = unusedCreditUsd(30, start, end, now)
  assert.ok(credit > 10 && credit < 20)
  const upgrade = quotePlanChange({ currentPrice: 19, nextPrice: 40, creditUsd: credit, mode: 'neither' })
  assert.equal(upgrade.kind, 'upgrade')
  assert.equal(upgrade.refundUsd, 0)
  assert.equal(upgrade.chargeUsd, Math.round((40 - credit) * 100) / 100)
  const prorate = quotePlanChange({ currentPrice: 40, nextPrice: 10, creditUsd: credit, mode: 'prorate' })
  assert.equal(prorate.kind, 'downgrade')
  assert.equal(prorate.chargeUsd, 0)
  assert.equal(prorate.refundUsd, 0)
  const refund = quotePlanChange({ currentPrice: 40, nextPrice: 10, creditUsd: credit, mode: 'refund' })
  assert.equal(refund.chargeUsd, 10)
  assert.equal(refund.refundUsd, credit)
  const neither = quotePlanChange({ currentPrice: 40, nextPrice: 10, creditUsd: credit, mode: 'neither' })
  assert.equal(neither.chargeUsd, 10)
  assert.equal(neither.refundUsd, 0)
})

test('plans stay on their account type and cancellations are reported', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const slug = `photo-plan-${Date.now().toString(36)}`
  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/plans',
    headers: { cookie: admin },
    payload: { name: 'Studio desk', slug, priceUsd: 12, periodDays: 30, audience: 'photographer' },
  })
  assert.equal(created.statusCode, 200, created.body)
  const planId = (created.json() as { id: string }).id

  const buyers = await app.inject({ method: 'GET', url: '/api/plans?audience=buyer' })
  const buyerItems = (buyers.json() as { items: { slug: string }[] }).items
  assert.equal(buyerItems.some((row) => row.slug === slug), false)
  assert.equal(buyerItems.some((row) => row.slug === 'plus'), true)

  const photographers = await app.inject({ method: 'GET', url: '/api/plans?audience=photographer' })
  assert.equal((photographers.json() as { items: { slug: string }[] }).items.some((row) => row.slug === slug), true)

  const adminList = await app.inject({ method: 'GET', url: '/api/admin/plans', headers: { cookie: admin } })
  assert.equal(adminList.statusCode, 200, adminList.body)
  const adminBody = adminList.json() as { items: { slug: string }[]; policy: { downgradeMode: string } }
  assert.equal(adminBody.items.some((row) => row.slug === slug), true)
  assert.ok(['prorate', 'refund', 'neither'].includes(adminBody.policy.downgradeMode))

  const email = `photo-plan-${Date.now()}@vuekumi.demo`
  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email,
      password: 'User12345!',
      firstName: 'Ada',
      lastName: 'Lens',
      accountType: 'photographer',
      country: 'NG',
      acceptAgreement: true,
    },
  })
  assert.equal(registered.statusCode, 200, registered.body)
  const photoCookie = cookies(registered)
  const blocked = await app.inject({
    method: 'POST',
    url: '/api/subscriptions',
    headers: { cookie: photoCookie },
    payload: { plan: 'plus' },
  })
  assert.equal(blocked.statusCode, 403, blocked.body)

  const missingPhone = await app.inject({
    method: 'PATCH',
    url: '/api/auth/me',
    headers: { cookie: photoCookie },
    payload: { firstName: 'Ada', lastName: 'Lens', bio: '' },
  })
  assert.equal(missingPhone.statusCode, 400, missingPhone.body)

  const saved = await app.inject({
    method: 'PATCH',
    url: '/api/auth/me',
    headers: { cookie: photoCookie },
    payload: { phoneCountryCode: '+234', phone: '8012345678', bio: 'Lagos studio' },
  })
  assert.equal(saved.statusCode, 200, saved.body)
  assert.equal((saved.json() as { user: { email: string; phone: string } }).user.email, email)

  const buyerEmail = `buyer-plan-${Date.now()}@vuekumi.demo`
  const buyer = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: buyerEmail, password: 'User12345!', firstName: 'Bo', lastName: 'Buyer', accountType: 'user' },
  })
  assert.equal(buyer.statusCode, 200, buyer.body)
  const buyerCookie = cookies(buyer)
  const buyerId = (buyer.json() as { user: { id: string } }).user.id
  const buyerSave = await app.inject({
    method: 'PATCH',
    url: '/api/auth/me',
    headers: { cookie: buyerCookie },
    payload: { firstName: 'Bo', lastName: 'Buyer' },
  })
  assert.equal(buyerSave.statusCode, 200, buyerSave.body)
  assert.equal((buyerSave.json() as { user: { email: string } }).user.email, buyerEmail)

  const fields = await app.inject({ method: 'GET', url: '/api/account/profile-fields', headers: { cookie: buyerCookie } })
  assert.equal(fields.statusCode, 200, fields.body)
  assert.deepEqual((fields.json() as { fields: string[] }).fields, [])

  const now = new Date()
  const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000)
  const subscription = await prisma.subscription.create({
    data: {
      userId: buyerId,
      plan: 'plus',
      status: 'active',
      amountUsd: 19,
      currency: 'USD',
      amountLocal: 19,
      provider: 'dev',
      periodStart: now,
      periodEnd,
    },
  })
  await prisma.userProfile.upsert({
    where: { userId: buyerId },
    create: { userId: buyerId, subscriptionPlan: 'plus', plusUntil: periodEnd, planAudience: 'buyer' },
    update: { subscriptionPlan: 'plus', plusUntil: periodEnd, planAudience: 'buyer' },
  })

  const noReason = await app.inject({
    method: 'POST',
    url: `/api/subscriptions/${subscription.id}/cancel`,
    headers: { cookie: buyerCookie },
    payload: {},
  })
  assert.equal(noReason.statusCode, 400, noReason.body)

  const cancelled = await app.inject({
    method: 'POST',
    url: `/api/subscriptions/${subscription.id}/cancel`,
    headers: { cookie: buyerCookie },
    payload: { reason: 'too_expensive', detail: 'Trying a smaller plan later' },
  })
  assert.equal(cancelled.statusCode, 200, cancelled.body)

  const report = await app.inject({ method: 'GET', url: '/api/admin/plans/cancellations', headers: { cookie: admin } })
  assert.equal(report.statusCode, 200, report.body)
  const items = (report.json() as { items: { email: string | null; reason: string; detail: string | null }[] }).items
  assert.equal(items.some((row) => row.email === buyerEmail && row.reason === 'too_expensive' && row.detail === 'Trying a smaller plan later'), true)

  const cheaper = `buyer-lite-${Date.now().toString(36)}`
  const lite = await app.inject({
    method: 'POST',
    url: '/api/admin/plans',
    headers: { cookie: admin },
    payload: { name: 'Lite', slug: cheaper, priceUsd: 5, periodDays: 30, audience: 'buyer' },
  })
  assert.equal(lite.statusCode, 200, lite.body)
  const policy = await app.inject({
    method: 'PUT',
    url: '/api/admin/plans/policy',
    headers: { cookie: admin },
    payload: { downgradeMode: 'prorate' },
  })
  assert.equal(policy.statusCode, 200, policy.body)
  const changed = await app.inject({
    method: 'POST',
    url: '/api/subscriptions/change',
    headers: { cookie: buyerCookie },
    payload: { plan: cheaper },
  })
  assert.equal(changed.statusCode, 200, changed.body)
  const changeBody = changed.json() as { checkout: { url: string } | null; quote: { chargeUsd: number; kind: string } }
  assert.equal(changeBody.quote.kind, 'downgrade')
  assert.equal(changeBody.quote.chargeUsd, 0)
  assert.equal(changeBody.checkout, null)

  await prisma.subscriptionCancellation.deleteMany({ where: { userId: buyerId } })
  await prisma.planAdjustment.deleteMany({ where: { userId: buyerId } })
  await prisma.subscription.deleteMany({ where: { userId: buyerId } })
  await prisma.user.deleteMany({ where: { email: { in: [email, buyerEmail] } } })
  await prisma.buyerPlan.deleteMany({ where: { slug: { in: [slug, cheaper] } } })
  await prisma.planPolicy.deleteMany({ where: { id: 'public' } })
  await app.close()
})
