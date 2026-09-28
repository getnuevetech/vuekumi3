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

export async function registerContributorRightsRoutes(app: FastifyInstance, gate: ContributorGate) {
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
