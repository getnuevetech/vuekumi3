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
  edge: 16,
  editorial: 6,
  pricing: 3,
  stats_background: 1,
}

export const HOME_CATEGORY_BANNER_CAPACITY = 8

export const HOME_EDITORIAL_MODES = ['pins', 'category'] as const
export type HomeEditorialMode = (typeof HOME_EDITORIAL_MODES)[number]

export const HOME_FEATURED_SLOT_LABEL: Record<HomeFeaturedSlotKey, string> = {
  hero: 'Hero slider',
  edge: 'Featured images',
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

export const categoryBannerPinSchema = z.object({
  photoId: z.string().min(1).nullable(),
  category: z.string().trim().min(1).max(80).nullable(),
})
export type CategoryBannerPin = z.infer<typeof categoryBannerPinSchema>

/** Desktop featured-image size before the admin controls, in viewport-width percent. */
const FEATURED_FRAME_BASE = {
  widthVw: 28 * 0.7,
  heightVw: 28 * 0.7 * (4 / 3),
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** Starting desktop size: 20% wider and 60% taller than the previous strip. */
export const DEFAULT_FEATURED_FRAME = {
  widthVw: round2(FEATURED_FRAME_BASE.widthVw * 1.2),
  heightVw: round2(FEATURED_FRAME_BASE.heightVw * 1.6),
}

export const featuredFrameSchema = z.object({
  widthVw: z.number().min(12).max(70),
  heightVw: z.number().min(16).max(95),
})
export type FeaturedFrame = z.infer<typeof featuredFrameSchema>

export function normalizeFeaturedFrame(input?: { widthVw?: number | null; heightVw?: number | null } | null): FeaturedFrame {
  const parsed = featuredFrameSchema.safeParse({
    widthVw: input?.widthVw ?? DEFAULT_FEATURED_FRAME.widthVw,
    heightVw: input?.heightVw ?? DEFAULT_FEATURED_FRAME.heightVw,
  })
  return parsed.success ? parsed.data : { ...DEFAULT_FEATURED_FRAME }
}

export const patchHomeFeaturedSchema = z.object({
  pins: z.object({
    hero: pinArray('hero').optional(),
    edge: pinArray('edge').optional(),
    editorial: pinArray('editorial').optional(),
    pricing: pinArray('pricing').optional(),
    stats_background: pinArray('stats_background').optional(),
  }),
  categoryBanners: z.array(categoryBannerPinSchema).max(HOME_CATEGORY_BANNER_CAPACITY).optional(),
  editorial: z.object({
    mode: z.enum(HOME_EDITORIAL_MODES),
    category: z.string().trim().min(1).max(80).nullable().optional(),
  }).optional(),
  frame: featuredFrameSchema.optional(),
})
export type PatchHomeFeaturedInput = z.infer<typeof patchHomeFeaturedSchema>

export function normalizeCategoryBanners(input?: CategoryBannerPin[] | null): CategoryBannerPin[] {
  const raw = input ?? []
  return Array.from({ length: HOME_CATEGORY_BANNER_CAPACITY }, (_, i) => {
    const row = raw[i]
    const photoId = typeof row?.photoId === 'string' && row.photoId.trim() ? row.photoId.trim() : null
    const category = typeof row?.category === 'string' && row.category.trim() ? row.category.trim() : null
    return { photoId, category }
  })
}

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

export interface HomeCategoryBannerDto {
  category: string
  photo: PhotoDto
}

export interface HomeFeaturedDto {
  hero: PhotoDto[]
  edge: PhotoDto[]
  editorial: PhotoDto[]
  pricing: PhotoDto[]
  statsBackground: PhotoDto | null
  categories: HomeCategoryBannerDto[]
  editorialMode: HomeEditorialMode
  editorialCategory: string | null
  frame: FeaturedFrame
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

export interface HomeCategoryBannerAdminDto {
  position: number
  photoId: string | null
  category: string | null
  photo: PhotoDto | null
  source: 'pinned' | 'auto'
}

export interface HomeFeaturedAdminDto {
  capacities: Record<HomeFeaturedSlotKey, number>
  labels: Record<HomeFeaturedSlotKey, string>
  categoryBannerCapacity: number
  pins: Record<HomeFeaturedSlotKey, (string | null)[]>
  slots: Record<HomeFeaturedSlotKey, HomeFeaturedPositionDto[]>
  categoryBanners: HomeCategoryBannerAdminDto[]
  editorialMode: HomeEditorialMode
  editorialCategory: string | null
  frame: FeaturedFrame
}
