import { z } from 'zod'

export const ACCOUNT_TYPES = ['admin', 'photographer', 'contributor', 'user', 'agency', 'model'] as const
export const accountTypeSchema = z.enum(ACCOUNT_TYPES)

export const PUBLIC_REGISTER_ACCOUNT_TYPES = ['photographer', 'contributor', 'user', 'agency'] as const
export const publicRegisterAccountTypeSchema = z.enum(PUBLIC_REGISTER_ACCOUNT_TYPES)

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
