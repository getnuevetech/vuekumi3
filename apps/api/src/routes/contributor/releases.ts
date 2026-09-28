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

export async function registerContributorReleaseRoutes(app: FastifyInstance, gate: ContributorGate) {
  app.post('/contributor/photos/:id/releases', gate, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (!isImpersonatingStaff(request.authUser) && !(await allowsCommercialStock(request.authUser?.accountType ?? ''))) {
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

}
