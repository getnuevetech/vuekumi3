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

export function assignHomeSlots(input: {
  byDownloads: RankedPhoto[]
  byNewest: RankedPhoto[]
  byLikes: RankedPhoto[]
}): {
  hero: string[]
  edge: string[]
  editorial: string[]
  pricing: string[]
  statsBackground: string | null
} {
  const used = new Set<string>()
  const hero = takeUnused(input.byDownloads, used, 3)
  const edge = takeUnused(input.byNewest, used, 4)
  const editorial = takeUnused(input.byLikes, used, 2)
  const pricing = takeUnused(input.byDownloads, used, 3)
  const landscape = input.byDownloads.find((p) => p.category === 'Landscape' && !used.has(p.id))
    ?? input.byNewest.find((p) => p.category === 'Landscape' && !used.has(p.id))
  const stats = landscape ?? takeUnused(input.byDownloads, used, 1)[0] ?? null
  if (stats) used.add(stats.id)

  return {
    hero: hero.map((p) => p.id),
    edge: edge.map((p) => p.id),
    editorial: editorial.map((p) => p.id),
    pricing: pricing.map((p) => p.id),
    statsBackground: stats?.id ?? null,
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
