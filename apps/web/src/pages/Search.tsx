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
  { value: 'newest', label: 'Newest' },
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

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{library.kicker}</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight md:text-5xl">{heading}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {loading ? 'Searching…' : fillSiteTokens(library.intro, { count: total })}
        </p>

        <div className="mt-8">
          <SearchForm defaultQuery={q} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setFilter({ category: e.target.value })}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none focus:border-terra"
          >
            <option value="">All categories</option>
            {(facets?.categories.map((f) => f.value) ?? categories.filter((c) => c !== 'All')).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Country"
            value={country}
            onChange={(e) => setFilter({ country: e.target.value })}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none focus:border-terra"
          >
            <option value="">All countries</option>
            {(facets?.countries ?? []).map((c) => (
              <option key={c.value} value={c.value}>{c.value} ({c.count})</option>
            ))}
          </select>
          <select
            aria-label="Licence"
            value={license}
            onChange={(e) => setFilter({ license: e.target.value })}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none focus:border-terra"
          >
            <option value="">Free + premium</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select
            aria-label="Library tier"
            value={libraryTier}
            onChange={(e) => setFilter({ libraryTier: e.target.value })}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none focus:border-terra"
          >
            <option value="">All library tiers</option>
            {(facets?.libraryTiers?.length
              ? facets.libraryTiers
              : (['OPEN', 'LICENSED', 'VERIFIED_PLUS', 'EDITORIAL'] as LibraryTier[]).map((tier) => ({
                  value: tier,
                  count: 0,
                }))
            ).map((row) => {
              const tier = row.value as LibraryTier
              const label = LIBRARY_TIER_LABEL[tier] ?? row.value
              return (
                <option key={row.value} value={row.value}>
                  {facets?.libraryTiers?.length ? `${label} (${row.count})` : label}
                </option>
              )
            })}
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setFilter({ sort: e.target.value })}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none focus:border-terra"
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {(q || category || country || license || libraryTier || tag || photographer) && (
            <Link to="/search" className="px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
              Clear filters
            </Link>
          )}
        </div>

        {facets?.tags && facets.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {facets.tags.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFilter({ tag: tag === t.value ? '' : t.value })}
                className={`border px-2.5 py-1 font-mono-tech text-[9px] uppercase tracking-[0.12em] ${
                  tag === t.value ? 'border-terra bg-terra/10 text-terra' : 'border-sand text-ink-soft hover:border-ink/40'
                }`}
              >
                {t.value}
              </button>
            ))}
          </div>
        )}

        {items.length > 0 ? (
          <PhotoMasonry photos={items} />
        ) : !loading ? (
          <p className="mt-16 text-sm text-ink-soft">No photographs match those filters.</p>
        ) : null}

        <div ref={sentinel} className="mt-10 flex justify-center">
          {loadingMore && (
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading more</span>
          )}
        </div>
      </div>
    </div>
  )
}
