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
import {
  copyrightCleared,
  isCommerciallyEligible,
  likenessRightsCleared,
  outstandingConsentCount,
  resolveAdminCapabilities,
  rollupModelConsentStatus,
  twoPartyBlocksLicense,
  twoPartyCommercialCleared,
} from '@vuekumi/shared'
import { isLicenseOffered, priceForProduct, rightsReadyForLive, twoPartyLicenseBlock } from './rights.js'
import { displayPlan, displayQuota } from './subscriptions.js'

export const authUserInclude = {
  contributorProfile: true,
  modelProfile: true,
  adminProfile: true,
  userProfile: true,
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
  agencyMembers?: (AgencyMember & { agency?: Pick<Agency, 'name' | 'status'> })[]
}

export function serializeUser(user: UserWithRelations): AuthUser {
  const agencyMember = user.agencyMembers?.[0]
  const quota = displayQuota(user.userProfile, new Date())
  const plan = displayPlan(user.userProfile, new Date())
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    status: user.status,
    country: user.country,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    bio: user.contributorProfile?.bio ?? user.modelProfile?.bio ?? null,
    location: user.contributorProfile?.location ?? user.modelProfile?.location ?? null,
    contributorHandle: user.contributorProfile?.handle ?? null,
    creatorKind: user.contributorProfile?.creatorKind ?? null,
    availability: user.contributorProfile?.availability ?? user.modelProfile?.availability ?? null,
    dayRateUsd: user.contributorProfile?.dayRateUsd ?? user.modelProfile?.dayRateUsd ?? null,
    modelHandle: user.modelProfile?.handle ?? null,
    hasModelProfile: Boolean(user.modelProfile),
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
    plusUntil: plan === 'plus' && user.userProfile?.plusUntil ? user.userProfile.plusUntil.toISOString() : null,
    downloadQuotaUsed: quota.used,
    downloadQuotaLimit: quota.limit,
    downloadQuotaRemaining: quota.remaining,
    downloadQuotaUnlimited: quota.unlimited,
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
  >,
  rights: RightsRecord | null,
  hasAgreement: boolean,
  appearances: TwoPartyAppearanceInput[] = [],
): RightsDto {
  const live = rightsReadyForLive({ rights, hasAgreement })
  const copyrightStatus = (rights?.copyrightStatus ?? (rights?.copyrightVerified ? 'verified' : 'claimed')) as CopyrightStatus
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
      }) ?? null
    : null
  const commercialEligible = isCommerciallyEligible({
    copyrightStatus,
    modelConsentStatus,
    commercialLocked: photo.commercialLocked,
  })
  const levels = appearances
    .map((row) => row.verificationLevel)
    .filter((level): level is ReleaseVerificationLevel => Boolean(level))
  const releaseVerificationLevel: ReleaseVerificationLevel | null = !photo.hasRecognizablePeople
    ? null
    : levels.length > 0 && levels.every((level) => level === 'vuekumi_verified')
      ? 'vuekumi_verified'
      : levels.length > 0
        ? 'photographer_provided'
        : modelConsentStatus === 'approved'
          ? 'vuekumi_verified'
          : null
  return {
    copyrightVerified: copyrightCleared(copyrightStatus) || Boolean(rights?.copyrightVerified),
    copyrightHolder: rights?.copyrightHolder ?? null,
    copyrightStatus,
    modelReleaseRequired: rights?.modelReleaseRequired ?? photo.hasRecognizablePeople,
    modelReleaseStatus: rights?.modelReleaseStatus ?? 'not_required',
    modelConsentStatus,
    commercialEligible,
    modelReleaseVerified: photo.hasRecognizablePeople && likenessRightsCleared(modelConsentStatus),
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
  contributor?: User & { contributorProfile?: ContributorProfile | null }
  agreements?: Pick<PlatformAgreement, 'version' | 'status'>[]
  appearances?: TwoPartyAppearanceInput[]
}

export function mediaSrc(photo: Photo, kind: 'preview' | 'thumb') {
  if (photo.storageKey && photo.processingStatus === 'ready') return `/api/media/${photo.id}/${kind}`
  return photo.src
}

export function serializePhoto(
  photo: PhotoWithTags,
  photographerHandle: string,
  hasAgreement = true,
  extras?: { favorited?: boolean; photographerFollowed?: boolean; appearances?: PhotoDto['appearances'] },
): PhotoDto {
  const contributor = photo.contributor
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
      ? serializeRights(photo, photo.rightsRecord, hasAgreement, photo.appearances ?? extras?.appearances ?? [])
      : undefined,
    commercialLocked: photo.commercialLocked,
    appearances: extras?.appearances,
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
  >,
  _rights: RightsRecord | null,
  appearances: TwoPartyAppearanceInput[] = [],
): LicenseProductDto {
  const offer = isLicenseOffered(product, photo)
  const twoParty = offer.offered ? twoPartyLicenseBlock(product, photo, appearances) : undefined
  const blockedReason = twoParty ?? offer.reason
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
