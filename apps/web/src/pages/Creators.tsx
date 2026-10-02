import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { CreatorKind } from '@vuekumi/shared'
import {
  AVAILABILITY_LABELS,
  creatorKindLabel,
  creatorKindSchema,
  formatDayRateUsd,
  isHireableAvailability,
} from '@vuekumi/shared'
import { DigitalIdCard } from '../components/marketplace/DigitalIdCard'
import { useSiteContent } from '../context/SiteContentContext'
import { api } from '../api/client'
import { fmt } from '../lib/format'
import { publicQueryKeys } from '../lib/query-keys'

const KIND_FILTERS: { value: CreatorKind | ''; label: string }[] = [
  { value: '', label: 'All creators' },
  { value: 'photographer', label: 'Photographers' },
  { value: 'photo_influencer', label: 'Photo influencers' },
]

export default function Creators() {
  const [params, setParams] = useSearchParams()
  const { content } = useSiteContent()
  const page = content.pages.creators
  const q = params.get('q') ?? ''
  const kindParam = creatorKindSchema.safeParse(params.get('kind'))
  const kind: CreatorKind | '' = kindParam.success ? kindParam.data : ''
  const openForHire = params.get('hire') === '1'

  const query = useQuery({
    queryKey: publicQueryKeys.creators({ q, kind, hire: openForHire ? '1' : '' }),
    queryFn: () =>
      api.photographers({
        page: 1,
        limit: 48,
        q: q || undefined,
        kind: kind || undefined,
        availability: openForHire ? 'hireable' : undefined,
      }),
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-8 md:px-8">
        <p className="text-sm font-semibold text-terra">{page.kicker}</p>
        <h1 className="font-display mt-1 text-5xl text-ink">{page.title}</h1>
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
          <Link to="/hire" className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra hover:text-ink">
            Hire browse →
          </Link>
          <form
            className="w-full max-w-md"
            onSubmit={(e) => {
              e.preventDefault()
              const next = new URLSearchParams(params)
              const value = new FormData(e.currentTarget).get('q')
              const queryText = typeof value === 'string' ? value.trim() : ''
              if (queryText) next.set('q', queryText)
              else next.delete('q')
              setParams(next)
            }}
          >
            <input
              name="q"
              defaultValue={q}
              key={q}
              placeholder="Search by name, handle, or location"
              className="w-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </form>
        </div>

        <p className="mt-8 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {query.isLoading ? 'Loading…' : `${total} creator${total === 1 ? '' : 's'}`}
        </p>

        {!query.isLoading && items.length === 0 && (
          <p className="mt-6 text-sm text-ink-soft">No creators match that search.</p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((creator) => {
            const openCreator = creator.creatorKind === 'photo_influencer' || creator.accountType === 'photo_influencer'
            return (
              <article key={creator.handle} className="overflow-hidden rounded-2xl border border-sand bg-white transition-colors hover:border-ink">
                <Link to={`/p/${creator.handle}`} className="group block p-5">
                  {creator.avatarUrl ? (
                    <img src={creator.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream text-2xl font-semibold">{creator.name.slice(0, 1)}</div>
                  )}
                  <h2 className="font-display mt-4 text-2xl tracking-tight group-hover:text-terra">
                    {creator.name}
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    @{creator.handle} · {creator.location ?? 'Africa'}
                  </p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-terra">
                    {openCreator ? 'Photo Influencer · Open Creator' : creator.accountType === 'contributor' ? 'Contributor' : creatorKindLabel(creator.creatorKind)}
                  </p>
                  {isHireableAvailability(creator.availability) && (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                      {AVAILABILITY_LABELS[creator.availability]}
                      {formatDayRateUsd(creator.dayRateUsd) ? ` · ${formatDayRateUsd(creator.dayRateUsd)}` : ''}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                    {creator.photosCount} photograph{creator.photosCount === 1 ? '' : 's'} · {fmt(creator.followers)} followers
                  </p>
                </Link>
                <div className="flex flex-wrap gap-2 border-t border-sand px-5 py-3">
                  {isHireableAvailability(creator.availability) && (
                    <Link
                      to={`/hire/${creator.handle}`}
                      className="inline-block border border-ink px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] hover:bg-ink hover:text-paper"
                    >
                      Hire
                    </Link>
                  )}
                  <Link
                    to={`/p/${creator.handle}`}
                    className="inline-block border border-sand px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:text-ink"
                  >
                    Profile
                  </Link>
                </div>
                {creator.digitalId && (
                  <div className="border-t border-sand p-3">
                    <DigitalIdCard
                      compact
                      preview={creator.digitalId}
                      name={creator.name}
                      handle={creator.handle}
                      location={creator.location}
                      avatarUrl={creator.avatarUrl}
                    />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
