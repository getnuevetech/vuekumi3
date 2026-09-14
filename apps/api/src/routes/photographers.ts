import type { FastifyInstance } from 'fastify'
import { photographerListQuerySchema, photoListQuerySchema } from '@vuekumi/shared'
import type { PhotographerDto } from '@vuekumi/shared'
import { optionalAuthenticate } from '../lib/auth-middleware.js'
import {
  buildPhotoWhere,
  catalogPhotoInclude,
  favoriteIdSet,
  normalizeQuery,
  photoOrderBy,
  serializeCatalogPhoto,
} from '../lib/catalog.js'
import { prisma } from '../lib/prisma.js'

function toPhotographer(
  user: {
    name: string
    avatarUrl: string | null
    contributorProfile: { handle: string; location: string | null; bio: string | null } | null
  },
  photosCount: number,
  downloads: number,
): PhotographerDto | null {
  if (!user.contributorProfile) return null
  return {
    handle: user.contributorProfile.handle,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.contributorProfile.location,
    bio: user.contributorProfile.bio,
    photosCount,
    downloads,
  }
}

export async function photographerRoutes(app: FastifyInstance) {
  app.get('/photographers', async (request) => {
    const query = photographerListQuerySchema.parse(request.query)
    const q = normalizeQuery(query.q)

    const where = {
      accountType: 'contributor' as const,
      status: 'active' as const,
      photos: { some: { status: 'active' as const } },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { contributorProfile: { handle: { contains: q, mode: 'insensitive' as const } } },
              { contributorProfile: { location: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        contributorProfile: true,
        photos: { where: { status: 'active' }, select: { downloads: true } },
      },
    })

    const items = users
      .map((user) => {
        const photosCount = user.photos.length
        const downloads = user.photos.reduce((sum, p) => sum + p.downloads, 0)
        return toPhotographer(user, photosCount, downloads)
      })
      .filter((row): row is PhotographerDto => Boolean(row))
      .sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))

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

  app.get('/photographers/:handle', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const query = photoListQuerySchema.parse(request.query)
    const profile = await prisma.contributorProfile.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      include: { user: true },
    })

    if (!profile || profile.user.accountType !== 'contributor' || profile.user.status !== 'active') {
      return reply.code(404).send({ error: 'Photographer not found' })
    }

    const photoQuery = { ...query, photographer: profile.handle }
    const where = buildPhotoWhere(photoQuery)

    const [total, photos, live] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: catalogPhotoInclude,
        orderBy: photoOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.photo.aggregate({
        where: { contributorId: profile.userId, status: 'active' },
        _count: { _all: true },
        _sum: { downloads: true },
      }),
    ])

    const photographer = toPhotographer(
      { ...profile.user, contributorProfile: profile },
      live._count._all,
      live._sum.downloads ?? 0,
    )
    if (!photographer) {
      return reply.code(404).send({ error: 'Photographer not found' })
    }

    const favorited = await favoriteIdSet(request.userId, photos.map((p) => p.id))

    return {
      photographer,
      items: photos.map((p) => serializeCatalogPhoto(p, request.userId ? favorited.has(p.id) : undefined)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })
}
