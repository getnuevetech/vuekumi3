import type { HomeCategoryBannerDto, HomePageDto, HomeSlotPins, PhotographerDto, PhotoDto } from '@vuekumi/shared'
import { HOME_CATEGORY_BANNER_CAPACITY, HOME_FEATURED_CAPACITY, HOME_FEATURED_SLOT_KEYS, STOCK_PERMISSION_STATES, normalizeFeaturedFrame } from '@vuekumi/shared'
import { assignHomeSlots, categoryShares } from './home.js'
import {
  PROFILE_PHOTO_FILTER,
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
        take: 24,
      }),
      prisma.photo.findMany({
        where: LIVE,
        include: catalogPhotoInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: 40,
      }),
      prisma.photo.findMany({
        where: LIVE,
        include: catalogPhotoInclude,
        orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
        take: 16,
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
  const [editorialConfig, frameConfig] = await Promise.all([
    prisma.homeSectionConfig.findUnique({ where: { slot: 'editorial' } }),
    prisma.homeSectionConfig.findUnique({ where: { slot: 'edge' } }),
  ])
  const editorialMode = editorialConfig?.mode === 'category' ? 'category' as const : 'pins' as const
  const editorialCategory = editorialConfig?.category ?? null
  let editorial = mapSlot(slots.editorial, lookup)
  if (editorialMode === 'category' && editorialCategory) {
    const rows = await prisma.photo.findMany({
      where: { ...LIVE, category: editorialCategory },
      include: catalogPhotoInclude,
      orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
      take: HOME_FEATURED_CAPACITY.editorial,
    })
    editorial = rows.map((photo) => serializeCatalogPhoto(photo))
  }
  const [categories, contributors] = await Promise.all([loadCategoryBanners(), loadFrontpageContributors()])

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
      editorial,
      pricing: mapSlot(slots.pricing, lookup),
      statsBackground: statsPhoto ? serializeCatalogPhoto(statsPhoto) : null,
      categories,
      editorialMode,
      editorialCategory,
      frame: normalizeFeaturedFrame(frameConfig),
    },
    contributors,
  }
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

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = next[i]!
    next[i] = next[j]!
    next[j] = current
  }
  return next
}

async function loadFrontpageContributors(): Promise<PhotographerDto[]> {
  const config = await prisma.homeSectionConfig.findUnique({ where: { slot: 'contributors' } })
  const ids = config?.contributorIds ?? []
  if (!ids.length) return []
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: 'active', contributorProfile: { isNot: null } },
    include: {
      contributorProfile: true,
      modelProfile: { select: { handle: true } },
      representation: { select: { status: true } },
      photos: { where: PROFILE_PHOTO_FILTER, select: { downloads: true } },
      _count: { select: { followers: true } },
    },
  })
  const byId = new Map(users.map((user) => [user.id, user]))
  const ordered = ids.flatMap((id) => {
    const user = byId.get(id)
    if (!user?.contributorProfile) return []
    const photosCount = user.photos.length
    const downloads = user.photos.reduce((sum, photo) => sum + photo.downloads, 0)
    const hireable = user.accountType === 'photographer'
    const row: PhotographerDto = {
      handle: user.contributorProfile.handle,
      name: user.name,
      avatarUrl: user.avatarUrl,
      location: user.contributorProfile.location,
      bio: user.contributorProfile.bio,
      creatorKind: user.contributorProfile.creatorKind,
      availability: hireable ? user.contributorProfile.availability : 'unavailable',
      dayRateUsd: hireable ? user.contributorProfile.dayRateUsd : null,
      represented: user.representation?.status === 'represented',
      photosCount,
      downloads,
      followers: user._count.followers,
      profileViews: user.contributorProfile.profileViews,
      modelHandle: user.modelProfile?.handle ?? null,
    }
    return [row]
  })
  return config?.randomize ? shuffle(ordered) : ordered
}

async function loadCategoryBanners(): Promise<HomeCategoryBannerDto[]> {
  const rows = await prisma.homeFeaturedPin.findMany({
    where: { slot: 'categories' },
    orderBy: { position: 'asc' },
  })
  const configured = rows.filter((row) => row.category)
  if (configured.length === 0) {
    const photos = await prisma.photo.findMany({
      where: LIVE,
      include: catalogPhotoInclude,
      orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
      take: 80,
    })
    const seen = new Set<string>()
    const banners: HomeCategoryBannerDto[] = []
    for (const photo of photos) {
      if (!photo.category || seen.has(photo.category)) continue
      seen.add(photo.category)
      banners.push({ category: photo.category, photo: serializeCatalogPhoto(photo) })
      if (banners.length >= HOME_CATEGORY_BANNER_CAPACITY) break
    }
    return banners
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
      photo = await prisma.photo.findFirst({
        where: { ...LIVE, category: row.category, id: { notIn: [...used] } },
        include: catalogPhotoInclude,
        orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
      }) ?? undefined
    }
    if (!photo) continue
    used.add(photo.id)
    banners.push({ category: row.category, photo: serializeCatalogPhoto(photo) })
  }
  return banners
}
