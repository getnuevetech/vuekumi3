import { z } from 'zod'

export const MODEL_APPEARANCE_STATUSES = [
  'identified',
  'invited',
  'claimed',
  'approved',
  'rejected',
] as const

export const modelAppearanceStatusSchema = z.enum(MODEL_APPEARANCE_STATUSES)
export type ModelAppearanceStatus = z.infer<typeof modelAppearanceStatusSchema>

export const MODEL_USAGE_PREFERENCES = ['none', 'editorial', 'commercial'] as const
export const modelUsagePreferenceSchema = z.enum(MODEL_USAGE_PREFERENCES)
export type ModelUsagePreference = z.infer<typeof modelUsagePreferenceSchema>

export const identifyAppearanceSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().email(),
})

export const decideAppearanceSchema = z.object({
  confirmedLikeness: z.boolean(),
  status: z.enum(['approved', 'rejected']),
  usage: modelUsagePreferenceSchema.optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const acceptModelInviteSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).optional(),
})

export type IdentifyAppearanceInput = z.infer<typeof identifyAppearanceSchema>
export type DecideAppearanceInput = z.infer<typeof decideAppearanceSchema>
export type AcceptModelInviteInput = z.infer<typeof acceptModelInviteSchema>

export interface PhotoAppearanceDto {
  id: string
  photoId: string
  photoTitle?: string
  photoSrc?: string
  photographerName?: string
  displayName: string
  inviteEmail?: string | null
  status: ModelAppearanceStatus
  usage: ModelUsagePreference
  confirmedLikeness: boolean
  modelHandle?: string | null
  invitedAt?: string | null
  claimedAt?: string | null
  decidedAt?: string | null
  inviteExpiresAt?: string | null
  notes?: string | null
}

export interface ModelInvitePreviewDto {
  email: string
  displayName: string
  photoTitle: string
  photographerName: string
  expiresAt: string
  needsAccount: boolean
}

export const MODEL_APPEARANCE_LABEL: Record<ModelAppearanceStatus, string> = {
  identified: 'Named only',
  invited: 'Invited',
  claimed: 'Claimed — awaiting decision',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const MODEL_USAGE_LABEL: Record<ModelUsagePreference, string> = {
  none: 'No usage',
  editorial: 'Editorial only',
  commercial: 'Editorial and commercial',
}
