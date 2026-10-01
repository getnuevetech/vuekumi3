import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fillSiteTokens, LIBRARY_TIER_LABEL, type LibraryTier, type PhotoSort } from '@vuekumi/shared'
import { PhotoMasonry, SearchForm } from '../components/shared'
import { api } from '../api/client'
import { useSiteContent } from '../context/SiteContentContext'
import { categories } from '../data/content'
import { publicQueryKeys } from '../lib/query-keys'

const sorts: { value: PhotoSort; label: string }[] = [
  { value: 'newest', label: 'Most recent' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'views', label: 'Views' },
  { value: 'likes', label: 'Likes' },
]

function FilterOption({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm ${active ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`}>
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${active ? 'border-terra bg-terra text-white' : 'border-sand bg-white'}`}>
        {active ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && <span className="text-xs text-ink-faint">{count}</span>}
    </button>
  )
}

function param(params: URLSearchParams, key: string) {
  return params.get(key) ?? ''
}

export default function Search() {
  const { content } = useSiteContent()
  const library = content.pages.search
  const [params, setParams] = useSearchParams()
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

  const categoryOptions = facets?.categories ?? categories.filter((c) => c !== 'All').map((value) => ({ value, count: 0 }))
  const tierOptions = facets?.libraryTiers?.length
    ? facets.libraryTiers
    : (['OPEN', 'LICENSED', 'VERIFIED_PLUS', 'EDITORIAL'] as LibraryTier[]).map((tier) => ({ value: tier, count: 0 }))
  const visibleTitle = q || tag || photographer ? heading : 'Discover authentic African imagery'
  const heroPhoto = items[0]

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
        <div className="grid items-start gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-sand bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Filter Results</p>
              {(q || category || country || license || libraryTier || tag || photographer) && (
                <Link to="/search" className="text-xs font-semibold text-terra">Clear all</Link>
              )}
            </div>

            <div className="mt-4 border-t border-sand pt-4">
              <p className="text-sm font-semibold text-ink">Category</p>
              <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                <FilterOption active={!category} label="All categories" onClick={() => setFilter({ category: '' })} />
                {categoryOptions.map((row) => (
                  <FilterOption
                    key={row.value}
                    active={category === row.value}
                    label={row.value}
                    count={row.count}
                    onClick={() => setFilter({ category: category === row.value ? '' : row.value })}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-sand pt-4">
              <p className="text-sm font-semibold text-ink">License type</p>
              <div className="mt-2">
                <FilterOption active={!license} label="All licences" onClick={() => setFilter({ license: '' })} />
                <FilterOption active={license === 'free'} label="Free" onClick={() => setFilter({ license: license === 'free' ? '' : 'free' })} />
                <FilterOption active={license === 'premium'} label="Premium" onClick={() => setFilter({ license: license === 'premium' ? '' : 'premium' })} />
              </div>
            </div>

            <div className="mt-4 border-t border-sand pt-4">
              <p className="text-sm font-semibold text-ink">Library</p>
              <div className="mt-2">
                <FilterOption active={!libraryTier} label="All library tiers" onClick={() => setFilter({ libraryTier: '' })} />
                {tierOptions.map((row) => {
                  const tier = row.value as LibraryTier
                  const label = LIBRARY_TIER_LABEL[tier] ?? row.value
                  return (
                    <FilterOption
                      key={row.value}
                      active={libraryTier === row.value}
                      label={label}
                      count={row.count}
                      onClick={() => setFilter({ libraryTier: libraryTier === row.value ? '' : row.value })}
                    />
                  )
                })}
              </div>
              {libraryTier === 'VERIFIED_PLUS' && (
                <p className="mt-2 text-[11px] text-ink-soft">
                  Verified+ is marketplace placement above Licensed. It is separate from rights clearance.
                </p>
              )}
              {libraryTier === 'OPEN' && (
                <p className="mt-2 text-[11px] text-ink-soft">
                  Free Library is the public name for Open. Photo Influencers upload here only.
                </p>
              )}
            </div>

            <div className="mt-4 border-t border-sand pt-4">
              <p className="text-sm font-semibold text-ink">Country</p>
              <select
                aria-label="Country"
                value={country}
                onChange={(e) => setFilter({ country: e.target.value })}
                className="mt-2 w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:border-terra"
              >
                <option value="">All countries</option>
                {(facets?.countries ?? []).map((c) => (
                  <option key={c.value} value={c.value}>{c.value} ({c.count})</option>
                ))}
              </select>
            </div>

            {facets?.tags && facets.tags.length > 0 && (
              <div className="mt-4 border-t border-sand pt-4">
                <p className="text-sm font-semibold text-ink">Topics</p>
                <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                  {facets.tags.map((row) => (
                    <FilterOption
                      key={row.value}
                      active={tag === row.value}
                      label={row.value}
                      count={row.count}
                      onClick={() => setFilter({ tag: tag === row.value ? '' : row.value })}
                    />
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {loading ? 'Searching…' : fillSiteTokens(library.intro, { count: total })}
              </p>
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

            {items.length > 0 ? (
              <PhotoMasonry photos={items} />
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
    </div>
  )
}
