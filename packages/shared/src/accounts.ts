import { z } from 'zod'

export const ACCOUNT_TYPES = ['admin', 'photographer', 'photo_influencer', 'contributor', 'user', 'agency', 'model'] as const
export const accountTypeSchema = z.enum(ACCOUNT_TYPES)

export const PUBLIC_REGISTER_ACCOUNT_TYPES = ['photographer', 'photo_influencer', 'contributor', 'user', 'agency', 'model'] as const
export const publicRegisterAccountTypeSchema = z.enum(PUBLIC_REGISTER_ACCOUNT_TYPES)

/** Account types staff may create from the admin portal (Phase 35). Admin users wait for Phase 36. */
export const STAFF_CREATE_ACCOUNT_TYPES = ['user', 'photographer', 'photo_influencer', 'contributor', 'agency', 'model'] as const
export const staffCreateAccountTypeSchema = z.enum(STAFF_CREATE_ACCOUNT_TYPES)
export type StaffCreateAccountType = (typeof STAFF_CREATE_ACCOUNT_TYPES)[number]

export const CREATOR_ACCOUNT_TYPES = ['photographer', 'photo_influencer', 'contributor'] as const
export type CreatorAccountType = (typeof CREATOR_ACCOUNT_TYPES)[number]

/** Public /creators directory — photographers and photo influencers, never mixed with community. */
export const DIRECTORY_ACCOUNT_TYPES = ['photographer', 'photo_influencer'] as const

export function isPhotographerAccount(accountType: string | null | undefined): boolean {
  return accountType === 'photographer'
}

export function isPhotoInfluencerAccount(accountType: string | null | undefined): boolean {
  return accountType === 'photo_influencer'
}

export function isCommunityContributor(accountType: string | null | undefined): boolean {
  return accountType === 'contributor'
}

/** Community contributors and photo influencers cannot enter commercial stock. */
export function isNonCommercialCreator(accountType: string | null | undefined): boolean {
  return accountType === 'contributor' || accountType === 'photo_influencer'
}

export function isAfricaRestrictedCreator(accountType: string | null | undefined): boolean {
  return accountType === 'photographer' || accountType === 'photo_influencer' || accountType === 'contributor'
}

export function isCreatorWorkspaceAccount(accountType: string | null | undefined): boolean {
  return accountType === 'photographer' || accountType === 'photo_influencer' || accountType === 'contributor'
}

export function isCreatorAccount(accountType: string | null | undefined): boolean {
  return isCreatorWorkspaceAccount(accountType) || accountType === 'admin'
}

/**
 * Professional photographers (and staff acting as them) may enter commercial inventory.
 * A model who has accepted the photographer agreement on the same email (dual-role)
 * may also enter commercial inventory. `accountType` stays `model`.
 */
export function canEnterCommercialInventory(
  accountType: string | null | undefined,
  opts?: { hasPhotographerAgreement?: boolean | null },
): boolean {
  if (accountType === 'photographer' || accountType === 'admin') return true
  if (accountType === 'model' && opts?.hasPhotographerAgreement) return true
  return false
}

export function creatorPortalLabel(accountType: string | null | undefined): string {
  if (accountType === 'photographer' || accountType === 'admin') return 'Photographer'
  if (accountType === 'photo_influencer') return 'Photo influencer'
  if (accountType === 'contributor') return 'Contributor'
  return 'Creator'
}
