import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import type { PhotoDto } from '@vuekumi/shared'
import { CountryMark, PhotoHoverActions } from '../components/PhotoActions'
import { SiteHeader } from '../components/shared'
import { api } from '../api/client'
import { useSiteContent } from '../context/SiteContentContext'
import { categoryFromSlug } from '../lib/categories'
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
    <Link to={`/photo/${photo.id}`} className="group relative mb-3 block break-inside-avoid overflow-hidden bg-cream">
      <img src={photo.src} alt={photo.title} loading="lazy" className="min-h-48 w-full object-cover" />
      <CountryMark country={photo.country} />
      <PhotoHoverActions photo={photo} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/85 to-transparent p-3 pt-16">
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

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">
          {modelCredits ? modelsCopy.kicker : 'Category'}
        </p>
        <h1 className="font-serif-display mt-2 text-5xl font-light tracking-tight">
          {modelCredits ? modelsCopy.title : category}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {modelCredits ? modelsCopy.intro : `${loading ? '…' : total} photographs in ${category}.`}
        </p>

        <form
          className="mt-8 max-w-md"
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
            placeholder={modelCredits ? 'Search by title or model name' : 'Search this category'}
            className="w-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </form>

        <p className="mt-8 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {loading ? 'Loading…' : `${total} photograph${total === 1 ? '' : 's'}`}
        </p>

        {!loading && items.length === 0 && (
          <p className="mt-6 text-sm text-ink-soft">No photographs match that search.</p>
        )}

        <div className="masonry mt-8">
          {items.map((photo) => (
            <CategoryCard key={photo.id} photo={photo} modelCredits={modelCredits} />
          ))}
        </div>
        <div ref={sentinel} className="mt-10 flex justify-center">
          {loadingMore && (
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading more</span>
          )}
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          <Link to="/search" className="text-terra">The full library</Link>
          {modelCredits ? <> · <Link to="/creators" className="text-terra">Creators</Link></> : null}
        </p>
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
