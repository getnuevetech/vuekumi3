import { z } from 'zod'
import type { PhotoDto } from './types.js'

/**
 * Phase 41 — staff can pin photographs into homepage featured slots.
 * Unfilled positions keep the live ranking fallback so the homepage never
 * goes blank. Featuring is curation, not a licence, not AI-training, and not
 * a rights grant. Only live stock-permission photographs can be pinned.
 */

export const HOME_FEATURED_SLOT_KEYS = [
  'hero',
  'edge',
  'editorial',
  'pricing',
  'stats_background',
] as const
export type HomeFeaturedSlotKey = (typeof HOME_FEATURED_SLOT_KEYS)[number]

export const HOME_FEATURED_CAPACITY: Record<HomeFeaturedSlotKey, number> = {
  hero: 3,
  edge: 4,
  editorial: 2,
  pricing: 3,
  stats_background: 1,
}

export const HOME_FEATURED_SLOT_LABEL: Record<HomeFeaturedSlotKey, string> = {
  hero: 'Hero slider',
  edge: 'Edge strip',
  editorial: 'Editorial split',
  pricing: 'Pricing cards',
  stats_background: 'Stats background',
}

export function homeFeaturedCapacity(slot: HomeFeaturedSlotKey): number {
  return HOME_FEATURED_CAPACITY[slot]
}

function pinArray(slot: HomeFeaturedSlotKey) {
  return z.array(z.string().min(1).nullable()).max(HOME_FEATURED_CAPACITY[slot])
}

export const patchHomeFeaturedSchema = z.object({
  pins: z.object({
    hero: pinArray('hero').optional(),
    edge: pinArray('edge').optional(),
    editorial: pinArray('editorial').optional(),
    pricing: pinArray('pricing').optional(),
    stats_background: pinArray('stats_background').optional(),
  }),
})
export type PatchHomeFeaturedInput = z.infer<typeof patchHomeFeaturedSchema>

export type HomeSlotPins = {
  [K in HomeFeaturedSlotKey]?: (string | null)[]
}

export function normalizeHomePins(input?: HomeSlotPins | null): Record<HomeFeaturedSlotKey, (string | null)[]> {
  const out = {} as Record<HomeFeaturedSlotKey, (string | null)[]>
  for (const slot of HOME_FEATURED_SLOT_KEYS) {
    const cap = HOME_FEATURED_CAPACITY[slot]
    const raw = input?.[slot] ?? []
    out[slot] = Array.from({ length: cap }, (_, i) => {
      const value = raw[i]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    })
  }
  return out
}

export function featuredPinIneligibleReason(input: {
  status?: string | null
  permissionState?: string | null
}): string | null {
  if (input.status && input.status !== 'active') {
    return 'Only live photographs can be featured'
  }
  if (input.permissionState === 'private' || input.permissionState === 'portfolio' || input.permissionState === 'agency_protected') {
    return 'Private, portfolio, and agency-protected photographs cannot be featured on the public homepage'
  }
  if (input.permissionState && !['editorial', 'restricted', 'commercial', 'exclusive'].includes(input.permissionState)) {
    return 'Only stock-permission photographs can be featured'
  }
  return null
}

export interface HomeCategoryShare {
  value: string
  count: number
  sharePct: number
}

export interface PublicStatsDto {
  photosLive: number
  contributors: number
  countries: number
  downloads: number
  categories: HomeCategoryShare[]
}

export interface HomeFeaturedDto {
  hero: PhotoDto[]
  edge: PhotoDto[]
  editorial: PhotoDto[]
  pricing: PhotoDto[]
  statsBackground: PhotoDto | null
}

export interface HomePageDto {
  stats: PublicStatsDto
  featured: HomeFeaturedDto
}

export interface HomeFeaturedPositionDto {
  position: number
  photoId: string | null
  photo: PhotoDto | null
  source: 'pinned' | 'auto'
  eligible: boolean
  ineligibleReason: string | null
}

export interface HomeFeaturedAdminDto {
  capacities: Record<HomeFeaturedSlotKey, number>
  labels: Record<HomeFeaturedSlotKey, string>
  pins: Record<HomeFeaturedSlotKey, (string | null)[]>
  slots: Record<HomeFeaturedSlotKey, HomeFeaturedPositionDto[]>
}
