import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PermissionState } from '@vuekumi/shared'
import {
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
} from '@vuekumi/shared'
import { accountHasFeature, allowsCommercialStock } from '../../lib/account-features.js'
import { writeAuditLog } from '../../lib/audit.js'
import { syncAiTrainingEligible } from '../../lib/ai-training.js'
import { isImpersonatingStaff, resolveCreatorWorkspaceId } from '../../lib/act-as-creator.js'
import { requireCreatorWorkspace } from '../../lib/auth-middleware.js'
import { prisma } from '../../lib/prisma.js'
import { assertContributorUploadAllowed } from '../../lib/policy-decision.js'
import { processPhotoAssets } from '../../lib/process-photo.js'
import { contributorHasAgreement } from '../../lib/rights.js'
import { serializePhoto } from '../../lib/serialize.js'
import { resolveLibraryTierForWrite, syncCommercialStatus } from '../../lib/library-tiers.js'
import { approvalRate } from '../../lib/follows.js'
import { payoutQuoteForContributor } from '../../lib/payout-fx.js'
import { earningsMonthSeries } from '../../lib/payouts.js'
import {
  PhotoEditError,
  assertContributorStatusChange,
  assertExclusiveEdit,
  assertPeopleFlagEdit,
  nextLicensePrice,
  nextModelReleaseFields,
} from '../../lib/photo-edit.js'
import {
  assertPermissionStateChange,
  permissionWriteData,
  resolvePermissionState,
} from '../../lib/permissions.js'
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
} from '../../lib/models.js'
import { appendRightsLedgerEvent, loadRightsLedger } from '../../lib/ledger.js'
import { issueAppearanceInvite } from '../models.js'
import { loadOriginalBytes, screenImageForRights, screeningWriteData } from '../../lib/screening.js'
import { applyPreviewAdjustment, proposeRemediation, type RemediationProposal } from '../../lib/remediation.js'
import { narrateCatalogEngagement, reportingProviderKind } from '../../lib/analytics-report.js'
import { evaluateContentApproval } from '../../lib/moderation.js'
import {
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
} from '../../lib/storage.js'

export const PLACEHOLDER_SRC = '/images/photos/fashion-portrait.jpg'
export const photoInclude = {
  tags: true,
  rightsRecord: true,
  appearances: true,
  contributor: { include: { contributorProfile: true, platformAgreements: true } },
} as const

export async function assertUploadForContributor(
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

export type ContributorGate = { preHandler: ReturnType<typeof requireCreatorWorkspace> }

export type { PermissionState, RemediationProposal }

// Re-exports for domain modules
export {
  z,
  type FastifyInstance,
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
  requireCreatorWorkspace,
  prisma,
  processPhotoAssets,
  contributorHasAgreement,
  serializePhoto,
  resolveLibraryTierForWrite,
  syncCommercialStatus,
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
}
