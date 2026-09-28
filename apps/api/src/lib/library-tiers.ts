import {
  commercialStatusFromLock,
  defaultLibraryTier,
  deriveRightsStatus,
  openLibraryEligibility,
  type CommercialStatus,
  type CreationClaim,
  type LibraryTier,
  type RightsStatus,
  isCommerciallyEligible,
} from '@vuekumi/shared'

export function resolveLibraryTierForWrite(input: {
  licenseType: 'free' | 'premium'
  permissionState?: string | null
  requestedTier?: LibraryTier | null
}): LibraryTier {
  if (input.requestedTier) return input.requestedTier
  return defaultLibraryTier({
    licenseType: input.licenseType,
    permissionState: input.permissionState,
  })
}

export function syncCommercialStatus(locked: boolean): CommercialStatus {
  return commercialStatusFromLock(locked)
}

export function photoRightsStatus(input: {
  copyrightStatus?: string | null
  modelConsentStatus?: string | null
  commercialLocked?: boolean
  creationClaim?: string | null
  appearances?: { status: string; selfShot: boolean; ageBand?: string | null }[]
  copyrightCommercialScope?: boolean
}): RightsStatus {
  const creationClaim = (input.creationClaim as CreationClaim | null | undefined) ?? 'self_created'
  const commercialEligible = isCommerciallyEligible({
    copyrightStatus: (input.copyrightStatus as 'claimed' | 'documented' | 'verified' | 'restricted' | 'disputed' | undefined) ?? 'claimed',
    modelConsentStatus: (input.modelConsentStatus as
      | 'not_required'
      | 'required'
      | 'invitation_sent'
      | 'pending'
      | 'approved'
      | 'rejected'
      | 'revoked'
      | 'disputed'
      | undefined) ?? 'not_required',
    commercialLocked: Boolean(input.commercialLocked),
    creationClaim,
    appearances: (input.appearances ?? []).map((row) => ({
      status: row.status,
      selfShot: row.selfShot,
      ageBand: row.ageBand ?? null,
    })),
    copyrightCommercialScope: input.copyrightCommercialScope,
  })
  return deriveRightsStatus({
    copyrightStatus: input.copyrightStatus,
    modelConsentStatus: input.modelConsentStatus,
    commercialEligible,
  })
}

export function assertOpenDownloadAllowed(input: {
  libraryTier: LibraryTier
  commercialStatus: CommercialStatus
  copyrightStatus?: string | null
  modelConsentStatus?: string | null
  commercialLocked?: boolean
  compensationRequested?: boolean
}) {
  const rightsStatus = photoRightsStatus({
    copyrightStatus: input.copyrightStatus,
    modelConsentStatus: input.modelConsentStatus,
    commercialLocked: input.commercialLocked,
  })
  const gate = openLibraryEligibility({
    libraryTier: input.libraryTier,
    commercialStatus: input.commercialStatus,
    rightsStatus,
    compensationRequested: input.compensationRequested,
  })
  if (!gate.allowed) {
    const err = new Error(
      gate.reason === 'compensation_requested'
        ? 'Open eligibility blocked — compensation requested. Move to Licensed or negotiate zero-fee Open use.'
        : gate.reason === 'rights_incomplete' || gate.reason === 'rights_blocked'
          ? 'Open download requires verified rights for a zero-price license.'
          : 'This image is not available for Open download.',
    ) as Error & { statusCode: number; reason: string }
    err.statusCode = 403
    err.reason = gate.reason ?? 'blocked'
    throw err
  }
  return rightsStatus
}
