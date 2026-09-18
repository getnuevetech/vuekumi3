import {
  HOME_FEATURED_CAPACITY,
  HOME_FEATURED_SLOT_KEYS,
  HOME_FEATURED_SLOT_LABEL,
  featuredPinIneligibleReason,
  normalizeHomePins,
  type HomeFeaturedAdminDto,
  type HomeFeaturedPositionDto,
  type HomeFeaturedSlotKey,
  type HomeSlotPins,
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

export async function replaceHomePins(pins: HomeSlotPins) {
  const current = normalizeHomePins(await loadHomePins())
  const normalized = normalizeHomePins({ ...current, ...pins })
  const wanted = HOME_FEATURED_SLOT_KEYS.flatMap((slot) =>
    normalized[slot]
      .map((photoId, position) => (photoId ? { slot, position, photoId } : null))
      .filter((row): row is { slot: HomeFeaturedSlotKey; position: number; photoId: string } => Boolean(row)),
  )
  const uniqueIds = [...new Set(wanted.map((row) => row.photoId))]
  const photos = uniqueIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, status: true, permissionState: true },
      })
    : []
  const byPhoto = new Map(photos.map((row) => [row.id, row]))
  for (const row of wanted) {
    const block = homeFeaturedBlocked(byPhoto.get(row.photoId) ?? null)
    if (block) {
      const err = new Error(block) as Error & { statusCode?: number }
      err.statusCode = 400
      throw err
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.homeFeaturedPin.deleteMany()
    if (wanted.length) {
      await tx.homeFeaturedPin.createMany({
        data: wanted.map((row) => ({ slot: row.slot, position: row.position, photoId: row.photoId })),
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

  return {
    capacities: HOME_FEATURED_CAPACITY,
    labels: HOME_FEATURED_SLOT_LABEL,
    pins,
    slots,
  }
}
