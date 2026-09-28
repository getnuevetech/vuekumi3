import {
  commercialStatusFromLock,
  deriveRightsStatus,
  openLibraryEligibility,
  resolveUploadLibraryTier,
  verifiedPlusEligibility,
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
  accountType?: string | null
  hasPhotographerAgreement?: boolean | null
}): LibraryTier {
  const resolved = resolveUploadLibraryTier({
    accountType: input.accountType ?? null,
    licenseType: input.licenseType,
    permissionState: input.permissionState,
    requestedTier: input.requestedTier,
    hasPhotographerAgreement: input.hasPhotographerAgreement,
  })
  if (resolved.error && input.requestedTier) {
    const err = new Error(resolved.error) as Error & { statusCode?: number; reason?: string }
    err.statusCode = 400
    err.reason = 'library_tier_forbidden'
    throw err
  }
  return resolved.tier
}

export function syncCommercialStatus(locked: boolean): CommercialStatus {
  return commercialStatusFromLock(locked)
}

export function assertVerifiedPlusAllowed(input: {
  commercialStatus: CommercialStatus
  rightsStatus: RightsStatus
  permissionState?: string | null
  commercialLocked?: boolean
}) {
  const gate = verifiedPlusEligibility(input)
  if (gate.allowed) return
  const err = new Error(
    gate.reason === 'private_inventory'
      ? 'Verified+ cannot be applied to private or portfolio inventory'
      : gate.reason === 'commercial_blocked'
        ? 'Verified+ requires commercial licensing to be enabled'
        : 'Verified+ requires Rights Verified clearance first',
  ) as Error & { statusCode?: number; reason?: string }
  err.statusCode = 400
  err.reason = gate.reason
  throw err
}

export function photoRightsStatus(input: {
  copyrightStatus?: string | null
  modelConsentStatus?: string | null
  commercialLocked?: boolean
  creationClaim?: string | null
  appearances?: { status: string; selfShot: boolean; ageBand?: string | null; consentStatus?: string | null; consentQuality?: string | null; verificationLevel?: string | null; usage?: string | null; confirmedLikeness?: boolean }[]
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
      consentStatus: row.consentStatus as never,
      consentQuality: row.consentQuality as never,
      verificationLevel: row.verificationLevel as never,
      usage: row.usage ?? undefined,
      confirmedLikeness: row.confirmedLikeness,
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
  creationClaim?: string | null
  appearances?: Parameters<typeof photoRightsStatus>[0]['appearances']
  copyrightCommercialScope?: boolean
}) {
  const rightsStatus = photoRightsStatus({
    copyrightStatus: input.copyrightStatus,
    modelConsentStatus: input.modelConsentStatus,
    commercialLocked: input.commercialLocked,
    creationClaim: input.creationClaim,
    appearances: input.appearances,
    copyrightCommercialScope: input.copyrightCommercialScope,
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
