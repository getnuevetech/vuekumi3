import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { fillSiteTokens, type CatalogFacets, type PhotoDto, type PhotoSort } from '@vuekumi/shared'
import { PhotoMasonry, SearchForm, SiteHeader } from '../components/shared'
import { api } from '../api/client'
import { useSiteContent } from '../context/SiteContentContext'
import { categories } from '../data/content'

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
  const [items, setItems] = useState<PhotoDto[]>([])
  const [facets, setFacets] = useState<CatalogFacets | undefined>()
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const pageRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const generation = useRef(0)

  const q = param(params, 'q')
  const category = param(params, 'category')
  const country = param(params, 'country')
  const license = param(params, 'license')
  const tag = param(params, 'tag')
  const photographer = param(params, 'photographer')
  const sort = (param(params, 'sort') || 'newest') as PhotoSort
  const filterKey = useMemo(
    () => [q, category, country, license, tag, photographer, sort].join('|'),
    [q, category, country, license, tag, photographer, sort],
  )

  function setFilter(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => {
      if (!v || (k === 'sort' && v === 'newest')) merged.delete(k)
      else merged.set(k, v)
    })
    setParams(merged)
  }

  useEffect(() => {
    const gen = ++generation.current
    pageRef.current = 0
    hasMoreRef.current = false
    setLoading(true)
    api.photos({
      page: 1,
      limit: 24,
      q: q || undefined,
      category: category || undefined,
      country: country || undefined,
      license: license || undefined,
      tag: tag || undefined,
      photographer: photographer || undefined,
      sort,
    }).then((data) => {
      if (generation.current !== gen) return
      setItems(data.items)
      setFacets(data.facets)
      setTotal(data.total)
      setHasMore(data.hasMore)
      hasMoreRef.current = data.hasMore
      pageRef.current = 1
    }).catch(() => {
      if (generation.current !== gen) return
      setItems([])
      setTotal(0)
      setHasMore(false)
      hasMoreRef.current = false
      pageRef.current = 1
    }).finally(() => {
      if (generation.current === gen) setLoading(false)
    })
  }, [filterKey, q, category, country, license, tag, photographer, sort])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      if (loadingMoreRef.current || !hasMoreRef.current || pageRef.current < 1) return
      const gen = generation.current
      const next = pageRef.current + 1
      loadingMoreRef.current = true
      setLoadingMore(true)
      api.photos({
        page: next,
        limit: 24,
        q: q || undefined,
        category: category || undefined,
        country: country || undefined,
        license: license || undefined,
        tag: tag || undefined,
        photographer: photographer || undefined,
        sort,
      }).then((data) => {
        if (generation.current !== gen) return
        setItems((prev) => [...prev, ...data.items])
        setHasMore(data.hasMore)
        hasMoreRef.current = data.hasMore
        pageRef.current = next
      }).catch(() => {
        if (generation.current !== gen) return
        hasMoreRef.current = false
        setHasMore(false)
      }).finally(() => {
        loadingMoreRef.current = false
        if (generation.current === gen) setLoadingMore(false)
      })
    }, { rootMargin: '700px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filterKey, hasMore, loading, items.length, q, category, country, license, tag, photographer, sort])

  const heading = q ? `Results for “${q}”` : tag ? `Tagged ${tag}` : photographer ? `@${photographer}` : library.title

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
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
            aria-label="Sort"
            value={sort}
            onChange={(e) => setFilter({ sort: e.target.value })}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none focus:border-terra"
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {(q || category || country || license || tag || photographer) && (
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
