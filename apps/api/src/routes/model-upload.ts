import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  COPYRIGHT_AUTHORIZATION_ATTESTATION,
  acceptPhotographerAgreementSchema,
  applyScreeningToPeopleFlag,
  canEnterCommercialInventory,
  guestCopyrightConsentSchema,
  identifyCopyrightHolderSchema,
  isCommerciallyEligible,
  presignUploadSchema,
  submitModelPhotoSchema,
  thirdPartyCopyright,
  updatePhotoSchema,
} from '@vuekumi/shared'
import { writeAuditLog } from '../lib/audit.js'
import { uniqueStaffHandle } from '../lib/admin-accounts.js'
import { requireAccountTypes } from '../lib/auth-middleware.js'
import {
  ModelError,
  appearanceInclude,
  serializeAppearance,
  syncVerifiedRightsRecord,
} from '../lib/models.js'
import {
  copyrightInclude,
  applyCopyrightDecision,
  issueCopyrightInvite,
  relatedCopyrightWhere,
  serializeCopyrightAuthorization,
  userHasPhotographerAgreement,
} from '../lib/copyright.js'
import { CURRENT_AGREEMENT_VERSION, MODEL_UPLOADER_AGREEMENT_VERSION } from '../data/licenses.js'
import { appendRightsLedgerEvent } from '../lib/ledger.js'
import { assertContributorCountry } from '../lib/geo.js'
import { hashToken } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { processPhotoAssets } from '../lib/process-photo.js'
import { contributorHasAgreement } from '../lib/rights.js'
import { loadOriginalBytes, screenImageForRights, screeningWriteData } from '../lib/screening.js'
import { authUserInclude, serializePhoto, serializeUser } from '../lib/serialize.js'
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
import { permissionWriteData, assertPermissionStateChange } from '../lib/permissions.js'
import { PhotoEditError } from '../lib/photo-edit.js'

const PLACEHOLDER_SRC = '/images/photos/fashion-portrait.jpg'
const modelPhotoInclude = {
  tags: true,
  rightsRecord: true,
  appearances: true,
  copyrightAuthorizations: true,
  contributor: { include: { contributorProfile: true, platformAgreements: true } },
} as const

function modelError(reply: FastifyReply, err: unknown) {
  if (err instanceof ModelError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

function initialCopyrightStatus(claim: string, documented: boolean) {
  if (claim === 'unknown') return 'restricted' as const
  if (documented) return 'documented' as const
  return 'claimed' as const
}

export async function modelUploadRoutes(app: FastifyInstance) {
  const gate = { preHandler: requireAccountTypes(app, 'model') }

  app.post('/model/uploads/presign', gate, async (request, reply) => {
    const body = presignUploadSchema.parse(request.body)
    const contentType = body.contentType.toLowerCase()
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return reply.code(400).send({ error: 'Only JPEG, PNG, WebP and TIFF images are accepted' })
    }
    const ext = extensionFor(body.filename, contentType)
    const key = originalKeyFor(request.userId!, ext)
    return presignPut(key, contentType)
  })

  await app.register(async (scope) => {
    scope.addContentTypeParser('*', (request, payload, done) => {
      done(null, payload)
    })
    scope.put('/model/uploads/bin/:token', {
      preHandler: requireAccountTypes(app, 'model'),
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

  app.get('/model/photos', gate, async (request) => {
    const photos = await prisma.photo.findMany({
      where: { uploadedById: request.userId },
      include: modelPhotoInclude,
      orderBy: { createdAt: 'desc' },
    })
    return {
      items: photos.map((p) =>
        serializePhoto(
          p,
          p.contributor.contributorProfile?.handle ?? p.contributorId,
          true,
          {
            appearances: p.appearances.map((row) => serializeAppearance(row)),
            copyrightAuthorizations: p.copyrightAuthorizations.map((row) => serializeCopyrightAuthorization(row)),
          },
        ),
      ),
    }
  })

  app.get('/model/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await prisma.photo.findUnique({ where: { id }, include: modelPhotoInclude })
    if (!photo) return reply.code(404).send({ error: 'Photo not found' })
    if (photo.uploadedById !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const appearances = await prisma.photoAppearance.findMany({
      where: { photoId: id },
      include: appearanceInclude,
      orderBy: { createdAt: 'asc' },
    })
    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? photo.contributorId,
        true,
        {
          appearances: appearances.map((row) => serializeAppearance(row, { includeEmail: true, includeMobile: true })),
          copyrightAuthorizations: photo.copyrightAuthorizations.map((row) =>
            serializeCopyrightAuthorization(row, { includeEmail: true, includeMobile: true }),
          ),
        },
      ),
    }
  })

  app.post('/model/photos', gate, async (request, reply) => {
    const userId = request.userId!
    const hasAgreement = await contributorHasAgreement(userId)
    if (!hasAgreement) {
      return reply.code(400).send({ error: 'Accept the VueKumi model uploader agreement before submitting' })
    }
    const body = submitModelPhotoSchema.parse(request.body)
    if (body.originalKey) {
      try {
        assertOwnedOriginalKey(body.originalKey, userId)
      } catch {
        return reply.code(400).send({ error: 'Invalid original storage key' })
      }
      if (!(await objectExists(body.originalKey))) {
        return reply.code(400).send({ error: 'Upload the image file before submitting' })
      }
    }

    const photographerAgreement = await userHasPhotographerAgreement(userId)
    const commercialUploader = canEnterCommercialInventory(request.authUser?.accountType, {
      hasPhotographerAgreement: photographerAgreement,
    })
    const image = await loadOriginalBytes(body.originalKey)
    const screening = await screenImageForRights({
      title: body.title,
      category: body.category,
      filename: body.originalKey,
      declaredPeople: body.hasRecognizablePeople || body.inPhotograph,
      image,
    })
    const people = applyScreeningToPeopleFlag({
      declaredPeople: body.hasRecognizablePeople || body.inPhotograph,
      screening,
    })
    const documented = Boolean(body.assignmentDocumentName)
    const copyrightStatus = initialCopyrightStatus(body.creationClaim, documented)
    const copyrightMethod = documented ? 'document' as const : 'attestation' as const
    const thirdParty = thirdPartyCopyright(body.creationClaim)
    const now = new Date()
    const selfShotVerified = body.inPhotograph && body.ownLikenessConfirmed
    const modelConsentStatus = people
      ? (selfShotVerified && screening.kind !== 'multiple_recognizable_people' ? 'approved' : 'required')
      : 'not_required'
    const commercialEligible = commercialUploader && isCommerciallyEligible({
      copyrightStatus,
      modelConsentStatus,
      creationClaim: body.creationClaim,
      copyrightCommercialScope: false,
      appearances: selfShotVerified
        ? [{ status: 'approved', consentStatus: 'approved', usage: body.ownUsage ?? 'editorial', confirmedLikeness: true, selfShot: true, consentQuality: 'verified' }]
        : [],
    })
    if (!commercialUploader && body.creationClaim === 'self_created' && body.ownUsage === 'commercial') {
      // commercial likeness is stored, but permission stays portfolio until photographer agreement
    }
    const permission = permissionWriteData('portfolio', false)
    const id = `mdl-${Date.now().toString(36)}`
    const processingStatus = body.originalKey ? 'pending' : 'ready'

    let photo = await prisma.$transaction(async (tx) => {
      const created = await tx.photo.create({
        data: {
          id,
          contributorId: userId,
          uploadedById: userId,
          creationClaim: body.creationClaim,
          title: body.title,
          description: body.description,
          category: body.category,
          country: body.country,
          licenseType: 'free',
          price: 0,
          status: 'pending',
          src: body.src || PLACEHOLDER_SRC,
          storageKey: body.originalKey,
          processingStatus,
          hasRecognizablePeople: people,
          exclusiveAvailable: false,
          permissionState: permission.permissionState,
          restrictionNotes: permission.restrictionNotes,
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
              copyrightVerified: copyrightStatus === 'claimed' || copyrightStatus === 'documented',
              copyrightStatus,
              copyrightMethod,
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
              flag: thirdParty ? 'copyright holder' : 'model upload',
              submittedBy: request.authUser?.modelHandle ?? request.authUser?.email ?? userId,
              status: 'pending',
            },
          },
        },
        include: modelPhotoInclude,
      })

      if (selfShotVerified) {
        await tx.photoAppearance.create({
          data: {
            photoId: created.id,
            displayName: request.authUser?.name ?? 'Model',
            inviteEmail: request.authUser?.email ?? null,
            modelUserId: userId,
            invitedById: userId,
            status: 'approved',
            consentStatus: 'approved',
            decisionKind: 'approved',
            usage: body.ownUsage ?? 'editorial',
            confirmedLikeness: true,
            selfShot: true,
            consentVersion: '1.0',
            verificationLevel: 'vuekumi_verified',
            consentQuality: 'verified',
            ageClass: 'adult',
            claimedAt: now,
            decidedAt: now,
          },
        })
      }

      if (thirdParty && body.creationClaim !== 'unknown' && body.photographerEmail) {
        await tx.copyrightAuthorization.create({
          data: {
            photoId: created.id,
            displayName: body.photographerName!,
            inviteEmail: body.photographerEmail.toLowerCase(),
            inviteMobile: body.photographerMobile,
            invitedById: userId,
            status: 'identified',
            quality: documented ? 'documented' : 'claimed',
            documentFileName: body.assignmentDocumentName ?? null,
          },
        })
      }

      return created
    })

    let joinUrl: string | undefined
    if (thirdParty && body.creationClaim !== 'unknown' && body.photographerEmail) {
      const row = await prisma.copyrightAuthorization.findFirst({ where: { photoId: photo.id } })
      if (row) {
        try {
          const issued = await issueCopyrightInvite(row.id)
          joinUrl = issued.joinUrl
        } catch (err) {
          request.log.warn({ err, photoId: photo.id }, 'photographer rights notice failed')
        }
      }
    }

    if (body.originalKey) {
      try {
        await processPhotoAssets(photo.id)
      } catch (err) {
        request.log.warn({ err, photoId: photo.id }, 'inline derivative processing failed')
      }
    }

    await syncVerifiedRightsRecord(photo.id)
    await writeAuditLog({
      actorId: userId,
      action: 'model.submit_photo',
      entityType: 'photo',
      entityId: photo.id,
      metadata: {
        creationClaim: body.creationClaim,
        inPhotograph: body.inPhotograph,
        thirdParty,
      },
      ipAddress: request.ip,
    })
    await appendRightsLedgerEvent({
      photoId: photo.id,
      action: documented ? 'copyright.documented' : 'copyright.attested',
      actorId: userId,
      actorKind: 'user',
      agreementVersion: MODEL_UPLOADER_AGREEMENT_VERSION,
      nextCopyright: copyrightStatus,
      nextQuality: documented ? 'documented' : 'claimed',
      nextLikeness: modelConsentStatus,
      commercialEligible,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    })

    const reloaded = await prisma.photo.findUnique({ where: { id: photo.id }, include: modelPhotoInclude })
    photo = reloaded ?? photo
    return {
      photo: serializePhoto(
        photo,
        photo.contributor.contributorProfile?.handle ?? userId,
        true,
        {
          appearances: photo.appearances.map((row) => serializeAppearance(row)),
          copyrightAuthorizations: photo.copyrightAuthorizations.map((row) => serializeCopyrightAuthorization(row)),
        },
      ),
      joinUrl,
    }
  })

  app.patch('/model/photos/:id', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePhotoSchema.parse(request.body)
    const existing = await prisma.photo.findUnique({
      where: { id },
      include: { rightsRecord: true, appearances: true, copyrightAuthorizations: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Photo not found' })
    if (existing.uploadedById !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const photographerAgreement = await userHasPhotographerAgreement(request.userId!)
    const commercialUploader = canEnterCommercialInventory(request.authUser?.accountType, {
      hasPhotographerAgreement: photographerAgreement,
    })
    const requested = body.permissionState
    if (requested && ['commercial', 'exclusive', 'agency_protected'].includes(requested) && !commercialUploader) {
      return reply.code(400).send({
        error: 'Commercial inventory requires the photographer licensing agreement on this same email. Account type stays model.',
      })
    }
    const copyrightCommercialScope = existing.copyrightAuthorizations.some((row) =>
      row.status === 'approved' && row.commercialSublicensing && row.quality === 'verified',
    )
    const eligible = isCommerciallyEligible({
      copyrightStatus: existing.rightsRecord?.copyrightStatus ?? 'claimed',
      modelConsentStatus: existing.rightsRecord?.modelConsentStatus ?? 'not_required',
      commercialLocked: existing.commercialLocked,
      creationClaim: existing.creationClaim,
      appearances: existing.appearances,
      copyrightCommercialScope,
    })
    if (requested && ['commercial', 'exclusive'].includes(requested) && !eligible) {
      return reply.code(400).send({
        error: 'Commercial state is refused until copyright and likeness are VueKumi-verified and commercial scopes are granted',
      })
    }

    const permissionState = requested ?? existing.permissionState
    try {
      assertPermissionStateChange({
        next: permissionState,
        current: existing.permissionState,
        exclusiveSold: existing.exclusiveSold,
        commercialLocked: existing.commercialLocked,
        hasRecognizablePeople: existing.hasRecognizablePeople,
        twoPartyCleared: eligible,
        actor: 'contributor',
      })
    } catch (err) {
      if (err instanceof PhotoEditError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }

    const permission = permissionWriteData(permissionState, existing.exclusiveSold, body.restrictionNotes)
    await prisma.photo.update({
      where: { id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.category ? { category: body.category } : {}),
        ...(body.country ? { country: body.country } : {}),
        licenseType: commercialUploader && requested === 'commercial' ? 'premium' : existing.licenseType,
        ...permission,
      },
    })
    if (body.tags) {
      await prisma.photoTag.deleteMany({ where: { photoId: id } })
      if (body.tags.length) {
        await prisma.photoTag.createMany({ data: body.tags.map((tag) => ({ photoId: id, tag })) })
      }
    }
    await syncVerifiedRightsRecord(id)
    const photo = await prisma.photo.findUnique({ where: { id }, include: modelPhotoInclude })
    return {
      photo: serializePhoto(
        photo!,
        photo!.contributor.contributorProfile?.handle ?? photo!.contributorId,
        true,
        {
          appearances: photo!.appearances.map((row) => serializeAppearance(row)),
          copyrightAuthorizations: photo!.copyrightAuthorizations.map((row) => serializeCopyrightAuthorization(row)),
        },
      ),
    }
  })

  app.post('/model/photos/:id/copyright-holder', gate, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = identifyCopyrightHolderSchema.parse(request.body)
      const photo = await prisma.photo.findUnique({ where: { id } })
      if (!photo) throw new ModelError('Photo not found', 404)
      if (photo.uploadedById !== request.userId) throw new ModelError('Forbidden', 403)
      if (!thirdPartyCopyright(photo.creationClaim)) {
        throw new ModelError('This photograph does not identify another copyright holder')
      }
      const email = body.email.toLowerCase()
      if (email === request.authUser?.email.toLowerCase()) {
        throw new ModelError('Use the self-shot photographer agreement path instead of inviting yourself')
      }
      const dup = await prisma.copyrightAuthorization.findFirst({
        where: { photoId: id, inviteEmail: email },
      })
      if (dup) throw new ModelError('That photographer is already identified on this photograph', 409)
      const created = await prisma.copyrightAuthorization.create({
        data: {
          photoId: id,
          displayName: body.displayName,
          inviteEmail: email,
          inviteMobile: body.mobile,
          invitedById: request.userId!,
          status: 'identified',
          quality: 'claimed',
        },
      })
      const issued = await issueCopyrightInvite(created.id)
      await syncVerifiedRightsRecord(id)
      await writeAuditLog({
        actorId: request.userId,
        action: 'copyright.invite',
        entityType: 'copyright_authorization',
        entityId: created.id,
        metadata: { photoId: id, email, displayName: body.displayName },
        ipAddress: request.ip,
      })
      return {
        authorization: serializeCopyrightAuthorization(issued.authorization, { includeEmail: true, includeMobile: true }),
        joinUrl: issued.joinUrl,
      }
    } catch (err) {
      return modelError(reply, err)
    }
  })

  app.post('/model/photographer-agreement', gate, async (request, reply) => {
    if (request.authUser?.accountType !== 'model') {
      return reply.code(403).send({ error: 'Only model accounts accept the photographer agreement as dual-role' })
    }
    const body = acceptPhotographerAgreementSchema.parse(request.body)
    try {
      await assertContributorCountry(body.country)
    } catch (err) {
      const e = err as Error & { statusCode?: number }
      return reply.code(e.statusCode ?? 400).send({ error: e.message })
    }
    const userId = request.userId!
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { contributorProfile: true, modelProfile: true, platformAgreements: true },
    })
    if (!existing) return reply.code(401).send({ error: 'Unauthorized' })
    if (existing.platformAgreements.some((a) => a.version === CURRENT_AGREEMENT_VERSION && a.status === 'accepted')) {
      const full = await prisma.user.findUnique({ where: { id: userId }, include: authUserInclude })
      return { user: serializeUser(full!) }
    }

    if (!existing.contributorProfile) {
      const handle = existing.modelProfile?.handle
        ?? await uniqueStaffHandle(existing.name, userId)
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { country: body.country.toUpperCase() },
        })
        await tx.contributorProfile.create({
          data: {
            userId,
            handle,
            location: body.country.toUpperCase(),
            creatorKind: 'photographer',
          },
        })
        await tx.platformAgreement.create({
          data: { userId, version: CURRENT_AGREEMENT_VERSION },
        })
      })
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { country: body.country.toUpperCase() },
        })
        await tx.platformAgreement.create({
          data: { userId, version: CURRENT_AGREEMENT_VERSION },
        })
      })
    }
    await writeAuditLog({
      actorId: userId,
      action: 'model.photographer_agreement',
      entityType: 'user',
      entityId: userId,
      metadata: { country: body.country.toUpperCase(), accountType: 'model' },
      ipAddress: request.ip,
    })
    const full = await prisma.user.findUnique({ where: { id: userId }, include: authUserInclude })
    return { user: serializeUser(full!) }
  })

  app.get('/copyright/invite/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const invite = await prisma.copyrightAuthorization.findUnique({
      where: { inviteTokenHash: hashToken(token) },
      include: copyrightInclude,
    })
    if (!invite || !invite.inviteExpiresAt || invite.inviteExpiresAt < new Date()) {
      return reply.code(404).send({ error: 'Invite is invalid or has expired' })
    }
    const existing = invite.inviteEmail
      ? await prisma.user.findUnique({ where: { email: invite.inviteEmail.toLowerCase() } })
      : null
    const relatedWhere = relatedCopyrightWhere(invite)
    const related = relatedWhere
      ? await prisma.copyrightAuthorization.findMany({
          where: relatedWhere,
          include: copyrightInclude,
          orderBy: { createdAt: 'asc' },
        })
      : [invite]
    const images = (related.length ? related : [invite]).map((row) => ({
      authorizationId: row.id,
      photoId: row.photoId,
      photoTitle: row.photo.title,
      photoSrc:
        row.photo.storageKey && row.photo.processingStatus === 'ready'
          ? `/api/media/${row.photo.id}/preview`
          : row.photo.src,
      status: row.status,
    }))
    return {
      invite: {
        email: invite.inviteEmail ?? '',
        displayName: invite.displayName,
        photoTitle: invite.photo.title,
        modelName: invite.photo.uploadedBy?.name ?? invite.photo.contributor.name,
        expiresAt: invite.inviteExpiresAt.toISOString(),
        needsAccount: !existing,
        membershipRequired: false as const,
        imageCount: images.length,
        images,
        terms: COPYRIGHT_AUTHORIZATION_ATTESTATION,
        notice: 'A model identified you as the photographer. This is rights clearance, not a marketing list.',
      },
    }
  })

  app.post('/copyright/invite/:token/decide', async (request, reply) => {
    try {
      const { token } = request.params as { token: string }
      const body = guestCopyrightConsentSchema.parse(request.body)
      const invite = await prisma.copyrightAuthorization.findUnique({
        where: { inviteTokenHash: hashToken(token) },
        include: copyrightInclude,
      })
      if (!invite || !invite.inviteExpiresAt || invite.inviteExpiresAt < new Date()) {
        throw new ModelError('Invite is invalid or has expired', 404)
      }
      const relatedWhere = relatedCopyrightWhere(invite)
      const related = relatedWhere
        ? await prisma.copyrightAuthorization.findMany({ where: relatedWhere })
        : [invite]
      const updated = []
      for (const row of related) {
        updated.push(await applyCopyrightDecision({
          authorizationId: row.id,
          action: body.action,
          confirmedIdentity: body.confirmedIdentity,
          usage: body.usage,
          notes: body.notes,
          acceptAuthorizationTerms: body.acceptAuthorizationTerms,
        }))
      }
      if (body.action === 'unauthorized') {
        await writeAuditLog({
          action: 'copyright.report_unauthorized',
          entityType: 'copyright_authorization',
          entityId: invite.id,
          metadata: { photoId: invite.photoId, authorizationIds: related.map((row) => row.id) },
          ipAddress: request.ip,
        })
      }
      return {
        authorizations: updated.map((row) => serializeCopyrightAuthorization(row)),
      }
    } catch (err) {
      return modelError(reply, err)
    }
  })
}

export { issueCopyrightInvite }
