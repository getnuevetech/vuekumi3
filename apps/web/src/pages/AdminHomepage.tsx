import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  HOME_FEATURED_SLOT_KEYS,
  type HomeFeaturedAdminDto,
  type HomeFeaturedSlotKey,
  type PhotoDto,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

function emptyPins(page: HomeFeaturedAdminDto): HomeFeaturedAdminDto['pins'] {
  return { ...page.pins }
}

export default function AdminHomepage() {
  const [page, setPage] = useState<HomeFeaturedAdminDto | null>(null)
  const [pins, setPins] = useState<HomeFeaturedAdminDto['pins'] | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PhotoDto[]>([])
  const [target, setTarget] = useState<{ slot: HomeFeaturedSlotKey; position: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.adminHomepage()
      .then((next) => {
        setPage(next)
        setPins(emptyPins(next))
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load homepage'))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    const handle = window.setTimeout(() => {
      api.adminContent({ q: term })
        .then((d) => setHits(d.items.slice(0, 8)))
        .catch(() => setHits([]))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [q])

  const setPin = (slot: HomeFeaturedSlotKey, position: number, photoId: string | null) => {
    setPins((current) => {
      if (!current) return current
      const next = [...(current[slot] ?? [])]
      next[position] = photoId
      return { ...current, [slot]: next }
    })
  }

  const save = async () => {
    if (!pins) return
    setBusy(true)
    try {
      const next = await api.saveHomepage({ pins })
      setPage(next)
      setPins(emptyPins(next))
      toast.success('Homepage featured slots saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell subtitle="Pin live stock photographs into homepage slots. Unfilled positions keep the ranking fallback.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Homepage</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Featured slots.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Featuring a photograph is curation, not a licence and not AI-training consent.
        Private, portfolio, and agency-protected inventory cannot appear on the public homepage.
        Empty positions fall back to live ranking so the page never goes blank.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Find a live photograph</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, id, country…"
            className="mt-1 w-72 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
          />
        </label>
        <button
          type="button"
          disabled={busy || !pins}
          onClick={() => void save()}
          className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          Save featured slots
        </button>
      </div>

      {hits.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {hits.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => {
                if (target) setPin(target.slot, target.position, photo.id)
                else toast.message(`Select a slot, then pin ${photo.id}`)
              }}
              className="flex items-center gap-3 rounded-2xl border border-sand-soft bg-white p-2 text-left hover:border-terra"
            >
              <img src={photo.src} alt="" className="h-12 w-16 rounded-lg object-cover" />
              <span>
                <span className="block text-sm font-medium">{photo.title}</span>
                <span className="font-mono-tech text-[10px] text-ink-faint">{photo.id}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 space-y-10">
        {HOME_FEATURED_SLOT_KEYS.map((slot) => (
          <section key={slot}>
            <h2 className="font-serif-display text-2xl font-light">{page?.labels[slot] ?? slot}</h2>
            <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {page?.capacities[slot] ?? 0} positions
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(page?.slots[slot] ?? []).map((row) => {
                const pinnedId = pins?.[slot]?.[row.position] ?? null
                const selected = target?.slot === slot && target.position === row.position
                return (
                  <article
                    key={`${slot}-${row.position}`}
                    className={`rounded-2xl border bg-white p-3 ${selected ? 'border-terra' : 'border-sand-soft'}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => setTarget({ slot, position: row.position })}>
                      {row.photo ? (
                        <img src={row.photo.src} alt="" className="h-28 w-full rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-xl bg-cream text-sm text-ink-faint">Empty — auto fill</div>
                      )}
                      <p className="mt-2 text-sm font-medium">{row.photo?.title ?? 'No photograph yet'}</p>
                      <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        #{row.position + 1} · {row.source}{row.ineligibleReason ? ` · ${row.ineligibleReason}` : ''}
                      </p>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={pinnedId ?? ''}
                        onFocus={() => setTarget({ slot, position: row.position })}
                        onChange={(e) => setPin(slot, row.position, e.target.value.trim() || null)}
                        placeholder="Photo id or leave blank"
                        className="min-w-0 flex-1 rounded-full border border-sand-soft px-3 py-1.5 font-mono-tech text-[11px] outline-none focus:border-terra"
                      />
                      <button
                        type="button"
                        onClick={() => setPin(slot, row.position, null)}
                        className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                      >
                        Auto
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  )
}
