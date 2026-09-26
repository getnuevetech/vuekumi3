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
  const listedBody = listed.json() as { items: { slug: string; name: string; priceUsd: number }[]; home: { kicker: string; title: string } }
  const items = listedBody.items
  assert.equal(items.find((row) => row.slug === 'plus')?.priceUsd, PLUS_PRICE_USD)
  assert.equal(items.find((row) => row.slug === slug)?.priceUsd, 29)
  assert.equal(items.some((row) => row.name === 'Free' || row.name === 'Extended'), false)

  const heading = await app.inject({
    method: 'PUT',
    url: '/api/admin/plans/home',
    headers: { cookie: admin },
    payload: { kicker: 'rates', title: 'Choose a plan' },
  })
  assert.equal(heading.statusCode, 200, heading.body)
  const again = await app.inject({ method: 'GET', url: '/api/plans' })
  assert.equal((again.json() as { home: { title: string } }).home.title, 'Choose a plan')
  await prisma.homeSectionConfig.deleteMany({ where: { slot: 'pricing' } })

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

test('buyer plans appear by sort number', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const stamp = Date.now().toString(36)
  const laterSlug = `sort-late-${stamp}`
  const earlierSlug = `sort-early-${stamp}`
  const created: string[] = []
  try {
    const later = await app.inject({
      method: 'POST',
      url: '/api/admin/plans',
      headers: { cookie: admin },
      payload: { name: 'Zebra Late', slug: laterSlug, priceUsd: 1, periodDays: 30, sortOrder: 40, audience: 'buyer' },
    })
    assert.equal(later.statusCode, 200, later.body)
    created.push((later.json() as { id: string }).id)

    const earlier = await app.inject({
      method: 'POST',
      url: '/api/admin/plans',
      headers: { cookie: admin },
      payload: { name: 'Alpha Early', slug: earlierSlug, priceUsd: 99, periodDays: 30, sortOrder: 5, audience: 'buyer' },
    })
    assert.equal(earlier.statusCode, 200, earlier.body)
    created.push((earlier.json() as { id: string }).id)

    const listed = await app.inject({ method: 'GET', url: '/api/plans?audience=buyer' })
    assert.equal(listed.statusCode, 200, listed.body)
    const slugs = (listed.json() as { items: { slug: string }[] }).items.map((row) => row.slug)
    const plusAt = slugs.indexOf('plus')
    const earlyAt = slugs.indexOf(earlierSlug)
    const lateAt = slugs.indexOf(laterSlug)
    assert.ok(plusAt >= 0 && earlyAt > plusAt && lateAt > earlyAt, slugs.join(','))

    const adminList = await app.inject({ method: 'GET', url: '/api/admin/plans', headers: { cookie: admin } })
    const adminSlugs = (adminList.json() as { items: { slug: string; audience: string }[] }).items
      .filter((row) => row.audience === 'buyer')
      .map((row) => row.slug)
    assert.ok(adminSlugs.indexOf(earlierSlug) < adminSlugs.indexOf(laterSlug), adminSlugs.join(','))
  } finally {
    if (created.length) await prisma.buyerPlan.deleteMany({ where: { id: { in: created } } })
    await app.close()
  }
})
