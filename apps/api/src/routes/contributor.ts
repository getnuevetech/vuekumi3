import type { FastifyInstance } from 'fastify'
import type { PermissionState } from '@vuekumi/shared'
import {
  CONSENT_VERSION,
  applyScreeningToPeopleFlag,
  canEnterCommercialInventory,
  commercialInventoryBlocked,
  declareSubjectAgeSchema,
  identifyAppearanceSchema,
  isAiTrainingEligible,
  isCommerciallyEligible,
  isCommunityContributor,
  isCreatorWorkspaceAccount,
  isNonCommercialCreator,
  MODEL_RELEASE_ATTESTATION,
  authorizeGuardianSchema,
  nonCommercialCreatorBlocksState,
  presignUploadSchema,
  selfShotAppearanceSchema,
  submitPhotoSchema,
  twoPartyCommercialCleared,
  updatePhotoSchema,
  uploadSignedReleaseSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { syncAiTrainingEligible } from '../lib/ai-training.js'
import { isImpersonatingStaff, resolveCreatorWorkspaceId } from '../lib/act-as-creator.js'
import { requireCreatorWorkspace } from '../lib/auth-middleware.js'
import { prisma } from '../lib/prisma.js'
import { assertContributorUploadAllowed } from '../lib/policy-decision.js'
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
  appearanceInclude,
  appearanceUnclaimed,
  decideAppearanceBlocked,
  ensureModelProfile,
  ModelError,
  modelAccountBlocked,
  ownEmailInviteBlocked,
  serializeAppearance,
  syncPermissionToTwoParty,
  syncVerifiedRightsRecord,
} from '../lib/models.js'
import { appendRightsLedgerEvent, loadRightsLedger } from '../lib/ledger.js'
import { issueAppearanceInvite } from './models.js'
import { loadOriginalBytes, screenImageForRights, screeningWriteData } from '../lib/screening.js'
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

async function assertUploadForContributor(
  contributorId: string,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
) {
  const user = await prisma.user.findUnique({
    where: { id: contributorId },
    select: { country: true },
  })
  try {
    await assertContributorUploadAllowed(user?.country)
    return true
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 403
    const reasonCodes =
      err && typeof err === 'object' && 'reasonCodes' in err
        ? (err as { reasonCodes?: string[] }).reasonCodes
        : undefined
    reply.code(status).send({
      error: err instanceof Error ? err.message : 'Upload denied',
      ...(reasonCodes ? { reasonCodes } : {}),
    })
    return false
  }
}

export async function contributorRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireCreatorWorkspace(app) }

  app.get('/contributor/stats', gate, async (request, reply) => {
    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return
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
      actingAsUserId: isImpersonatingStaff(request.authUser) ? contributorId : null,
      actingAsAccountType: isImpersonatingStaff(request.authUser) ? user?.accountType ?? null : null,
    }
  })

  app.post('/contributor/uploads/presign', gate, async (request, reply) => {
    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return
    if (!(await assertUploadForContributor(contributorId, reply))) return
    const body = presignUploadSchema.parse(request.body)
    const contentType = body.contentType.toLowerCase()
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return reply.code(400).send({ error: 'Only JPEG, PNG, WebP and TIFF images are accepted' })
    }
    const ext = extensionFor(body.filename, contentType)
    const key = originalKeyFor(contributorId, ext)
    const signed = await presignPut(key, contentType)
    return signed
  })

  await app.register(async (scope) => {
    scope.addContentTypeParser('*', (request, payload, done) => {
      done(null, payload)
    })

    scope.put('/contributor/uploads/bin/:token', {
      preHandler: requireCreatorWorkspace(app),
      bodyLimit: 55 * 1024 * 1024,
    }, async (request, reply) => {
      const contributorId = await resolveCreatorWorkspaceId(request, reply)
      if (!contributorId) return
      if (!(await assertUploadForContributor(contributorId, reply))) return
      const { token } = request.params as { token: string }
      const key = verifyLocalToken(token)
      if (!key) return reply.code(400).send({ error: 'Upload token is invalid or expired' })
      try {
        assertOwnedOriginalKey(key, contributorId)
      } catch {
        return reply.code(403).send({ error: 'Invalid storage key' })
      }
      const stored = await writeLocalUpload(key, request.body as NodeJS.ReadableStream)
      return { ok: true, key: stored.key, bytes: stored.bytes }
    })
  })

  app.get('/contributor/photos', gate, async (request, reply) => {
    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return

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
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
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
        { appearances: appearances.map((row) => serializeAppearance(row, { includeEmail: true, includeMobile: true })) },
      ),
    }
  })

  app.post('/contributor/photos', gate, async (request, reply) => {
    const accountType = request.authUser?.accountType
    if (!isCreatorWorkspaceAccount(accountType) && !isImpersonatingStaff(request.authUser)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return
    if (!(await assertUploadForContributor(contributorId, reply))) return

    const body = submitPhotoSchema.parse(request.body)
    const target = await prisma.user.findUnique({
      where: { id: contributorId },
      select: { accountType: true },
    })
    const targetAccountType = target?.accountType ?? accountType
    const hasAgreement = await contributorHasAgreement(contributorId)
    if (!hasAgreement) {
      return reply.code(400).send({
        error: isCommunityContributor(targetAccountType)
          ? 'Accept the VueKumi community contributor terms before submitting'
          : isNonCommercialCreator(targetAccountType)
            ? 'Accept the VueKumi photo influencer terms before submitting'
            : 'Accept the current VueKumi photographer licensing agreement before submitting',
      })
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

    const image = await loadOriginalBytes(body.originalKey)
    const screening = await screenImageForRights({
      title: body.title,
      category: body.category,
      filename: body.originalKey,
      declaredPeople: body.hasRecognizablePeople,
      image,
    })
    const people = applyScreeningToPeopleFlag({ declaredPeople: body.hasRecognizablePeople, screening })
    const commercialUploader = canEnterCommercialInventory(targetAccountType)
    if (!commercialUploader && (body.licenseType === 'premium' || body.permissionState === 'commercial' || body.permissionState === 'exclusive')) {
      return reply.code(400).send({
        error: commercialInventoryBlocked(targetAccountType)
          ?? 'This account type cannot enter commercial inventory.',
      })
    }
    const requestedPermission = commercialUploader
      ? body.permissionState
      : (body.permissionState && ['private', 'portfolio', 'editorial'].includes(body.permissionState)
          ? body.permissionState
          : 'portfolio')
    const modelReleaseAttached = Boolean(body.modelReleaseFileName)
    const id = `sub-${Date.now().toString(36)}`
    const processingStatus = body.originalKey ? 'pending' : 'ready'
    const permissionState = resolvePermissionState({
      requested: requestedPermission,
      exclusiveAvailable: commercialUploader ? body.exclusiveAvailable : false,
      hasRecognizablePeople: people,
    })
    const communityBlock = nonCommercialCreatorBlocksState(targetAccountType, permissionState)
    if (communityBlock) {
      return reply.code(400).send({ error: communityBlock })
    }
    try {
      assertPermissionStateChange({
        next: permissionState,
        exclusiveSold: false,
        commercialLocked: false,
        hasRecognizablePeople: people,
        twoPartyCleared: false,
        actor: isImpersonatingStaff(request.authUser) ? 'admin' : 'contributor',
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
    const permission = permissionWriteData(permissionState, false, body.restrictionNotes)
    const now = new Date()
    const modelConsentStatus = people ? 'required' : 'not_required'
    const copyrightStatus = 'claimed' as const
    const commercialEligible = isCommerciallyEligible({
      copyrightStatus,
      modelConsentStatus,
      creationClaim: 'self_created',
    })

    let shootId: string | undefined
    if (body.shootTitle && commercialUploader) {
      const shoot = await prisma.photoShoot.create({
        data: {
          photographerId: contributorId,
          title: body.shootTitle,
          shotOn: body.shotOn ? new Date(body.shotOn) : null,
        },
      })
      shootId = shoot.id
    }

    let photo = await prisma.$transaction(async (tx) => {
      const created = await tx.photo.create({
        data: {
          id,
          contributorId,
          uploadedById: contributorId,
          creationClaim: 'self_created',
          title: body.title,
          description: body.description,
          category: body.category,
          country: body.country,
          licenseType: commercialUploader ? body.licenseType : 'free',
          price: commercialUploader && body.licenseType === 'premium' ? (body.price ?? 12) : 0,
          status: 'pending',
          src: body.src || PLACEHOLDER_SRC,
          storageKey: body.originalKey,
          processingStatus,
          hasRecognizablePeople: people,
          exclusiveAvailable: commercialUploader ? permission.exclusiveAvailable : false,
          permissionState: permission.permissionState,
          restrictionNotes: permission.restrictionNotes,
          shootId,
          ...screeningWriteData(screening),
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
              copyrightStatus,
              copyrightAttestedAt: now,
              copyrightHolder: body.copyrightHolder,
              modelReleaseRequired: people,
              modelReleaseStatus: people ? 'pending' : 'not_required',
              modelConsentStatus,
              commercialEligible,
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

      if (people && modelReleaseAttached && commercialUploader) {
        await tx.modelRelease.create({
          data: {
            photoId: created.id,
            photographerId: contributorId,
            fileName: body.modelReleaseFileName!,
            notes: body.modelReleaseNotes,
            status: 'pending',
            verificationLevel: 'photographer_provided',
            attestedGenuine: true,
            attestedAt: now,
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
    await appendRightsLedgerEvent({
      photoId: photo.id,
      action: 'copyright.attested',
      actorId: request.userId,
      actorKind: 'user',
      agreementVersion: commercialUploader ? 'photographer' : 'community',
      nextCopyright: copyrightStatus,
      nextLikeness: modelConsentStatus,
      commercialEligible,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
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
    if (!isImpersonatingStaff(request.authUser) && existing.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    if (!isImpersonatingStaff(request.authUser) && isNonCommercialCreator(request.authUser?.accountType) && body.copyrightAiTraining) {
      return reply.code(400).send({
        error: 'AI-training opt-in is for professional photographers. Dataset pricing is undecided.',
      })
    }

    const people = body.hasRecognizablePeople
    const nextPeople = people ?? existing.hasRecognizablePeople
    const permissionState = resolvePermissionState({
      requested: body.permissionState,
      exclusiveAvailable: body.exclusiveAvailable,
      current: existing.permissionState as PermissionState,
      hasRecognizablePeople: nextPeople,
    })
    const actor = isImpersonatingStaff(request.authUser) ? 'admin' : 'contributor'
    const inventoryBlock = !isImpersonatingStaff(request.authUser)
      ? nonCommercialCreatorBlocksState(request.authUser?.accountType, permissionState)
      : undefined
    if (inventoryBlock) {
      return reply.code(400).send({ error: inventoryBlock })
    }
    if (!isImpersonatingStaff(request.authUser) && isNonCommercialCreator(request.authUser?.accountType) && body.licenseType === 'premium') {
      return reply.code(400).send({
        error: commercialInventoryBlocked(request.authUser?.accountType)
          ?? 'This account type cannot enter commercial inventory.',
      })
    }

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
          ...(body.copyrightAiTraining !== undefined ? { copyrightAiTraining: body.copyrightAiTraining } : {}),
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

    await syncAiTrainingEligible(id)
    if (body.copyrightAiTraining !== undefined) {
      photo.copyrightAiTraining = body.copyrightAiTraining
    }
    photo.aiTrainingEligible = isAiTrainingEligible({
      copyrightAiTraining: photo.copyrightAiTraining,
      hasRecognizablePeople: photo.hasRecognizablePeople,
      appearances: photo.appearances,
    })
    if (body.copyrightAiTraining !== undefined) {
      await appendRightsLedgerEvent({
        photoId: id,
        action: body.copyrightAiTraining ? 'ai_training.copyright_opt_in' : 'ai_training.copyright_opt_out',
        actorId: request.userId,
        actorKind: 'user',
        agreementVersion: body.copyrightAiTraining ? '1.0-ai-training' : undefined,
        scopes: { ai_training: body.copyrightAiTraining },
      })
    }

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

  app.post('/contributor/photos/:id/releases', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (isNonCommercialCreator(request.authUser?.accountType)) {
      return reply.code(400).send({
        error: commercialInventoryBlocked(request.authUser?.accountType)
          ?? 'This account type cannot upload commercial model releases.',
      })
    }
    const body = uploadSignedReleaseSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({ where: { id }, include: { contributor: true, rightsRecord: true } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    if (!photo.hasRecognizablePeople) {
      return reply.code(400).send({ error: 'A model release is only used when a recognizable person appears' })
    }
    const email = body.email?.toLowerCase()
    if (email) {
      const selfBlocked = ownEmailInviteBlocked(email, photo.contributor.email)
      if (selfBlocked) return reply.code(400).send({ error: selfBlocked })
    }
    const existing = email
      ? await prisma.photoAppearance.findFirst({ where: { photoId: id, inviteEmail: email } })
      : await prisma.photoAppearance.findFirst({ where: { photoId: id, displayName: body.displayName, inviteEmail: null } })
    const appearance = existing
      ?? await prisma.photoAppearance.create({
        data: {
          photoId: id,
          displayName: body.displayName,
          inviteEmail: email,
          inviteMobile: body.mobile,
          invitedById: request.userId!,
          status: 'identified',
          consentStatus: 'required',
          ageClass: body.ageClass === 'minor' || body.isMinor ? 'minor' : (body.ageClass ?? 'adult'),
          isMinor: Boolean(body.isMinor || body.ageClass === 'minor'),
          verificationLevel: 'photographer_provided',
          consentQuality: 'documented',
        },
      })
    const release = await prisma.modelRelease.create({
      data: {
        photoId: id,
        photographerId: photo.contributorId,
        appearanceId: appearance.id,
        fileName: body.fileName,
        notes: `${MODEL_RELEASE_ATTESTATION} Identity: ${body.modelIdentity}`,
        status: 'pending',
        verificationLevel: 'photographer_provided',
        attestedGenuine: true,
        attestedAt: new Date(),
        modelIdentity: body.modelIdentity,
      },
    })
    await prisma.photoAppearance.update({
      where: { id: appearance.id },
      data: { verificationLevel: 'photographer_provided', consentQuality: 'documented' },
    })
    let joinUrl: string | undefined
    if (body.confirmWithModel && email) {
      const issued = await issueAppearanceInvite(appearance.id)
      joinUrl = issued.joinUrl
      await prisma.modelRelease.update({
        where: { id: release.id },
        data: { confirmationSentAt: new Date() },
      })
    }
    await syncVerifiedRightsRecord(id)
    await writeAuditLog({
      actorId: request.userId,
      action: 'model.release_upload',
      entityType: 'model_release',
      entityId: release.id,
      metadata: {
        photoId: id,
        appearanceId: appearance.id,
        photographerId: photo.contributorId,
        verificationLevel: 'photographer_provided',
        confirmWithModel: Boolean(body.confirmWithModel),
      },
      ipAddress: request.ip,
    })
    const row = await prisma.photoAppearance.findUnique({
      where: { id: appearance.id },
      include: appearanceInclude,
    })
    return {
      release: {
        id: release.id,
        verificationLevel: 'photographer_provided',
        attestedGenuine: true,
      },
      appearance: serializeAppearance(row!, { includeEmail: true, includeMobile: true }),
      joinUrl,
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
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const email = body.email.toLowerCase()
    const selfBlocked = ownEmailInviteBlocked(email, photo.contributor.email)
    if (selfBlocked) {
      return reply.code(400).send({ error: selfBlocked })
    }
    if (isCommunityContributor(request.authUser?.accountType)) {
      return reply.code(400).send({
        error: 'Community contributors cannot start commercial model-release clearance. Register as a professional photographer.',
      })
    }
    const dup = await prisma.photoAppearance.findFirst({
      where: {
        photoId: id,
        inviteEmail: email,
      },
    })
    if (dup) {
      return reply.code(409).send({ error: 'That person is already identified on this photograph' })
    }

    const minor = Boolean(body.isMinor || body.ageClass === 'minor')
    let shootId = body.shootId ?? photo.shootId ?? undefined
    if (!shootId && body.shootTitle) {
      const shoot = await prisma.photoShoot.create({
        data: {
          photographerId: photo.contributorId,
          title: body.shootTitle,
          shotOn: body.shotOn ? new Date(body.shotOn) : null,
        },
      })
      shootId = shoot.id
      await prisma.photo.update({ where: { id }, data: { shootId } })
    }

    try {
      const created = await prisma.photoAppearance.create({
        data: {
          photoId: id,
          displayName: body.displayName,
          inviteEmail: email,
          inviteMobile: body.mobile,
          invitedById: request.userId!,
          status: 'identified',
          consentStatus: 'required',
          ageClass: minor ? 'minor' : (body.ageClass ?? (photo.possibleMinor ? 'unknown' : 'adult')),
          isMinor: minor,
          guardianName: minor ? body.guardianName : null,
          guardianEmail: minor ? body.guardianEmail?.toLowerCase() : null,
          guardianMobile: minor ? body.guardianMobile : null,
        },
      })
      const issued = await issueAppearanceInvite(created.id)
      await syncVerifiedRightsRecord(id)
      await writeAuditLog({
        actorId: request.userId,
        action: 'model.invite',
        entityType: 'photo_appearance',
        entityId: created.id,
        metadata: { photoId: id, email, displayName: body.displayName, mobileProvided: true },
        ipAddress: request.ip,
      })
      return {
        appearance: serializeAppearance(issued.appearance, { includeEmail: true, includeMobile: true }),
        joinUrl: issued.joinUrl,
      }
    } catch (err) {
      if (err instanceof ModelError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })

  app.post('/contributor/photos/:id/appearances/self', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = selfShotAppearanceSchema.parse(request.body)
    const decisionBlocked = decideAppearanceBlocked(body)
    if (decisionBlocked) return reply.code(400).send({ error: decisionBlocked })

    const photo = await prisma.photo.findUnique({
      where: { id },
      include: { contributor: true },
    })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Only the photographer can identify themselves on this photograph' })
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })
    const typeBlocked = modelAccountBlocked(user.accountType)
    if (typeBlocked) return reply.code(403).send({ error: typeBlocked })

    const email = user.email.toLowerCase()
    const displayName = body.displayName?.trim() || user.name
    const usage = body.status === 'approved' ? body.usage! : (body.usage ?? 'none')
    const now = new Date()

    try {
      await ensureModelProfile(user.id, displayName)
      const existing = await prisma.photoAppearance.findFirst({
        where: { photoId: id, inviteEmail: email },
      })
      const data = {
        displayName,
        inviteEmail: email,
        modelUserId: user.id,
        invitedById: user.id,
        status: body.status === 'approved' || body.status === 'rejected' ? body.status : 'rejected',
        consentStatus: body.status === 'approved' ? 'approved' as const : 'rejected' as const,
        decisionKind: body.status === 'approved' ? 'approved' as const : 'rejected' as const,
        usage,
        confirmedLikeness: body.confirmedLikeness,
        selfShot: true,
        aiTraining: body.status === 'approved' ? Boolean(body.aiTraining) : false,
        ageClass: 'adult' as const,
        isMinor: false,
        verificationLevel: body.status === 'approved' ? 'vuekumi_verified' as const : null,
        consentQuality: body.status === 'approved' ? 'verified' as const : 'claimed' as const,
        notes: body.notes ?? existing?.notes ?? null,
        claimedAt: existing?.claimedAt ?? now,
        decidedAt: now,
        consentVersion: body.status === 'approved' ? CONSENT_VERSION : null,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      }
      const saved = existing
        ? await prisma.photoAppearance.update({
            where: { id: existing.id },
            data,
            include: appearanceInclude,
          })
        : await prisma.photoAppearance.create({
            data: { photoId: id, ...data },
            include: appearanceInclude,
          })
      await syncPermissionToTwoParty(id)
      await writeAuditLog({
        actorId: user.id,
        action: 'model.self_shot',
        entityType: 'photo_appearance',
        entityId: saved.id,
        metadata: {
          photoId: id,
          status: body.status,
          usage,
          confirmedLikeness: body.confirmedLikeness,
          consentVersion: body.status === 'approved' ? CONSENT_VERSION : null,
        },
        ipAddress: request.ip,
      })
      return { appearance: serializeAppearance(saved, { includeEmail: true }) }
    } catch (err) {
      if (err instanceof ModelError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })

  app.post('/contributor/photos/:id/appearances/:appearanceId/age', gate, async (request, reply) => {
    const { id, appearanceId } = request.params as { id: string; appearanceId: string }
    const body = declareSubjectAgeSchema.parse({ ...request.body as object, appearanceId })
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const row = await prisma.photoAppearance.findUnique({ where: { id: appearanceId } })
    if (!row || row.photoId !== id) return reply.code(404).send({ error: 'Appearance not found' })
    const minor = Boolean(body.isMinor || body.ageClass === 'minor')
    if (minor && (!body.guardianName || !body.guardianEmail || !body.guardianMobile)) {
      return reply.code(400).send({
        error: 'A parent or legal guardian name, email and mobile are required for a minor',
      })
    }
    const updated = await prisma.photoAppearance.update({
      where: { id: appearanceId },
      data: {
        ageClass: minor ? 'minor' : body.ageClass,
        isMinor: minor,
        guardianName: minor ? body.guardianName : null,
        guardianEmail: minor ? body.guardianEmail?.toLowerCase() : null,
        guardianMobile: minor ? body.guardianMobile : null,
        guardianAuthorizedAt: minor && body.guardianAuthorized ? new Date() : (minor ? row.guardianAuthorizedAt : null),
      },
      include: appearanceInclude,
    })
    await syncVerifiedRightsRecord(id)
    if (minor && body.guardianAuthorized) {
      await appendRightsLedgerEvent({
        photoId: id,
        action: 'likeness.guardian_authorized',
        actorId: request.userId,
        actorKind: isImpersonatingStaff(request.authUser) ? 'staff' : 'user',
        relatedIds: { appearanceId },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      })
    }
    return { appearance: serializeAppearance(updated, { includeEmail: true, includeMobile: true }) }
  })

  app.post('/contributor/photos/:id/appearances/:appearanceId/guardian', gate, async (request, reply) => {
    const { id, appearanceId } = request.params as { id: string; appearanceId: string }
    authorizeGuardianSchema.parse(request.body)
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const row = await prisma.photoAppearance.findUnique({ where: { id: appearanceId } })
    if (!row || row.photoId !== id) return reply.code(404).send({ error: 'Appearance not found' })
    if (!row.isMinor) return reply.code(400).send({ error: 'Guardian authorization applies only to a minor' })
    if (!row.guardianName || !row.guardianEmail || !row.guardianMobile) {
      return reply.code(400).send({ error: 'Record the parent or legal guardian name, email and mobile first' })
    }
    const updated = await prisma.photoAppearance.update({
      where: { id: appearanceId },
      data: { guardianAuthorizedAt: new Date() },
      include: appearanceInclude,
    })
    await syncVerifiedRightsRecord(id)
    await appendRightsLedgerEvent({
      photoId: id,
      action: 'likeness.guardian_authorized',
      actorId: request.userId,
      actorKind: isImpersonatingStaff(request.authUser) ? 'staff' : 'user',
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
    return { appearance: serializeAppearance(updated, { includeEmail: true, includeMobile: true }) }
  })

  app.get('/contributor/photos/:id/rights-ledger', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({ where: { id }, select: { contributorId: true, uploadedById: true } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    const mine = photo.contributorId === request.userId || photo.uploadedById === request.userId
    if (!isImpersonatingStaff(request.authUser) && !mine) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const ledger = await loadRightsLedger(id)
    if (!ledger) return reply.code(404).send({ error: 'Photo not found' })
    return { ledger }
  })

  app.post('/contributor/photos/:id/appearances/:appearanceId/resend', gate, async (request, reply) => {
    const { id, appearanceId } = request.params as { id: string; appearanceId: string }
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
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
    if (!isImpersonatingStaff(request.authUser) && photo.contributorId !== request.userId) {
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
