import type { FastifyInstance } from 'fastify'
import { presignUploadSchema, submitPhotoSchema, updatePhotoSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { processPhotoAssets } from '../lib/process-photo.js'
import { contributorHasAgreement } from '../lib/rights.js'
import { serializePhoto } from '../lib/serialize.js'
import {
  ALLOWED_IMAGE_TYPES,
  assertOwnedOriginalKey,
  extensionFor,
  objectExists,
  originalKeyFor,
  presignPut,
  verifyLocalToken,
  writeLocalUpload,
} from '../lib/storage.js'

const PLACEHOLDER_SRC = '/images/photos/fashion-portrait.jpg'
const photoInclude = {
  tags: true,
  rightsRecord: true,
  contributor: { include: { contributorProfile: true } },
} as const

export async function contributorRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAccountTypes(app, 'contributor', 'admin') }

  app.post('/contributor/uploads/presign', gate, async (request, reply) => {
    const body = presignUploadSchema.parse(request.body)
    const contentType = body.contentType.toLowerCase()
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return reply.code(400).send({ error: 'Only JPEG, PNG, WebP and TIFF images are accepted' })
    }
    const ext = extensionFor(body.filename, contentType)
    const key = originalKeyFor(request.userId!, ext)
    const signed = await presignPut(key, contentType)
    return signed
  })

  await app.register(async (scope) => {
    scope.addContentTypeParser('*', (request, payload, done) => {
      done(null, payload)
    })

    scope.put('/contributor/uploads/bin/:token', {
      preHandler: requireAccountTypes(app, 'contributor', 'admin'),
      bodyLimit: 55 * 1024 * 1024,
    }, async (request, reply) => {
      const { token } = request.params as { token: string }
      const key = verifyLocalToken(token)
      if (!key) return reply.code(400).send({ error: 'Upload token is invalid or expired' })
      try {
        assertOwnedOriginalKey(key, request.userId!)
      } catch {
        return reply.code(403).send({ error: 'Invalid storage key' })
      }
      const stored = await writeLocalUpload(key, request.body as NodeJS.ReadableStream)
      return { ok: true, key: stored.key, bytes: stored.bytes }
    })
  })

  app.get('/contributor/photos', gate, async (request) => {
    const contributorId = request.authUser?.accountType === 'admin' && (request.query as { userId?: string }).userId
      ? (request.query as { userId: string }).userId
      : request.userId!

    const photos = await prisma.photo.findMany({
      where: { contributorId },
      include: {
        tags: true,
        rightsRecord: true,
        contributor: { include: { contributorProfile: true, platformAgreements: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      items: photos.map((p) =>
        serializePhoto(
          p,
          p.contributor.contributorProfile?.handle ?? p.contributorId,
          p.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        ),
      ),
    }
  })

  app.post('/contributor/photos', gate, async (request, reply) => {
    if (request.authUser?.accountType !== 'contributor' && request.authUser?.accountType !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const body = submitPhotoSchema.parse(request.body)
    const contributorId = request.userId!
    const hasAgreement = await contributorHasAgreement(contributorId)
    if (!hasAgreement) {
      return reply.code(400).send({ error: 'Accept the current VueKumi contributor agreement before submitting' })
    }

    if (body.originalKey) {
      try {
        assertOwnedOriginalKey(body.originalKey, contributorId)
      } catch {
        return reply.code(400).send({ error: 'Invalid original storage key' })
      }
      if (!(await objectExists(body.originalKey))) {
        return reply.code(400).send({ error: 'Upload the image file before submitting' })
      }
    }

    const people = body.hasRecognizablePeople
    const modelReleaseAttached = Boolean(body.modelReleaseFileName)
    const id = `sub-${Date.now().toString(36)}`
    const processingStatus = body.originalKey ? 'pending' : 'ready'

    let photo = await prisma.$transaction(async (tx) => {
      const created = await tx.photo.create({
        data: {
          id,
          contributorId,
          title: body.title,
          description: body.description,
          category: body.category,
          country: body.country,
          licenseType: body.licenseType,
          price: body.licenseType === 'premium' ? (body.price ?? 12) : 0,
          status: 'pending',
          src: body.src || PLACEHOLDER_SRC,
          storageKey: body.originalKey,
          processingStatus,
          hasRecognizablePeople: people,
          exclusiveAvailable: Boolean(body.exclusiveAvailable),
          tags: body.tags?.length ? { create: body.tags.map((tag) => ({ tag })) } : undefined,
          assets: body.originalKey
            ? {
                create: {
                  kind: 'original',
                  storageKey: body.originalKey,
                  mimeType: 'application/octet-stream',
                },
              }
            : undefined,
          rightsRecord: {
            create: {
              copyrightVerified: true,
              copyrightHolder: body.copyrightHolder,
              modelReleaseRequired: people,
              modelReleaseStatus: people ? 'pending' : 'not_required',
              platformRightsOk: true,
            },
          },
          moderationItems: {
            create: {
              flag: people ? 'copyright check' : 'new submission',
              submittedBy: request.authUser?.contributorHandle ?? request.authUser?.email ?? contributorId,
              status: 'pending',
            },
          },
        },
        include: photoInclude,
      })

      if (people && modelReleaseAttached) {
        await tx.modelRelease.create({
          data: {
            photoId: created.id,
            fileName: body.modelReleaseFileName!,
            notes: body.modelReleaseNotes,
            status: 'pending',
          },
        })
      }

      await tx.contributorProfile.updateMany({
        where: { userId: contributorId },
        data: { photosCount: { increment: 1 } },
      })

      return created
    })

    if (body.originalKey) {
      try {
        await processPhotoAssets(photo.id)
        const reloaded = await prisma.photo.findUnique({
          where: { id: photo.id },
          include: photoInclude,
        })
        if (reloaded) photo = reloaded
      } catch (err) {
        request.log.warn({ err, photoId: photo.id }, 'inline derivative processing failed')
      }
    }

    await writeAuditLog({
      actorId: request.userId,
      action: 'contributor.submit_photo',
      entityType: 'photo',
      entityId: photo.id,
      metadata: { hasRecognizablePeople: people, exclusiveAvailable: body.exclusiveAvailable, originalKey: Boolean(body.originalKey) },
      ipAddress: request.ip,
    })

    return {
      photo: serializePhoto(photo, photo.contributor.contributorProfile?.handle ?? contributorId, true),
    }
  })

  app.patch('/contributor/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePhotoSchema.parse(request.body)
    const existing = await prisma.photo.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'Photo not found' })
    if (request.authUser?.accountType !== 'admin' && existing.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const photo = await prisma.$transaction(async (tx) => {
      if (body.tags) {
        await tx.photoTag.deleteMany({ where: { photoId: id } })
        if (body.tags.length) {
          await tx.photoTag.createMany({ data: body.tags.map((tag) => ({ photoId: id, tag })) })
        }
      }
      const updated = await tx.photo.update({
        where: { id },
        data: {
          ...(body.title ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.category ? { category: body.category } : {}),
          ...(body.country ? { country: body.country } : {}),
          ...(body.hasRecognizablePeople !== undefined ? { hasRecognizablePeople: body.hasRecognizablePeople } : {}),
        },
        include: {
          tags: true,
          rightsRecord: true,
          contributor: { include: { contributorProfile: true } },
        },
      })
      if (body.hasRecognizablePeople) {
        await tx.rightsRecord.updateMany({
          where: { photoId: id },
          data: { modelReleaseRequired: true, modelReleaseStatus: 'pending' },
        })
      }
      return updated
    })

    return {
      photo: serializePhoto(photo, photo.contributor.contributorProfile?.handle ?? photo.contributorId, true),
    }
  })
}
