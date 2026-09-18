import type { GrantLicenseType, LicenseProduct, Photo, PlatformAgreement, RightsRecord } from '@prisma/client'
import type { PermissionState, TwoPartyAppearanceInput } from '@vuekumi/shared'
import { copyrightCleared, commercialEligibilityBlock, permissionBlocksLicense, thirdPartyCopyright, twoPartyBlocksLicense } from '@vuekumi/shared'
import { COMMUNITY_AGREEMENT_VERSION, CURRENT_AGREEMENT_VERSION } from '../data/licenses.js'
import { prisma } from './prisma.js'

export class RightsError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'RightsError'
    this.statusCode = statusCode
  }
}

export function hasCurrentAgreement(
  agreements: Pick<PlatformAgreement, 'version' | 'status'>[],
  accountType?: string,
): boolean {
  const needed = accountType === 'contributor' ? COMMUNITY_AGREEMENT_VERSION : CURRENT_AGREEMENT_VERSION
  return agreements.some((a) => a.version === needed && a.status === 'accepted')
}

export function rightsReadyForLive(input: {
  rights: RightsRecord | null
  hasAgreement: boolean
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const copyrightOk = input.rights
    ? copyrightCleared(input.rights.copyrightStatus) || input.rights.copyrightVerified
    : false
  if (!copyrightOk) reasons.push('Photo copyright rights are not cleared')
  if (!input.rights?.platformRightsOk) reasons.push('Platform rights incomplete')
  if (!input.hasAgreement) reasons.push('Photographer has not accepted the current VueKumi agreement')
  return { ok: reasons.length === 0, reasons }
}

export function priceForProduct(product: LicenseProduct, photo: Pick<Photo, 'price' | 'licenseType'>): number | null {
  if (product.quoteOnly) return null
  if (product.type === 'commercial') return photo.price > 0 ? photo.price : product.defaultUsd
  if (product.type === 'royalty_free') return photo.licenseType === 'free' ? 0 : product.defaultUsd
  return product.defaultUsd
}

export const COMMERCIAL_LOCK_REASON =
  'New licensing is paused while staff review a rights report'

export type PhotoLicenseFields = Pick<
  Photo,
  | 'licenseType'
  | 'exclusiveAvailable'
  | 'exclusiveSold'
  | 'status'
  | 'commercialLocked'
  | 'permissionState'
  | 'hasRecognizablePeople'
>

export function isLicenseOffered(
  product: LicenseProduct,
  photo: PhotoLicenseFields,
): { offered: boolean; reason?: string } {
  if (!product.active) return { offered: false, reason: 'Licence type is inactive' }
  if (photo.commercialLocked) return { offered: false, reason: COMMERCIAL_LOCK_REASON }
  const permissionBlock = permissionBlocksLicense(photo.permissionState as PermissionState, product.type)
  if (permissionBlock) return { offered: false, reason: permissionBlock }
  if (photo.exclusiveSold) return { offered: false, reason: 'An exclusive licence has already been sold' }
  if (photo.status !== 'active') return { offered: false, reason: 'Photo is not live' }
  if (product.exclusiveOptIn && !photo.exclusiveAvailable) {
    return { offered: false, reason: 'Contributor has not opted this photo into exclusive sale' }
  }
  if (product.type === 'royalty_free' && photo.licenseType !== 'free') {
    return { offered: false, reason: 'Royalty-free applies to the free collection' }
  }
  if (product.type === 'commercial' && photo.licenseType !== 'premium') {
    return { offered: false, reason: 'Commercial licence applies to the premium collection' }
  }
  return { offered: true }
}

export function twoPartyLicenseBlock(
  product: Pick<LicenseProduct, 'requiresModelRelease' | 'type'>,
  photo: Pick<Photo, 'hasRecognizablePeople'> & { creationClaim?: Photo['creationClaim'] },
  appearances: TwoPartyAppearanceInput[],
  copyrightStatus?: RightsRecord['copyrightStatus'],
): string | undefined {
  return twoPartyBlocksLicense({
    hasRecognizablePeople: photo.hasRecognizablePeople,
    appearances,
    licenseType: product.type,
    requiresModelRelease: product.requiresModelRelease,
    copyrightStatus,
    creationClaim: photo.creationClaim,
  })
}

export function assertCanGrant(
  product: LicenseProduct,
  photo: PhotoLicenseFields & { creationClaim?: Photo['creationClaim'] },
  rights: RightsRecord | null,
  appearances: TwoPartyAppearanceInput[] = [],
) {
  const offer = isLicenseOffered(product, photo)
  if (!offer.offered) throw new RightsError(offer.reason ?? 'Licence not available')
  const twoParty = twoPartyLicenseBlock(product, photo, appearances, rights?.copyrightStatus)
  if (twoParty) throw new RightsError(twoParty)
  const eligibility = commercialEligibilityBlock({
    copyrightStatus: rights?.copyrightStatus ?? 'claimed',
    modelConsentStatus: rights?.modelConsentStatus ?? 'not_required',
    commercialLocked: photo.commercialLocked,
    appearances,
    licenseType: product.type,
    creationClaim: photo.creationClaim,
  })
  if (eligibility) throw new RightsError(eligibility)
}

export async function contributorHasAgreement(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountType: true,
      platformAgreements: { where: { status: 'accepted' }, select: { version: true, status: true } },
    },
  })
  if (!user) return false
  return hasCurrentAgreement(user.platformAgreements, user.accountType)
}

export function certificateCode(photoId: string, licenseType: GrantLicenseType): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `VK-${photoId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10)}-${licenseType.slice(0, 3).toUpperCase()}-${rand}`
}
