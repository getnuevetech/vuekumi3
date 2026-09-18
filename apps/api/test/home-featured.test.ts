import assert from 'node:assert/strict'
import { test } from 'node:test'
import { featuredPinIneligibleReason, HOME_FEATURED_CAPACITY } from '@vuekumi/shared'
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

test('featured pin helpers reject private and portfolio photographs', () => {
  assert.equal(featuredPinIneligibleReason({ status: 'active', permissionState: 'commercial' }), null)
  assert.match(featuredPinIneligibleReason({ status: 'pending', permissionState: 'commercial' }) ?? '', /live/)
  assert.match(featuredPinIneligibleReason({ status: 'active', permissionState: 'private' }) ?? '', /Private/)
  assert.match(featuredPinIneligibleReason({ status: 'active', permissionState: 'portfolio' }) ?? '', /portfolio/)
  assert.match(featuredPinIneligibleReason({ status: 'active', permissionState: 'agency_protected' }) ?? '', /agency-protected/)
  assert.equal(HOME_FEATURED_CAPACITY.hero, 3)
})

test('staff can pin a live stock photo onto the homepage hero; finance cannot; private photos are rejected', async () => {
  const app = await buildApp()
  const admin = await login(app, 'admin@vuekumi.com', 'Admin123!')
  const finance = await login(app, 'finance@vuekumi.demo', 'User12345!')
  const moderator = await login(app, 'moderator@vuekumi.demo', 'User12345!')

  const forbidden = await app.inject({
    method: 'PUT',
    url: '/api/admin/homepage',
    headers: { cookie: finance },
    payload: { pins: { hero: ['afr-012'] } },
  })
  assert.equal(forbidden.statusCode, 403, forbidden.body)

  const privatePin = await app.inject({
    method: 'PUT',
    url: '/api/admin/homepage',
    headers: { cookie: admin },
    payload: { pins: { hero: ['afr-pend-1'] } },
  })
  assert.equal(privatePin.statusCode, 400, privatePin.body)
  assert.match(privatePin.json().error as string, /live|Private|featured/i)

  const portfolioPin = await app.inject({
    method: 'PUT',
    url: '/api/admin/homepage',
    headers: { cookie: admin },
    payload: { pins: { edge: ['mdl-pending-copy'] } },
  })
  assert.equal(portfolioPin.statusCode, 400, portfolioPin.body)

  const pinned = await app.inject({
    method: 'PUT',
    url: '/api/admin/homepage',
    headers: { cookie: moderator },
    payload: { pins: { hero: ['afr-012', null, null] } },
  })
  assert.equal(pinned.statusCode, 200, pinned.body)
  const body = pinned.json() as { pins: { hero: (string | null)[] }; slots: { hero: { photoId: string | null; source: string }[] } }
  assert.equal(body.pins.hero[0], 'afr-012')
  assert.equal(body.slots.hero[0]?.photoId, 'afr-012')
  assert.equal(body.slots.hero[0]?.source, 'pinned')

  const home = await app.inject({ method: 'GET', url: '/api/public/home' })
  assert.equal(home.statusCode, 200)
  const page = home.json() as { featured: { hero: { id: string }[] } }
  assert.equal(page.featured.hero[0]?.id, 'afr-012')

  await prisma.homeFeaturedPin.deleteMany({ where: { slot: 'hero', position: 0, photoId: 'afr-012' } })
  await prisma.homeFeaturedPin.upsert({
    where: { slot_position: { slot: 'hero', position: 0 } },
    create: { slot: 'hero', position: 0, photoId: 'afr-014' },
    update: { photoId: 'afr-014' },
  })

  await app.close()
})
