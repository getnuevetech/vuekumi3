import type { Prisma } from '@prisma/client'
import type { CatalogFacets, PhotoListQuery } from '@vuekumi/shared'
import { PROFILE_PERMISSION_STATES, STOCK_PERMISSION_STATES } from '@vuekumi/shared'
import { prisma } from './prisma.js'
import { serializePhoto } from './serialize.js'
import { publicAppearances } from './models.js'

export const catalogPhotoInclude = {
  tags: true,
  rightsRecord: true,
  appearances: {
    include: {
      modelUser: { include: { modelProfile: { select: { handle: true } } } },
    },
  },
  contributor: { include: { contributorProfile: true, platformAgreements: true } },
} as const

export type CatalogPhoto = Prisma.PhotoGetPayload<{ include: typeof catalogPhotoInclude }>

export const STOCK_PHOTO_FILTER = {
  status: 'active' as const,
  permissionState: { in: [...STOCK_PERMISSION_STATES] },
}

export const PROFILE_PHOTO_FILTER = {
  status: 'active' as const,
  permissionState: { in: [...PROFILE_PERMISSION_STATES] },
}

const QUERY_MAX = 120

export function normalizeQuery(q?: string): string | undefined {
  const trimmed = q?.trim().replace(/\s+/g, ' ')
  if (!trimmed) return undefined
  return trimmed.slice(0, QUERY_MAX)
}

export function wantsFacets(facets?: '0' | '1'): boolean {
  return facets !== '0'
}

export function photoOrderBy(sort?: PhotoListQuery['sort']): Prisma.PhotoOrderByWithRelationInput[] {
  switch (sort) {
    case 'downloads':
      return [{ downloads: 'desc' }, { createdAt: 'desc' }]
    case 'views':
      return [{ views: 'desc' }, { createdAt: 'desc' }]
    case 'likes':
      return [{ likes: 'desc' }, { createdAt: 'desc' }]
    default:
      return [{ createdAt: 'desc' }]
  }
}

export function buildPhotoWhere(query: PhotoListQuery): Prisma.PhotoWhereInput {
  const q = normalizeQuery(query.q)
  const tag = normalizeQuery(query.tag)
  const photographer = normalizeQuery(query.photographer)
  const where: Prisma.PhotoWhereInput = { ...STOCK_PHOTO_FILTER }

  if (query.category && query.category !== 'All') {
    where.category = query.category
  }
  if (query.country) where.country = query.country
  if (query.license) where.licenseType = query.license
  if (tag) {
    where.tags = { some: { tag: { equals: tag, mode: 'insensitive' } } }
  }
  if (photographer) {
    where.contributor = {
      contributorProfile: { handle: { equals: photographer, mode: 'insensitive' } },
    }
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { country: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { tags: { some: { tag: { contains: q, mode: 'insensitive' } } } },
      { contributor: { name: { contains: q, mode: 'insensitive' } } },
      { contributor: { contributorProfile: { handle: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  return where
}

export function relatedPhotoWhere(photo: {
  id: string
  category: string
  country: string
}): Prisma.PhotoWhereInput {
  return {
    ...STOCK_PHOTO_FILTER,
    id: { not: photo.id },
    OR: [{ category: photo.category }, { country: photo.country }],
  }
}

export function profilePhotoWhere(contributorId: string): Prisma.PhotoWhereInput {
  return {
    ...PROFILE_PHOTO_FILTER,
    contributorId,
  }
}

export function approvedLikenessWhere(modelUserId: string): Prisma.PhotoAppearanceWhereInput {
  return {
    modelUserId,
    status: 'approved',
    confirmedLikeness: true,
  }
}

export function modelPortfolioPhotoWhere(modelUserId: string, category?: string): Prisma.PhotoWhereInput {
  return {
    ...PROFILE_PHOTO_FILTER,
    OR: [
      { appearances: { some: approvedLikenessWhere(modelUserId) } },
      { uploadedById: modelUserId, uploadedBy: { accountType: 'model' } },
    ],
    ...(category && category !== 'All' ? { category } : {}),
  }
}

export function facetWhere(
  where: Prisma.PhotoWhereInput,
  omit: 'category' | 'country' | 'licenseType' | 'tags',
): Prisma.PhotoWhereInput {
  const next: Prisma.PhotoWhereInput = { ...where }
  if (omit === 'category') delete next.category
  if (omit === 'country') delete next.country
  if (omit === 'licenseType') delete next.licenseType
  if (omit === 'tags') delete next.tags
  return next
}

export function serializeCatalogPhoto(photo: CatalogPhoto, favorited?: boolean) {
  return serializePhoto(
    photo,
    photo.contributor.contributorProfile?.handle ?? photo.contributorId,
    photo.contributor.platformAgreements.some((a) => a.status === 'accepted'),
    { favorited, appearances: publicAppearances(photo.appearances) },
  )
}

export async function favoriteIdSet(userId: string | undefined, photoIds: string[]) {
  if (!userId || photoIds.length === 0) return new Set<string>()
  const rows = await prisma.photoFavorite.findMany({
    where: { userId, photoId: { in: photoIds } },
    select: { photoId: true },
  })
  return new Set(rows.map((row) => row.photoId))
}

function toFacets(
  rows: { value: string; count: number }[],
): { value: string; count: number }[] {
  return rows.filter((row) => row.value).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export async function loadCatalogFacets(where: Prisma.PhotoWhereInput): Promise<CatalogFacets> {
  const [categories, countries, licenses, tags] = await Promise.all([
    prisma.photo.groupBy({
      by: ['category'],
      where: facetWhere(where, 'category'),
      _count: { _all: true },
    }),
    prisma.photo.groupBy({
      by: ['country'],
      where: facetWhere(where, 'country'),
      _count: { _all: true },
    }),
    prisma.photo.groupBy({
      by: ['licenseType'],
      where: facetWhere(where, 'licenseType'),
      _count: { _all: true },
    }),
    prisma.photoTag.groupBy({
      by: ['tag'],
      where: { photo: facetWhere(where, 'tags') },
      _count: { _all: true },
      orderBy: { _count: { tag: 'desc' } },
      take: 24,
    }),
  ])

  return {
    categories: toFacets(categories.map((row) => ({ value: row.category, count: row._count._all }))),
    countries: toFacets(countries.map((row) => ({ value: row.country, count: row._count._all }))),
    licenses: toFacets(licenses.map((row) => ({ value: row.licenseType, count: row._count._all }))),
    tags: toFacets(tags.map((row) => ({ value: row.tag, count: row._count._all }))),
  }
}
