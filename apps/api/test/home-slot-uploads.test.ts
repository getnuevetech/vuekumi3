import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('admin can upload images for the hero, editorial, pricing, and stats slots', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const admin = cookies(login)
  const before = await prisma.homeFeaturedPin.findMany({
    where: { slot: { in: ['hero', 'editorial', 'pricing', 'stats_background', 'edge'] } },
  })
  const beforeFrame = await prisma.homeSectionConfig.findUnique({ where: { slot: 'edge' } })

  try {
    const rejected = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: { pins: {}, uploads: { hero: ['https://example.com/hero.jpg', null, null] } },
    })
    assert.equal(rejected.statusCode, 400, rejected.body)

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: {
        pins: {},
        uploads: {
          hero: ['/api/media/site/banners/hero-upload.jpg', null, null],
          editorial: [null, '/api/media/site/banners/editorial-upload.jpg'],
          pricing: ['/api/media/site/banners/pricing-upload.jpg', null, null],
          stats_background: ['/api/media/site/banners/stats-upload.jpg'],
        },
      },
    })
    assert.equal(saved.statusCode, 200, saved.body)
    const body = saved.json() as {
      slots: {
        hero: { source: string; imageSrc: string | null }[]
        editorial: { source: string; imageSrc: string | null }[]
        pricing: { source: string; imageSrc: string | null }[]
        stats_background: { source: string; imageSrc: string | null }[]
      }
      frame: { widthVw: number; heightVw: number }
    }
    assert.equal(body.slots.hero[0]?.source, 'upload')
    assert.equal(body.slots.hero[0]?.imageSrc, '/api/media/site/banners/hero-upload.jpg')
    assert.equal(body.slots.editorial[1]?.imageSrc, '/api/media/site/banners/editorial-upload.jpg')
    assert.equal(body.slots.pricing[0]?.imageSrc, '/api/media/site/banners/pricing-upload.jpg')
    assert.equal(body.slots.stats_background[0]?.source, 'upload')
    assert.equal(body.frame.widthVw, beforeFrame?.widthVw ?? 23.52)
    assert.equal(body.frame.heightVw, beforeFrame?.heightVw ?? 41.81)

    const home = await app.inject({ method: 'GET', url: '/api/public/home' })
    const page = home.json() as {
      featured: {
        hero: { id: string; src: string; country: string }[]
        editorial: { src: string }[]
        pricing: { src: string }[]
        statsBackground: { src: string; country: string } | null
        frame: { widthVw: number }
      }
    }
    assert.equal(page.featured.hero[0]?.src, '/api/media/site/banners/hero-upload.jpg')
    assert.equal(page.featured.hero[0]?.id.startsWith('upload-hero-'), true)
    assert.equal(page.featured.editorial.some((photo) => photo.src === '/api/media/site/banners/editorial-upload.jpg'), true)
    assert.equal(page.featured.pricing[0]?.src, '/api/media/site/banners/pricing-upload.jpg')
    assert.equal(page.featured.statsBackground?.src, '/api/media/site/banners/stats-upload.jpg')
    assert.equal(page.featured.frame.widthVw, beforeFrame?.widthVw ?? 23.52)

    const kept = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: { pins: { edge: ['afr-011'] } },
    })
    assert.equal(kept.statusCode, 200, kept.body)
    const still = await app.inject({ method: 'GET', url: '/api/public/home' })
    const stillHero = (still.json() as { featured: { hero: { src: string }[] } }).featured.hero[0]?.src
    assert.equal(stillHero, '/api/media/site/banners/hero-upload.jpg')
  } finally {
    await prisma.homeFeaturedPin.deleteMany({
      where: { slot: { in: ['hero', 'editorial', 'pricing', 'stats_background', 'edge'] } },
    })
    if (before.length) {
      await prisma.homeFeaturedPin.createMany({
        data: before.map((row) => ({
          slot: row.slot,
          position: row.position,
          photoId: row.photoId,
          category: row.category,
          imageSrc: row.imageSrc,
        })),
      })
    }
    await app.close()
  }
})
