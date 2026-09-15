import type { FastifyInstance } from 'fastify'
import type { PermissionState } from '@vuekumi/shared'
import {
  identifyAppearanceSchema,
  presignUploadSchema,
  submitPhotoSchema,
  twoPartyCommercialCleared,
  updatePhotoSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { processPhotoAssets } from '../lib/process-photo.js'
import { contributorHasAgreement } from '../lib/rights.js'
import { serializePhoto } from '../lib/serialize.js'
import { approvalRate } from '../lib/follows.js'
import { earningsMonthSeries } from '../lib/payouts.js'
import {
  PhotoEditError,
  assertContributorStatusChange,
  assertExclusiveEdit,
  assertPeopleFlagEdit,
  nextLicensePrice,
  nextModelReleaseFields,
} from '../lib/photo-edit.js'
import {
  assertPermissionStateChange,
  permissionWriteData,
  resolvePermissionState,
} from '../lib/permissions.js'
import {
  appearanceUnclaimed,
  ModelError,
  serializeAppearance,
  syncPermissionToTwoParty,
} from '../lib/models.js'
import { issueAppearanceInvite } from './models.js'
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
  appearances: true,
  contributor: { include: { contributorProfile: true, platformAgreements: true } },
} as const

export async function contributorRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAccountTypes(app, 'contributor', 'admin') }

  app.get('/contributor/stats', gate, async (request) => {
    const contributorId = request.userId!
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [user, live, views, followers, rejected, available, month, seriesRows, top] = await Promise.all([
      prisma.user.findUnique({
        where: { id: contributorId },
        include: { contributorProfile: true },
      }),
      prisma.photo.aggregate({
        where: { contributorId, status: 'active' },
        _count: { _all: true },
        _sum: { downloads: true },
      }),
      prisma.photo.aggregate({
        where: { contributorId },
        _sum: { views: true },
      }),
      prisma.photographerFollow.count({ where: { photographerId: contributorId } }),
      prisma.photo.count({ where: { contributorId, status: 'rejected' } }),
      prisma.earningsLedger.aggregate({
        where: { contributorId, status: 'available' },
        _sum: { amountUsd: true },
      }),
      prisma.earningsLedger.aggregate({
        where: { contributorId, createdAt: { gte: monthStart } },
        _sum: { amountUsd: true },
      }),
      prisma.earningsLedger.findMany({
        where: { contributorId },
        select: { createdAt: true, amountUsd: true },
      }),
      prisma.photo.findMany({
        where: { contributorId, status: 'active' },
        include: photoInclude,
        orderBy: [{ downloads: 'desc' }, { views: 'desc' }],
        take: 4,
      }),
    ])

    const handle = user?.contributorProfile?.handle ?? ''
    const rate = approvalRate(live._count._all, rejected)

    return {
      name: user?.name ?? 'Contributor',
      handle,
      avatarUrl: user?.avatarUrl ?? null,
      location: user?.contributorProfile?.location ?? null,
      downloads: live._sum.downloads ?? 0,
      views: views._sum.views ?? 0,
      followers,
      profileViews: user?.contributorProfile?.profileViews ?? 0,
      photosCount: live._count._all,
      approvalRate: rate,
      availableUsd: available._sum.amountUsd ?? 0,
      thisMonthUsd: month._sum.amountUsd ?? 0,
      series: earningsMonthSeries(seriesRows),
      topPhotos: top.map((p) => serializePhoto(p, handle, true)),
    }
  })

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
        appearances: true,
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

  app.get('/contributor/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({ where: { id }, include: photoInclude })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (request.authUser?.accountType !== 'admin' && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const appearances = await prisma.photoAppearance.findMany({
      where: { photoId: id },
      include: {
        photo: { include: { contributor: true } },
        modelUser: { include: { modelProfile: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? photo.contributorId,
        photo.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        { appearances: appearances.map((row) => serializeAppearance(row, { includeEmail: true })) },
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
    const permissionState = resolvePermissionState({
      requested: body.permissionState,
      exclusiveAvailable: body.exclusiveAvailable,
      hasRecognizablePeople: people,
    })
    try {
      assertPermissionStateChange({
        next: permissionState,
        exclusiveSold: false,
        commercialLocked: false,
        hasRecognizablePeople: people,
        twoPartyCleared: false,
        actor: request.authUser?.accountType === 'admin' ? 'admin' : 'contributor',
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
    const permission = permissionWriteData(permissionState, false, body.restrictionNotes)

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
          exclusiveAvailable: permission.exclusiveAvailable,
          permissionState: permission.permissionState,
          restrictionNotes: permission.restrictionNotes,
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
      metadata: {
        hasRecognizablePeople: people,
        exclusiveAvailable: permission.exclusiveAvailable,
        permissionState: permission.permissionState,
        originalKey: Boolean(body.originalKey),
      },
      ipAddress: request.ip,
    })

    return {
      photo: serializePhoto(photo, photo.contributor.contributorProfile?.handle ?? contributorId, true),
    }
  })

  app.patch('/contributor/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePhotoSchema.parse(request.body)
    const existing = await prisma.photo.findUnique({
      where: { id },
      include: { rightsRecord: true, appearances: true, contributor: { include: { contributorProfile: true } } },
    })
    if (!existing) return reply.code(404).send({ error: 'Photo not found' })
    if (request.authUser?.accountType !== 'admin' && existing.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const people = body.hasRecognizablePeople
    const nextPeople = people ?? existing.hasRecognizablePeople
    const permissionState = resolvePermissionState({
      requested: body.permissionState,
      exclusiveAvailable: body.exclusiveAvailable,
      current: existing.permissionState as PermissionState,
      hasRecognizablePeople: nextPeople,
    })
    const actor = request.authUser?.accountType === 'admin' ? 'admin' : 'contributor'

    try {
      if (body.status) {
        assertContributorStatusChange({
          current: existing.status,
          next: body.status,
          exclusiveSold: existing.exclusiveSold,
        })
      }
      assertExclusiveEdit({
        exclusiveSold: existing.exclusiveSold,
        exclusiveAvailable: body.exclusiveAvailable,
      })
      assertPeopleFlagEdit({
        requested: body.hasRecognizablePeople,
        currentlyRequired: existing.hasRecognizablePeople || Boolean(existing.rightsRecord?.modelReleaseRequired),
      })
      assertPermissionStateChange({
        next: permissionState,
        current: existing.permissionState as PermissionState,
        exclusiveSold: existing.exclusiveSold,
        commercialLocked: existing.commercialLocked,
        hasRecognizablePeople: nextPeople,
        twoPartyCleared: twoPartyCommercialCleared({
          hasRecognizablePeople: nextPeople,
          appearances: existing.appearances,
        }),
        actor,
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }

    const licenseType = body.licenseType ?? existing.licenseType
    const price = body.licenseType || body.price != null
      ? nextLicensePrice({
          licenseType,
          price: body.price,
          currentPrice: existing.price,
        })
      : undefined
    const releaseFields =
      people === undefined
        ? null
        : nextModelReleaseFields({
            hasRecognizablePeople: people,
            current: existing.rightsRecord?.modelReleaseStatus ?? null,
          })
    const permission = permissionWriteData(
      permissionState,
      existing.exclusiveSold,
      body.restrictionNotes,
    )

    const photo = await prisma.$transaction(async (tx) => {
      if (body.tags) {
        await tx.photoTag.deleteMany({ where: { photoId: id } })
        if (body.tags.length) {
          await tx.photoTag.createMany({ data: body.tags.map((tag) => ({ photoId: id, tag })) })
        }
      }

      await tx.photo.update({
        where: { id },
        data: {
          ...(body.title ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.category ? { category: body.category } : {}),
          ...(body.country ? { country: body.country } : {}),
          ...(people !== undefined ? { hasRecognizablePeople: people } : {}),
          ...(body.licenseType ? { licenseType: body.licenseType } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(body.exclusiveAvailable !== undefined || body.permissionState
            ? { exclusiveAvailable: permission.exclusiveAvailable }
            : {}),
          ...(body.permissionState || body.exclusiveAvailable !== undefined
            ? { permissionState: permission.permissionState }
            : {}),
          ...(body.restrictionNotes !== undefined ? { restrictionNotes: permission.restrictionNotes } : {}),
          ...(body.status ? { status: body.status } : {}),
        },
      })

      if (releaseFields || body.copyrightHolder) {
        await tx.rightsRecord.upsert({
          where: { photoId: id },
          create: {
            photoId: id,
            copyrightVerified: true,
            copyrightHolder: body.copyrightHolder ?? existing.rightsRecord?.copyrightHolder,
            platformRightsOk: true,
            modelReleaseRequired: releaseFields?.modelReleaseRequired ?? false,
            modelReleaseStatus: releaseFields?.modelReleaseStatus ?? 'not_required',
          },
          update: {
            ...(body.copyrightHolder ? { copyrightHolder: body.copyrightHolder } : {}),
            ...(releaseFields
              ? {
                  modelReleaseRequired: releaseFields.modelReleaseRequired,
                  modelReleaseStatus: releaseFields.modelReleaseStatus,
                }
              : {}),
          },
        })
      }

      if (people && body.modelReleaseFileName) {
        await tx.modelRelease.create({
          data: {
            photoId: id,
            fileName: body.modelReleaseFileName,
            notes: body.modelReleaseNotes,
            status: 'pending',
          },
        })
      }

      if (body.status === 'delisted' && existing.status === 'pending') {
        await tx.moderationItem.updateMany({
          where: { photoId: id, status: 'pending' },
          data: { status: 'withdrawn', notes: 'Withdrawn by contributor', decidedAt: new Date() },
        })
      }

      if (body.status === 'pending' && existing.status !== 'pending') {
        await tx.moderationItem.create({
          data: {
            photoId: id,
            flag: (people ?? existing.hasRecognizablePeople) ? 'copyright check' : 'new submission',
            submittedBy:
              request.authUser?.contributorHandle ?? request.authUser?.email ?? existing.contributorId,
            status: 'pending',
          },
        })
      }

      return tx.photo.findUniqueOrThrow({ where: { id }, include: photoInclude })
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'contributor.update_photo',
      entityType: 'photo',
      entityId: id,
      metadata: {
        status: body.status ?? existing.status,
        licenseType,
        exclusiveAvailable: permission.exclusiveAvailable,
        permissionState: permission.permissionState,
        hasRecognizablePeople: people,
      },
      ipAddress: request.ip,
    })

    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? photo.contributorId,
        photo.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        { appearances: photo.appearances.map((row) => serializeAppearance(row, { includeEmail: true })) },
      ),
    }
  })

  app.post('/contributor/photos/:id/appearances', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = identifyAppearanceSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { contributor: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (request.authUser?.accountType !== 'admin' && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const email = body.email.toLowerCase()
    const dup = await prisma.photoAppearance.findFirst({ where: { photoId: id, inviteEmail: email } })
    if (dup) {
      return reply.code(409).send({ error: 'That person is already identified on this photograph' })
    }

    try {
      const created = await prisma.photoAppearance.create({
        data: {
          photoId: id,
          displayName: body.displayName,
          inviteEmail: email,
          invitedById: request.userId!,
          status: 'identified',
        },
      })
      const issued = await issueAppearanceInvite(created.id)
      await writeAuditLog({
        actorId: request.userId,
        action: 'model.invite',
        entityType: 'photo_appearance',
        entityId: created.id,
        metadata: { photoId: id, email, displayName: body.displayName },
        ipAddress: request.ip,
      })
      return {
        appearance: serializeAppearance(issued.appearance, { includeEmail: true }),
        joinUrl: issued.joinUrl,
      }
    } catch (err) {
      if (err instanceof ModelError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })

  app.post('/contributor/photos/:id/appearances/:appearanceId/resend', gate, async (request, reply) => {
    const { id, appearanceId } = request.params as { id: string; appearanceId: string }
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (request.authUser?.accountType !== 'admin' && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const row = await prisma.photoAppearance.findUnique({ where: { id: appearanceId } })
    if (!row || row.photoId !== id) return reply.code(404).send({ error: 'Appearance not found' })
    if (!appearanceUnclaimed(row.status)) {
      return reply.code(400).send({ error: 'This person has already claimed the invite' })
    }
    const issued = await issueAppearanceInvite(row.id)
    await writeAuditLog({
      actorId: request.userId,
      action: 'model.invite',
      entityType: 'photo_appearance',
      entityId: row.id,
      metadata: { photoId: id, resend: true, email: row.inviteEmail },
      ipAddress: request.ip,
    })
    return {
      appearance: serializeAppearance(issued.appearance, { includeEmail: true }),
      joinUrl: issued.joinUrl,
    }
  })

  app.delete('/contributor/photos/:id/appearances/:appearanceId', gate, async (request, reply) => {
    const { id, appearanceId } = request.params as { id: string; appearanceId: string }
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (request.authUser?.accountType !== 'admin' && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const row = await prisma.photoAppearance.findUnique({ where: { id: appearanceId } })
    if (!row || row.photoId !== id) return reply.code(404).send({ error: 'Appearance not found' })
    if (!appearanceUnclaimed(row.status)) {
      return reply.code(400).send({ error: 'Claimed appearances cannot be removed by the photographer' })
    }
    await prisma.photoAppearance.delete({ where: { id: row.id } })
    await syncPermissionToTwoParty(id)
    return { ok: true }
  })
}
