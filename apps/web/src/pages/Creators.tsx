import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { CreatorKind, PhotographerDto } from '@vuekumi/shared'
import {
  AVAILABILITY_LABELS,
  creatorKindLabel,
  creatorKindSchema,
  formatDayRateUsd,
  isHireableAvailability,
} from '@vuekumi/shared'
import { useSiteContent } from '../context/SiteContentContext'
import { api } from '../api/client'
import { fmt } from '../data/content'

const KIND_FILTERS: { value: CreatorKind | ''; label: string }[] = [
  { value: '', label: 'All creators' },
  { value: 'photographer', label: 'Photographers' },
  { value: 'photo_influencer', label: 'Photo influencers' },
]

export default function Creators() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<PhotographerDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { content } = useSiteContent()
  const page = content.pages.creators
  const q = params.get('q') ?? ''
  const kindParam = creatorKindSchema.safeParse(params.get('kind'))
  const kind: CreatorKind | '' = kindParam.success ? kindParam.data : ''
  const openForHire = params.get('hire') === '1'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.photographers({
      page: 1,
      limit: 48,
      q: q || undefined,
      kind: kind || undefined,
      availability: openForHire ? 'hireable' : undefined,
    })
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [q, kind, openForHire])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{page.kicker}</p>
        <h1 className="font-serif-display mt-2 text-5xl font-light tracking-tight">{page.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{page.intro}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex border border-sand bg-white p-1">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.value || 'all'}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params)
                  if (f.value) next.set('kind', f.value)
                  else next.delete('kind')
                  setParams(next)
                }}
                className={`px-3.5 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  kind === f.value ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              if (openForHire) next.delete('hire')
              else next.set('hire', '1')
              setParams(next)
            }}
            className={`border px-3.5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] ${
              openForHire ? 'border-ink bg-ink text-paper' : 'border-sand bg-white text-ink-soft hover:border-ink'
            }`}
          >
            Open for hire
          </button>
          <Link
            to="/hire"
            className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra hover:text-ink"
          >
            Hire browse →
          </Link>
          <form
            className="w-full max-w-md"
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
              placeholder="Search by name, handle, or location"
              className="w-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </form>
        </div>

        <p className="mt-8 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {loading ? 'Loading…' : `${total} creator${total === 1 ? '' : 's'}`}
        </p>

        {!loading && items.length === 0 && (
          <p className="mt-6 text-sm text-ink-soft">No creators match that search.</p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((creator) => (
            <article key={creator.handle} className="border border-sand bg-white p-5 transition-colors hover:border-ink">
              <Link to={`/p/${creator.handle}`} className="group block">
                {creator.avatarUrl ? (
                  <img src={creator.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-cream" />
                )}
                <h2 className="font-serif-display mt-4 text-2xl font-light tracking-tight group-hover:text-terra">
                  {creator.name}
                </h2>
                <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  @{creator.handle} · {creator.location ?? 'Africa'}
                </p>
              </Link>
              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
                {creatorKindLabel(creator.creatorKind)}
              </p>
              {isHireableAvailability(creator.availability) && (
                <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  {AVAILABILITY_LABELS[creator.availability]}
                  {formatDayRateUsd(creator.dayRateUsd) ? ` · ${formatDayRateUsd(creator.dayRateUsd)}` : ''}
                </p>
              )}
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {creator.photosCount} photograph{creator.photosCount === 1 ? '' : 's'} · {fmt(creator.downloads)} downloads · {fmt(creator.followers)} followers
              </p>
              {isHireableAvailability(creator.availability) && (
                <Link
                  to={`/hire/${creator.handle}`}
                  className="mt-4 inline-block border border-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] hover:bg-ink hover:text-paper"
                >
                  Hire
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
