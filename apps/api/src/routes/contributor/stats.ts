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
import { loadSearchOpportunitySummary } from '../../lib/search-opportunity.js'

export async function registerContributorStatsRoutes(app: FastifyInstance, gate: ContributorGate) {
  app.get('/contributor/stats', gate, async (request, reply) => {
    const contributorId = await resolveCreatorWorkspaceId(request, reply)
    if (!contributorId) return
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [user, live, views, followers, rejected, available, month, seriesRows, top, favorites, licences, categoryRows, provider, opportunities] = await Promise.all([
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
      prisma.photoFavorite.count({ where: { photo: { contributorId } } }),
      prisma.licenseGrant.count({ where: { photo: { contributorId } } }),
      prisma.photo.groupBy({
        by: ['category'],
        where: { contributorId },
        _sum: { views: true },
      }),
      reportingProviderKind(),
      loadSearchOpportunitySummary({ limit: 6 }),
    ])

    const handle = user?.contributorProfile?.handle ?? ''
    const rate = approvalRate(live._count._all, rejected)
    const viewCount = views._sum.views ?? 0
    const busiest = [...categoryRows].sort((a, b) => (b._sum.views ?? 0) - (a._sum.views ?? 0))[0]
    const topCategory = (busiest?._sum.views ?? 0) > 0 ? busiest?.category ?? null : null
    const report = narrateCatalogEngagement({
      views: viewCount,
      favorites,
      licences,
      topCategory,
    })
    if (provider === 'openai') {
      report.push('A reporting provider is configured. Catalog rows are not sent to it.')
    }

    return {
      name: user?.name ?? 'Contributor',
      handle,
      avatarUrl: user?.avatarUrl ?? null,
      location: user?.contributorProfile?.location ?? null,
      downloads: live._sum.downloads ?? 0,
      views: viewCount,
      followers,
      profileViews: user?.contributorProfile?.profileViews ?? 0,
      photosCount: live._count._all,
      approvalRate: rate,
      favorites,
      licences,
      report,
      availableUsd: available._sum.amountUsd ?? 0,
      thisMonthUsd: month._sum.amountUsd ?? 0,
      payout: await payoutQuoteForContributor(contributorId),
      series: earningsMonthSeries(seriesRows),
      topPhotos: top.map((p) => serializePhoto(p, handle, true)),
      opportunities,
      actingAsUserId: isImpersonatingStaff(request.authUser) ? contributorId : null,
      actingAsAccountType: isImpersonatingStaff(request.authUser) ? user?.accountType ?? null : null,
    }
  })

}
