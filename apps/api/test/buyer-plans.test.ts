import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PLUS_PRICE_USD } from '@vuekumi/shared'
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

test('admin can create a buyer plan, support cannot, and checkout uses that price', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const support = await login(app, 'support@vuekumi.demo', 'User12345!')
  const slug = `studio-${Date.now().toString(36)}`

  const hidden = await app.inject({
    method: 'POST',
    url: '/api/admin/plans',
    headers: { cookie: support },
    payload: { name: 'Studio', slug, priceUsd: 29, periodDays: 30 },
  })
  assert.equal(hidden.statusCode, 403, hidden.body)

  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/plans',
    headers: { cookie: admin },
    payload: { name: 'Studio', slug, priceUsd: 29, periodDays: 14, description: 'A shorter buyer plan' },
  })
  assert.equal(created.statusCode, 200, created.body)
  const plan = created.json() as { id: string; slug: string; priceUsd: number }
  assert.equal(plan.slug, slug)
  assert.equal(plan.priceUsd, 29)

  const listed = await app.inject({ method: 'GET', url: '/api/plans' })
  assert.equal(listed.statusCode, 200, listed.body)
  const items = (listed.json() as { items: { slug: string; priceUsd: number }[] }).items
  assert.equal(items.find((row) => row.slug === 'plus')?.priceUsd, PLUS_PRICE_USD)
  assert.equal(items.find((row) => row.slug === slug)?.priceUsd, 29)

  const locked = await app.inject({
    method: 'DELETE',
    url: '/api/admin/plans/plan_vuekumi_plus',
    headers: { cookie: admin },
  })
  assert.equal(locked.statusCode, 400, locked.body)

  const email = `plan-buyer-${Date.now()}@vuekumi.demo`
  const registered = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'User12345!', name: 'Plan Buyer', accountType: 'user', country: 'US' },
  })
  assert.equal(registered.statusCode, 200, registered.body)
  const started = await app.inject({
    method: 'POST',
    url: '/api/subscriptions',
    headers: { cookie: cookies(registered) },
    payload: { plan: slug },
  })
  assert.equal(started.statusCode, 200, started.body)
  const checkout = started.json() as { checkout: { amountUsd: number } }
  assert.equal(checkout.checkout.amountUsd, 29)

  await prisma.buyerPlan.delete({ where: { id: plan.id } }).catch(() => undefined)
  await app.close()
})

test('homepage save stores a category banner and an editorial category', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const saved = await app.inject({
    method: 'PUT',
    url: '/api/admin/homepage',
    headers: { cookie: admin },
    payload: {
      pins: { edge: ['afr-012'] },
      categoryBanners: [{ photoId: 'afr-012', category: 'Wildlife' }],
      editorial: { mode: 'category', category: 'Landscape' },
    },
  })
  assert.equal(saved.statusCode, 200, saved.body)
  const body = saved.json() as {
    labels: { edge: string }
    categoryBanners: { category: string | null; photoId: string | null }[]
    editorialMode: string
    editorialCategory: string | null
  }
  assert.equal(body.labels.edge, 'Featured images')
  assert.equal(body.categoryBanners[0]?.category, 'Wildlife')
  assert.equal(body.categoryBanners[0]?.photoId, 'afr-012')
  assert.equal(body.editorialMode, 'category')
  assert.equal(body.editorialCategory, 'Landscape')

  const home = await app.inject({ method: 'GET', url: '/api/public/home' })
  assert.equal(home.statusCode, 200, home.body)
  const page = home.json() as {
    featured: {
      categories: { category: string }[]
      editorialMode: string
      editorial: { category: string }[]
    }
  }
  assert.equal(page.featured.editorialMode, 'category')
  assert.ok(page.featured.categories.some((row) => row.category === 'Wildlife'))
  if (page.featured.editorial.length) {
    assert.ok(page.featured.editorial.every((row) => row.category === 'Landscape'))
  }

  await prisma.homeFeaturedPin.deleteMany()
  await prisma.homeSectionConfig.deleteMany({ where: { slot: 'editorial' } })
  await prisma.homeFeaturedPin.create({ data: { slot: 'hero', position: 0, photoId: 'afr-014' } })
  await app.close()
})
