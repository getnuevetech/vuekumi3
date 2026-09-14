import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { CatalogFacets, PhotoDto, PhotoSort } from '@vuekumi/shared'
import { PhotoMasonry, SearchForm, SiteHeader } from '../components/shared'
import { api } from '../api/client'
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
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<PhotoDto[]>([])
  const [facets, setFacets] = useState<CatalogFacets | undefined>()
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

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
    let cancelled = false
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
      if (cancelled) return
      setItems(data.items)
      setFacets(data.facets)
      setTotal(data.total)
      setHasMore(data.hasMore)
      setPage(1)
    }).catch(() => {
      if (!cancelled) {
        setItems([])
        setTotal(0)
        setHasMore(false)
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [filterKey, q, category, country, license, tag, photographer, sort])

  async function loadMore() {
    const next = page + 1
    const data = await api.photos({
      page: next,
      limit: 24,
      q: q || undefined,
      category: category || undefined,
      country: country || undefined,
      license: license || undefined,
      tag: tag || undefined,
      photographer: photographer || undefined,
      sort,
    })
    setItems((prev) => [...prev, ...data.items])
    setHasMore(data.hasMore)
    setPage(next)
  }

  const heading = q ? `Results for “${q}”` : tag ? `Tagged ${tag}` : photographer ? `@${photographer}` : 'The library'

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-28 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Catalog</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight md:text-5xl">{heading}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {loading ? 'Searching…' : `${total} photograph${total === 1 ? '' : 's'} from African contributors.`}
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

        {hasMore && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              className="border border-ink px-8 py-3 font-mono-tech text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
