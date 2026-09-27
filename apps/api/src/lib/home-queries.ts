import type { HomeCategoryBannerDto, HomePageDto, HomeSlotPins, PhotoDto } from '@vuekumi/shared'
import { HOME_CATEGORY_BANNER_CAPACITY, HOME_FEATURED_CAPACITY, HOME_FEATURED_SLOT_KEYS, HOME_UPLOAD_SLOT_KEYS, STOCK_PERMISSION_STATES, isHomeUploadSlot, normalizeFeaturedFrame, normalizeSlotUploads } from '@vuekumi/shared'
import { assignHomeSlots, categoryShares, shuffleWith } from './home.js'
import {
  catalogPhotoInclude,
  serializeCatalogPhoto,
  type CatalogPhoto,
} from './catalog.js'
import { loadHomeLayout } from './home-layout.js'
import { prisma } from './prisma.js'

const LIVE = { status: 'active' as const, permissionState: { in: [...STOCK_PERMISSION_STATES] } }

function ranked(photo: { id: string; category: string }) {
  return { id: photo.id, category: photo.category }
}

function byId(photos: CatalogPhoto[]) {
  return new Map(photos.map((photo) => [photo.id, photo]))
}

function mapSlot(ids: string[], lookup: Map<string, CatalogPhoto>) {
  return ids.map((id) => lookup.get(id)).filter((photo): photo is CatalogPhoto => Boolean(photo)).map((p) => serializeCatalogPhoto(p))
}

export async function loadHomeUploads() {
  const rows = await prisma.homeFeaturedPin.findMany({
    where: { slot: { in: [...HOME_UPLOAD_SLOT_KEYS] } },
    orderBy: { position: 'asc' },
  })
  const uploads = normalizeSlotUploads(null)
  for (const row of rows) {
    if (!isHomeUploadSlot(row.slot) || !row.imageSrc) continue
    uploads[row.slot][row.position] = row.imageSrc
  }
  return uploads
}

export async function loadHomePins(): Promise<HomeSlotPins> {
  const rows = await prisma.homeFeaturedPin.findMany({ orderBy: [{ slot: 'asc' }, { position: 'asc' }] })
  const pins: HomeSlotPins = {}
  for (const slot of HOME_FEATURED_SLOT_KEYS) pins[slot] = []
  for (const row of rows) {
    if (!HOME_FEATURED_SLOT_KEYS.includes(row.slot as (typeof HOME_FEATURED_SLOT_KEYS)[number])) continue
    const slot = row.slot as (typeof HOME_FEATURED_SLOT_KEYS)[number]
    const list = pins[slot] ?? []
    list[row.position] = row.photoId
    pins[slot] = list
  }
  return pins
}

export async function loadHomePage(): Promise<HomePageDto> {
  const [photosLive, contributorGroups, countryGroups, downloadAgg, categoryGroups, pool, pins, uploads] =
    await Promise.all([
      prisma.photo.count({ where: LIVE }),
      prisma.photo.groupBy({ by: ['contributorId'], where: LIVE, _count: { _all: true } }),
      prisma.photo.groupBy({ by: ['country'], where: LIVE, _count: { _all: true } }),
      prisma.photo.aggregate({ where: LIVE, _sum: { downloads: true } }),
      prisma.photo.groupBy({ by: ['category'], where: LIVE, _count: { _all: true } }),
      prisma.photo.findMany({
        where: LIVE,
        select: { id: true, category: true },
      }),
      loadHomePins(),
      loadHomeUploads(),
    ])

  const pinIds = HOME_FEATURED_SLOT_KEYS.flatMap((slot) => (pins[slot] ?? []).filter((id): id is string => Boolean(id)))
  const liveIds = new Set(pool.map((photo) => photo.id))
  const [editorialConfig, frameConfig] = await Promise.all([
    prisma.homeSectionConfig.findUnique({ where: { slot: 'editorial' } }),
    prisma.homeSectionConfig.findUnique({ where: { slot: 'edge' } }),
  ])
  const editorialMode = editorialConfig?.mode === 'category' ? 'category' as const : 'pins' as const
  const editorialCategory = editorialConfig?.category ?? null
  const slots = assignHomeSlots({
    byDownloads: pool.map(ranked),
    byNewest: [],
    byLikes: [],
    pins,
    liveIds,
    holds: {
      hero: uploads.hero.map(Boolean),
      pricing: uploads.pricing.map(Boolean),
      stats_background: uploads.stats_background.map(Boolean),
      ...(editorialMode === 'pins' ? { editorial: uploads.editorial.map(Boolean) } : {}),
    },
  })
  const chosenIds = [...new Set([
    ...slots.hero,
    ...slots.edge,
    ...slots.editorial,
    ...slots.pricing,
    ...(slots.statsBackground ? [slots.statsBackground] : []),
    ...pinIds.filter((id) => liveIds.has(id)),
  ])]
  const chosenPhotos = chosenIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: chosenIds }, ...LIVE },
        include: catalogPhotoInclude,
      })
    : []
  const lookup = byId(chosenPhotos)
  let editorial = mixUploads(slots.editorial, uploads.editorial, lookup, 'editorial')
  if (editorialMode === 'category' && editorialCategory) {
    const rows = await prisma.photo.findMany({
      where: { ...LIVE, category: editorialCategory },
      include: catalogPhotoInclude,
    })
    const picked = shuffleWith(rows).slice(0, HOME_FEATURED_CAPACITY.editorial)
    editorial = overlayUploads(picked.map((photo) => serializeCatalogPhoto(photo)), uploads.editorial, 'editorial')
  }
  const statsUpload = uploads.stats_background[0]
  const [categories, layout] = await Promise.all([loadCategoryBanners(), loadHomeLayout()])

  return {
    stats: {
      photosLive,
      contributors: contributorGroups.length,
      countries: countryGroups.length,
      downloads: downloadAgg._sum.downloads ?? 0,
      categories: categoryShares(
        categoryGroups.map((row) => ({ value: row.category, count: row._count._all })),
        photosLive,
      ),
    },
    featured: {
      hero: mixUploads(slots.hero, uploads.hero, lookup, 'hero'),
      edge: mapSlot(slots.edge, lookup),
      editorial,
      pricing: mixUploads(slots.pricing, uploads.pricing, lookup, 'pricing'),
      statsBackground: statsUpload
        ? uploadedSlide(statsUpload, 'stats', 0)
        : slots.statsBackground && lookup.get(slots.statsBackground)
          ? serializeCatalogPhoto(lookup.get(slots.statsBackground)!)
          : null,
      categories,
      editorialMode,
      editorialCategory,
      frame: normalizeFeaturedFrame(frameConfig),
    },
    contributors: layout.people.contributors.people,
    layout,
  }
}

function uploadedSlide(src: string, slot: string, index: number): PhotoDto {
  return {
    id: `upload-${slot}-${index}`,
    src,
    title: '',
    category: '',
    country: '',
    photographer: '',
    license: 'free',
    price: 0,
    downloads: 0,
    views: 0,
    likes: 0,
    tags: [],
    status: 'active',
  }
}

function mixUploads(ids: string[], uploads: (string | null)[], lookup: Map<string, CatalogPhoto>, slot: string): PhotoDto[] {
  const cap = Math.max(ids.length, uploads.length)
  const photos: PhotoDto[] = []
  let cursor = 0
  for (let i = 0; i < cap; i++) {
    const src = uploads[i]
    if (src) {
      photos.push(uploadedSlide(src, slot, i))
      continue
    }
    const id = ids[cursor]
    cursor += 1
    const photo = id ? lookup.get(id) : undefined
    if (photo) photos.push(serializeCatalogPhoto(photo))
  }
  return photos
}

function overlayUploads(photos: PhotoDto[], uploads: (string | null)[], slot: string): PhotoDto[] {
  if (!uploads.some(Boolean)) return photos
  const cap = Math.max(photos.length, uploads.length)
  const out: PhotoDto[] = []
  for (let i = 0; i < cap; i++) {
    const src = uploads[i]
    if (src) out.push(uploadedSlide(src, slot, i))
    else if (photos[i]) out.push(photos[i]!)
  }
  return out
}

function uploadedBannerPhoto(src: string, category: string): PhotoDto {
  return {
    id: `banner-${category}`,
    src,
    title: category,
    category,
    country: '',
    photographer: '',
    license: 'free',
    price: 0,
    downloads: 0,
    views: 0,
    likes: 0,
    tags: [],
    status: 'active',
  }
}

async function loadCategoryBanners(): Promise<HomeCategoryBannerDto[]> {
  const rows = await prisma.homeFeaturedPin.findMany({
    where: { slot: 'categories' },
    orderBy: { position: 'asc' },
  })
  const configured = rows.filter((row) => row.category)
  if (configured.length === 0) {
    const rows = shuffleWith(await prisma.photo.findMany({
      where: LIVE,
      select: { id: true, category: true },
    }))
    const seen = new Set<string>()
    const picked: { id: string; category: string }[] = []
    for (const photo of rows) {
      if (!photo.category || seen.has(photo.category)) continue
      seen.add(photo.category)
      picked.push(photo)
      if (picked.length >= HOME_CATEGORY_BANNER_CAPACITY) break
    }
    const photos = picked.length
      ? await prisma.photo.findMany({
          where: { id: { in: picked.map((row) => row.id) } },
          include: catalogPhotoInclude,
        })
      : []
    const lookup = new Map(photos.map((photo) => [photo.id, photo]))
    return picked.flatMap((row) => {
      const photo = lookup.get(row.id)
      return photo ? [{ category: row.category, photo: serializeCatalogPhoto(photo) }] : []
    })
  }

  const pinnedIds = configured.map((row) => row.photoId).filter((id): id is string => Boolean(id))
  const pinned = pinnedIds.length
    ? await prisma.photo.findMany({ where: { id: { in: pinnedIds }, ...LIVE }, include: catalogPhotoInclude })
    : []
  const pinnedById = new Map(pinned.map((photo) => [photo.id, photo]))
  const used = new Set<string>()
  const banners: HomeCategoryBannerDto[] = []
  for (const row of configured) {
    if (!row.category) continue
    if (row.imageSrc) {
      banners.push({ category: row.category, photo: uploadedBannerPhoto(row.imageSrc, row.category) })
      continue
    }
    let photo = row.photoId ? pinnedById.get(row.photoId) : undefined
    if (photo && used.has(photo.id)) photo = undefined
    if (!photo) {
      const choices = await prisma.photo.findMany({
        where: { ...LIVE, category: row.category, id: { notIn: [...used] } },
        select: { id: true },
      })
      const pick = shuffleWith(choices)[0]
      photo = pick
        ? await prisma.photo.findFirst({
            where: { id: pick.id, ...LIVE },
            include: catalogPhotoInclude,
          }) ?? undefined
        : undefined
    }
    if (!photo) continue
    used.add(photo.id)
    banners.push({ category: row.category, photo: serializeCatalogPhoto(photo) })
  }
  return banners
}
