import type { QueryClient } from '@tanstack/react-query'
import type { PhotoSort } from '@vuekumi/shared'

/** Public marketplace query keys (P1-H4). Admin saves invalidate these. */
export const publicQueryKeys = {
  all: ['public'] as const,
  home: ['public', 'home'] as const,
  site: ['public', 'site'] as const,
  photos: ['public', 'photos'] as const,
  photoSearch: (filters: {
    q?: string
    category?: string
    country?: string
    license?: string
    libraryTier?: string
    tag?: string
    photographer?: string
    sort?: PhotoSort | string
  }) =>
    [
      'public',
      'photos',
      'search',
      filters.q ?? '',
      filters.category ?? '',
      filters.country ?? '',
      filters.license ?? '',
      filters.libraryTier ?? '',
      filters.tag ?? '',
      filters.photographer ?? '',
      filters.sort ?? 'newest',
    ] as const,
  homeFeed: ['public', 'photos', 'home-feed'] as const,
  plans: ['public', 'plans'] as const,
}

/** Invalidate public Home / Site / catalog caches after admin curation or site edits. */
export async function invalidatePublicMarketplace(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: publicQueryKeys.all })
}

export async function invalidatePublicHome(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: publicQueryKeys.home }),
    queryClient.invalidateQueries({ queryKey: publicQueryKeys.homeFeed }),
    queryClient.invalidateQueries({ queryKey: publicQueryKeys.plans }),
  ])
}

export async function invalidatePublicSite(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: publicQueryKeys.site })
}
