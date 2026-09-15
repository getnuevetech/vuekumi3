import type { ModelReleaseStatus, PhotoStatus } from '@prisma/client'

export class PhotoEditError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'PhotoEditError'
    this.statusCode = statusCode
  }
}

export function assertContributorStatusChange(input: {
  current: PhotoStatus
  next: 'delisted' | 'pending'
  exclusiveSold: boolean
}): void {
  if (input.exclusiveSold) {
    throw new PhotoEditError('An exclusive licence has already been sold for this photograph')
  }
  if (input.next === 'delisted') {
    if (input.current !== 'active' && input.current !== 'pending') {
      throw new PhotoEditError('Only live or pending photographs can be unpublished')
    }
    return
  }
  if (input.current !== 'delisted' && input.current !== 'rejected' && input.current !== 'draft') {
    throw new PhotoEditError('Only unpublished, draft, or rejected photographs can be resubmitted')
  }
}

export function nextLicensePrice(input: {
  licenseType: 'free' | 'premium'
  price?: number
  currentPrice: number
}): number {
  if (input.licenseType === 'free') return 0
  if (input.price != null) return input.price
  return input.currentPrice > 0 ? input.currentPrice : 12
}

export function nextModelReleaseFields(input: {
  hasRecognizablePeople: boolean
  current: ModelReleaseStatus | null
}): { modelReleaseRequired: boolean; modelReleaseStatus: ModelReleaseStatus } {
  if (!input.hasRecognizablePeople) {
    return { modelReleaseRequired: false, modelReleaseStatus: 'not_required' }
  }
  if (input.current === 'verified') {
    return { modelReleaseRequired: true, modelReleaseStatus: 'verified' }
  }
  return { modelReleaseRequired: true, modelReleaseStatus: 'pending' }
}

export function assertExclusiveEdit(input: {
  exclusiveSold: boolean
  exclusiveAvailable?: boolean
}): void {
  if (input.exclusiveSold && input.exclusiveAvailable === false) {
    throw new PhotoEditError('Exclusive sale cannot be turned off after an exclusive licence is granted')
  }
}

export function assertPeopleFlagEdit(input: {
  requested?: boolean
  currentlyRequired: boolean
}): void {
  if (input.requested === false && input.currentlyRequired) {
    throw new PhotoEditError(
      'Ask an admin to clear a model-release requirement. You can only declare that people are present.',
    )
  }
}
