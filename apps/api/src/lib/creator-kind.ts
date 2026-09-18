import type { CreatorKind } from '@vuekumi/shared'
import { creatorKindFromAccountType } from '@vuekumi/shared'
import { DIRECTORY_ACCOUNT_TYPES } from '@vuekumi/shared'

/**
 * Creator kind is derived from account type. Photographers and photo
 * influencers are separate types and cannot be mixed or converted.
 */

export function registrationCreatorKind(
  accountType: string,
  _requested?: CreatorKind,
): CreatorKind | null {
  const locked = creatorKindFromAccountType(accountType)
  if (locked) return locked
  if (accountType === 'contributor') return 'photographer'
  return null
}

export function mixedCreatorKindBlocked(
  accountType: string,
  requested?: CreatorKind,
): string | null {
  if (!requested) return null
  if (accountType === 'photographer' && requested === 'photo_influencer') {
    return 'Photographers and photo influencers are separate account types. Register as a photo influencer.'
  }
  if (accountType === 'photo_influencer' && requested === 'photographer') {
    return 'Photographers and photo influencers are separate account types. Register as a photographer.'
  }
  if (accountType === 'contributor' && requested === 'photo_influencer') {
    return 'Community contributors and photo influencers are separate account types.'
  }
  return null
}

/** Kind cannot change after signup — account type is the source of truth. */
export function creatorKindChange(
  _hasContributorProfile: boolean,
  _requested?: CreatorKind,
): CreatorKind | null {
  return null
}

/** Prisma where fragment for the public creator directory. */
export function creatorKindWhere(kind?: CreatorKind): {
  accountType: 'photographer' | 'photo_influencer' | { in: Array<'photographer' | 'photo_influencer'> }
} {
  if (kind === 'photo_influencer') return { accountType: 'photo_influencer' }
  if (kind === 'photographer') return { accountType: 'photographer' }
  return { accountType: { in: [...DIRECTORY_ACCOUNT_TYPES] } }
}
