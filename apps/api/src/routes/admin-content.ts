import type { FastifyInstance } from 'fastify'
import type { PermissionState } from '@vuekumi/shared'
import { canMarkAgencyProtected, CONSENT_VERSION, authorizeGuardianSchema, twoPartyCommercialCleared } from '@vuekumi/shared'
import { decideModerationSchema, patchRightsSchema, reviewModelReleaseSchema } from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { requireAdminCapability } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { contributorHasAgreement, rightsReadyForLive } from '../lib/rights.js'
import { serializePhoto, serializeQuote } from '../lib/serialize.js'
import { serializeAppearance, syncVerifiedRightsRecord } from '../lib/models.js'
import { appendRightsLedgerEvent, loadRightsLedger } from '../lib/ledger.js'
import { serializeRightsReport } from '../lib/reports.js'
import { PhotoEditError } from '../lib/photo-edit.js'
import {
  assertPermissionStateChange,
  permissionWriteData,
  resolvePermissionState,
} from '../lib/permissions.js'

export async function adminContentRoutes(app: FastifyInstance) {
  const list = { preHandler: requireAdminCapability(app, 'content.list') }
  const read = { preHandler: requireAdminCapability(app, 'content.read') }
  const ledgerRead = { preHandler: requireAdminCapability(app, 'content.rights_ledger.read') }
  const editRights = { preHandler: requireAdminCapability(app, 'content.rights.edit') }
  const reviewRelease = { preHandler: requireAdminCapability(app, 'content.model_release.review') }
  const verifyProcess = { preHandler: requireAdminCapability(app, 'content.two_party.verify') }
  const moderationList = { preHandler: requireAdminCapability(app, 'moderation.list') }
  const moderationDecide = { preHandler: requireAdminCapability(app, 'moderation.decide') }

  app.get('/admin/content', list, async (request) => {
    const query = request.query as { q?: string; status?: string; page?: string; locked?: string }
    const page = Math.max(1, Number(query.page) || 1)
    const limit = 25
    const lockedOnly = query.locked === '1' || query.locked === 'true'
    const where = {
      ...(query.status ? { status: query.status as 'draft' | 'pending' | 'active' | 'rejected' | 'delisted' } : {}),
      ...(lockedOnly ? { commercialLocked: true } : {}),
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
          appearances: true,
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

  app.get('/admin/content/:id', read, async (request, reply) => {
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
        rightsReports: { orderBy: { createdAt: 'desc' } },
        appearances: {
          include: {
            photo: { include: { contributor: true } },
            modelUser: { include: { modelProfile: true } },
            likenessChecks: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const hasAgreement = await contributorHasAgreement(photo.contributorId)
    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? photo.contributorId,
        hasAgreement,
        { appearances: photo.appearances.map((row) => serializeAppearance(row, { includeEmail: true, includeVerification: true })) },
      ),
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
      reports: photo.rightsReports.map((report) => serializeRightsReport({ ...report, photo })),
    }
  })

  app.get('/admin/content/:id/rights-ledger', ledgerRead, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ledger = await loadRightsLedger(id)
    if (!ledger) return reply.code(404).send({ error: 'Photo not found' })
    return { ledger }
  })

  app.post('/admin/content/:id/appearances/:appearanceId/guardian', editRights, async (request, reply) => {
    const { id, appearanceId } = request.params as { id: string; appearanceId: string }
    authorizeGuardianSchema.parse(request.body)
    const row = await prisma.photoAppearance.findUnique({ where: { id: appearanceId } })
    if (!row || row.photoId !== id) return reply.code(404).send({ error: 'Appearance not found' })
    if (!row.isMinor) return reply.code(400).send({ error: 'Guardian authorization applies only to a minor' })
    if (!row.guardianName || !row.guardianEmail || !row.guardianMobile) {
      return reply.code(400).send({ error: 'Record the parent or legal guardian name, email and mobile first' })
    }
    const updated = await prisma.photoAppearance.update({
      where: { id: appearanceId },
      data: { guardianAuthorizedAt: new Date() },
      include: {
        photo: { include: { contributor: true } },
        modelUser: { include: { modelProfile: true } },
        likenessChecks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    await syncVerifiedRightsRecord(id)
    await appendRightsLedgerEvent({
      photoId: id,
      action: 'likeness.guardian_authorized',
      actorId: request.userId,
      actorKind: 'staff',
      relatedIds: { appearanceId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    })
    await writeAuditLog({
      actorId: request.userId,
      action: 'rights.guardian_authorized',
      entityType: 'photo_appearance',
      entityId: appearanceId,
      metadata: { photoId: id },
      ipAddress: request.ip,
    })
    return { appearance: serializeAppearance(updated, { includeEmail: true, includeVerification: true }) }
  })

  app.patch('/admin/content/:id/rights', editRights, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = patchRightsSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { rightsRecord: true, appearances: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })

    const people = body.modelReleaseRequired ?? photo.hasRecognizablePeople
    const twoPartyCleared = twoPartyCommercialCleared({
      hasRecognizablePeople: people,
      appearances: photo.appearances,
    })
    let permissionState = resolvePermissionState({
      requested: body.permissionState,
      exclusiveAvailable: body.exclusiveAvailable,
      current: photo.permissionState as PermissionState,
      hasRecognizablePeople: people,
    })
    if (
      !body.permissionState
      && people
      && !twoPartyCleared
      && (permissionState === 'commercial' || permissionState === 'exclusive')
      && !photo.exclusiveSold
    ) {
      permissionState = 'editorial'
    }

    try {
      assertPermissionStateChange({
        next: permissionState,
        current: photo.permissionState as PermissionState,
        exclusiveSold: photo.exclusiveSold,
        commercialLocked: photo.commercialLocked,
        hasRecognizablePeople: people,
        twoPartyCleared,
        actor: 'admin',
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }

    // Phase 31 — agency-protected is real representation handling, not a label:
    // it may only be applied while the contributor is represented by VueQuatro.
    if (permissionState === 'agency_protected' && photo.permissionState !== 'agency_protected') {
      const representation = await prisma.representation.findUnique({
        where: { contributorId: photo.contributorId },
        select: { status: true },
      })
      if (!canMarkAgencyProtected(representation?.status ?? null)) {
        return reply.code(400).send({
          error: 'Agency-protected requires an active VueQuatro representation — approve the contributor first',
        })
      }
    }

    const permission = permissionWriteData(permissionState, photo.exclusiveSold, body.restrictionNotes)

    await prisma.$transaction([
      prisma.photo.update({
        where: { id },
        data: {
          ...(body.exclusiveAvailable != null || body.permissionState || permissionState !== photo.permissionState
            ? { exclusiveAvailable: permission.exclusiveAvailable, permissionState: permission.permissionState }
            : {}),
          ...(body.restrictionNotes !== undefined ? { restrictionNotes: permission.restrictionNotes } : {}),
          ...(body.modelReleaseRequired != null ? { hasRecognizablePeople: body.modelReleaseRequired } : {}),
          ...(body.creationClaim != null ? { creationClaim: body.creationClaim } : {}),
        },
      }),
      prisma.rightsRecord.upsert({
        where: { photoId: id },
        create: {
          photoId: id,
          copyrightVerified: body.copyrightVerified ?? false,
          copyrightHolder: body.copyrightHolder,
          copyrightStatus: body.copyrightStatus
            ?? (body.copyrightVerified ? 'verified' : body.creationClaim === 'unknown' ? 'restricted' : 'claimed'),
          copyrightMethod: body.copyrightVerified ? 'vuekumi_direct' : 'attestation',
          platformRightsOk: body.platformRightsOk ?? false,
          modelReleaseRequired: body.modelReleaseRequired ?? false,
          modelReleaseStatus: body.modelReleaseRequired ? 'pending' : 'not_required',
        },
        update: {
          ...(body.copyrightVerified != null ? { copyrightVerified: body.copyrightVerified } : {}),
          ...(body.copyrightHolder != null ? { copyrightHolder: body.copyrightHolder } : {}),
          ...(body.platformRightsOk != null ? { platformRightsOk: body.platformRightsOk } : {}),
          ...(body.copyrightStatus != null ? { copyrightStatus: body.copyrightStatus } : {}),
          ...(body.copyrightVerified === true
            ? { copyrightStatus: 'verified' as const, copyrightMethod: 'vuekumi_direct' as const, copyrightVerified: true }
            : {}),
          ...(body.copyrightVerified === false && body.copyrightStatus == null
            ? { copyrightStatus: 'claimed' as const, copyrightMethod: 'attestation' as const }
            : {}),
          ...(body.creationClaim === 'unknown' ? { copyrightStatus: 'restricted' as const } : {}),
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
    await syncVerifiedRightsRecord(id)
    const nextRecord = await prisma.rightsRecord.findUnique({ where: { photoId: id } })
    await appendRightsLedgerEvent({
      photoId: id,
      action: 'staff.patch_rights',
      actorId: request.userId,
      actorKind: 'staff',
      previousCopyright: photo.rightsRecord?.copyrightStatus,
      nextCopyright: nextRecord?.copyrightStatus,
      commercialEligible: nextRecord?.commercialEligible,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
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

  app.post('/admin/model-releases/:id/review', reviewRelease, async (request, reply) => {
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

  app.post('/admin/content/:id/verify-process', verifyProcess, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { appearances: true, rightsRecord: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    const cleared = twoPartyCommercialCleared({
      hasRecognizablePeople: photo.hasRecognizablePeople,
      appearances: photo.appearances,
    })
    if (!cleared) {
      return reply.code(400).send({
        error: 'Staff can verify the process only after photographer and model commercial approval',
      })
    }

    await prisma.rightsRecord.upsert({
      where: { photoId: id },
      create: {
        photoId: id,
        copyrightVerified: photo.rightsRecord?.copyrightVerified ?? false,
        copyrightHolder: photo.rightsRecord?.copyrightHolder,
        platformRightsOk: photo.rightsRecord?.platformRightsOk ?? false,
        modelReleaseRequired: photo.hasRecognizablePeople,
        modelReleaseStatus: photo.rightsRecord?.modelReleaseStatus ?? 'pending',
        processVerifiedAt: new Date(),
        processVerifiedById: request.userId,
        consentVersion: CONSENT_VERSION,
      },
      update: {
        processVerifiedAt: new Date(),
        processVerifiedById: request.userId,
        consentVersion: CONSENT_VERSION,
      },
    })

    await writeAuditLog({
      actorId: request.userId,
      action: 'admin.verify_two_party_process',
      entityType: 'photo',
      entityId: id,
      metadata: { consentVersion: CONSENT_VERSION, appearances: photo.appearances.length },
      ipAddress: request.ip,
    })

    return { ok: true, consentVersion: CONSENT_VERSION }
  })

  app.get('/admin/moderation', moderationList, async () => {
    const items = await prisma.moderationItem.findMany({
      where: { status: 'pending' },
      include: {
        photo: {
          include: {
            tags: true,
            rightsRecord: true,
            appearances: true,
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

  app.post('/admin/moderation/:id/decide', moderationDecide, async (request, reply) => {
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
