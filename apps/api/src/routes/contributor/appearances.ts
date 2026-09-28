import type { FastifyInstance } from 'fastify'
import {
  type ContributorGate,
  z,
  PLACEHOLDER_SRC,
  photoInclude,
  assertUploadForContributor,
  CONSENT_VERSION,
  applyScreeningToPeopleFlag,
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
  accountHasFeature,
  allowsCommercialStock,
  writeAuditLog,
  syncAiTrainingEligible,
  isImpersonatingStaff,
  resolveCreatorWorkspaceId,
  prisma,
  processPhotoAssets,
  contributorHasAgreement,
  serializePhoto,
  approvalRate,
  payoutQuoteForContributor,
  earningsMonthSeries,
  PhotoEditError,
  assertContributorStatusChange,
  assertExclusiveEdit,
  assertPeopleFlagEdit,
  nextLicensePrice,
  nextModelReleaseFields,
  assertPermissionStateChange,
  permissionWriteData,
  resolvePermissionState,
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
  appendRightsLedgerEvent,
  loadRightsLedger,
  issueAppearanceInvite,
  loadOriginalBytes,
  screenImageForRights,
  screeningWriteData,
  applyPreviewAdjustment,
  proposeRemediation,
  narrateCatalogEngagement,
  reportingProviderKind,
  evaluateContentApproval,
  ALLOWED_IMAGE_TYPES,
  assertOwnedOriginalKey,
  extensionFor,
  derivativeKey,
  getObjectBuffer,
  objectExists,
  originalKeyFor,
  putObject,
  presignPut,
  verifyLocalToken,
  writeLocalUpload,
} from './shared.js'

export async function registerContributorAppearanceRoutes(app: FastifyInstance, gate: ContributorGate) {
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

}
