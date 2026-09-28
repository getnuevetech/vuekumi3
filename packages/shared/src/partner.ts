import { z } from 'zod'
import { LIBRARY_TIERS, type LibraryTier } from './library-tiers.js'
import { photoSortSchema } from './photos.js'

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
 * List filters mirror the public catalog (`libraryTier`, `license`, `tag`,
 * `photographer`, `sort`) so distributors can target the same placement tiers
 * partners see on vuekumi.com search.
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
  + 'Attribution required: photographer name and profile URL on every public display. '
  + 'Report preview downloads via POST /partner/v1/photos/:id/events — this does not grant a licence.'

export const PARTNER_API_EVENT_TYPES = ['view', 'download_preview', 'attribution_ack'] as const
export type PartnerApiEventType = (typeof PARTNER_API_EVENT_TYPES)[number]

export const partnerApiEventSchema = z.object({
  eventType: z.enum(PARTNER_API_EVENT_TYPES),
  fileVariant: z.enum(['thumb', 'preview']).optional(),
  referrer: z.string().max(500).optional().or(z.literal('')),
})
export type PartnerApiEventInput = z.infer<typeof partnerApiEventSchema>

export const createPartnerKeySchema = z.object({
  name: z.string().min(2).max(120),
  note: z.string().max(500).optional().or(z.literal('')),
})
export type CreatePartnerKeyInput = z.infer<typeof createPartnerKeySchema>

/** Catalog-aligned list query for `/partner/v1/photos`. */
export const partnerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  q: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
  license: z.enum(['free', 'premium']).optional(),
  libraryTier: z.enum(LIBRARY_TIERS).optional(),
  tag: z.string().max(60).optional(),
  photographer: z.string().max(60).optional(),
  sort: photoSortSchema.default('newest'),
})
export type PartnerListQuery = z.infer<typeof partnerListQuerySchema>

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
  /** Marketplace placement tier (Open / Licensed / Verified+ / Editorial / Private). */
  libraryTier: LibraryTier
  /** Catalog pricing class — free RF vs premium paid licences. */
  licenseType: 'free' | 'premium'
  width: number | null
  height: number | null
  urls: { thumb: string; preview: string }
  photographer: { name: string; handle: string; profileUrl: string }
  /** Required credit line for partner surfaces — not optional branding. */
  attribution: {
    required: true
    text: string
    photographerName: string
    profileUrl: string
    webUrl: string
  }
  licenses: PartnerLicenseDto[]
  webUrl: string
  createdAt: string
  aiTrainingConsented: boolean
  aiTrainingPermitted: false
}

export interface PartnerApiEventDto {
  id: string
  partnerKeyId: string
  photoId: string
  eventType: PartnerApiEventType
  fileVariant: string | null
  referrer: string | null
  createdAt: string
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
