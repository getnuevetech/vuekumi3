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

function fillGaps(partial: (string | null)[], source: RankedPhoto[], used: Set<string>): string[] {
  const out = [...partial]
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue
    const next = takeUnused(source, used, 1)[0]
    if (next) out[i] = next.id
  }
  return out.filter((id): id is string => Boolean(id))
}

export function assignHomeSlots(input: {
  byDownloads: RankedPhoto[]
  byNewest: RankedPhoto[]
  byLikes: RankedPhoto[]
  pins?: HomeSlotPins | null
  liveIds?: Set<string>
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

  const hero = fillGaps(placed.hero, input.byDownloads, used)
  const edge = fillGaps(placed.edge, input.byNewest, used)
  const editorial = fillGaps(placed.editorial, input.byLikes, used)
  const pricing = fillGaps(placed.pricing, input.byDownloads, used)

  let stats = placed.stats_background[0]
  if (!stats) {
    const landscape = input.byDownloads.find((p) => p.category === 'Landscape' && !used.has(p.id))
      ?? input.byNewest.find((p) => p.category === 'Landscape' && !used.has(p.id))
    const fallback = landscape ?? takeUnused(input.byDownloads, used, 1)[0] ?? null
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
