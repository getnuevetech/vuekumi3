export type AccountType = 'admin' | 'contributor' | 'user' | 'agency'
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
  contributorHandle?: string | null
  adminRole?: AdminRole | null
  agencyId?: string | null
  agencyRole?: AgencyRole | null
}

export interface RightsDto {
  copyrightVerified: boolean
  copyrightHolder: string | null
  modelReleaseRequired: boolean
  modelReleaseStatus: ModelReleaseStatus
  platformRightsOk: boolean
  exclusiveAvailable: boolean
  exclusiveSold: boolean
  hasRecognizablePeople: boolean
  liveReady: boolean
  liveBlockers: string[]
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
  tags: string[]
  status: PhotoStatus
  exclusiveAvailable?: boolean
  exclusiveSold?: boolean
  hasRecognizablePeople?: boolean
  rights?: RightsDto
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
}

export interface LicenseQuoteDto {
  id: string
  photoId: string
  photoTitle: string
  photoSrc?: string
  requesterEmail?: string
  territory: string
  duration: string
  channels: string
  notes: string | null
  quoteUsd: number | null
  status: 'pending' | 'quoted' | 'accepted' | 'declined'
  createdAt: string
}

export interface AgreementDto {
  version: string
  title: string
  body: string
}

export interface PaginatedPhotos {
  items: PhotoDto[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}
