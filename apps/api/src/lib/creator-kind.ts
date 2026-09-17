import type { CreatorKind } from '@vuekumi/shared'

/**
 * Phase 29 — creator kind is presentation and discovery only. It never changes
 * rights, earnings, or the platform agreement: a photo influencer is a
 * photographer account, not a separate type.
 */

/** Photographer and community-contributor registrations carry a creator kind. */
export function registrationCreatorKind(
  accountType: string,
  requested?: CreatorKind,
): CreatorKind | null {
  if (accountType !== 'contributor' && accountType !== 'photographer') return null
  return requested ?? 'photographer'
}

/**
 * A profile update may change the kind only when the account actually has a
 * contributor profile (model-only and buyer accounts have no creator kind).
 * Returns the kind to write, or null for "no change".
 */
export function creatorKindChange(
  hasContributorProfile: boolean,
  requested?: CreatorKind,
): CreatorKind | null {
  if (!requested || !hasContributorProfile) return null
  return requested
}

/** Prisma where fragment for filtering the public creator directory by kind. */
export function creatorKindWhere(kind?: CreatorKind): {
  contributorProfile?: { creatorKind: CreatorKind }
} {
  return kind ? { contributorProfile: { creatorKind: kind } } : {}
}
