import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ModelPublicDto } from '@vuekumi/shared'
import { SiteHeader } from '../components/shared'
import { useSiteContent } from '../context/SiteContentContext'
import { api } from '../api/client'

export default function Models() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<ModelPublicDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { content } = useSiteContent()
  const page = content.pages.models
  const q = params.get('q') ?? ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.models({ page: 1, limit: 48, q: q || undefined })
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
  }, [q])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{page.kicker}</p>
        <h1 className="font-serif-display mt-2 text-5xl font-light tracking-tight">{page.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{page.intro}</p>

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
            placeholder="Search by name, handle, or location"
            className="w-full border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </form>

        <p className="mt-8 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {loading ? 'Loading…' : `${total} public portfolio${total === 1 ? '' : 's'}`}
        </p>

        {!loading && items.length === 0 && (
          <p className="mt-6 text-sm text-ink-soft">No public model portfolios match that search.</p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((model) => (
            <Link
              key={model.handle}
              to={`/m/${model.handle}`}
              className="group border border-sand bg-white p-5 transition-colors hover:border-ink"
            >
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
              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {model.photosCount} approved photograph{model.photosCount === 1 ? '' : 's'}
                {model.photographerHandle ? ' · also photographs' : ''}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
