import { z } from 'zod'

/**
 * Phase 29 — creator kind on contributor accounts.
 *
 * A photo influencer is still a `contributor`: same copyright, same platform
 * agreement, same 50% share of paid licences. The kind only changes how the
 * creator is presented and discovered, so the directory does not pretend every
 * creator is a studio photographer.
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
