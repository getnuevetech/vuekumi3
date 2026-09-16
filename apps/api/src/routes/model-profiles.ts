import type { FastifyInstance } from 'fastify'
import { modelListQuerySchema, photoListQuerySchema } from '@vuekumi/shared'
import type { ModelPublicDto } from '@vuekumi/shared'
import { optionalAuthenticate } from '../lib/auth-middleware.js'
import {
  approvedLikenessWhere,
  catalogPhotoInclude,
  favoriteIdSet,
  modelPortfolioPhotoWhere,
  normalizeQuery,
  photoOrderBy,
  PROFILE_PHOTO_FILTER,
  serializeCatalogPhoto,
} from '../lib/catalog.js'
import { prisma } from '../lib/prisma.js'

function toPublicModel(
  user: {
    name: string
    avatarUrl: string | null
    modelProfile: {
      handle: string
      location: string | null
      bio: string | null
      availability: 'open' | 'limited' | 'unavailable'
      dayRateUsd: number | null
      profileViews?: number
    } | null
    contributorProfile?: { handle: string } | null
  },
  photosCount: number,
  extras?: { profileViews?: number },
): ModelPublicDto | null {
  if (!user.modelProfile) return null
  return {
    handle: user.modelProfile.handle,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.modelProfile.location,
    bio: user.modelProfile.bio,
    availability: user.modelProfile.availability,
    dayRateUsd: user.modelProfile.dayRateUsd,
    photosCount,
    photographerHandle: user.contributorProfile?.handle ?? null,
    earns: false,
    profileViews: extras?.profileViews ?? user.modelProfile.profileViews,
  }
}

export async function modelProfileRoutes(app: FastifyInstance) {
  app.get('/models', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request) => {
    const query = modelListQuerySchema.parse(request.query)
    const q = normalizeQuery(query.q)
    const visibleAppearance = {
      status: 'approved' as const,
      confirmedLikeness: true,
      photo: PROFILE_PHOTO_FILTER,
    }

    const where = {
      status: 'active' as const,
      modelProfile: { isNot: null },
      modelAppearances: { some: visibleAppearance },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { modelProfile: { handle: { contains: q, mode: 'insensitive' as const } } },
              { modelProfile: { location: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        modelProfile: true,
        contributorProfile: { select: { handle: true } },
        modelAppearances: {
          where: visibleAppearance,
          select: { photoId: true },
        },
      },
    })

    const items = users
      .map((user) => {
        const photosCount = new Set(user.modelAppearances.map((row) => row.photoId)).size
        return toPublicModel(user, photosCount)
      })
      .filter((row): row is ModelPublicDto => Boolean(row))
      .sort((a, b) => b.photosCount - a.photosCount || a.name.localeCompare(b.name))

    const start = (query.page - 1) * query.limit
    const pageItems = items.slice(start, start + query.limit)

    return {
      items: pageItems,
      page: query.page,
      limit: query.limit,
      total: items.length,
      hasMore: start + query.limit < items.length,
    }
  })

  app.get('/models/:handle', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const query = photoListQuerySchema.parse(request.query)
    const profile = await prisma.modelProfile.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      include: {
        user: { include: { contributorProfile: { select: { handle: true } } } },
      },
    })

    if (!profile || profile.user.status !== 'active') {
      return reply.code(404).send({ error: 'Model not found' })
    }

    const photoWhere = modelPortfolioPhotoWhere(
      profile.userId,
      query.category && query.category !== 'All' ? query.category : undefined,
    )

    const countOwnView = query.page === 1 && request.userId !== profile.userId
    if (countOwnView) {
      const updated = await prisma.modelProfile.update({
        where: { id: profile.id },
        data: { profileViews: { increment: 1 } },
        select: { profileViews: true },
      })
      profile.profileViews = updated.profileViews
    }

    const skip = (query.page - 1) * query.limit
    const [total, photoIds] = await Promise.all([
      prisma.photo.count({ where: photoWhere }),
      query.sort === 'newest'
        ? prisma.photoAppearance.findMany({
            where: {
              ...approvedLikenessWhere(profile.userId),
              photo: {
                ...PROFILE_PHOTO_FILTER,
                ...(query.category && query.category !== 'All' ? { category: query.category } : {}),
              },
            },
            orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
            select: { photoId: true },
          }).then((rows) => {
            const unique = [...new Set(rows.map((row) => row.photoId))]
            return unique.slice(skip, skip + query.limit)
          })
        : prisma.photo.findMany({
            where: photoWhere,
            orderBy: photoOrderBy(query.sort),
            skip,
            take: query.limit,
            select: { id: true },
          }).then((rows) => rows.map((row) => row.id)),
    ])

    const photos = photoIds.length
      ? await prisma.photo.findMany({
          where: { id: { in: photoIds } },
          include: catalogPhotoInclude,
        })
      : []
    const byId = new Map(photos.map((photo) => [photo.id, photo]))
    const ordered = photoIds.map((id) => byId.get(id)).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))

    const model = toPublicModel(
      { ...profile.user, modelProfile: profile },
      total,
      { profileViews: profile.profileViews },
    )
    if (!model) {
      return reply.code(404).send({ error: 'Model not found' })
    }

    const favorited = await favoriteIdSet(request.userId, ordered.map((p) => p.id))

    return {
      model,
      items: ordered.map((p) => serializeCatalogPhoto(p, request.userId ? favorited.has(p.id) : undefined)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })
}
