import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { PHOTO_CATEGORIES, type PhotoDto } from '@vuekumi/shared'
import { CountryMark, PhotoHoverActions } from '../components/PhotoActions'
import { api } from '../api/client'
import { useSiteContent } from '../context/SiteContentContext'
import { categoryFromSlug, categoryPath } from '../lib/categories'
import NotFound from './NotFound'

function presentPhotos(items: PhotoDto[], modelCredits: boolean) {
  if (!modelCredits) return items
  return [...items].sort((a, b) => Number(Boolean(modelCredit(b))) - Number(Boolean(modelCredit(a))))
}

function modelCredit(photo: PhotoDto) {
  const row = photo.appearances?.find((item) => item.status === 'approved' && item.displayName)
  if (!row) return null
  return {
    name: row.displayName,
    avatar: row.modelAvatarUrl ?? null,
    handle: row.modelHandle ?? null,
  }
}

function CategoryCard({ photo, modelCredits }: { photo: PhotoDto; modelCredits: boolean }) {
  const credit = modelCredits ? modelCredit(photo) : null
  return (
    <Link to={`/photo/${photo.id}`} className="group relative mb-4 block break-inside-avoid overflow-hidden rounded-2xl bg-cream">
      <img src={photo.src} alt={photo.title} loading="lazy" className="min-h-52 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <CountryMark country={photo.country} />
      <PhotoHoverActions photo={photo} />
      <div data-on-photo className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/85 to-transparent p-3 pt-16">
        {credit && (
          credit.avatar ? (
            <img src={credit.avatar} alt="" className="mb-2 h-10 w-10 rounded-full object-cover ring-1 ring-white/80" />
          ) : (
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-noir/70 font-condensed text-sm uppercase text-paper ring-1 ring-white/70">
              {credit.name.slice(0, 1)}
            </span>
          )
        )}
        <p className="font-condensed text-sm uppercase tracking-[0.12em] text-paper">{photo.title}</p>
        {credit ? (
          <p className="mt-0.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper-soft">
            {credit.handle ? `@${credit.handle} · ` : ''}{credit.name}
          </p>
        ) : (
          <p className="mt-0.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-paper-soft">
            {photo.photographerName ?? photo.photographer}
          </p>
        )}
      </div>
    </Link>
  )
}

export function CategoryBrowse({
  category,
  modelCredits = false,
}: {
  category: string
  modelCredits?: boolean
}) {
  const { content } = useSiteContent()
  const modelsCopy = content.pages.models
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [items, setItems] = useState<PhotoDto[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const pageRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    const gen = ++generation.current
    pageRef.current = 0
    hasMoreRef.current = false
    setLoading(true)
    api.photos({
      page: 1,
      limit: 24,
      q: q || undefined,
      category: modelCredits ? undefined : category,
      featuring: modelCredits ? 'model' : undefined,
      facets: '0',
    }).then((data) => {
      if (generation.current !== gen) return
      setItems(presentPhotos(data.items, modelCredits))
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
  }, [category, modelCredits, q])

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
        category: modelCredits ? undefined : category,
        featuring: modelCredits ? 'model' : undefined,
        facets: '0',
      }).then((data) => {
        if (generation.current !== gen) return
        setItems((prev) => presentPhotos([...prev, ...data.items], modelCredits))
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
  }, [category, modelCredits, q, hasMore, loading, items.length])

  const hero = items[0]
  const featured = items.slice(0, 4)
  const rest = items.length > 4 ? items.slice(4) : []
  const creators = useMemo(() => {
    const seen = new Map<string, PhotoDto>()
    for (const photo of items) {
      if (!photo.photographer || seen.has(photo.photographer)) continue
      seen.set(photo.photographer, photo)
    }
    return [...seen.values()].slice(0, 8)
  }, [items])
  const topicCovers = useMemo(() => {
    const seen = new Map<string, PhotoDto>()
    for (const photo of items) {
      for (const topic of photo.tags ?? []) {
        if (!seen.has(topic)) seen.set(topic, photo)
        if (seen.size >= 4) return [...seen.entries()]
      }
    }
    return [...seen.entries()]
  }, [items])
  const title = modelCredits ? modelsCopy.title : category
  const kicker = modelCredits ? modelsCopy.kicker : 'Home / Categories'

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="relative min-h-[340px] overflow-hidden bg-[#14110e] text-white md:min-h-[420px]">
        {hero?.src && <img src={hero.src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/20" />
        <div className="relative mx-auto flex min-h-[340px] max-w-[1500px] flex-col justify-end px-5 pb-8 md:min-h-[420px] md:px-8">
          <p className="text-sm text-white/80">{kicker}</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display text-5xl text-white md:text-7xl">{title}</h1>
            <p className="max-w-sm text-sm text-white/80">
              {modelCredits ? modelsCopy.intro : `Extraordinary destinations across ${category}. Authentic African photographs from the people who made them.`}
            </p>
          </div>
        </div>
      </section>

      <div className="border-b border-sand bg-white">
        <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-5 py-4 no-scrollbar md:px-8">
          <Link to="/search" className="shrink-0 rounded-full border border-sand px-3 py-1.5 text-xs font-medium text-ink hover:border-terra">All</Link>
          {PHOTO_CATEGORIES.map((name) => (
            <Link
              key={name}
              to={categoryPath(name)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${name === category || (modelCredits && name === 'Model') ? 'border-ink bg-ink text-white' : 'border-sand text-ink hover:border-terra'}`}
            >
              {name}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-8 md:px-8">
        <form
          className="max-w-xl"
          onSubmit={(e) => {
            e.preventDefault()
            const next = new URLSearchParams(params)
            const value = new FormData(e.currentTarget).get('q')
            const query = typeof value === 'string' ? value.trim() : ''
            if (query) next.set('q', query)
            else next.delete('q')
            setParams(next)
          }}
        >
          <input
            name="q"
            defaultValue={q}
            placeholder={modelCredits ? 'Search by title or model name' : `Search within ${category}`}
            className="w-full rounded-full border border-sand bg-white px-4 py-3 text-sm outline-none focus:border-terra"
          />
        </form>

        {!loading && items.length === 0 && (
          <p className="mt-8 text-sm text-ink-soft">No photographs match that search.</p>
        )}

        {!loading && featured.length > 0 && (
          <div className="mt-10">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="font-display text-3xl text-ink">{modelCredits ? 'Featured appearances' : `Featured ${category}`}</h2>
                <p className="mt-1 text-sm text-ink-soft">{loading ? 'Loading…' : `${total} photograph${total === 1 ? '' : 's'}`}</p>
              </div>
              <Link to="/search" className="text-sm font-semibold text-terra">View all</Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-12">
              {featured[0] && (
                <div className="lg:col-span-5">
                  <CategoryCard photo={featured[0]} modelCredits={modelCredits} />
                </div>
              )}
              {featured[1] && (
                <div className="lg:col-span-4">
                  <CategoryCard photo={featured[1]} modelCredits={modelCredits} />
                </div>
              )}
              {(featured[2] || featured[3]) && (
                <div className="grid gap-4 lg:col-span-3">
                  {featured[2] && <CategoryCard photo={featured[2]} modelCredits={modelCredits} />}
                  {featured[3] && <CategoryCard photo={featured[3]} modelCredits={modelCredits} />}
                </div>
              )}
            </div>
          </div>
        )}

        {!modelCredits && topicCovers.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-3xl text-ink">In this category</h2>
              <Link to={`/search?category=${encodeURIComponent(category)}`} className="text-sm font-semibold text-terra">View all</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {topicCovers.map(([topic, photo]) => (
                <Link key={topic} to={`/search?category=${encodeURIComponent(category)}&tag=${encodeURIComponent(topic)}`} className="group relative aspect-[16/10] overflow-hidden rounded-2xl">
                  <img src={photo.src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute bottom-3 left-3 text-lg font-semibold text-white">{topic}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {creators.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-3xl text-ink">{modelCredits ? 'Models in view' : `Creators in ${category}`}</h2>
              <Link to={modelCredits ? '/models' : '/creators'} className="text-sm font-semibold text-terra">View all</Link>
            </div>
            <div className="flex gap-5 overflow-x-auto no-scrollbar">
              {creators.map((photo) => (
                <Link key={photo.photographer} to={modelCredits && photo.appearances?.[0]?.modelHandle ? `/m/${photo.appearances[0].modelHandle}` : `/p/${photo.photographer}`} className="w-28 shrink-0 text-center">
                  {photo.photographerAvatar ? (
                    <img src={photo.photographerAvatar} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream text-lg font-semibold">{(photo.photographerName ?? photo.photographer).slice(0, 1)}</span>
                  )}
                  <p className="mt-2 truncate text-sm font-semibold text-ink">{photo.photographerName ?? photo.photographer}</p>
                  <p className="truncate text-xs text-ink-soft">{photo.country}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link to="/pricing" className="mt-12 flex flex-col items-start justify-between gap-4 rounded-3xl bg-[#14110e] px-6 py-8 text-white md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl">License authentic African content</h2>
            <p className="mt-2 text-sm text-white/70">Plans for commercial use where the photograph’s rights allow it.</p>
          </div>
          <span className="rounded-full bg-terra px-5 py-3 text-sm font-semibold">View pricing</span>
        </Link>

        {rest.length > 0 && (
          <>
            <div className="mt-12 flex items-end justify-between">
              <h2 className="font-display text-3xl text-ink">{modelCredits ? 'More appearances' : `Explore ${category}`}</h2>
              <p className="text-sm text-ink-soft">{total} results</p>
            </div>
            <div className="masonry mt-6">
              {rest.map((photo) => (
                <CategoryCard key={photo.id} photo={photo} modelCredits={modelCredits} />
              ))}
            </div>
          </>
        )}

        <div ref={sentinel} className="mt-10 flex justify-center">
          {loadingMore && (
            <span className="text-sm text-ink-soft">Loading more</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Category() {
  const { slug = '' } = useParams()
  const category = categoryFromSlug(slug)
  if (category === 'Model') return <Navigate to="/models" replace />
  if (!category) return <NotFound />
  return <CategoryBrowse category={category} />
}
