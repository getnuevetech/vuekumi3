import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fillSiteTokens, PHOTO_CATEGORIES, type LibraryTier, type PhotoSort } from '@vuekumi/shared'
import { LibraryFilterPanel, PhotoTileMasonry, SearchForm, type PhotoDensity } from '../components/marketplace'
import { api } from '../api/client'
import { useSiteContent } from '../context/SiteContentContext'
import { publicQueryKeys } from '../lib/query-keys'

const sorts: { value: PhotoSort; label: string }[] = [
  { value: 'newest', label: 'Most recent' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'views', label: 'Views' },
  { value: 'likes', label: 'Likes' },
]

function param(params: URLSearchParams, key: string) {
  return params.get(key) ?? ''
}

export default function Search() {
  const { content } = useSiteContent()
  const library = content.pages.search
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [density, setDensity] = useState<PhotoDensity>('comfortable')
  const sentinel = useRef<HTMLDivElement>(null)

  const q = param(params, 'q')
  const category = param(params, 'category')
  const country = param(params, 'country')
  const license = param(params, 'license')
  const libraryTier = param(params, 'libraryTier')
  const tag = param(params, 'tag')
  const photographer = param(params, 'photographer')
  const sort = (param(params, 'sort') || 'newest') as PhotoSort
  const filters = useMemo(
    () => ({ q, category, country, license, libraryTier, tag, photographer, sort }),
    [q, category, country, license, libraryTier, tag, photographer, sort],
  )

  function setFilter(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => {
      if (!v || (k === 'sort' && v === 'newest')) merged.delete(k)
      else merged.set(k, v)
    })
    setParams(merged)
  }

  const query = useInfiniteQuery({
    queryKey: publicQueryKeys.photoSearch(filters),
    queryFn: ({ pageParam }) =>
      api.photos({
        page: pageParam,
        limit: 24,
        q: q || undefined,
        category: category || undefined,
        country: country || undefined,
        license: license || undefined,
        libraryTier: libraryTier || undefined,
        tag: tag || undefined,
        photographer: photographer || undefined,
        sort,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
  })

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )
  const facets = query.data?.pages[0]?.facets
  const total = query.data?.pages[0]?.total ?? 0
  const loading = query.isLoading
  const loadingMore = query.isFetchingNextPage
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      if (!hasNextPage || isFetchingNextPage) return
      void fetchNextPage()
    }, { rootMargin: '700px' })
    io.observe(el)
    return () => io.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, items.length])

  const heading = q ? `Results for “${q}”` : tag ? `Tagged ${tag}` : photographer ? `@${photographer}` : library.title
  const categoryOptions = facets?.categories ?? PHOTO_CATEGORIES.map((value) => ({ value, count: 0 }))
  const tierOptions = facets?.libraryTiers?.length
    ? facets.libraryTiers
    : (['OPEN', 'LICENSED', 'VERIFIED_PLUS', 'EDITORIAL'] as LibraryTier[]).map((tier) => ({ value: tier, count: 0 }))
  const visibleTitle = q || tag || photographer ? heading : 'Discover authentic African imagery'
  const heroPhoto = items[0]

  const filterPanel = (
    <LibraryFilterPanel
      q={q}
      category={category}
      country={country}
      license={license}
      libraryTier={libraryTier}
      tag={tag}
      photographer={photographer}
      categoryOptions={categoryOptions}
      tierOptions={tierOptions}
      countryOptions={facets?.countries ?? []}
      tagOptions={facets?.tags ?? []}
      onFilter={setFilter}
    />
  )

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="relative overflow-hidden bg-[#14110e] text-white">
        {heroPhoto?.src && (
          <img src={heroPhoto.src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#14110e] via-[#14110e]/80 to-[#14110e]/40" />
        <div className="relative mx-auto max-w-[1500px] px-5 py-12 md:px-8 md:py-16">
          <p className="text-sm text-white/70">Home / Library / Search results</p>
          <h1 className="sr-only">{library.title}</h1>
          <p className="font-display mt-3 max-w-3xl text-4xl leading-tight md:text-6xl" role="presentation">{visibleTitle}</p>
          <p className="mt-3 max-w-xl text-sm text-white/75">People. Places. Cultures. Real stories. Endless possibilities.</p>
          <div className="mt-6 max-w-2xl">
            <SearchForm wide defaultQuery={q} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-8 md:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-semibold text-ink"
          >
            Filters
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={density === 'comfortable'}
              onClick={() => setDensity('comfortable')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${density === 'comfortable' ? 'bg-ink text-white' : 'bg-[#f3eee9] text-ink'}`}
            >
              Large
            </button>
            <button
              type="button"
              aria-pressed={density === 'compact'}
              onClick={() => setDensity('compact')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${density === 'compact' ? 'bg-ink text-white' : 'bg-[#f3eee9] text-ink'}`}
            >
              Dense
            </button>
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[260px_1fr]">
          <div className="hidden lg:block">{filterPanel}</div>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {loading ? 'Searching…' : fillSiteTokens(library.intro, { count: total })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    aria-pressed={density === 'comfortable'}
                    onClick={() => setDensity('comfortable')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${density === 'comfortable' ? 'bg-ink text-white' : 'bg-[#f3eee9] text-ink'}`}
                  >
                    Large
                  </button>
                  <button
                    type="button"
                    aria-pressed={density === 'compact'}
                    onClick={() => setDensity('compact')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${density === 'compact' ? 'bg-ink text-white' : 'bg-[#f3eee9] text-ink'}`}
                  >
                    Dense
                  </button>
                </div>
                <select
                  aria-label="Sort"
                  value={sort}
                  onChange={(e) => setFilter({ sort: e.target.value })}
                  className="rounded-full border border-sand bg-white px-3 py-2 text-sm outline-none focus:border-terra"
                >
                  {sorts.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {items.length > 0 ? (
              <PhotoTileMasonry photos={items} density={density} />
            ) : !loading ? (
              <p className="mt-16 text-sm text-ink-soft">No photographs match those filters.</p>
            ) : null}

            <div ref={sentinel} className="mt-10 flex justify-center">
              {loadingMore && (
                <span className="text-sm text-ink-soft">Loading more</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-noir/50" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(100%,320px)] overflow-y-auto bg-paper p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Filters</p>
              <button type="button" className="text-sm font-semibold text-terra" onClick={() => setFiltersOpen(false)}>
                Done
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}
    </div>
  )
}
