import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AccountTypeConfigDto } from '@vuekumi/shared'
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

test('photographers keep bookings; contributors get paid-tier commercial_stock; influencers stay Free Library', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const slug = `feature-plan-${Date.now().toString(36)}`
  let planId: string | null = null
  try {
    const page = await app.inject({ method: 'GET', url: '/api/public/account-types' })
    assert.equal(page.statusCode, 200, page.body)
    const items = (page.json() as { items: AccountTypeConfigDto[] }).items
    const photographer = items.find((item) => item.accountType === 'photographer')
    const contributor = items.find((item) => item.accountType === 'contributor')
    const influencer = items.find((item) => item.accountType === 'photo_influencer')
    assert.equal(photographer?.features.includes('receive_bookings'), true)
    assert.equal(photographer?.features.includes('commercial_stock'), true)
    assert.equal(contributor?.features.includes('receive_bookings'), false)
    assert.equal(contributor?.features.includes('upload_photos'), true)
    assert.equal(contributor?.features.includes('copyright_earnings'), true)
    assert.equal(contributor?.features.includes('commercial_stock'), true)
    assert.equal(influencer?.features.includes('commercial_stock'), false)
    assert.equal(influencer?.features.includes('upload_photos'), true)

    const closed = await app.inject({
      method: 'PUT',
      url: '/api/admin/account-types',
      headers: { cookie: admin },
      payload: {
        items: items.map((item) => ({
          accountType: item.accountType,
          enabled: item.accountType === 'contributor' ? false : item.enabled,
          features: item.features,
        })),
      },
    })
    assert.equal(closed.statusCode, 200, closed.body)

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'closed-contributor@vuekumi.test',
        password: 'User12345!',
        firstName: 'Closed',
        lastName: 'Contributor',
        accountType: 'contributor',
        country: 'NG',
        acceptAgreement: true,
      },
    })
    assert.equal(signup.statusCode, 400, signup.body)
    assert.match(signup.body, /not open for signup/)

    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/plans',
      headers: { cookie: admin },
      payload: {
        name: 'Feature plan',
        slug,
        priceUsd: 12,
        periodDays: 30,
        audience: 'contributor',
        featureKeys: ['upload_photos', 'copyright_earnings'],
      },
    })
    assert.equal(created.statusCode, 200, created.body)
    const plan = created.json() as { id: string; featureKeys: string[]; features: string[] }
    planId = plan.id
    assert.deepEqual(plan.featureKeys, ['upload_photos', 'copyright_earnings'])
    assert.deepEqual(plan.features, ['Upload photographs', 'Copyright income'])
  } finally {
    if (planId) await prisma.buyerPlan.deleteMany({ where: { id: planId } })
    await prisma.user.deleteMany({ where: { email: 'closed-contributor@vuekumi.test' } })
    await prisma.accountTypeConfig.deleteMany()
    await app.close()
  }
})
