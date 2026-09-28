/** Imagery Concept v2 — marketplace placement (orthogonal to rights / commercial gate). */
export const LIBRARY_TIERS = ['OPEN', 'LICENSED', 'VERIFIED_PLUS', 'EDITORIAL', 'PRIVATE'] as const
export type LibraryTier = (typeof LIBRARY_TIERS)[number]

export const COMMERCIAL_STATUSES = ['ENABLED', 'BLOCKED', 'SUSPENDED'] as const
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number]

export const RIGHTS_STATUSES = ['INCOMPLETE', 'PENDING', 'VERIFIED', 'RESTRICTED', 'DISPUTED'] as const
export type RightsStatus = (typeof RIGHTS_STATUSES)[number]

/** Current VueKumi Open license text version stamped on anonymous downloads. */
export const OPEN_LICENSE_VERSION = '1.0-open'

export function defaultLibraryTier(input: {
  licenseType: 'free' | 'premium'
  permissionState?: string | null
}): LibraryTier {
  const state = input.permissionState ?? 'commercial'
  if (state === 'private' || state === 'portfolio') return 'PRIVATE'
  if (state === 'editorial') return 'EDITORIAL'
  if (input.licenseType === 'premium') return 'LICENSED'
  return 'OPEN'
}

export function commercialStatusFromLock(locked: boolean): CommercialStatus {
  return locked ? 'BLOCKED' : 'ENABLED'
}

/**
 * Derive a coarse rights status from existing clearance fields.
 * Face match / subject match never equals commercial consent.
 */
export function deriveRightsStatus(input: {
  copyrightStatus?: string | null
  modelConsentStatus?: string | null
  commercialEligible?: boolean
}): RightsStatus {
  const copyright = input.copyrightStatus ?? 'claimed'
  const consent = input.modelConsentStatus ?? 'not_required'
  if (copyright === 'disputed' || consent === 'disputed') return 'DISPUTED'
  if (copyright === 'restricted' || consent === 'rejected' || consent === 'revoked') return 'RESTRICTED'
  if (copyright === 'verified' && (consent === 'not_required' || consent === 'approved')) {
    return input.commercialEligible === false ? 'RESTRICTED' : 'VERIFIED'
  }
  if (consent === 'invitation_sent' || consent === 'pending' || copyright === 'documented') return 'PENDING'
  return 'INCOMPLETE'
}

/**
 * VueKumi Open requires all necessary rights for a zero-price license.
 * A rights holder demanding ongoing revenue participation blocks Open
 * (handled when compensation negotiation exists; here we gate on clearance).
 */
export function openLibraryEligibility(input: {
  libraryTier: LibraryTier
  commercialStatus: CommercialStatus
  rightsStatus: RightsStatus
  compensationRequested?: boolean
}): { allowed: boolean; reason?: string } {
  if (input.libraryTier !== 'OPEN') {
    return { allowed: false, reason: 'not_open_tier' }
  }
  if (input.compensationRequested) {
    return { allowed: false, reason: 'compensation_requested' }
  }
  if (input.commercialStatus !== 'ENABLED') {
    return { allowed: false, reason: 'commercial_blocked' }
  }
  if (input.rightsStatus === 'DISPUTED' || input.rightsStatus === 'RESTRICTED') {
    return { allowed: false, reason: 'rights_blocked' }
  }
  if (input.rightsStatus === 'INCOMPLETE' || input.rightsStatus === 'PENDING') {
    return { allowed: false, reason: 'rights_incomplete' }
  }
  return { allowed: true }
}
