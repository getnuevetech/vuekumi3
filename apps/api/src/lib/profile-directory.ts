import type { ProfilePortfolioThumbDto } from '@vuekumi/shared'
import { PROFILE_PHOTO_FILTER, modelPortfolioPhotoWhere } from './catalog.js'
import { prisma } from './prisma.js'

const STRIP_LIMIT = 4
const SPECIALTY_LIMIT = 3

function topSpecialties(categories: string[], limit = SPECIALTY_LIMIT): string[] {
  const counts = new Map<string, number>()
  for (const category of categories) {
    if (!category) continue
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([category]) => category)
}

export async function photographerDirectoryExtras(contributorUserIds: string[]): Promise<
  Map<string, { specialties: string[]; portfolioStrip: ProfilePortfolioThumbDto[]; coverPhotoUrl: string | null }>
> {
  const result = new Map<string, { specialties: string[]; portfolioStrip: ProfilePortfolioThumbDto[]; coverPhotoUrl: string | null }>()
  if (contributorUserIds.length === 0) return result

  const photos = await prisma.photo.findMany({
    where: {
      contributorId: { in: contributorUserIds },
      ...PROFILE_PHOTO_FILTER,
    },
    orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, src: true, title: true, category: true, contributorId: true },
  })

  const byUser = new Map<string, typeof photos>()
  for (const photo of photos) {
    const list = byUser.get(photo.contributorId) ?? []
    list.push(photo)
    byUser.set(photo.contributorId, list)
  }

  for (const userId of contributorUserIds) {
    const list = byUser.get(userId) ?? []
    result.set(userId, {
      specialties: topSpecialties(list.map((photo) => photo.category)),
      portfolioStrip: list.slice(0, STRIP_LIMIT).map((photo) => ({
        id: photo.id,
        src: photo.src,
        title: photo.title,
      })),
      coverPhotoUrl: list[0]?.src ?? null,
    })
  }
  return result
}

export async function modelDirectoryExtras(modelUserIds: string[]): Promise<
  Map<string, { specialties: string[]; portfolioStrip: ProfilePortfolioThumbDto[]; coverPhotoUrl: string | null }>
> {
  const result = new Map<string, { specialties: string[]; portfolioStrip: ProfilePortfolioThumbDto[]; coverPhotoUrl: string | null }>()
  if (modelUserIds.length === 0) return result

  await Promise.all(modelUserIds.map(async (userId) => {
    const photos = await prisma.photo.findMany({
      where: modelPortfolioPhotoWhere(userId),
      orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      select: { id: true, src: true, title: true, category: true },
    })
    result.set(userId, {
      specialties: topSpecialties(photos.map((photo) => photo.category)),
      portfolioStrip: photos.slice(0, STRIP_LIMIT).map((photo) => ({
        id: photo.id,
        src: photo.src,
        title: photo.title,
      })),
      coverPhotoUrl: photos[0]?.src ?? null,
    })
  }))

  return result
}
