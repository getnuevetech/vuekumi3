import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ModelPublicDto, PhotographerDto } from '@vuekumi/shared'
import { AVAILABILITY_LABELS, formatDayRateUsd, isHireableAvailability } from '@vuekumi/shared'
import { api } from '../api/client'
import { fmt } from '../data/content'

type Tab = 'photographers' | 'models'

const HIRE_NOTE =
  'Browse photographers and models open for hire. VueKumi records the request and quote — '
  + 'settlement stays off-platform in this phase (no booking commission until Dec-Fee). '
  + 'Messaging here is discovery only.'

export default function HireBrowse() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'models' ? 'models' : 'photographers'
  const q = params.get('q') ?? ''
  const [photographers, setPhotographers] = useState<PhotographerDto[]>([])
  const [models, setModels] = useState<ModelPublicDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = tab === 'photographers'
      ? api.photographers({ page: 1, limit: 48, q: q || undefined, availability: 'hireable', kind: 'photographer' })
      : api.models({ page: 1, limit: 48, q: q || undefined, availability: 'hireable' })
    load
      .then((data) => {
        if (cancelled) return
        if (tab === 'photographers') {
          setPhotographers(data.items as PhotographerDto[])
          setModels([])
        } else {
          setModels(data.items as ModelPublicDto[])
          setPhotographers([])
        }
        setTotal(data.total)
      })
      .catch(() => {
        if (!cancelled) {
          setPhotographers([])
          setModels([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [tab, q])

  function setTab(next: Tab) {
    const p = new URLSearchParams(params)
    if (next === 'models') p.set('tab', 'models')
    else p.delete('tab')
    setParams(p)
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-8 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Hire</p>
        <h1 className="font-serif-display mt-2 text-5xl font-light tracking-tight">Talent open for briefs.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{HIRE_NOTE}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex border border-sand bg-white p-1">
            {([
              { id: 'photographers' as const, label: 'Photographers' },
              { id: 'models' as const, label: 'Models' },
            ]).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTab(f.id)}
                className={`px-3.5 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  tab === f.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
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
          {loading ? 'Loading…' : `${total} open for hire`}
        </p>

        {!loading && total === 0 && (
          <p className="mt-6 text-sm text-ink-soft">No talent matches that search right now.</p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tab === 'photographers' && photographers.map((creator) => (
            <article key={creator.handle} className="border border-sand bg-white p-5">
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
                {AVAILABILITY_LABELS[creator.availability]}
                {formatDayRateUsd(creator.dayRateUsd) ? ` · ${formatDayRateUsd(creator.dayRateUsd)}` : ''}
              </p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {creator.photosCount} photos · {fmt(creator.downloads)} downloads
              </p>
              {isHireableAvailability(creator.availability) && (
                <Link
                  to={`/hire/${creator.handle}`}
                  className="mt-4 inline-block bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra"
                >
                  Hire
                </Link>
              )}
            </article>
          ))}

          {tab === 'models' && models.map((model) => (
            <article key={model.handle} className="border border-sand bg-white p-5">
              <Link to={`/m/${model.handle}`} className="group block">
                {model.avatarUrl ? (
                  <img src={model.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-cream" />
                )}
                <h2 className="font-serif-display mt-4 text-2xl font-light tracking-tight group-hover:text-terra">
                  {model.name}
                </h2>
                <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  @{model.handle} · {model.location ?? 'Africa'}
                </p>
              </Link>
              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
                {AVAILABILITY_LABELS[model.availability]}
                {formatDayRateUsd(model.dayRateUsd) ? ` · ${formatDayRateUsd(model.dayRateUsd)}` : ''}
              </p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {model.photosCount} photograph{model.photosCount === 1 ? '' : 's'}
              </p>
              {isHireableAvailability(model.availability) && (
                <Link
                  to={`/book/${model.handle}`}
                  className="mt-4 inline-block bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra"
                >
                  Book
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
