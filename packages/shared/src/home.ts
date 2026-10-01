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
  hero: 'D01 Hero banner and background',
  edge: 'Featured images',
  editorial: 'D01 Featured Collections',
  pricing: 'D01 License banner',
  stats_background: 'D01 Continent banner',
}

export function homeFeaturedCapacity(slot: HomeFeaturedSlotKey): number {
  return HOME_FEATURED_CAPACITY[slot]
}

/** Slots that can show an uploaded image instead of a catalog photograph. Featured images stay on the catalog. */
export const HOME_UPLOAD_SLOT_KEYS = ['hero', 'editorial', 'pricing', 'stats_background'] as const
export type HomeUploadSlotKey = (typeof HOME_UPLOAD_SLOT_KEYS)[number]

export function isHomeUploadSlot(slot: string): slot is HomeUploadSlotKey {
  return (HOME_UPLOAD_SLOT_KEYS as readonly string[]).includes(slot)
}

function pinArray(slot: HomeFeaturedSlotKey) {
  return z.array(z.string().min(1).nullable()).max(HOME_FEATURED_CAPACITY[slot])
}

function uploadArray(slot: HomeUploadSlotKey) {
  return z.array(z.string().trim().max(500).nullable()).max(HOME_FEATURED_CAPACITY[slot])
}

export const categoryBannerPinSchema = z.object({
  photoId: z.string().min(1).nullable(),
  category: z.string().trim().min(1).max(80).nullable(),
  imageSrc: z.string().trim().max(500).nullable().optional(),
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

/** Built-in homepage sections. Header, footer, and back-to-top stay fixed. */
export const HOME_BUILTIN_SECTIONS = [
  'hero',
  'marquee',
  'featured',
  'icons',
  'category_banners',
  'cta',
  'feed',
  'editorial',
  'stats',
  'photo_influencers',
  'photographers',
  'contributors',
  'models',
  'pricing',
] as const
export type HomeBuiltinSection = (typeof HOME_BUILTIN_SECTIONS)[number]

export const HOME_SECTION_LABEL: Record<HomeBuiltinSection, string> = {
  hero: 'D01 Hero — Images that tell Africa’s story',
  marquee: 'D01 Category chips',
  featured: 'D01 Featured Photos',
  icons: 'D01 Trust row',
  category_banners: 'D01 Browse by Categories',
  cta: 'D01 Continent banner',
  feed: 'D01 Latest from the Library',
  editorial: 'D01 Editorial feature',
  stats: 'D01 Library stats',
  photo_influencers: 'D01 Photo Influencer spotlight',
  photographers: 'D01 Top photographers',
  contributors: 'D01 Top contributors',
  models: 'D01 Top models',
  pricing: 'D01 License banner',
}

/** Photo influencers sit where photographers used to, and photographers sit where contributors used to. */
export const DEFAULT_HOME_SECTION_ORDER: HomeBuiltinSection[] = [...HOME_BUILTIN_SECTIONS]

export const HOME_PEOPLE_SLOTS = ['photographers', 'photo_influencers', 'contributors'] as const
export type HomePeopleSlot = (typeof HOME_PEOPLE_SLOTS)[number]

export const HOME_PEOPLE_MODES = ['profiles', 'downloads', 'both'] as const
export type HomePeopleMode = (typeof HOME_PEOPLE_MODES)[number]

export const HOME_PEOPLE_SLOT_LABEL: Record<HomePeopleSlot, string> = {
  photographers: 'Photographers',
  photo_influencers: 'Photo influencers',
  contributors: 'Contributors',
}

export const HOME_PEOPLE_ACCOUNT: Record<HomePeopleSlot, 'photographer' | 'photo_influencer' | 'contributor'> = {
  photographers: 'photographer',
  photo_influencers: 'photo_influencer',
  contributors: 'contributor',
}

/** Current large-screen people card: 30vw wide and a 4/5 frame. */
export const DEFAULT_PEOPLE_FRAME = { widthVw: 30, heightVw: 37.5 }

/** Current large-screen category banner: 28vw wide and a 3/4 frame. */
export const DEFAULT_CATEGORY_BANNER_FRAME = { widthVw: 28, heightVw: 37.33 }

export const HOME_PEOPLE_LIMIT = 20
export const HOME_STATIC_BANNER_LIMIT = 12

export const sectionFrameSchema = z.object({
  widthVw: z.number().min(8).max(90),
  heightVw: z.number().min(8).max(120),
})
export type SectionFrame = z.infer<typeof sectionFrameSchema>

export function normalizeSectionFrame(
  input: { widthVw?: number | null; heightVw?: number | null } | null | undefined,
  defaults: SectionFrame,
): SectionFrame {
  const parsed = sectionFrameSchema.safeParse({
    widthVw: input?.widthVw ?? defaults.widthVw,
    heightVw: input?.heightVw ?? defaults.heightVw,
  })
  return parsed.success ? parsed.data : { ...defaults }
}

export function homeBannerSectionKey(bannerId: string) {
  return `banner:${bannerId}`
}

export function homeSectionLabel(key: string, banners: { id: string; title: string }[] = []): string {
  if ((HOME_BUILTIN_SECTIONS as readonly string[]).includes(key)) {
    return HOME_SECTION_LABEL[key as HomeBuiltinSection]
  }
  const id = key.startsWith('banner:') ? key.slice('banner:'.length) : ''
  const banner = banners.find((row) => row.id === id)
  return banner?.title ? `Banner · ${banner.title}` : 'Banner'
}

/**
 * Keep a saved arrangement as the admin left it.
 * A missing order (no saved layout) still starts from every built-in section.
 */
export function normalizeHomeSectionOrder(
  order: string[] | null | undefined,
  bannerIds: string[],
  options?: { fillMissing?: boolean },
): string[] {
  const allowed = new Set<string>([...HOME_BUILTIN_SECTIONS, ...bannerIds.map(homeBannerSectionKey)])
  const fillMissing = options?.fillMissing ?? order == null
  const seen = new Set<string>()
  const next: string[] = []
  for (const key of order ?? []) {
    if (!allowed.has(key) || seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  if (!fillMissing) return next
  for (const key of HOME_BUILTIN_SECTIONS) {
    if (!seen.has(key)) next.push(key)
  }
  for (const id of bannerIds) {
    const key = homeBannerSectionKey(id)
    if (!seen.has(key)) next.push(key)
  }
  return next
}

/** Hidden keys stay in the arrangement and stay off the public homepage. */
export function normalizeHiddenSections(hidden: string[] | null | undefined, order: string[]): string[] {
  const allowed = new Set(order)
  const seen = new Set<string>()
  const next: string[] = []
  for (const key of hidden ?? []) {
    if (!allowed.has(key) || seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  return next
}

export const homePeoplePatchSchema = z.object({
  mode: z.enum(HOME_PEOPLE_MODES),
  ids: z.array(z.string().trim().min(1).max(80)).max(24),
  randomize: z.boolean(),
  frame: sectionFrameSchema,
})
export type HomePeoplePatch = z.infer<typeof homePeoplePatchSchema>

export const homeStaticBannerSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(80),
  columns: z.number().int().min(1).max(6),
  rows: z.number().int().min(1).max(6),
  frame: sectionFrameSchema,
  images: z.array(z.string().trim().min(1).max(500)).max(36),
})
export type HomeStaticBannerInput = z.infer<typeof homeStaticBannerSchema>

export const patchHomeFeaturedSchema = z.object({
  pins: z.object({
    hero: pinArray('hero').optional(),
    edge: pinArray('edge').optional(),
    editorial: pinArray('editorial').optional(),
    pricing: pinArray('pricing').optional(),
    stats_background: pinArray('stats_background').optional(),
  }),
  uploads: z.object({
    hero: uploadArray('hero').optional(),
    editorial: uploadArray('editorial').optional(),
    pricing: uploadArray('pricing').optional(),
    stats_background: uploadArray('stats_background').optional(),
  }).optional(),
  categoryBanners: z.array(categoryBannerPinSchema).max(HOME_CATEGORY_BANNER_CAPACITY).optional(),
  editorial: z.object({
    mode: z.enum(HOME_EDITORIAL_MODES),
    category: z.string().trim().min(1).max(80).nullable().optional(),
  }).optional(),
  frame: featuredFrameSchema.optional(),
  contributors: z.object({
    ids: z.array(z.string().trim().min(1).max(80)).max(24),
    randomize: z.boolean(),
  }).optional(),
  layoutOrder: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  layoutHidden: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  people: z.object({
    photographers: homePeoplePatchSchema.optional(),
    photo_influencers: homePeoplePatchSchema.optional(),
    contributors: homePeoplePatchSchema.optional(),
  }).optional(),
  categoryBannerFrame: sectionFrameSchema.optional(),
  staticBanners: z.array(homeStaticBannerSchema).max(HOME_STATIC_BANNER_LIMIT).optional(),
})
export type PatchHomeFeaturedInput = z.infer<typeof patchHomeFeaturedSchema>

export function normalizeCategoryBanners(input?: CategoryBannerPin[] | null): CategoryBannerPin[] {
  const raw = input ?? []
  return Array.from({ length: HOME_CATEGORY_BANNER_CAPACITY }, (_, i) => {
    const row = raw[i]
    const photoId = typeof row?.photoId === 'string' && row.photoId.trim() ? row.photoId.trim() : null
    const category = typeof row?.category === 'string' && row.category.trim() ? row.category.trim() : null
    const imageSrc = typeof row?.imageSrc === 'string' && row.imageSrc.trim() ? row.imageSrc.trim() : null
    return { photoId, category, imageSrc }
  })
}

export type HomeSlotPins = {
  [K in HomeFeaturedSlotKey]?: (string | null)[]
}

export type HomeSlotUploads = {
  [K in HomeUploadSlotKey]?: (string | null)[]
}

export function normalizeSlotUploads(input?: HomeSlotUploads | null): Record<HomeUploadSlotKey, (string | null)[]> {
  const out = {} as Record<HomeUploadSlotKey, (string | null)[]>
  for (const slot of HOME_UPLOAD_SLOT_KEYS) {
    const cap = HOME_FEATURED_CAPACITY[slot]
    const raw = input?.[slot] ?? []
    out[slot] = Array.from({ length: cap }, (_, i) => {
      const value = raw[i]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    })
  }
  return out
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

export interface HomePeopleRailDto {
  mode: HomePeopleMode
  frame: SectionFrame
  people: import('./types.js').PhotographerDto[]
}

export interface HomeStaticBannerDto {
  id: string
  title: string
  columns: number
  rows: number
  widthVw: number
  heightVw: number
  images: string[]
}

export interface HomeLayoutDto {
  order: string[]
  hidden: string[]
  people: Record<HomePeopleSlot, HomePeopleRailDto>
  categoryBannerFrame: SectionFrame
  staticBanners: HomeStaticBannerDto[]
}

export interface HomePageDto {
  stats: PublicStatsDto
  featured: HomeFeaturedDto
  contributors: import('./types.js').PhotographerDto[]
  layout: HomeLayoutDto
}

export interface HomeFeaturedPositionDto {
  position: number
  photoId: string | null
  photo: PhotoDto | null
  imageSrc: string | null
  source: 'pinned' | 'auto' | 'upload'
  eligible: boolean
  ineligibleReason: string | null
}

export interface HomeContributorPick {
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  location: string | null
  accountType?: string
}

export interface HomePeopleAdminDto {
  mode: HomePeopleMode
  ids: string[]
  randomize: boolean
  frame: SectionFrame
  people: HomeContributorPick[]
}

export interface HomeCategoryBannerAdminDto {
  position: number
  photoId: string | null
  category: string | null
  imageSrc: string | null
  photo: PhotoDto | null
  source: 'pinned' | 'auto' | 'upload'
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
  contributors: {
    ids: string[]
    randomize: boolean
    people: HomeContributorPick[]
  }
  layoutOrder: string[]
  layoutHidden: string[]
  people: Record<HomePeopleSlot, HomePeopleAdminDto>
  categoryBannerFrame: SectionFrame
  staticBanners: HomeStaticBannerDto[]
}
