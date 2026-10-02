import { z } from 'zod'

export const DIGITAL_ID_CARD_TYPES = [
  'photo_influencer',
  'contributor',
  'photographer',
  'model',
] as const
export type DigitalIdCardType = (typeof DIGITAL_ID_CARD_TYPES)[number]

export const DIGITAL_ID_STATUSES = ['active', 'revoked'] as const
export type DigitalIdStatus = (typeof DIGITAL_ID_STATUSES)[number]

export const DIGITAL_ID_CARD_LABEL: Record<DigitalIdCardType, string> = {
  photo_influencer: 'Open Creator',
  contributor: 'Contributor',
  photographer: 'Verified Photographer',
  model: 'Verified Model',
}

/** Public Digital ID card — never includes email, phone, documents, or ledger. */
export const digitalIdPublicSchema = z.object({
  token: z.string().min(8).max(80),
  cardType: z.enum(DIGITAL_ID_CARD_TYPES),
  status: z.enum(DIGITAL_ID_STATUSES),
  issuedAt: z.string(),
  displayName: z.string(),
  handle: z.string(),
  roleLabel: z.string(),
  location: z.string().nullable(),
  publicId: z.string(),
  profilePath: z.string(),
  avatarUrl: z.string().nullable(),
  badge: z.string().nullable(),
})
export type DigitalIdPublicDto = z.infer<typeof digitalIdPublicSchema>

/** Compact preview embedded on public profile / directory DTOs. */
export const digitalIdPreviewSchema = z.object({
  token: z.string().min(8).max(80),
  cardType: z.enum(DIGITAL_ID_CARD_TYPES),
  status: z.enum(DIGITAL_ID_STATUSES),
  roleLabel: z.string(),
})
export type DigitalIdPreviewDto = z.infer<typeof digitalIdPreviewSchema>

export function digitalIdProfilePath(cardType: DigitalIdCardType, handle: string): string {
  return cardType === 'model' ? `/m/${handle}` : `/p/${handle}`
}

export function digitalIdPublicUrl(webUrl: string, token: string): string {
  const base = webUrl.replace(/\/$/, '')
  return `${base}/id/${token}`
}
