import type {
  Agency,
  ContributorProfile,
  LicenseGrant,
  LicenseProduct,
  LicenseQuote,
  Payment,
  Photo,
  PlatformAgreement,
  RightsRecord,
  User,
  UserProfile,
  AdminProfile,
  AgencyMember,
} from '@prisma/client'
import type {
  AuthUser,
  CheckoutDto,
  CopyrightStatus,
  LicenseGrantDto,
  LicenseProductDto,
  LicenseQuoteDto,
  ModelConsentStatus,
  PaymentDto,
  PhotoDto,
  ReleaseVerificationLevel,
  RightsDto,
  ScreeningKind,
} from '@vuekumi/shared'
import type { TwoPartyAppearanceInput } from '@vuekumi/shared'
import { splitDisplayName } from '@vuekumi/shared'
import {
  commercialEligibilityBlock,
  copyrightCleared,
  isCommerciallyEligible,
  likenessAuthorizationSufficient,
  outstandingConsentCount,
  publicRightsVerified,
  resolveAdminCapabilities,
  rollupModelConsentStatus,
  thirdPartyCopyright,
  twoPartyBlocksLicense,
  twoPartyCommercialCleared,
  aiTrainingEligibilityBlock,
  type CreationClaim,
} from '@vuekumi/shared'
import { CURRENT_AGREEMENT_VERSION } from '../data/licenses.js'
import { isLicenseOffered, priceForProduct, rightsReadyForLive, twoPartyLicenseBlock } from './rights.js'
import { displayPlan, displayQuota } from './subscriptions.js'

export const authUserInclude = {
  contributorProfile: true,
  modelProfile: true,
  adminProfile: true,
  userProfile: true,
  platformAgreements: { where: { status: 'accepted' as const }, select: { version: true } },
  agencyMembers: {
    where: { status: 'active' },
    take: 1,
    include: { agency: true },
  },
} as const

type UserWithRelations = User & {
  contributorProfile?: ContributorProfile | null
  modelProfile?: {
    handle: string
    bio: string | null
    location: string | null
    availability?: 'open' | 'limited' | 'unavailable'
    dayRateUsd?: number | null
  } | null
  adminProfile?: AdminProfile | null
  userProfile?: UserProfile | null
  platformAgreements?: { version: string }[]
  agencyMembers?: (AgencyMember & { agency?: Pick<Agency, 'name' | 'status'> })[]
}

export function serializeUser(user: UserWithRelations): AuthUser {
  const agencyMember = user.agencyMembers?.[0]
  const quota = displayQuota(user.userProfile, new Date())
  const plan = displayPlan(user.userProfile, new Date())
  const stored = user.firstName
    ? { firstName: user.firstName, lastName: user.lastName ?? '' }
    : splitDisplayName(user.name)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: stored.firstName,
    lastName: stored.lastName,
    accountType: user.accountType,
    status: user.status,
    country: user.country,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    phoneCountryCode: user.phoneCountryCode,
    phone: user.phone,
    addressLine: user.addressLine,
    city: user.city,
    bio: user.bio ?? user.contributorProfile?.bio ?? user.modelProfile?.bio ?? null,
    location: user.location ?? user.contributorProfile?.location ?? user.modelProfile?.location ?? null,
    contributorHandle: user.contributorProfile?.handle ?? null,
    creatorKind: user.contributorProfile?.creatorKind ?? null,
    availability: user.contributorProfile?.availability ?? user.modelProfile?.availability ?? null,
    dayRateUsd: user.contributorProfile?.dayRateUsd ?? user.modelProfile?.dayRateUsd ?? null,
    modelHandle: user.modelProfile?.handle ?? null,
    hasModelProfile: Boolean(user.modelProfile),
    hasPhotographerAgreement: Boolean(
      user.platformAgreements?.some((row) => row.version === CURRENT_AGREEMENT_VERSION),
    ),
    adminRole: user.adminProfile?.adminRole ?? null,
    adminCapabilities: user.adminProfile
      ? resolveAdminCapabilities({
          adminRole: user.adminProfile.adminRole,
          capabilities: user.adminProfile.capabilities,
          capabilitiesCustomized: user.adminProfile.capabilitiesCustomized,
        })
      : undefined,
    adminCapabilitiesCustomized: user.adminProfile?.capabilitiesCustomized ?? false,
    agencyId: agencyMember?.agencyId ?? null,
    agencyRole: agencyMember?.agencyRole ?? null,
    agencyName: agencyMember?.agency?.name ?? null,
    agencyStatus: agencyMember?.agency?.status ?? null,
    subscriptionPlan: plan,
    plusUntil: plan !== 'free' && user.userProfile?.plusUntil ? user.userProfile.plusUntil.toISOString() : null,
    downloadQuotaUsed: quota.used,
    downloadQuotaLimit: quota.limit,
    downloadQuotaRemaining: quota.remaining,
    downloadQuotaUnlimited: quota.unlimited,
    theme: user.theme === 'light' || user.theme === 'dark' ? user.theme : null,
  }
}

export function serializeRights(
  photo: Pick<
    Photo,
    | 'exclusiveAvailable'
    | 'exclusiveSold'
    | 'hasRecognizablePeople'
    | 'commercialLocked'
    | 'possibleMinor'
    | 'screeningKind'
    | 'creationClaim'
  > & { copyrightCommercialScope?: boolean; modelSelfShotNeedsAgreement?: boolean },
  rights: RightsRecord | null,
  hasAgreement: boolean,
  appearances: TwoPartyAppearanceInput[] = [],
): RightsDto {
  const live = rightsReadyForLive({ rights, hasAgreement })
  const copyrightStatus = (rights?.copyrightStatus ?? (rights?.copyrightVerified ? 'verified' : 'claimed')) as CopyrightStatus
  const creationClaim = ((photo as { creationClaim?: CreationClaim }).creationClaim ?? 'self_created') as CreationClaim
  const modelConsentStatus = (rights?.modelConsentStatus
    ?? rollupModelConsentStatus({
      hasRecognizablePeople: photo.hasRecognizablePeople,
      appearances,
    })) as ModelConsentStatus
  const outstanding = outstandingConsentCount(appearances)
  const twoPartyBlocker = photo.hasRecognizablePeople
    ? twoPartyBlocksLicense({
        hasRecognizablePeople: true,
        appearances,
        licenseType: 'commercial',
        requiresModelRelease: true,
        copyrightStatus,
        creationClaim,
        copyrightCommercialScope: (photo as { copyrightCommercialScope?: boolean }).copyrightCommercialScope,
      }) ?? null
    : null
  const commercialEligible = isCommerciallyEligible({
    copyrightStatus,
    modelConsentStatus,
    commercialLocked: photo.commercialLocked,
    creationClaim,
    appearances,
    copyrightCommercialScope: photo.copyrightCommercialScope,
  }) && !photo.modelSelfShotNeedsAgreement
  const levels = appearances
    .map((row) => row.verificationLevel)
    .filter((level): level is ReleaseVerificationLevel => Boolean(level))
  const releaseVerificationLevel: ReleaseVerificationLevel | null = !photo.hasRecognizablePeople
    ? null
    : levels.length > 0 && levels.every((level) => level === 'vuekumi_verified')
      ? 'vuekumi_verified'
      : levels.length > 0
        ? 'photographer_provided'
        : likenessAuthorizationSufficient({ modelConsentStatus, appearances })
          ? 'vuekumi_verified'
          : null
  const rightsVerified = publicRightsVerified({
    copyrightStatus,
    modelConsentStatus,
    appearances,
  })
  return {
    copyrightVerified: copyrightCleared(copyrightStatus) || Boolean(rights?.copyrightVerified),
    copyrightHolder: rights?.copyrightHolder ?? null,
    copyrightStatus,
    copyrightMethod: rights?.copyrightMethod,
    creationClaim,
    thirdPartyCopyright: thirdPartyCopyright(creationClaim),
    modelReleaseRequired: rights?.modelReleaseRequired ?? photo.hasRecognizablePeople,
    modelReleaseStatus: rights?.modelReleaseStatus ?? 'not_required',
    modelConsentStatus,
    commercialEligible,
    copyrightAiTraining: Boolean((photo as Photo & { copyrightAiTraining?: boolean }).copyrightAiTraining)
      || Boolean(
        (photo as PhotoWithTags).copyrightAuthorizations?.some((row) =>
          row.status === 'approved' && Boolean((row as { aiTraining?: boolean }).aiTraining),
        ),
      ),
    aiTrainingEligible: Boolean((photo as Photo & { aiTrainingEligible?: boolean }).aiTrainingEligible),
    aiTrainingBlock: aiTrainingEligibilityBlock({
      copyrightAiTraining: Boolean((photo as Photo & { copyrightAiTraining?: boolean }).copyrightAiTraining),
      authorizations: ((photo as PhotoWithTags).copyrightAuthorizations ?? []).map((row) => ({
        status: row.status,
        aiTraining: Boolean((row as { aiTraining?: boolean }).aiTraining),
      })),
      hasRecognizablePeople: photo.hasRecognizablePeople,
      appearances: appearances.map((row) => ({
        status: row.status,
        aiTraining: Boolean((row as { aiTraining?: boolean }).aiTraining),
        isMinor: Boolean((row as { isMinor?: boolean }).isMinor),
      })),
    }),
    modelReleaseVerified: photo.hasRecognizablePeople && likenessAuthorizationSufficient({
      modelConsentStatus,
      appearances,
    }),
    rightsVerified,
    releaseVerificationLevel,
    outstandingConsents: photo.hasRecognizablePeople ? outstanding : 0,
    awaitingModelConsent:
      photo.hasRecognizablePeople
      && (modelConsentStatus === 'invitation_sent' || modelConsentStatus === 'pending' || modelConsentStatus === 'required'),
    possibleMinor: Boolean((photo as Photo & { possibleMinor?: boolean }).possibleMinor),
    screeningKind: ((photo as Photo & { screeningKind?: ScreeningKind | null }).screeningKind ?? null),
    platformRightsOk: rights?.platformRightsOk ?? false,
    exclusiveAvailable: photo.exclusiveAvailable,
    exclusiveSold: photo.exclusiveSold,
    hasRecognizablePeople: photo.hasRecognizablePeople,
    liveReady: live.ok,
    liveBlockers: live.reasons,
    commercialLocked: photo.commercialLocked,
    twoPartyCleared: twoPartyCommercialCleared({
      hasRecognizablePeople: photo.hasRecognizablePeople,
      appearances,
    }),
    twoPartyBlocker,
    processVerifiedAt: rights?.processVerifiedAt ? rights.processVerifiedAt.toISOString() : null,
    consentVersion: rights?.consentVersion ?? null,
  }
}

type PhotoWithTags = Photo & {
  tags: { tag: string }[]
  rightsRecord?: RightsRecord | null
  contributor?: User & {
    contributorProfile?: ContributorProfile | null
    platformAgreements?: Pick<PlatformAgreement, 'version' | 'status'>[]
  }
  agreements?: Pick<PlatformAgreement, 'version' | 'status'>[]
  appearances?: TwoPartyAppearanceInput[]
  copyrightAuthorizations?: {
    commercialSublicensing: boolean
    status: string
    quality: string
    aiTraining?: boolean
  }[]
  copyrightCommercialScope?: boolean
}

export function mediaSrc(photo: Photo, kind: 'preview' | 'thumb') {
  if (photo.storageKey && photo.processingStatus === 'ready') return `/api/media/${photo.id}/${kind}`
  return photo.src
}

export function serializePhoto(
  photo: PhotoWithTags,
  photographerHandle: string,
  hasAgreement = true,
  extras?: {
    favorited?: boolean
    photographerFollowed?: boolean
    appearances?: PhotoDto['appearances']
    copyrightAuthorizations?: PhotoDto['copyrightAuthorizations']
  },
): PhotoDto {
  const contributor = photo.contributor
  const copyrightCommercialScope = photo.copyrightCommercialScope
    ?? (photo.copyrightAuthorizations && photo.copyrightAuthorizations.length > 0
      ? photo.copyrightAuthorizations.some((row) =>
        row.status === 'approved' && row.commercialSublicensing && row.quality === 'verified',
      )
      : undefined)
  const photographerAgreement = Boolean(
    photo.contributor?.platformAgreements?.some((a) => a.version === CURRENT_AGREEMENT_VERSION && a.status === 'accepted'),
  )
  const modelSelfShotNeedsAgreement = photo.contributor?.accountType === 'model'
    && ((photo.creationClaim ?? 'self_created') === 'self_created')
    && !photographerAgreement
  return {
    id: photo.id,
    src: mediaSrc(photo, 'preview'),
    thumbSrc: mediaSrc(photo, 'thumb'),
    hasOriginal: Boolean(photo.storageKey),
    processingStatus: photo.processingStatus,
    width: photo.width,
    height: photo.height,
    title: photo.title,
    description: photo.description,
    category: photo.category,
    country: photo.country,
    photographer: photographerHandle,
    photographerName: contributor?.name,
    photographerAvatar: contributor?.avatarUrl ?? null,
    photographerLocation: contributor?.contributorProfile?.location ?? null,
    license: photo.licenseType,
    price: photo.price,
    downloads: photo.downloads,
    views: photo.views,
    likes: photo.likes,
    favorited: extras?.favorited,
    photographerFollowed: extras?.photographerFollowed,
    tags: photo.tags.map((t) => t.tag),
    status: photo.status,
    exclusiveAvailable: photo.exclusiveAvailable,
    exclusiveSold: photo.exclusiveSold,
    hasRecognizablePeople: photo.hasRecognizablePeople,
    permissionState: photo.permissionState,
    restrictionNotes: photo.restrictionNotes,
    rights: photo.rightsRecord
      ? serializeRights(
          { ...photo, copyrightCommercialScope, modelSelfShotNeedsAgreement },
          photo.rightsRecord,
          hasAgreement,
          photo.appearances ?? extras?.appearances ?? [],
        )
      : undefined,
    commercialLocked: photo.commercialLocked,
    commercialLockReason: photo.commercialLockReason ?? null,
    appearances: extras?.appearances,
    copyrightAuthorizations: extras?.copyrightAuthorizations,
  }
}

export function serializeLicenseProduct(
  product: LicenseProduct,
  photo: Pick<
    Photo,
    | 'price'
    | 'licenseType'
    | 'exclusiveAvailable'
    | 'exclusiveSold'
    | 'status'
    | 'commercialLocked'
    | 'permissionState'
    | 'hasRecognizablePeople'
    | 'creationClaim'
  >,
  _rights: RightsRecord | null,
  appearances: TwoPartyAppearanceInput[] = [],
): LicenseProductDto {
  const offer = isLicenseOffered(product, photo)
  const twoParty = offer.offered
    ? twoPartyLicenseBlock(product, photo, appearances, _rights?.copyrightStatus)
    : undefined
  const authorizations = (photo as { copyrightAuthorizations?: { commercialSublicensing: boolean; status: string; quality: string }[] }).copyrightAuthorizations
  const copyrightCommercialScope = (photo as { copyrightCommercialScope?: boolean }).copyrightCommercialScope
    ?? (authorizations && authorizations.length > 0
      ? authorizations.some((row) => row.status === 'approved' && row.commercialSublicensing && row.quality === 'verified')
      : undefined)
  const eligibility = offer.offered && product.commercialAllowed
    ? commercialEligibilityBlock({
        copyrightStatus: _rights?.copyrightStatus ?? 'claimed',
        modelConsentStatus: _rights?.modelConsentStatus ?? 'not_required',
        commercialLocked: photo.commercialLocked,
        appearances,
        licenseType: product.type,
        creationClaim: photo.creationClaim,
        copyrightCommercialScope,
      })
    : undefined
  const blockedReason = eligibility ?? twoParty ?? offer.reason
  return {
    id: product.id,
    type: product.type,
    name: product.name,
    description: product.description,
    priceUsd: priceForProduct(product, photo),
    quoteOnly: product.quoteOnly,
    points: product.points,
    commercialAllowed: product.commercialAllowed,
    requiresModelRelease: product.requiresModelRelease,
    exclusiveOptIn: product.exclusiveOptIn,
    offered: offer.offered && !blockedReason,
    blockedReason,
  }
}

export function serializeGrant(
  grant: LicenseGrant & {
    photo: Pick<Photo, 'id' | 'title' | 'src' | 'storageKey' | 'processingStatus'>
    product: Pick<LicenseProduct, 'name'>
    buyer?: Pick<User, 'name' | 'email'>
  },
): LicenseGrantDto {
  return {
    id: grant.id,
    photoId: grant.photoId,
    photoTitle: grant.photo.title,
    photoSrc:
      grant.photo.storageKey && grant.photo.processingStatus === 'ready'
        ? `/api/media/${grant.photo.id}/preview`
        : grant.photo.src,
    hasOriginal: Boolean(grant.photo.storageKey),
    licenseType: grant.licenseType,
    licenseName: grant.product.name,
    amountUsd: grant.amountUsd,
    currency: grant.currency,
    amountLocal: grant.amountLocal,
    certificateCode: grant.certificateCode,
    createdAt: grant.createdAt.toISOString(),
    scope: (grant.scopeJson ?? {}) as Record<string, unknown>,
    buyerName: grant.buyer?.name,
    buyerEmail: grant.buyer?.email,
    agreementKind: (grant as { agreementKind?: string | null }).agreementKind ?? undefined,
    agreementVersion: (grant as { agreementVersion?: string | null }).agreementVersion ?? undefined,
  }
}

export function serializeQuote(
  quote: LicenseQuote & {
    photo: Pick<Photo, 'id' | 'title' | 'src'>
    requester?: Pick<User, 'email' | 'name'>
  },
): LicenseQuoteDto {
  return {
    id: quote.id,
    photoId: quote.photoId,
    photoTitle: quote.photo.title,
    photoSrc: quote.photo.src,
    requesterEmail: quote.requester?.email,
    requesterName: quote.requester?.name,
    territory: quote.territory,
    duration: quote.duration,
    channels: quote.channels,
    notes: quote.notes,
    quoteUsd: quote.quoteUsd,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
  }
}

export function serializePayment(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    status: payment.status,
    provider: payment.provider as PaymentDto['provider'],
    amountUsd: payment.amountUsd,
    currency: payment.currency,
    amountLocal: payment.amountLocal,
    checkoutUrl: payment.checkoutUrl,
    photoId: payment.photoId,
  }
}

export function serializeCheckout(payment: Payment): CheckoutDto {
  return {
    paymentId: payment.id,
    provider: payment.provider as CheckoutDto['provider'],
    url: payment.checkoutUrl ?? `/checkout/${payment.id}`,
    amountUsd: payment.amountUsd,
    currency: payment.currency,
    amountLocal: payment.amountLocal,
  }
}
