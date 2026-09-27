import {
  HOME_FEATURED_CAPACITY,
  HOME_FEATURED_SLOT_KEYS,
  type HomeFeaturedSlotKey,
  type HomeSlotPins,
} from '@vuekumi/shared'

export type RankedPhoto = {
  id: string
  category: string
}

export function categoryShares(
  rows: { value: string; count: number }[],
  total: number,
  take = 4,
): { value: string; count: number; sharePct: number }[] {
  return rows
    .filter((row) => row.value)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, take)
    .map((row) => ({
      value: row.value,
      count: row.count,
      sharePct: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }))
}

function takeUnused(source: RankedPhoto[], used: Set<string>, n: number): RankedPhoto[] {
  const picked: RankedPhoto[] = []
  for (const photo of source) {
    if (used.has(photo.id)) continue
    picked.push(photo)
    used.add(photo.id)
    if (picked.length >= n) break
  }
  return picked
}

function placePins(
  pinned: (string | null)[] | undefined,
  capacity: number,
  used: Set<string>,
  live?: Set<string>,
): (string | null)[] {
  const out = Array.from({ length: capacity }, () => null as string | null)
  if (!pinned) return out
  for (let i = 0; i < capacity; i++) {
    const id = pinned[i]
    if (!id) continue
    if (live && !live.has(id)) continue
    if (used.has(id)) continue
    out[i] = id
    used.add(id)
  }
  return out
}

function fillGaps(partial: (string | null)[], source: RankedPhoto[], used: Set<string>, holds?: boolean[]): string[] {
  const out = [...partial]
  for (let i = 0; i < out.length; i++) {
    if (out[i] || holds?.[i]) continue
    const next = takeUnused(source, used, 1)[0]
    if (next) out[i] = next.id
  }
  return out.filter((id): id is string => Boolean(id))
}

export function shuffleWith<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const current = next[i]!
    next[i] = next[j]!
    next[j] = current
  }
  return next
}

function randomCatalog(input: {
  byDownloads: RankedPhoto[]
  byNewest: RankedPhoto[]
  byLikes: RankedPhoto[]
  pool?: RankedPhoto[]
  random?: () => number
}): RankedPhoto[] {
  const seen = new Set<string>()
  const pool: RankedPhoto[] = []
  for (const photo of input.pool ?? [...input.byDownloads, ...input.byNewest, ...input.byLikes]) {
    if (seen.has(photo.id)) continue
    seen.add(photo.id)
    pool.push(photo)
  }
  return shuffleWith(pool, input.random ?? Math.random)
}

export function assignHomeSlots(input: {
  byDownloads: RankedPhoto[]
  byNewest: RankedPhoto[]
  byLikes: RankedPhoto[]
  pool?: RankedPhoto[]
  random?: () => number
  pins?: HomeSlotPins | null
  liveIds?: Set<string>
  holds?: Partial<Record<HomeFeaturedSlotKey, boolean[]>>
}): {
  hero: string[]
  edge: string[]
  editorial: string[]
  pricing: string[]
  statsBackground: string | null
  sources: Record<HomeFeaturedSlotKey, ('pinned' | 'auto')[]>
} {
  const used = new Set<string>()
  const live = input.liveIds
  const sources = {} as Record<HomeFeaturedSlotKey, ('pinned' | 'auto')[]>

  const placed: Record<HomeFeaturedSlotKey, (string | null)[]> = {
    hero: placePins(input.pins?.hero, HOME_FEATURED_CAPACITY.hero, used, live),
    edge: placePins(input.pins?.edge, HOME_FEATURED_CAPACITY.edge, used, live),
    editorial: placePins(input.pins?.editorial, HOME_FEATURED_CAPACITY.editorial, used, live),
    pricing: placePins(input.pins?.pricing, HOME_FEATURED_CAPACITY.pricing, used, live),
    stats_background: placePins(input.pins?.stats_background, HOME_FEATURED_CAPACITY.stats_background, used, live),
  }

  const holds = input.holds
  const catalog = randomCatalog(input)
  const hero = fillGaps(placed.hero, catalog, used, holds?.hero)
  const edge = fillGaps(placed.edge, catalog, used, holds?.edge)
  const editorial = fillGaps(placed.editorial, catalog, used, holds?.editorial)
  const pricing = fillGaps(placed.pricing, catalog, used, holds?.pricing)

  let stats = placed.stats_background[0]
  if (!stats && !holds?.stats_background?.[0]) {
    const fallback = takeUnused(catalog, used, 1)[0] ?? null
    stats = fallback?.id ?? null
    if (stats) used.add(stats)
  }

  const filled: Record<HomeFeaturedSlotKey, (string | null)[]> = {
    hero,
    edge,
    editorial,
    pricing,
    stats_background: [stats],
  }
  for (const slot of HOME_FEATURED_SLOT_KEYS) {
    sources[slot] = filled[slot].map((id, i) => (id && placed[slot][i] === id ? 'pinned' : 'auto'))
  }

  return {
    hero,
    edge,
    editorial,
    pricing,
    statsBackground: stats,
    sources,
  }
}

export function heroHeadline(stats: { photosLive: number; countries: number }): string {
  if (stats.photosLive <= 0) {
    return 'Authentic images from across the continent. Free and premium.'
  }
  const photos = stats.photosLive.toLocaleString('en-US')
  const places = stats.countries === 1 ? '1 country' : `${stats.countries} countries`
  return `${photos} authentic images from ${places}. Free and premium.`
}
