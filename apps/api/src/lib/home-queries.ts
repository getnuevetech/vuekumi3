import type { HomePageDto, HomeSlotPins } from '@vuekumi/shared'
import { HOME_FEATURED_SLOT_KEYS, STOCK_PERMISSION_STATES } from '@vuekumi/shared'
import { assignHomeSlots, categoryShares } from './home.js'
import {
  catalogPhotoInclude,
  serializeCatalogPhoto,
  type CatalogPhoto,
} from './catalog.js'
import { prisma } from './prisma.js'

const LIVE = { status: 'active' as const, permissionState: { in: [...STOCK_PERMISSION_STATES] } }

function ranked(photo: CatalogPhoto) {
  return { id: photo.id, category: photo.category }
}

function byId(photos: CatalogPhoto[]) {
  return new Map(photos.map((photo) => [photo.id, photo]))
}

function mapSlot(ids: string[], lookup: Map<string, CatalogPhoto>) {
  return ids.map((id) => lookup.get(id)).filter((photo): photo is CatalogPhoto => Boolean(photo)).map((p) => serializeCatalogPhoto(p))
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
  const [photosLive, contributorGroups, countryGroups, downloadAgg, categoryGroups, byDownloads, byNewest, byLikes, pins] =
    await Promise.all([
      prisma.photo.count({ where: LIVE }),
      prisma.photo.groupBy({ by: ['contributorId'], where: LIVE, _count: { _all: true } }),
      prisma.photo.groupBy({ by: ['country'], where: LIVE, _count: { _all: true } }),
      prisma.photo.aggregate({ where: LIVE, _sum: { downloads: true } }),
      prisma.photo.groupBy({ by: ['category'], where: LIVE, _count: { _all: true } }),
      prisma.photo.findMany({
        where: LIVE,
        include: catalogPhotoInclude,
        orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
        take: 16,
      }),
      prisma.photo.findMany({
        where: LIVE,
        include: catalogPhotoInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: 12,
      }),
      prisma.photo.findMany({
        where: LIVE,
        include: catalogPhotoInclude,
        orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      loadHomePins(),
    ])

  const pinIds = HOME_FEATURED_SLOT_KEYS.flatMap((slot) => (pins[slot] ?? []).filter((id): id is string => Boolean(id)))
  const missingIds = pinIds.filter((id) => ![...byDownloads, ...byNewest, ...byLikes].some((photo) => photo.id === id))
  const pinnedPhotos = missingIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: missingIds }, ...LIVE },
        include: catalogPhotoInclude,
      })
    : []

  const lookup = byId([...byDownloads, ...byNewest, ...byLikes, ...pinnedPhotos])
  const liveIds = new Set(lookup.keys())
  const slots = assignHomeSlots({
    byDownloads: byDownloads.map(ranked),
    byNewest: byNewest.map(ranked),
    byLikes: byLikes.map(ranked),
    pins,
    liveIds,
  })
  const statsPhoto = slots.statsBackground ? lookup.get(slots.statsBackground) : undefined

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
      hero: mapSlot(slots.hero, lookup),
      edge: mapSlot(slots.edge, lookup),
      editorial: mapSlot(slots.editorial, lookup),
      pricing: mapSlot(slots.pricing, lookup),
      statsBackground: statsPhoto ? serializeCatalogPhoto(statsPhoto) : null,
    },
  }
}
