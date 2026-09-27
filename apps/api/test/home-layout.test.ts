import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_HOME_SECTION_ORDER, normalizeHiddenSections, normalizeHomeSectionOrder } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('default homepage order puts photo influencers ahead of photographers', () => {
  const order = normalizeHomeSectionOrder(null, [])
  assert.deepEqual(order, DEFAULT_HOME_SECTION_ORDER)
  assert.ok(order.indexOf('photo_influencers') < order.indexOf('photographers'))
  assert.ok(order.indexOf('photographers') < order.indexOf('contributors'))
  const saved = normalizeHomeSectionOrder(['pricing', 'hero'], ['banner-1'], { fillMissing: false })
  assert.deepEqual(saved, ['pricing', 'hero'])
  const withBanner = normalizeHomeSectionOrder(null, ['banner-1'])
  assert.equal(withBanner.at(-1), 'banner:banner-1')
  assert.equal(withBanner.filter((key) => key === 'hero').length, 1)
  assert.deepEqual(normalizeHiddenSections(['photographers', 'missing', 'photographers'], saved), [])
  assert.deepEqual(normalizeHiddenSections(['hero', 'pricing'], saved), ['hero', 'pricing'])
})

test('admin can arrange homepage sections, choose people, and add a static banner', async () => {
  const app = await buildApp()
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@vuekumi.com', password: 'Admin123!' },
  })
  assert.equal(login.statusCode, 200, login.body)
  const admin = cookies(login)
  const slots = ['photographers', 'photo_influencers', 'contributors', 'category_banners']
  const beforeConfigs = await prisma.homeSectionConfig.findMany({ where: { slot: { in: slots } } })
  const beforeLayout = await prisma.homeLayout.findUnique({ where: { id: 'public' } })
  const beforeFrame = await prisma.homeSectionConfig.findUnique({ where: { slot: 'edge' } })

  try {
    const photographer = await prisma.user.findFirst({
      where: { accountType: 'photographer', status: 'active', contributorProfile: { isNot: null } },
      select: { id: true, contributorProfile: { select: { handle: true } } },
    })
    const contributor = await prisma.user.findFirst({
      where: { accountType: 'contributor', status: 'active', contributorProfile: { isNot: null } },
      select: { id: true },
    })
    assert.ok(photographer?.contributorProfile)
    assert.ok(contributor)

    const homeBefore = await app.inject({ method: 'GET', url: '/api/public/home' })
    const beforeOrder = (homeBefore.json() as { layout: { order: string[] } }).layout.order
    assert.ok(beforeOrder.indexOf('photo_influencers') < beforeOrder.indexOf('photographers'))
    assert.ok(beforeOrder.indexOf('photographers') < beforeOrder.indexOf('contributors'))

    const rejected = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: {
        pins: {},
        people: {
          photographers: {
            mode: 'profiles',
            ids: [contributor.id],
            randomize: false,
            frame: { widthVw: 22, heightVw: 28 },
          },
        },
      },
    })
    assert.equal(rejected.statusCode, 400, rejected.body)

    const moved = [...beforeOrder]
    const heroAt = moved.indexOf('hero')
    const marqueeAt = moved.indexOf('marquee')
    const hero = moved[heroAt]!
    moved[heroAt] = moved[marqueeAt]!
    moved[marqueeAt] = hero
    const existingBanners = await prisma.homeStaticBanner.findMany({
      include: { images: { orderBy: { position: 'asc' } } },
    })

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: {
        pins: {},
        layoutOrder: moved,
        people: {
          photographers: {
            mode: 'profiles',
            ids: [photographer.id],
            randomize: false,
            frame: { widthVw: 22, heightVw: 28 },
          },
        },
        categoryBannerFrame: { widthVw: 18, heightVw: 24 },
        staticBanners: [
          ...existingBanners.map((banner) => ({
            id: banner.id,
            title: banner.title,
            columns: banner.columns,
            rows: banner.rows,
            frame: { widthVw: banner.widthVw, heightVw: banner.heightVw },
            images: banner.images.map((image) => image.imageSrc),
          })),
          {
            title: 'Layout test banner',
            columns: 2,
            rows: 1,
            frame: { widthVw: 20, heightVw: 12 },
            images: ['/api/media/site/banners/layout-test.jpg'],
          },
        ],
      },
    })
    assert.equal(saved.statusCode, 200, saved.body)
    const adminBody = saved.json() as {
      people: { photographers: { mode: string; frame: { widthVw: number } } }
      categoryBannerFrame: { heightVw: number }
      staticBanners: { id: string; title: string; columns: number }[]
      layoutOrder: string[]
      frame: { widthVw: number; heightVw: number }
    }
    assert.equal(adminBody.people.photographers.mode, 'profiles')
    assert.equal(adminBody.people.photographers.frame.widthVw, 22)
    assert.equal(adminBody.categoryBannerFrame.heightVw, 24)
    const savedBanner = adminBody.staticBanners.find((banner) => banner.title === 'Layout test banner')
    assert.equal(savedBanner?.columns, 2)
    assert.equal(adminBody.layoutOrder[heroAt], 'marquee')
    assert.equal(adminBody.layoutOrder[marqueeAt], 'hero')
    assert.ok(savedBanner && adminBody.layoutOrder.includes(`banner:${savedBanner.id}`))
    assert.equal(adminBody.frame.widthVw, beforeFrame?.widthVw ?? 23.52)
    assert.equal(adminBody.frame.heightVw, beforeFrame?.heightVw ?? 41.81)

    const home = await app.inject({ method: 'GET', url: '/api/public/home' })
    const page = home.json() as {
      layout: {
        order: string[]
        people: {
          photographers: { people: { handle: string }[]; frame: { heightVw: number } }
          photo_influencers: { mode: string }
        }
        categoryBannerFrame: { widthVw: number }
        staticBanners: { title: string; rows: number; images: string[] }[]
      }
      featured: { frame: { widthVw: number } }
    }
    assert.equal(page.layout.order[heroAt], 'marquee')
    assert.equal(page.layout.people.photographers.people.length, 1)
    assert.equal(page.layout.people.photographers.people[0]?.handle, photographer.contributorProfile.handle)
    assert.equal(page.layout.people.photographers.frame.heightVw, 28)
    assert.equal(page.layout.people.photo_influencers.mode, 'downloads')
    assert.equal(page.layout.categoryBannerFrame.widthVw, 18)
    const publicBanner = page.layout.staticBanners.find((banner) => banner.title === 'Layout test banner')
    assert.equal(publicBanner?.rows, 1)
    assert.equal(publicBanner?.images[0], '/api/media/site/banners/layout-test.jpg')
    assert.equal(page.featured.frame.widthVw, beforeFrame?.widthVw ?? 23.52)

    const both = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: {
        pins: {},
        people: {
          photographers: {
            mode: 'both',
            ids: [photographer.id],
            randomize: false,
            frame: { widthVw: 22, heightVw: 28 },
          },
        },
      },
    })
    assert.equal(both.statusCode, 200, both.body)
    const filled = await app.inject({ method: 'GET', url: '/api/public/home' })
    const first = (filled.json() as { layout: { people: { photographers: { mode: string; people: { handle: string }[] } } } }).layout.people.photographers
    assert.equal(first.mode, 'both')
    assert.equal(first.people[0]?.handle, photographer.contributorProfile.handle)

    const withoutPhotographers = moved.filter((key) => key !== 'photographers')
    const hiddenSave = await app.inject({
      method: 'PUT',
      url: '/api/admin/homepage',
      headers: { cookie: admin },
      payload: { pins: {}, layoutOrder: withoutPhotographers, layoutHidden: ['contributors'] },
    })
    assert.equal(hiddenSave.statusCode, 200, hiddenSave.body)
    const hiddenAdmin = hiddenSave.json() as { layoutOrder: string[]; layoutHidden: string[] }
    assert.equal(hiddenAdmin.layoutOrder.includes('photographers'), false)
    assert.equal(hiddenAdmin.layoutHidden.includes('contributors'), true)
    const hiddenHome = await app.inject({ method: 'GET', url: '/api/public/home' })
    const visible = (hiddenHome.json() as { layout: { order: string[] } }).layout.order
    assert.equal(visible.includes('photographers'), false)
    assert.equal(visible.includes('contributors'), false)
    assert.equal(visible.includes('photo_influencers'), true)
  } finally {
    await prisma.homeStaticBanner.deleteMany({ where: { title: 'Layout test banner' } })
    await prisma.homeSectionConfig.deleteMany({ where: { slot: { in: slots } } })
    if (beforeConfigs.length) {
      await prisma.homeSectionConfig.createMany({
        data: beforeConfigs.map((row) => ({
          slot: row.slot,
          mode: row.mode,
          category: row.category,
          kicker: row.kicker,
          title: row.title,
          widthVw: row.widthVw,
          heightVw: row.heightVw,
          contributorIds: row.contributorIds,
          randomize: row.randomize,
        })),
      })
    }
    if (beforeLayout) {
      await prisma.homeLayout.update({
        where: { id: 'public' },
        data: { order: beforeLayout.order, hidden: beforeLayout.hidden },
      })
    } else {
      await prisma.homeLayout.deleteMany({ where: { id: 'public' } })
    }
    await app.close()
  }
})
