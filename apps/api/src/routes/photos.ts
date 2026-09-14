import type { FastifyInstance } from 'fastify'
import { photoListQuerySchema } from '@vuekumi/shared'
import { authenticate, optionalAuthenticate } from '../lib/auth-middleware.js'
import {
  buildPhotoWhere,
  catalogPhotoInclude,
  favoriteIdSet,
  loadCatalogFacets,
  photoOrderBy,
  relatedPhotoWhere,
  serializeCatalogPhoto,
  wantsFacets,
} from '../lib/catalog.js'
import { prisma } from '../lib/prisma.js'

export async function photoRoutes(app: FastifyInstance) {
  app.get('/photos', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request) => {
    const query = photoListQuerySchema.parse(request.query)
    const where = buildPhotoWhere(query)

    const [total, photos, facets] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: catalogPhotoInclude,
        orderBy: photoOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      wantsFacets(query.facets) ? loadCatalogFacets(where) : Promise.resolve(undefined),
    ])

    const favorited = await favoriteIdSet(request.userId, photos.map((p) => p.id))

    return {
      items: photos.map((p) => serializeCatalogPhoto(p, request.userId ? favorited.has(p.id) : undefined)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
      ...(facets ? { facets } : {}),
    }
  })

  app.get('/favorites', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const query = photoListQuerySchema.parse(request.query)
    const where = { userId: request.userId!, photo: { status: 'active' as const } }

    const [total, rows] = await Promise.all([
      prisma.photoFavorite.count({ where }),
      prisma.photoFavorite.findMany({
        where,
        include: { photo: { include: catalogPhotoInclude } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])

    return {
      items: rows.map((row) => serializeCatalogPhoto(row.photo, true)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })

  app.get('/photos/:id/related', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { id: true, category: true, country: true, status: true },
    })
    if (!photo || photo.status !== 'active') {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    const related = await prisma.photo.findMany({
      where: relatedPhotoWhere(photo),
      include: catalogPhotoInclude,
      orderBy: [{ downloads: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    })
    const favorited = await favoriteIdSet(request.userId, related.map((p) => p.id))

    return {
      items: related.map((p) => serializeCatalogPhoto(p, request.userId ? favorited.has(p.id) : undefined)),
    }
  })

  app.post('/photos/:id/favorite', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!photo || photo.status !== 'active') {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.photoFavorite.findUnique({
        where: { userId_photoId: { userId: request.userId!, photoId: id } },
      })
      if (existing) {
        await tx.photoFavorite.delete({ where: { id: existing.id } })
        const updated = await tx.photo.update({
          where: { id },
          data: { likes: { decrement: 1 } },
          select: { likes: true },
        })
        const likes = Math.max(0, updated.likes)
        if (updated.likes < 0) {
          await tx.photo.update({ where: { id }, data: { likes: 0 } })
        }
        return { favorited: false, likes }
      }

      await tx.photoFavorite.create({ data: { userId: request.userId!, photoId: id } })
      const updated = await tx.photo.update({
        where: { id },
        data: { likes: { increment: 1 } },
        select: { likes: true },
      })
      return { favorited: true, likes: updated.likes }
    })

    return result
  })

  app.get('/photos/:id', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: catalogPhotoInclude,
    })

    if (!photo || (photo.status !== 'active' && photo.status !== 'pending')) {
      return reply.code(404).send({ error: 'Photo not found' })
    }

    await prisma.photo.update({
      where: { id },
      data: { views: { increment: 1 } },
    })

    const favorited = request.userId
      ? Boolean(await prisma.photoFavorite.findUnique({
          where: { userId_photoId: { userId: request.userId, photoId: id } },
        }))
      : undefined

    const dto = serializeCatalogPhoto(photo, favorited)
    dto.views += 1
    return dto
  })
}
