import type { FastifyInstance } from 'fastify'
import { decideModerationSchema, patchRightsSchema, reviewModelReleaseSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { contributorHasAgreement, rightsReadyForLive } from '../lib/rights.js'
import { serializePhoto, serializeQuote } from '../lib/serialize.js'

export async function adminContentRoutes(app: FastifyInstance) {
  const admin = { preHandler: requireAccountTypes(app, 'admin') }

  app.get('/admin/content', admin, async (request) => {
    const query = request.query as { q?: string; status?: string; page?: string }
    const page = Math.max(1, Number(query.page) || 1)
    const limit = 25
    const where = {
      ...(query.status ? { status: query.status as 'draft' | 'pending' | 'active' | 'rejected' | 'delisted' } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { country: { contains: query.q, mode: 'insensitive' as const } },
              { id: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [total, photos] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        include: {
          tags: true,
          rightsRecord: true,
          contributor: { include: { contributorProfile: true, platformAgreements: true } },
          modelReleases: { orderBy: { createdAt: 'desc' }, take: 3 },
          licenseGrants: { select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return {
      total,
      page,
      items: photos.map((p) => ({
        ...serializePhoto(
          p,
          p.contributor.contributorProfile?.handle ?? p.contributorId,
          p.contributor.platformAgreements.some((a) => a.status === 'accepted'),
        ),
        modelReleases: p.modelReleases,
        grantsCount: p.licenseGrants.length,
      })),
    }
  })

  app.get('/admin/content/:id', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        tags: true,
        rightsRecord: true,
        contributor: { include: { contributorProfile: true, platformAgreements: true } },
        modelReleases: { orderBy: { createdAt: 'desc' } },
        licenseGrants: { include: { product: true, buyer: true }, orderBy: { createdAt: 'desc' } },
        licenseQuotes: { include: { requester: true, photo: true }, orderBy: { createdAt: 'desc' } },
        moderationItems: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const hasAgreement = await contributorHasAgreement(photo.contributorId)
    return {
      photo: serializePhoto(photo, photo.contributor.contributorProfile?.handle ?? photo.contributorId, hasAgreement),
      modelReleases: photo.modelReleases,
      grants: photo.licenseGrants.map((g) => ({
        id: g.id,
        licenseType: g.licenseType,
        licenseName: g.product.name,
        certificateCode: g.certificateCode,
        buyerEmail: g.buyer.email,
        amountUsd: g.amountUsd,
        createdAt: g.createdAt.toISOString(),
      })),
      quotes: photo.licenseQuotes.map((q) => serializeQuote({ ...q, photo })),
      moderation: photo.moderationItems,
    }
  })

  app.patch('/admin/content/:id/rights', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = patchRightsSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({ where: { id }, include: { rightsRecord: true } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    await prisma.$transaction([
      prisma.photo.update({
        where: { id },
        data: {
          ...(body.exclusiveAvailable != null ? { exclusiveAvailable: body.exclusiveAvailable } : {}),
          ...(body.modelReleaseRequired != null ? { hasRecognizablePeople: body.modelReleaseRequired } : {}),
        },
      }),
      prisma.rightsRecord.upsert({
        where: { photoId: id },
        create: {
          photoId: id,
          copyrightVerified: body.copyrightVerified ?? false,
          copyrightHolder: body.copyrightHolder,
          platformRightsOk: body.platformRightsOk ?? false,
          modelReleaseRequired: body.modelReleaseRequired ?? false,
          modelReleaseStatus: body.modelReleaseRequired ? 'pending' : 'not_required',
        },
        update: {
          ...(body.copyrightVerified != null ? { copyrightVerified: body.copyrightVerified } : {}),
          ...(body.copyrightHolder != null ? { copyrightHolder: body.copyrightHolder } : {}),
          ...(body.platformRightsOk != null ? { platformRightsOk: body.platformRightsOk } : {}),
          ...(body.modelReleaseRequired != null
            ? {
                modelReleaseRequired: body.modelReleaseRequired,
                modelReleaseStatus: body.modelReleaseRequired
                  ? photo.rightsRecord?.modelReleaseStatus === 'verified'
                    ? 'verified'
                    : 'pending'
                  : 'not_required',
              }
            : {}),
        },
      }),
    ])

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.patch_rights',
      entityType: 'photo',
      entityId: id,
      metadata: body,
      ipAddress: request.ip,
    })

    const next = await prisma.photo.findUnique({
      where: { id },
      include: {
        tags: true,
        rightsRecord: true,
        contributor: { include: { contributorProfile: true, platformAgreements: true } },
      },
    })
    return {
      photo: serializePhoto(
        next!,
        next!.contributor.contributorProfile?.handle ?? next!.contributorId,
        next!.contributor.platformAgreements.some((a) => a.status === 'accepted'),
      ),
    }
  })

  app.post('/admin/model-releases/:id/review', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = reviewModelReleaseSchema.parse(request.body)
    const release = await prisma.modelRelease.findUnique({ where: { id } })
    if (!release) return reply.code(404).send({ error: 'Model release not found' })

    await prisma.$transaction([
      prisma.modelRelease.update({
        where: { id },
        data: {
          status: body.status,
          notes: body.notes ?? release.notes,
          verifiedById: request.userId,
          verifiedAt: new Date(),
        },
      }),
      prisma.rightsRecord.update({
        where: { photoId: release.photoId },
        data: { modelReleaseStatus: body.status },
      }),
    ])

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.review_model_release',
      entityType: 'model_release',
      entityId: id,
      metadata: { status: body.status, photoId: release.photoId },
      ipAddress: request.ip,
    })

    return { ok: true }
  })

  app.get('/admin/moderation', admin, async () => {
    const items = await prisma.moderationItem.findMany({
      where: { status: 'pending' },
      include: {
        photo: {
          include: {
            tags: true,
            rightsRecord: true,
            contributor: { include: { contributorProfile: true, platformAgreements: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return {
      items: items.map((item) => {
        const hasAgreement = item.photo.contributor.platformAgreements.some((a) => a.status === 'accepted')
        const live = rightsReadyForLive({ rights: item.photo.rightsRecord, hasAgreement })
        return {
          id: item.id,
          flag: item.flag,
          status: item.status,
          submittedBy: item.submittedBy,
          createdAt: item.createdAt.toISOString(),
          liveReady: live.ok,
          liveBlockers: live.reasons,
          photo: serializePhoto(
            item.photo,
            item.photo.contributor.contributorProfile?.handle ?? item.photo.contributorId,
            hasAgreement,
          ),
        }
      }),
    }
  })

  app.post('/admin/moderation/:id/decide', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = decideModerationSchema.parse(request.body)
    const item = await prisma.moderationItem.findUnique({
      where: { id },
      include: {
        photo: {
          include: {
            rightsRecord: true,
            contributor: { include: { platformAgreements: true } },
          },
        },
      },
    })
    if (!item) return reply.code(404).send({ error: 'Moderation item not found' })

    if (body.action === 'approve') {
      const hasAgreement = await contributorHasAgreement(item.photo.contributorId)
      const live = rightsReadyForLive({ rights: item.photo.rightsRecord, hasAgreement })
      if (!live.ok) {
        return reply.code(400).send({
          error: `Cannot publish until rights are complete: ${live.reasons.join('; ')}`,
          blockers: live.reasons,
        })
      }
    }

    await prisma.$transaction([
      prisma.moderationItem.update({
        where: { id },
        data: {
          status: body.action === 'approve' ? 'approved' : 'rejected',
          reviewerId: request.userId,
          decidedAt: new Date(),
          notes: body.notes,
        },
      }),
      prisma.photo.update({
        where: { id: item.photoId },
        data: {
          status: body.action === 'approve' ? 'active' : 'rejected',
          publishedAt: body.action === 'approve' ? new Date() : item.photo.publishedAt,
        },
      }),
    ])

    await writeAuditLog({
      actorId: request.userId,
      action: `admin.moderation.${body.action}`,
      entityType: 'photo',
      entityId: item.photoId,
      metadata: { moderationId: id, notes: body.notes },
      ipAddress: request.ip,
    })

    return { ok: true }
  })
}
