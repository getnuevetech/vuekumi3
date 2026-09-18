import type { PermissionState } from './permissions.js'
import type {
  CopyrightStatus,
  ModelConsentStatus,
  ReleaseVerificationLevel,
  ScreeningKind,
} from './rights.js'
import type { CreatorKind } from './creators.js'
import type { BookingAvailability } from './bookings.js'

export type AccountType = 'admin' | 'photographer' | 'photo_influencer' | 'contributor' | 'user' | 'agency' | 'model'
export type UserStatus = 'active' | 'suspended' | 'pending'
export type LicenseType = 'free' | 'premium'
export type GrantLicenseType =
  | 'royalty_free'
  | 'commercial'
  | 'extended'
  | 'editorial'
  | 'rights_managed'
  | 'exclusive'
export type PhotoStatus = 'draft' | 'pending' | 'active' | 'rejected' | 'delisted'
export type ModelReleaseStatus = 'not_required' | 'pending' | 'verified' | 'rejected'
export type AdminRole = 'super_admin' | 'moderator' | 'finance' | 'support'
export type AgencyRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  name: string
  accountType: AccountType
  status: UserStatus
  country: string | null
  avatarUrl: string | null
  emailVerified: boolean
  hasPassword: boolean
  bio?: string | null
  location?: string | null
  contributorHandle?: string | null
  creatorKind?: CreatorKind | null
  modelHandle?: string | null
  hasModelProfile?: boolean
  availability?: BookingAvailability | null
  dayRateUsd?: number | null
  adminRole?: AdminRole | null
  adminCapabilities?: import('./admin-acl.js').AdminCapability[]
  adminCapabilitiesCustomized?: boolean
  agencyId?: string | null
  agencyRole?: AgencyRole | null
  agencyName?: string | null
  agencyStatus?: 'pending' | 'active' | 'suspended' | null
  subscriptionPlan?: 'free' | 'plus'
  plusUntil?: string | null
  downloadQuotaUsed?: number
  downloadQuotaLimit?: number | null
  downloadQuotaRemaining?: number | null
  downloadQuotaUnlimited?: boolean
}

export interface RightsDto {
  copyrightVerified: boolean
  copyrightHolder: string | null
  copyrightStatus: CopyrightStatus
  copyrightMethod?: import('./rights.js').CopyrightMethod
  creationClaim?: import('./rights.js').CreationClaim
  thirdPartyCopyright?: boolean
  modelReleaseRequired: boolean
  modelReleaseStatus: ModelReleaseStatus
  modelConsentStatus: ModelConsentStatus
  commercialEligible: boolean
  modelReleaseVerified: boolean
  rightsVerified?: boolean
  releaseVerificationLevel: ReleaseVerificationLevel | null
  outstandingConsents: number
  awaitingModelConsent: boolean
  possibleMinor: boolean
  screeningKind: ScreeningKind | null
  platformRightsOk: boolean
  exclusiveAvailable: boolean
  exclusiveSold: boolean
  hasRecognizablePeople: boolean
  liveReady: boolean
  liveBlockers: string[]
  commercialLocked: boolean
  twoPartyCleared: boolean
  twoPartyBlocker: string | null
  processVerifiedAt: string | null
  consentVersion: string | null
}

export interface PhotoDto {
  id: string
  src: string
  title: string
  description?: string | null
  category: string
  country: string
  photographer: string
  photographerName?: string
  photographerAvatar?: string | null
  photographerLocation?: string | null
  license: LicenseType
  price: number
  downloads: number
  views: number
  likes: number
  favorited?: boolean
  photographerFollowed?: boolean
  tags: string[]
  status: PhotoStatus
  permissionState?: PermissionState
  restrictionNotes?: string | null
  appearances?: import('./models.js').PhotoAppearanceDto[]
  exclusiveAvailable?: boolean
  exclusiveSold?: boolean
  hasRecognizablePeople?: boolean
  rights?: RightsDto
  commercialLocked?: boolean
  thumbSrc?: string
  hasOriginal?: boolean
  processingStatus?: string
  width?: number | null
  height?: number | null
}

export interface LicenseProductDto {
  id: string
  type: GrantLicenseType
  name: string
  description: string
  priceUsd: number | null
  quoteOnly: boolean
  points: string[]
  commercialAllowed: boolean
  requiresModelRelease: boolean
  exclusiveOptIn: boolean
  offered: boolean
  blockedReason?: string
}

export interface LicenseGrantDto {
  id: string
  photoId: string
  photoTitle: string
  photoSrc: string
  licenseType: GrantLicenseType
  licenseName: string
  amountUsd: number
  currency: string
  amountLocal: number
  certificateCode: string
  createdAt: string
  scope: Record<string, unknown>
  hasOriginal?: boolean
  buyerName?: string
  buyerEmail?: string
}

export interface LicenseQuoteDto {
  id: string
  photoId: string
  photoTitle: string
  photoSrc?: string
  requesterEmail?: string
  requesterName?: string
  territory: string
  duration: string
  channels: string
  notes: string | null
  quoteUsd: number | null
  status: 'pending' | 'quoted' | 'accepted' | 'declined'
  createdAt: string
}

export interface CheckoutDto {
  paymentId: string
  provider: 'stripe' | 'flutterwave' | 'dev'
  url: string
  amountUsd: number
  currency: string
  amountLocal: number
}

export interface PaymentDto {
  id: string
  status: string
  provider: 'stripe' | 'flutterwave' | 'dev'
  amountUsd: number
  currency: string
  amountLocal: number
  checkoutUrl: string | null
  photoId: string
}

export interface PaymentMethodsDto {
  stripe: boolean
  flutterwave: boolean
  dev: boolean
  defaultProvider: 'stripe' | 'flutterwave' | 'dev'
  contributorShare: number
}

export interface PurchaseLicenseResult {
  grant?: LicenseGrantDto
  existing?: boolean
  checkout?: CheckoutDto
}

export interface AgreementDto {
  version: string
  title: string
  body: string
}

export interface AiSuggestionDto {
  id?: string
  photoId?: string
  provider: 'openai' | 'dev'
  status?: string
  title: string | null
  description: string | null
  category: string | null
  country: string | null
  tags: string[]
  hasRecognizablePeople: boolean | null
  notes: string | null
  createdAt?: string
}

export interface AiStatusDto {
  configured: boolean
  provider: 'openai' | 'dev'
  manualOnly: true
}

export interface CatalogFacet {
  value: string
  count: number
}

export interface CatalogFacets {
  categories: CatalogFacet[]
  countries: CatalogFacet[]
  licenses: CatalogFacet[]
  tags: CatalogFacet[]
}

export interface PaginatedPhotos {
  items: PhotoDto[]
  page: number
  limit: number
  total: number
  hasMore: boolean
  facets?: CatalogFacets
}

export interface PhotographerDto {
  handle: string
  name: string
  avatarUrl: string | null
  location: string | null
  bio: string | null
  creatorKind: CreatorKind
  availability: BookingAvailability
  dayRateUsd: number | null
  represented: boolean
  photosCount: number
  downloads: number
  followers: number
  profileViews?: number
  following?: boolean
  modelHandle?: string | null
}

export interface ModelPublicDto {
  handle: string
  name: string
  avatarUrl: string | null
  location: string | null
  bio: string | null
  availability: BookingAvailability
  dayRateUsd: number | null
  photosCount: number
  photographerHandle: string | null
  earns: false
  profileViews?: number
}

export interface FollowResult {
  following: boolean
  followers: number
}

export interface ContributorStatsDto {
  name: string
  handle: string
  avatarUrl: string | null
  location: string | null
  downloads: number
  views: number
  followers: number
  profileViews: number
  photosCount: number
  approvalRate: number
  availableUsd: number
  thisMonthUsd: number
  series: { month: string; earnings: number }[]
  topPhotos: PhotoDto[]
}

export interface PhotographerProfileDto extends PaginatedPhotos {
  photographer: PhotographerDto
}

export interface ModelPublicProfileDto extends PaginatedPhotos {
  model: ModelPublicDto
}

export interface FavoriteResult {
  favorited: boolean
  likes: number
}

export interface CollectionDto {
  id: string
  name: string
  description: string | null
  visibility: 'private' | 'unlisted' | 'public'
  shareToken?: string
  ownerName: string
  agencyId: string | null
  agencyName: string | null
  photoCount: number
  coverSrc: string | null
  mine: boolean
  canEdit: boolean
  createdAt: string
  updatedAt: string
}

export interface CollectionDetailDto extends CollectionDto {
  items: PhotoDto[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface CollectionMembershipDto {
  id: string
  name: string
  contains: boolean
  shared: boolean
}

export interface AgencyDto {
  id: string
  name: string
  slug: string
  status: 'pending' | 'active' | 'suspended'
  plan: string
  seatLimit: number
  seatsUsed: number
  pendingInvites: number
  billingEmail: string | null
  myRole: AgencyRole
  membersCount: number
  grantsCount: number
  quotesCount: number
}

export interface AgencyMemberDto {
  id: string
  userId: string
  name: string
  email: string
  role: AgencyRole
  status: string
  joinedAt: string
}

export interface AgencyInviteDto {
  id: string
  email: string
  role: AgencyRole
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

export interface AgencyInvitePreviewDto {
  agencyName: string
  email: string
  role: AgencyRole
  expiresAt: string
  needsAccount: boolean
}

export interface PublicConfigDto {
  oauth: {
    google: boolean
    dev: boolean
  }
  sentryDsn: string | null
  contributorShare: number
}
