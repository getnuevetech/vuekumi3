export type AccountType = 'admin' | 'contributor' | 'user' | 'agency'
export type UserStatus = 'active' | 'suspended' | 'pending'
export type LicenseType = 'free' | 'premium'
export type PhotoStatus = 'draft' | 'pending' | 'active' | 'rejected' | 'delisted'
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

export interface PhotoDto {
  id: string
  src: string
  title: string
  category: string
  country: string
  photographer: string
  license: LicenseType
  price: number
  downloads: number
  views: number
  likes: number
  tags: string[]
  status: PhotoStatus
}

export interface PaginatedPhotos {
  items: PhotoDto[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}
