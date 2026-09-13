import type { GrantLicenseType, LicenseProduct, Photo, PlatformAgreement, RightsRecord } from '@prisma/client'
import { CURRENT_AGREEMENT_VERSION } from '../data/licenses.js'
import { prisma } from './prisma.js'

export class RightsError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'RightsError'
    this.statusCode = statusCode
  }
}

export function hasCurrentAgreement(agreements: Pick<PlatformAgreement, 'version' | 'status'>[]): boolean {
  return agreements.some((a) => a.version === CURRENT_AGREEMENT_VERSION && a.status === 'accepted')
}

export function modelReleaseBlocksCommercial(rights: RightsRecord | null): boolean {
  if (!rights?.modelReleaseRequired) return false
  return rights.modelReleaseStatus !== 'verified'
}

export function rightsReadyForLive(input: {
  rights: RightsRecord | null
  hasAgreement: boolean
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!input.rights?.copyrightVerified) reasons.push('Copyright not verified')
  if (!input.rights?.platformRightsOk) reasons.push('Platform rights incomplete')
  if (!input.hasAgreement) reasons.push('Contributor has not accepted the current VueKumi agreement')
  if (input.rights?.modelReleaseRequired && input.rights.modelReleaseStatus !== 'verified') {
    reasons.push('Model release required and not verified')
  }
  return { ok: reasons.length === 0, reasons }
}

export function priceForProduct(product: LicenseProduct, photo: Pick<Photo, 'price' | 'licenseType'>): number | null {
  if (product.quoteOnly) return null
  if (product.type === 'commercial') return photo.price > 0 ? photo.price : product.defaultUsd
  if (product.type === 'royalty_free') return photo.licenseType === 'free' ? 0 : product.defaultUsd
  return product.defaultUsd
}

export function isLicenseOffered(
  product: LicenseProduct,
  photo: Pick<Photo, 'licenseType' | 'exclusiveAvailable' | 'exclusiveSold' | 'status'>,
): { offered: boolean; reason?: string } {
  if (!product.active) return { offered: false, reason: 'Licence type is inactive' }
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

export function assertCanGrant(
  product: LicenseProduct,
  photo: Pick<Photo, 'licenseType' | 'exclusiveAvailable' | 'exclusiveSold' | 'status'>,
  rights: RightsRecord | null,
) {
  const offer = isLicenseOffered(product, photo)
  if (!offer.offered) throw new RightsError(offer.reason ?? 'Licence not available')
  if (product.requiresModelRelease && modelReleaseBlocksCommercial(rights)) {
    throw new RightsError(
      'A verified model release is required before this commercial licence can be granted',
    )
  }
}

export async function contributorHasAgreement(userId: string): Promise<boolean> {
  const agreements = await prisma.platformAgreement.findMany({
    where: { userId, status: 'accepted' },
    select: { version: true, status: true },
  })
  return hasCurrentAgreement(agreements)
}

export function certificateCode(photoId: string, licenseType: GrantLicenseType): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `VK-${photoId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10)}-${licenseType.slice(0, 3).toUpperCase()}-${rand}`
}
