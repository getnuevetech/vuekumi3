import { useSearchParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AVAILABILITY_LABELS,
  formatDayRateUsd,
  isHireableAvailability,
} from '@vuekumi/shared'
import { DigitalIdCard } from '../components/marketplace/DigitalIdCard'
import { useSiteContent } from '../context/SiteContentContext'
import { api } from '../api/client'
import { fmt } from '../lib/format'
import { publicQueryKeys } from '../lib/query-keys'

export default function Models() {
  const [params, setParams] = useSearchParams()
  const { content } = useSiteContent()
  const page = content.pages.models
  const q = params.get('q') ?? ''
  const openForHire = params.get('hire') === '1'

  const query = useQuery({
    queryKey: publicQueryKeys.modelsDirectory({ q, hire: openForHire ? '1' : '' }),
    queryFn: () =>
      api.models({
        page: 1,
        limit: 48,
        q: q || undefined,
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
          <form
            className="min-w-[220px] flex-1"
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
              placeholder="Search models by name or location"
              className="w-full rounded-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
          </form>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              if (openForHire) next.delete('hire')
              else next.set('hire', '1')
              setParams(next)
            }}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              openForHire ? 'border-ink bg-ink text-white' : 'border-sand bg-white text-ink-soft'
            }`}
          >
            Available to book
          </button>
        </div>

        <p className="mt-4 text-sm text-ink-soft">
          {query.isLoading ? 'Loading…' : `${total} model${total === 1 ? '' : 's'}`}
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((model) => {
            const hireable = isHireableAvailability(model.availability)
            return (
              <article key={model.handle} className="overflow-hidden rounded-3xl border border-sand bg-white">
                <Link to={`/m/${model.handle}`} className="block">
                  <div className="aspect-[4/5] overflow-hidden bg-cream">
                    {model.coverPhotoUrl || model.avatarUrl ? (
                      <img src={model.coverPhotoUrl ?? model.avatarUrl ?? ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl font-semibold text-ink-faint">
                        {model.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#e0a36a]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#8a5a20]">Verified Model</span>
                      <span className="rounded-full bg-[#f3eee9] px-2.5 py-0.5 text-[10px] font-semibold text-ink">
                        {AVAILABILITY_LABELS[model.availability]}
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-2xl text-ink">{model.name}</h2>
                    <p className="text-sm text-ink-soft">@{model.handle} · {model.location ?? 'Africa'}</p>
                    {(model.specialties?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(model.specialties ?? []).map((label) => (
                          <span key={label} className="rounded-full border border-sand px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {(model.portfolioStrip?.length ?? 0) > 0 && (
                      <div className="mt-3 grid grid-cols-4 gap-1">
                        {(model.portfolioStrip ?? []).slice(0, 4).map((photo) => (
                          <img key={photo.id} src={photo.src} alt="" className="aspect-square w-full rounded-md object-cover" />
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-ink-faint">
                      {fmt(model.photosCount)} appearance{model.photosCount === 1 ? '' : 's'}
                      {model.dayRateUsd != null && hireable ? ` · ${formatDayRateUsd(model.dayRateUsd)}` : ''}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2 border-t border-sand px-4 py-3">
                  {hireable && (
                    <Link to={`/book/${model.handle}`} className="rounded-full bg-terra px-4 py-2 text-xs font-semibold text-white">
                      Book
                    </Link>
                  )}
                  <Link to={`/m/${model.handle}`} className="rounded-full border border-sand px-4 py-2 text-xs font-semibold text-ink">
                    Profile
                  </Link>
                </div>
                {model.digitalId && (
                  <div className="border-t border-sand p-3">
                    <DigitalIdCard
                      compact
                      preview={model.digitalId}
                      name={model.name}
                      handle={model.handle}
                      location={model.location}
                      avatarUrl={model.avatarUrl}
                    />
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {!query.isLoading && items.length === 0 && (
          <p className="mt-12 text-sm text-ink-soft">No models match those filters.</p>
        )}
      </div>
    </div>
  )
}
