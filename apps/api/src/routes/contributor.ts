import type { FastifyInstance } from 'fastify'
import { submitPhotoSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { contributorHasAgreement } from '../lib/rights.js'
import { serializePhoto } from '../lib/serialize.js'

const PLACEHOLDER_SRC = '/images/photos/fashion-portrait.jpg'

export async function contributorRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAccountTypes(app, 'contributor', 'admin') }

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

    const people = body.hasRecognizablePeople
    const modelReleaseAttached = Boolean(body.modelReleaseFileName)
    const id = `sub-${Date.now().toString(36)}`

    const photo = await prisma.$transaction(async (tx) => {
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
          hasRecognizablePeople: people,
          exclusiveAvailable: Boolean(body.exclusiveAvailable),
          tags: body.tags?.length ? { create: body.tags.map((tag) => ({ tag })) } : undefined,
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
        include: {
          tags: true,
          rightsRecord: true,
          contributor: { include: { contributorProfile: true } },
        },
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

    await writeAuditLog({
      actorId: request.userId,
      action: 'contributor.submit_photo',
      entityType: 'photo',
      entityId: photo.id,
      metadata: { hasRecognizablePeople: people, exclusiveAvailable: body.exclusiveAvailable },
      ipAddress: request.ip,
    })

    return {
      photo: serializePhoto(photo, photo.contributor.contributorProfile?.handle ?? contributorId, true),
    }
  })
}
