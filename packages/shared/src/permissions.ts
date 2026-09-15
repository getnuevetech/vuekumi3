import { z } from 'zod'

export const PERMISSION_STATES = [
  'private',
  'portfolio',
  'editorial',
  'restricted',
  'commercial',
  'exclusive',
  'agency_protected',
] as const

export const permissionStateSchema = z.enum(PERMISSION_STATES)
export type PermissionState = z.infer<typeof permissionStateSchema>

export const STOCK_PERMISSION_STATES: PermissionState[] = [
  'editorial',
  'restricted',
  'commercial',
  'exclusive',
]

export const PROFILE_PERMISSION_STATES: PermissionState[] = [
  'portfolio',
  'editorial',
  'restricted',
  'commercial',
  'exclusive',
  'agency_protected',
]

export const CONTRIBUTOR_PERMISSION_STATES: PermissionState[] = [
  'private',
  'portfolio',
  'editorial',
  'restricted',
  'commercial',
  'exclusive',
]

export const PERMISSION_STATE_LABEL: Record<PermissionState, string> = {
  private: 'Private',
  portfolio: 'Portfolio only',
  editorial: 'Editorial',
  restricted: 'Restricted',
  commercial: 'Commercial',
  exclusive: 'Exclusive',
  agency_protected: 'Agency-protected',
}

export const PERMISSION_STATE_HELP: Record<PermissionState, string> = {
  private: 'Only you and staff can see it. Not stock.',
  portfolio: 'Visible on your profile. Not offered as stock.',
  editorial: 'News, commentary and education. Not advertising.',
  restricted: 'Editorial or a rights-managed quote only.',
  commercial: 'Cleared for commercial stock licences.',
  exclusive: 'Sole licensed use. Delisted after one sale.',
  agency_protected: 'VueQuatro representation — not self-serve stock.',
}

export function isStockPermission(state: PermissionState): boolean {
  return STOCK_PERMISSION_STATES.includes(state)
}

export function isProfilePermission(state: PermissionState): boolean {
  return PROFILE_PERMISSION_STATES.includes(state)
}

export function defaultPermissionState(input: {
  exclusiveAvailable?: boolean
  hasRecognizablePeople: boolean
}): PermissionState {
  if (input.exclusiveAvailable) return 'exclusive'
  if (input.hasRecognizablePeople) return 'editorial'
  return 'commercial'
}

export function permissionBlocksLicense(
  state: PermissionState,
  licenseType: string,
): string | undefined {
  if (state === 'private') return 'This photograph is private'
  if (state === 'portfolio') return 'Portfolio-only — not offered as stock'
  if (state === 'agency_protected') {
    return 'Agency-protected inventory is not self-serve stock'
  }
  if (state === 'editorial' && licenseType !== 'editorial') {
    return 'Only editorial licences are available for this photograph'
  }
  if (state === 'restricted' && licenseType !== 'editorial' && licenseType !== 'rights_managed') {
    return 'This photograph is restricted — editorial or a rights-managed quote only'
  }
  return undefined
}

export function exclusiveFlagForState(state: PermissionState, exclusiveSold: boolean): boolean {
  if (exclusiveSold) return true
  return state === 'exclusive'
}

export function permissionPublicCopy(
  state: PermissionState,
  restrictionNotes?: string | null,
): string | null {
  switch (state) {
    case 'private':
      return 'This photograph is private.'
    case 'portfolio':
      return 'Portfolio only — not offered as stock.'
    case 'editorial':
      return 'Editorial use only — not for advertising.'
    case 'restricted':
      return restrictionNotes?.trim() || 'Restricted — editorial or a rights-managed quote only.'
    case 'agency_protected':
      return 'Agency-protected inventory is not self-serve stock.'
    case 'exclusive':
      return 'Exclusive sale is available for this photograph.'
    default:
      return null
  }
}
