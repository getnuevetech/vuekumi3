import { z } from 'zod'

export const ACCOUNT_TYPES = ['admin', 'photographer', 'contributor', 'user', 'agency', 'model'] as const
export const accountTypeSchema = z.enum(ACCOUNT_TYPES)

export const PUBLIC_REGISTER_ACCOUNT_TYPES = ['photographer', 'contributor', 'user', 'agency'] as const
export const publicRegisterAccountTypeSchema = z.enum(PUBLIC_REGISTER_ACCOUNT_TYPES)

/** Account types staff may create from the admin portal (Phase 35). Admin users wait for Phase 36. */
export const STAFF_CREATE_ACCOUNT_TYPES = ['user', 'photographer', 'contributor', 'agency', 'model'] as const
export const staffCreateAccountTypeSchema = z.enum(STAFF_CREATE_ACCOUNT_TYPES)
export type StaffCreateAccountType = (typeof STAFF_CREATE_ACCOUNT_TYPES)[number]

export const CREATOR_ACCOUNT_TYPES = ['photographer', 'contributor'] as const
export type CreatorAccountType = (typeof CREATOR_ACCOUNT_TYPES)[number]

export function isPhotographerAccount(accountType: string | null | undefined): boolean {
  return accountType === 'photographer'
}

export function isCommunityContributor(accountType: string | null | undefined): boolean {
  return accountType === 'contributor'
}

export function isCreatorAccount(accountType: string | null | undefined): boolean {
  return accountType === 'photographer' || accountType === 'contributor' || accountType === 'admin'
}

/** Professional photographers (and staff acting as them) may enter commercial inventory. */
export function canEnterCommercialInventory(accountType: string | null | undefined): boolean {
  return accountType === 'photographer' || accountType === 'admin'
}

export function creatorPortalLabel(accountType: string | null | undefined): string {
  if (accountType === 'photographer' || accountType === 'admin') return 'Photographer'
  if (accountType === 'contributor') return 'Contributor'
  return 'Creator'
}
