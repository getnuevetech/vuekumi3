import type { FastifyInstance } from 'fastify'
import {
  type ContributorGate,
  requireCreatorWorkspace,
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

export async function registerContributorUploadRoutes(app: FastifyInstance, gate: ContributorGate) {
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

}
