import type { ProfileCollectionSummaryDto } from '@vuekumi/shared'
import { PROFILE_PHOTO_FILTER } from './catalog.js'
import { coverSrc } from './collections.js'
import { prisma } from './prisma.js'

const COLLECTION_LIMIT = 6

const collectionSummaryInclude = {
  photos: {
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    select: {
      photo: {
        select: { id: true, src: true, storageKey: true, processingStatus: true },
      },
    },
  },
  _count: { select: { photos: true } },
} as const

function toSummary(row: {
  id: string
  name: string
  description: string | null
  photos: { photo: { id: string; src: string; storageKey: string | null; processingStatus: string } }[]
  _count: { photos: number }
}): ProfileCollectionSummaryDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photoCount: row._count.photos,
    coverSrc: coverSrc(row.photos[0]?.photo),
  }
}

/** Public collections that include a contributor's profile-visible photographs. */
export async function photographerPublicCollections(
  contributorUserId: string,
  limit = COLLECTION_LIMIT,
): Promise<ProfileCollectionSummaryDto[]> {
  const rows = await prisma.collection.findMany({
    where: {
      visibility: 'public',
      photos: {
        some: {
          photo: {
            contributorId: contributorUserId,
            ...PROFILE_PHOTO_FILTER,
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: limit,
    include: collectionSummaryInclude,
  })
  return rows.map(toSummary)
}

/** Public collections that include a model's approved, profile-visible appearances. */
export async function modelPublicCollections(
  modelUserId: string,
  limit = COLLECTION_LIMIT,
): Promise<ProfileCollectionSummaryDto[]> {
  const rows = await prisma.collection.findMany({
    where: {
      visibility: 'public',
      photos: {
        some: {
          photo: {
            ...PROFILE_PHOTO_FILTER,
            appearances: {
              some: {
                modelUserId,
                status: 'approved',
                confirmedLikeness: true,
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: limit,
    include: collectionSummaryInclude,
  })
  return rows.map(toSummary)
}
