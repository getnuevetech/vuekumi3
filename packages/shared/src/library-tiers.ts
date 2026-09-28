/** Imagery Concept v2 — marketplace placement (orthogonal to rights / commercial gate). */
export const LIBRARY_TIERS = ['OPEN', 'LICENSED', 'VERIFIED_PLUS', 'EDITORIAL', 'PRIVATE'] as const
export type LibraryTier = (typeof LIBRARY_TIERS)[number]

/** Dec-FreeLib A: Free Library is the public name for `OPEN` (no new enum). */
export const FREE_LIBRARY_TIER: LibraryTier = 'OPEN'
export const FREE_LIBRARY_LABEL = 'Free Library'

/** Paid marketplace upload tiers (Photographers + Contributors). PRIVATE portfolio allowed. */
export const PAID_UPLOAD_LIBRARY_TIERS: LibraryTier[] = ['LICENSED', 'VERIFIED_PLUS', 'EDITORIAL', 'PRIVATE']

export const LIBRARY_TIER_LABEL: Record<LibraryTier, string> = {
  OPEN: FREE_LIBRARY_LABEL,
  LICENSED: 'Licensed',
  VERIFIED_PLUS: 'Verified+',
  EDITORIAL: 'Editorial',
  PRIVATE: 'Private',
}

/**
 * Dec-TierMap: Photo Influencer → Free Library only; Photographer/Contributor → paid tiers only.
 * Dual-role models with photographer agreement use paid tiers.
 */
export function allowedUploadLibraryTiers(
  accountType: string | null | undefined,
  opts?: { hasPhotographerAgreement?: boolean | null },
): LibraryTier[] {
  if (accountType === 'photo_influencer') return [FREE_LIBRARY_TIER]
  if (accountType === 'photographer' || accountType === 'contributor') return [...PAID_UPLOAD_LIBRARY_TIERS]
  if (accountType === 'model') {
    if (opts?.hasPhotographerAgreement) return [...PAID_UPLOAD_LIBRARY_TIERS]
    return ['PRIVATE']
  }
  if (accountType === 'admin') return [...LIBRARY_TIERS]
  return []
}

export function accountMayUploadLibraryTier(
  accountType: string | null | undefined,
  tier: LibraryTier,
  opts?: { hasPhotographerAgreement?: boolean | null },
): boolean {
  return allowedUploadLibraryTiers(accountType, opts).includes(tier)
}

/** Coerce a computed default into an allowed tier for the account, or return a block reason. */
export function resolveUploadLibraryTier(input: {
  accountType: string | null | undefined
  licenseType: 'free' | 'premium'
  permissionState?: string | null
  requestedTier?: LibraryTier | null
  hasPhotographerAgreement?: boolean | null
}): { tier: LibraryTier; error?: string } {
  const allowed = allowedUploadLibraryTiers(input.accountType, {
    hasPhotographerAgreement: input.hasPhotographerAgreement,
  })
  if (allowed.length === 0) {
    // No account context (or non-uploader): keep legacy default behavior.
    if (!input.accountType) {
      if (input.requestedTier) return { tier: input.requestedTier }
      return {
        tier: defaultLibraryTier({
          licenseType: input.licenseType,
          permissionState: input.permissionState,
        }),
      }
    }
    return { tier: FREE_LIBRARY_TIER, error: 'This account type cannot upload library images.' }
  }

  if (input.requestedTier) {
    if (!allowed.includes(input.requestedTier)) {
      if (input.accountType === 'photo_influencer') {
        return {
          tier: FREE_LIBRARY_TIER,
          error: 'Photo influencers may upload only to the Free Library.',
        }
      }
      return {
        tier: allowed[0]!,
        error: 'Photographers and contributors upload to paid library tiers only (not Free Library).',
      }
    }
    return { tier: input.requestedTier }
  }

  const computed = defaultLibraryTier({
    licenseType: input.licenseType,
    permissionState: input.permissionState,
  })
  if (allowed.includes(computed)) return { tier: computed }

  if (input.accountType === 'photo_influencer') {
    return { tier: FREE_LIBRARY_TIER }
  }

  // Photographer/Contributor: never land on OPEN/Free Library.
  if (computed === 'OPEN') {
    return { tier: input.permissionState === 'editorial' ? 'EDITORIAL' : 'LICENSED' }
  }
  return { tier: allowed.includes('LICENSED') ? 'LICENSED' : allowed[0]! }
}

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

/**
 * Verified+ is staff-set marketplace placement above Licensed.
 * Distinct from Rights Verified (rightsStatus) and Phase 60 identity evidence.
 */
export function verifiedPlusEligibility(input: {
  commercialStatus: CommercialStatus
  rightsStatus: RightsStatus
  permissionState?: string | null
  commercialLocked?: boolean
}): { allowed: boolean; reason?: string } {
  const state = input.permissionState ?? 'commercial'
  if (state === 'private' || state === 'portfolio') {
    return { allowed: false, reason: 'private_inventory' }
  }
  if (input.commercialLocked || input.commercialStatus !== 'ENABLED') {
    return { allowed: false, reason: 'commercial_blocked' }
  }
  if (input.rightsStatus !== 'VERIFIED') {
    return { allowed: false, reason: 'rights_not_verified' }
  }
  return { allowed: true }
}
