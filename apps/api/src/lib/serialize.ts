import type {
  ContributorProfile,
  LicenseGrant,
  LicenseProduct,
  LicenseQuote,
  Photo,
  PlatformAgreement,
  RightsRecord,
  User,
  AdminProfile,
  AgencyMember,
} from '@prisma/client'
import type {
  AuthUser,
  LicenseGrantDto,
  LicenseProductDto,
  LicenseQuoteDto,
  PhotoDto,
  RightsDto,
} from '@vuekumi/shared'
import { isLicenseOffered, priceForProduct, rightsReadyForLive } from './rights.js'

type UserWithRelations = User & {
  contributorProfile?: ContributorProfile | null
  adminProfile?: AdminProfile | null
  agencyMembers?: AgencyMember[]
}

export function serializeUser(user: UserWithRelations): AuthUser {
  const agencyMember = user.agencyMembers?.[0]
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    status: user.status,
    country: user.country,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    contributorHandle: user.contributorProfile?.handle ?? null,
    adminRole: user.adminProfile?.adminRole ?? null,
    agencyId: agencyMember?.agencyId ?? null,
    agencyRole: agencyMember?.agencyRole ?? null,
  }
}

export function serializeRights(
  photo: Pick<Photo, 'exclusiveAvailable' | 'exclusiveSold' | 'hasRecognizablePeople'>,
  rights: RightsRecord | null,
  hasAgreement: boolean,
): RightsDto {
  const live = rightsReadyForLive({ rights, hasAgreement })
  return {
    copyrightVerified: rights?.copyrightVerified ?? false,
    copyrightHolder: rights?.copyrightHolder ?? null,
    modelReleaseRequired: rights?.modelReleaseRequired ?? false,
    modelReleaseStatus: rights?.modelReleaseStatus ?? 'not_required',
    platformRightsOk: rights?.platformRightsOk ?? false,
    exclusiveAvailable: photo.exclusiveAvailable,
    exclusiveSold: photo.exclusiveSold,
    hasRecognizablePeople: photo.hasRecognizablePeople,
    liveReady: live.ok,
    liveBlockers: live.reasons,
  }
}

type PhotoWithTags = Photo & {
  tags: { tag: string }[]
  rightsRecord?: RightsRecord | null
  contributor?: User & { contributorProfile?: ContributorProfile | null }
  agreements?: Pick<PlatformAgreement, 'version' | 'status'>[]
}

export function serializePhoto(photo: PhotoWithTags, photographerHandle: string, hasAgreement = true): PhotoDto {
  const contributor = photo.contributor
  return {
    id: photo.id,
    src: photo.src,
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
    tags: photo.tags.map((t) => t.tag),
    status: photo.status,
    exclusiveAvailable: photo.exclusiveAvailable,
    exclusiveSold: photo.exclusiveSold,
    hasRecognizablePeople: photo.hasRecognizablePeople,
    rights: photo.rightsRecord
      ? serializeRights(photo, photo.rightsRecord, hasAgreement)
      : undefined,
  }
}

export function serializeLicenseProduct(
  product: LicenseProduct,
  photo: Pick<Photo, 'price' | 'licenseType' | 'exclusiveAvailable' | 'exclusiveSold' | 'status'>,
  rights: RightsRecord | null,
): LicenseProductDto {
  const offer = isLicenseOffered(product, photo)
  let blockedReason = offer.reason
  if (offer.offered && product.requiresModelRelease && rights?.modelReleaseRequired && rights.modelReleaseStatus !== 'verified') {
    blockedReason = 'A verified model release is required for this commercial licence'
  }
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
    photo: Pick<Photo, 'id' | 'title' | 'src'>
    product: Pick<LicenseProduct, 'name'>
  },
): LicenseGrantDto {
  return {
    id: grant.id,
    photoId: grant.photoId,
    photoTitle: grant.photo.title,
    photoSrc: grant.photo.src,
    licenseType: grant.licenseType,
    licenseName: grant.product.name,
    amountUsd: grant.amountUsd,
    currency: grant.currency,
    amountLocal: grant.amountLocal,
    certificateCode: grant.certificateCode,
    createdAt: grant.createdAt.toISOString(),
    scope: (grant.scopeJson ?? {}) as Record<string, unknown>,
  }
}

export function serializeQuote(
  quote: LicenseQuote & {
    photo: Pick<Photo, 'id' | 'title' | 'src'>
    requester?: Pick<User, 'email'>
  },
): LicenseQuoteDto {
  return {
    id: quote.id,
    photoId: quote.photoId,
    photoTitle: quote.photo.title,
    photoSrc: quote.photo.src,
    requesterEmail: quote.requester?.email,
    territory: quote.territory,
    duration: quote.duration,
    channels: quote.channels,
    notes: quote.notes,
    quoteUsd: quote.quoteUsd,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
  }
}
