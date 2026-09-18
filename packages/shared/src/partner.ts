import { z } from 'zod'

/**
 * Phase 33 — partner / distribution API.
 *
 * Authenticated, licensed, rate-limited. Partners get read access to the
 * cleared catalog only: active photographs in stock permission states. Private,
 * portfolio-only, and agency-protected inventory is never exposed, and the
 * licence flags on every photo are computed with the same guards as checkout
 * (two-approval commercial lock included) — the API cannot pretend an image is
 * commercially cleared when it is not.
 *
 * The API distributes usage permission, not ownership. Licences are granted on
 * VueKumi checkout, not by the API. Partner access explicitly excludes
 * AI-training use even when a photograph has a separate AI-training opt-in.
 * Dataset pricing is undecided; this API never grants training rights.
 */

export const PARTNER_API_TERMS =
  'Usage permission only, never ownership. Licences are granted on VueKumi checkout. '
  + 'AI training is not permitted through this API even when a photograph has a separate AI-training opt-in. '
  + 'Dataset pricing is undecided; VueKumi does not sell training access. '
  + 'Attribution: photographer name and profile URL.'

export const createPartnerKeySchema = z.object({
  name: z.string().min(2).max(120),
  note: z.string().max(500).optional().or(z.literal('')),
})
export type CreatePartnerKeyInput = z.infer<typeof createPartnerKeySchema>

export const PARTNER_KEY_STATUSES = ['active', 'revoked'] as const
export type PartnerKeyStatus = (typeof PARTNER_KEY_STATUSES)[number]

export interface PartnerKeyDto {
  id: string
  name: string
  note: string | null
  keyPrefix: string
  status: PartnerKeyStatus
  requestCount: number
  lastUsedAt: string | null
  createdAt: string
}

export interface PartnerLicenseDto {
  type: string
  name: string
  priceUsd: number | null
  offered: boolean
  reason?: string
}

export interface PartnerPhotoDto {
  id: string
  title: string
  description: string | null
  category: string
  country: string
  tags: string[]
  width: number | null
  height: number | null
  urls: { thumb: string; preview: string }
  photographer: { name: string; handle: string; profileUrl: string }
  licenses: PartnerLicenseDto[]
  webUrl: string
  createdAt: string
  aiTrainingConsented: boolean
  aiTrainingPermitted: false
}

/** Why a partner request is rejected, or null when the key is good. */
export function partnerAuthBlocked(input: {
  keyProvided: boolean
  keyFound: boolean
  status?: PartnerKeyStatus
}): { status: number; error: string } | null {
  if (!input.keyProvided) return { status: 401, error: 'Partner API key required' }
  if (!input.keyFound) return { status: 401, error: 'Unknown partner API key' }
  if (input.status !== 'active') return { status: 401, error: 'This partner API key has been revoked' }
  return null
}
