import {
  HOME_CATEGORY_BANNER_CAPACITY,
  HOME_FEATURED_CAPACITY,
  HOME_FEATURED_SLOT_KEYS,
  HOME_FEATURED_SLOT_LABEL,
  PHOTO_CATEGORIES,
  featuredPinIneligibleReason,
  normalizeCategoryBanners,
  normalizeFeaturedFrame,
  normalizeHomePins,
  type HomeEditorialMode,
  type HomeFeaturedAdminDto,
  type HomeFeaturedPositionDto,
  type HomeFeaturedSlotKey,
  type HomeSlotPins,
  type PatchHomeFeaturedInput,
} from '@vuekumi/shared'
import { assignHomeSlots } from './home.js'
import { catalogPhotoInclude, serializeCatalogPhoto, type CatalogPhoto } from './catalog.js'
import { loadHomePins } from './home-queries.js'
import { prisma } from './prisma.js'
import { STOCK_PERMISSION_STATES } from '@vuekumi/shared'

const LIVE = { status: 'active' as const, permissionState: { in: [...STOCK_PERMISSION_STATES] } }

export function homeFeaturedBlocked(photo: { status: string; permissionState: string } | null): string | null {
  if (!photo) return 'Photograph not found'
  return featuredPinIneligibleReason(photo)
}

const CATEGORY_SLOT = 'categories'

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = statusCode
  return err
}

function assertKnownCategory(category: string | null | undefined, label: string) {
  if (!category) return
  if (!PHOTO_CATEGORIES.includes(category as (typeof PHOTO_CATEGORIES)[number])) {
    throw httpError(`Choose a category from the list for ${label}.`)
  }
}

export async function replaceHomePins(input: HomeSlotPins | PatchHomeFeaturedInput) {
  const pins: HomeSlotPins = 'pins' in input ? input.pins : input
  const categoryBanners = 'pins' in input ? input.categoryBanners : undefined
  const editorial = 'pins' in input ? input.editorial : undefined
  const frame = 'pins' in input ? input.frame : undefined
  const current = normalizeHomePins(await loadHomePins())
  const normalized = normalizeHomePins({ ...current, ...pins })
  const wanted = HOME_FEATURED_SLOT_KEYS.flatMap((slot) =>
    normalized[slot]
      .map((photoId, position) => (photoId ? { slot, position, photoId } : null))
      .filter((row): row is { slot: HomeFeaturedSlotKey; position: number; photoId: string } => Boolean(row)),
  )
  const banners = categoryBanners ? normalizeCategoryBanners(categoryBanners) : null
  const bannerPhotoIds = (banners ?? []).map((row) => row.photoId).filter((id): id is string => Boolean(id))
  for (const row of banners ?? []) {
    assertKnownCategory(row.category, 'this category banner')
    if (row.photoId && !row.category) throw httpError('Choose a category for each category banner.')
  }
  if (editorial?.mode === 'category' && !editorial.category) {
    throw httpError('Choose a category for the editorial slides.')
  }
  assertKnownCategory(editorial?.category, 'the editorial split')

  const uniqueIds = [...new Set([...wanted.map((row) => row.photoId), ...bannerPhotoIds])]
  const photos = uniqueIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, status: true, permissionState: true },
      })
    : []
  const byPhoto = new Map(photos.map((row) => [row.id, row]))
  for (const row of wanted) {
    const block = homeFeaturedBlocked(byPhoto.get(row.photoId) ?? null)
    if (block) throw httpError(block)
  }
  for (const photoId of bannerPhotoIds) {
    const block = homeFeaturedBlocked(byPhoto.get(photoId) ?? null)
    if (block) throw httpError(block)
  }

  await prisma.$transaction(async (tx) => {
    await tx.homeFeaturedPin.deleteMany({ where: { slot: { in: [...HOME_FEATURED_SLOT_KEYS] } } })
    if (wanted.length) {
      await tx.homeFeaturedPin.createMany({
        data: wanted.map((row) => ({ slot: row.slot, position: row.position, photoId: row.photoId })),
      })
    }
    if (banners) {
      await tx.homeFeaturedPin.deleteMany({ where: { slot: CATEGORY_SLOT } })
      const rows = banners.flatMap((row, position) =>
        row.photoId || row.category ? [{ slot: CATEGORY_SLOT, position, photoId: row.photoId, category: row.category }] : [],
      )
      if (rows.length) await tx.homeFeaturedPin.createMany({ data: rows })
    }
    if (editorial) {
      await tx.homeSectionConfig.upsert({
        where: { slot: 'editorial' },
        create: {
          slot: 'editorial',
          mode: editorial.mode,
          category: editorial.category ?? null,
        },
        update: {
          mode: editorial.mode,
          category: editorial.category ?? null,
        },
      })
    }
    if (frame) {
      const size = normalizeFeaturedFrame(frame)
      await tx.homeSectionConfig.upsert({
        where: { slot: 'edge' },
        create: { slot: 'edge', mode: 'pins', widthVw: size.widthVw, heightVw: size.heightVw },
        update: { widthVw: size.widthVw, heightVw: size.heightVw },
      })
    }
  })
  return loadHomeFeaturedAdmin()
}

export async function loadHomeFeaturedAdmin(): Promise<HomeFeaturedAdminDto> {
  const pins = normalizeHomePins(await loadHomePins())
  const pinIds = HOME_FEATURED_SLOT_KEYS.flatMap((slot) => pins[slot].filter((id): id is string => Boolean(id)))

  const [byDownloads, byNewest, byLikes, pinPhotos] = await Promise.all([
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
    pinIds.length
      ? prisma.photo.findMany({
          where: { id: { in: pinIds } },
          include: catalogPhotoInclude,
        })
      : Promise.resolve([] as CatalogPhoto[]),
  ])

  const lookup = new Map<string, CatalogPhoto>()
  for (const photo of [...byDownloads, ...byNewest, ...byLikes, ...pinPhotos]) lookup.set(photo.id, photo)
  const liveIds = new Set(
    [...lookup.values()].filter((photo) => !homeFeaturedBlocked(photo)).map((photo) => photo.id),
  )
  const assigned = assignHomeSlots({
    byDownloads: byDownloads.map((p) => ({ id: p.id, category: p.category })),
    byNewest: byNewest.map((p) => ({ id: p.id, category: p.category })),
    byLikes: byLikes.map((p) => ({ id: p.id, category: p.category })),
    pins,
    liveIds,
  })
  const resolved: Record<HomeFeaturedSlotKey, string[]> = {
    hero: assigned.hero,
    edge: assigned.edge,
    editorial: assigned.editorial,
    pricing: assigned.pricing,
    stats_background: assigned.statsBackground ? [assigned.statsBackground] : [],
  }

  const slots = {} as HomeFeaturedAdminDto['slots']
  for (const slot of HOME_FEATURED_SLOT_KEYS) {
    const cap = HOME_FEATURED_CAPACITY[slot]
    const positions: HomeFeaturedPositionDto[] = []
    for (let i = 0; i < cap; i++) {
      const pinnedId = pins[slot][i]
      const resolvedId = resolved[slot][i] ?? null
      const photoId = pinnedId ?? resolvedId
      const photo = photoId ? lookup.get(photoId) : undefined
      const ineligibleReason = pinnedId ? homeFeaturedBlocked(photo ?? null) : null
      const source = pinnedId && resolvedId === pinnedId ? 'pinned' : 'auto'
      positions.push({
        position: i,
        photoId: photoId ?? null,
        photo: photo ? serializeCatalogPhoto(photo) : null,
        source,
        eligible: !ineligibleReason,
        ineligibleReason,
      })
    }
    slots[slot] = positions
  }

  const [bannerRows, editorialConfig, frameConfig] = await Promise.all([
    prisma.homeFeaturedPin.findMany({ where: { slot: CATEGORY_SLOT }, orderBy: { position: 'asc' } }),
    prisma.homeSectionConfig.findUnique({ where: { slot: 'editorial' } }),
    prisma.homeSectionConfig.findUnique({ where: { slot: 'edge' } }),
  ])
  const bannerPins = normalizeCategoryBanners(
    Array.from({ length: HOME_CATEGORY_BANNER_CAPACITY }, (_, position) => {
      const row = bannerRows.find((item) => item.position === position)
      return { photoId: row?.photoId ?? null, category: row?.category ?? null }
    }),
  )
  const bannerPhotoIds = bannerPins.map((row) => row.photoId).filter((id): id is string => Boolean(id))
  const missingBannerIds = bannerPhotoIds.filter((id) => !lookup.has(id))
  if (missingBannerIds.length) {
    const extra = await prisma.photo.findMany({ where: { id: { in: missingBannerIds } }, include: catalogPhotoInclude })
    for (const photo of extra) lookup.set(photo.id, photo)
  }
  const categoryBanners = [] as HomeFeaturedAdminDto['categoryBanners']
  for (let i = 0; i < HOME_CATEGORY_BANNER_CAPACITY; i++) {
    const pin = bannerPins[i]!
    let photo = pin.photoId ? lookup.get(pin.photoId) : undefined
    let source: 'pinned' | 'auto' = pin.photoId ? 'pinned' : 'auto'
    if (!photo && pin.category) {
      photo = await prisma.photo.findFirst({
        where: { ...LIVE, category: pin.category },
        include: catalogPhotoInclude,
        orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
      }) ?? undefined
      source = 'auto'
    }
    categoryBanners.push({
      position: i,
      photoId: pin.photoId,
      category: pin.category,
      photo: photo ? serializeCatalogPhoto(photo) : null,
      source: pin.photoId || pin.category ? source : 'auto',
    })
  }

  const editorialMode: HomeEditorialMode = editorialConfig?.mode === 'category' ? 'category' : 'pins'

  return {
    capacities: HOME_FEATURED_CAPACITY,
    labels: HOME_FEATURED_SLOT_LABEL,
    categoryBannerCapacity: HOME_CATEGORY_BANNER_CAPACITY,
    pins,
    slots,
    categoryBanners,
    editorialMode,
    editorialCategory: editorialConfig?.category ?? null,
    frame: normalizeFeaturedFrame(frameConfig),
  }
}
