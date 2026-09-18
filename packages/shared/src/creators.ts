import { z } from 'zod'

/**
 * Presentation label for public creator profiles.
 *
 * Photographers and photo influencers are separate `AccountType`s. This kind is
 * derived from account type for directory labels — it is not a signup sub-choice
 * and cannot convert one type into the other.
 */
export const creatorKindSchema = z.enum(['photographer', 'photo_influencer'])
export type CreatorKind = z.infer<typeof creatorKindSchema>

export const CREATOR_KINDS = creatorKindSchema.options

export const CREATOR_KIND_LABELS: Record<CreatorKind, string> = {
  photographer: 'Photographer',
  photo_influencer: 'Photo influencer',
}

export function creatorKindLabel(kind: CreatorKind | null | undefined): string {
  return CREATOR_KIND_LABELS[kind ?? 'photographer']
}

export function creatorKindFromAccountType(accountType: string | null | undefined): CreatorKind | null {
  if (accountType === 'photo_influencer') return 'photo_influencer'
  if (accountType === 'photographer') return 'photographer'
  return null
}
