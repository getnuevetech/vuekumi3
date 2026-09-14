import type { FastifyInstance } from 'fastify'
import {
  addCollectionPhotoSchema,
  createCollectionSchema,
  photoListQuerySchema,
  updateCollectionSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { authenticate, optionalAuthenticate } from '../lib/auth-middleware.js'
import { catalogPhotoInclude, favoriteIdSet, serializeCatalogPhoto } from '../lib/catalog.js'
import {
  canEditCollection,
  canViewCollection,
  CollectionError,
  MAX_COLLECTION_PHOTOS,
  MAX_COLLECTIONS,
  newShareToken,
  serializeCollection,
} from '../lib/collections.js'
import { prisma } from '../lib/prisma.js'

const listInclude = {
  owner: { select: { name: true } },
  agency: { select: { name: true } },
  photos: {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    include: { photo: { select: { id: true, src: true, storageKey: true, processingStatus: true } } },
  },
  _count: { select: { photos: true } },
}

function viewerOf(request: { userId?: string; authUser?: { agencyId?: string | null; agencyRole?: string | null } }) {
  if (!request.userId) return null
  return {
    id: request.userId,
    agencyId: request.authUser?.agencyId ?? null,
    agencyRole: request.authUser?.agencyRole ?? null,
  }
}

function collError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof CollectionError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

export async function collectionRoutes(app: FastifyInstance) {
  app.get('/collections', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const viewer = viewerOf(request)!
    const rows = await prisma.collection.findMany({
      where: {
        OR: [
          { ownerId: viewer.id },
          ...(viewer.agencyId ? [{ agencyId: viewer.agencyId }] : []),
        ],
      },
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
    })
    return { items: rows.map((row) => serializeCollection(row, viewer)) }
  })

  app.post('/collections', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    try {
      const body = createCollectionSchema.parse(request.body)
      const viewer = viewerOf(request)!
      const count = await prisma.collection.count({
        where: { ownerId: viewer.id },
      })
      if (count >= MAX_COLLECTIONS) {
        throw new CollectionError(`You can keep up to ${MAX_COLLECTIONS} collections`)
      }
      const shareWithAgency = Boolean(body.shared && viewer.agencyId)
      if (body.shared && !viewer.agencyId) {
        throw new CollectionError('Join an agency to share a lightbox with a team', 403)
      }
      if (shareWithAgency && (viewer.agencyRole === 'viewer' || !viewer.agencyRole)) {
        throw new CollectionError('Your agency role cannot share lightboxes', 403)
      }
      const created = await prisma.collection.create({
        data: {
          ownerId: viewer.id,
          agencyId: shareWithAgency ? viewer.agencyId : null,
          name: body.name,
          description: body.description,
          visibility: body.visibility,
          shareToken: newShareToken(),
        },
        include: listInclude,
      })
      await writeAuditLog({
        actorId: viewer.id,
        action: 'collection.create',
        entityType: 'collection',
        entityId: created.id,
        metadata: { name: created.name, shared: shareWithAgency },
      })
      return { collection: serializeCollection(created, viewer) }
    } catch (err) {
      return collError(reply, err)
    }
  })

  app.get('/collections/:id', {
    preHandler: (request, reply) => optionalAuthenticate(app, request, reply),
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = photoListQuerySchema.parse(request.query)
    const token = typeof (request.query as { token?: string }).token === 'string'
      ? (request.query as { token?: string }).token
      : undefined
    const viewer = viewerOf(request)
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: listInclude,
    })
    if (!collection || !canViewCollection(collection, viewer, token)) {
      return reply.code(404).send({ error: 'Collection not found' })
    }

    const [total, rows] = await Promise.all([
      prisma.collectionPhoto.count({
        where: { collectionId: id, photo: { status: 'active' } },
      }),
      prisma.collectionPhoto.findMany({
        where: { collectionId: id, photo: { status: 'active' } },
        include: { photo: { include: catalogPhotoInclude } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])
    const favorited = await favoriteIdSet(request.userId, rows.map((row) => row.photoId))
    const dto = serializeCollection(collection, viewer)
    return {
      ...dto,
      items: rows.map((row) => serializeCatalogPhoto(row.photo, request.userId ? favorited.has(row.photoId) : undefined)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    }
  })

  app.patch('/collections/:id', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = updateCollectionSchema.parse(request.body)
      const viewer = viewerOf(request)!
      const collection = await prisma.collection.findUnique({ where: { id } })
      if (!collection) throw new CollectionError('Collection not found', 404)
      if (!canEditCollection(collection, viewer)) throw new CollectionError('Forbidden', 403)

      let agencyId = collection.agencyId
      if (body.shared === true) {
        if (!viewer.agencyId) throw new CollectionError('Join an agency to share a lightbox with a team', 403)
        if (viewer.agencyRole === 'viewer') throw new CollectionError('Your agency role cannot share lightboxes', 403)
        agencyId = viewer.agencyId
      }
      if (body.shared === false && collection.ownerId === viewer.id) {
        agencyId = null
      }

      const updated = await prisma.collection.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
          agencyId,
        },
        include: listInclude,
      })
      return { collection: serializeCollection(updated, viewer) }
    } catch (err) {
      return collError(reply, err)
    }
  })

  app.delete('/collections/:id', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const viewer = viewerOf(request)!
      const collection = await prisma.collection.findUnique({ where: { id } })
      if (!collection) throw new CollectionError('Collection not found', 404)
      const agencyAdmin = collection.agencyId
        && viewer.agencyId === collection.agencyId
        && (viewer.agencyRole === 'owner' || viewer.agencyRole === 'admin')
      if (collection.ownerId !== viewer.id && !agencyAdmin) {
        throw new CollectionError('Forbidden', 403)
      }
      await prisma.collection.delete({ where: { id } })
      await writeAuditLog({
        actorId: viewer.id,
        action: 'collection.delete',
        entityType: 'collection',
        entityId: id,
      })
      return { ok: true }
    } catch (err) {
      return collError(reply, err)
    }
  })

  app.get('/photos/:id/collections', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const viewer = viewerOf(request)!
    const rows = await prisma.collection.findMany({
      where: {
        OR: [
          { ownerId: viewer.id },
          ...(viewer.agencyId ? [{ agencyId: viewer.agencyId }] : []),
        ],
      },
      include: {
        photos: { where: { photoId: id }, select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        contains: row.photos.length > 0,
        shared: Boolean(row.agencyId),
      })),
    }
  })

  app.post('/collections/:id/photos', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = addCollectionPhotoSchema.parse(request.body)
      const viewer = viewerOf(request)!
      const collection = await prisma.collection.findUnique({ where: { id } })
      if (!collection) throw new CollectionError('Collection not found', 404)
      if (!canEditCollection(collection, viewer)) throw new CollectionError('Forbidden', 403)

      const photo = await prisma.photo.findUnique({ where: { id: body.photoId }, select: { id: true, status: true } })
      if (!photo || photo.status !== 'active') throw new CollectionError('Photo not found', 404)

      const existing = await prisma.collectionPhoto.findUnique({
        where: { collectionId_photoId: { collectionId: id, photoId: body.photoId } },
      })
      if (existing) return { added: false, photoId: body.photoId }

      const count = await prisma.collectionPhoto.count({ where: { collectionId: id } })
      if (count >= MAX_COLLECTION_PHOTOS) {
        throw new CollectionError(`A collection can hold ${MAX_COLLECTION_PHOTOS} photographs`)
      }

      await prisma.collectionPhoto.create({
        data: { collectionId: id, photoId: body.photoId, addedById: viewer.id },
      })
      await prisma.collection.update({ where: { id }, data: { updatedAt: new Date() } })
      return { added: true, photoId: body.photoId }
    } catch (err) {
      return collError(reply, err)
    }
  })

  app.delete('/collections/:id/photos/:photoId', {
    preHandler: (request, reply) => authenticate(app, request, reply),
  }, async (request, reply) => {
    try {
      const { id, photoId } = request.params as { id: string; photoId: string }
      const viewer = viewerOf(request)!
      const collection = await prisma.collection.findUnique({ where: { id } })
      if (!collection) throw new CollectionError('Collection not found', 404)
      if (!canEditCollection(collection, viewer)) throw new CollectionError('Forbidden', 403)
      await prisma.collectionPhoto.deleteMany({ where: { collectionId: id, photoId } })
      return { ok: true }
    } catch (err) {
      return collError(reply, err)
    }
  })
}
