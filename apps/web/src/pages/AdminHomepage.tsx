import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  HOME_FEATURED_SLOT_KEYS,
  PHOTO_CATEGORIES,
  type CategoryBannerPin,
  type HomeEditorialMode,
  type HomeFeaturedAdminDto,
  type HomeFeaturedSlotKey,
  type PhotoDto,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

function emptyPins(page: HomeFeaturedAdminDto): HomeFeaturedAdminDto['pins'] {
  return { ...page.pins }
}

const SLOT_NOTE: Partial<Record<HomeFeaturedSlotKey, string>> = {
  edge: 'These are the featured images. On the homepage they sit above the three messages and scroll left or right with the mouse wheel.',
  editorial: 'Pin several photographs and they change on a timer, or choose a category and the slides pull live images from that category.',
  pricing: 'These photographs fill homepage pricing cards that do not have their own image. Plan names, prices, and the lines on the cards are edited under Buyer plans.',
}

type PinTarget =
  | { kind: 'slot'; slot: HomeFeaturedSlotKey; position: number }
  | { kind: 'banner'; position: number }

export default function AdminHomepage() {
  const [page, setPage] = useState<HomeFeaturedAdminDto | null>(null)
  const [pins, setPins] = useState<HomeFeaturedAdminDto['pins'] | null>(null)
  const [banners, setBanners] = useState<CategoryBannerPin[] | null>(null)
  const [editorialMode, setEditorialMode] = useState<HomeEditorialMode>('pins')
  const [editorialCategory, setEditorialCategory] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PhotoDto[]>([])
  const [target, setTarget] = useState<PinTarget | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.adminHomepage()
      .then((next) => {
        setPage(next)
        setPins(emptyPins(next))
        setBanners(next.categoryBanners.map((row) => ({ photoId: row.photoId, category: row.category })))
        setEditorialMode(next.editorialMode)
        setEditorialCategory(next.editorialCategory ?? '')
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

  const setBanner = (position: number, patch: Partial<CategoryBannerPin>) => {
    setBanners((current) => {
      if (!current) return current
      const next = current.map((row) => ({ ...row }))
      next[position] = { ...next[position], ...patch }
      return next
    })
  }

  const save = async () => {
    if (!pins || !banners) return
    setBusy(true)
    try {
      const next = await api.saveHomepage({
        pins,
        categoryBanners: banners,
        editorial: { mode: editorialMode, category: editorialCategory || null },
      })
      setPage(next)
      setPins(emptyPins(next))
      setBanners(next.categoryBanners.map((row) => ({ photoId: row.photoId, category: row.category })))
      setEditorialMode(next.editorialMode)
      setEditorialCategory(next.editorialCategory ?? '')
      toast.success('Homepage featured slots saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell subtitle="Featured images, category banners, and the editorial slideshow.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Homepage</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Featured slots.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        The public menu is edited under <Link to="/admin/menu" className="text-terra">Menu</Link>. Other words and the logo are under <Link to="/admin/site" className="text-terra">Site content</Link>. Featuring a photograph is curation, not a licence and not AI-training consent.
        Private, portfolio, and agency-protected inventory cannot appear on the public homepage.
        Featured images scroll sideways above the three homepage messages. Category banners sit below those messages and link to the category you choose.
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
                if (!target) {
                  toast.message(`Select a slot, then pin ${photo.id}`)
                  return
                }
                if (target.kind === 'banner') setBanner(target.position, { photoId: photo.id })
                else setPin(target.slot, target.position, photo.id)
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
            {SLOT_NOTE[slot] && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{SLOT_NOTE[slot]}</p>}
            {slot === 'editorial' && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Slides</span>
                  <select
                    value={editorialMode}
                    onChange={(e) => setEditorialMode(e.target.value as HomeEditorialMode)}
                    className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
                  >
                    <option value="pins">Pinned photographs</option>
                    <option value="category">Category</option>
                  </select>
                </label>
                {editorialMode === 'category' && (
                  <label className="block">
                    <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Category</span>
                    <select
                      value={editorialCategory}
                      onChange={(e) => setEditorialCategory(e.target.value)}
                      className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
                    >
                      <option value="">Choose a category</option>
                      {PHOTO_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(page?.slots[slot] ?? []).map((row) => {
                const pinnedId = pins?.[slot]?.[row.position] ?? null
                const selected = target?.kind === 'slot' && target.slot === slot && target.position === row.position
                return (
                  <article
                    key={`${slot}-${row.position}`}
                    className={`rounded-2xl border bg-white p-3 ${selected ? 'border-terra' : 'border-sand-soft'}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => setTarget({ kind: 'slot', slot, position: row.position })}>
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
                        onFocus={() => setTarget({ kind: 'slot', slot, position: row.position })}
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
            {slot === 'edge' && (
              <section className="mt-10">
                <h2 className="font-serif-display text-2xl font-light">Category banners</h2>
                <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {page?.categoryBannerCapacity ?? banners?.length ?? 0} positions
                </p>
                <p className="mt-2 max-w-2xl text-sm text-ink-soft">
                  These banners sit below the three homepage messages and scroll sideways with the mouse wheel.
                  Choose the category each image links to. Leave a photograph blank to use a live image from that category.
                  Leave every banner blank and the homepage shows one live photograph per category.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(page?.categoryBanners ?? []).map((row) => {
                    const draft = banners?.[row.position]
                    const selected = target?.kind === 'banner' && target.position === row.position
                    return (
                      <article
                        key={`banner-${row.position}`}
                        className={`rounded-2xl border bg-white p-3 ${selected ? 'border-terra' : 'border-sand-soft'}`}
                      >
                        <button type="button" className="w-full text-left" onClick={() => setTarget({ kind: 'banner', position: row.position })}>
                          {row.photo ? (
                            <img src={row.photo.src} alt="" className="h-28 w-full rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-28 items-center justify-center rounded-xl bg-cream text-sm text-ink-faint">Empty — auto fill</div>
                          )}
                          <p className="mt-2 text-sm font-medium">{row.photo?.title ?? 'No photograph yet'}</p>
                          <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                            #{row.position + 1} · {draft?.category || 'no category'} · {row.source}
                          </p>
                        </button>
                        <div className="mt-3 flex flex-col gap-2">
                          <select
                            value={draft?.category ?? ''}
                            onFocus={() => setTarget({ kind: 'banner', position: row.position })}
                            onChange={(e) => setBanner(row.position, { category: e.target.value || null })}
                            className="rounded-full border border-sand-soft bg-white px-3 py-1.5 text-sm outline-none focus:border-terra"
                          >
                            <option value="">Category</option>
                            {PHOTO_CATEGORIES.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input
                              value={draft?.photoId ?? ''}
                              onFocus={() => setTarget({ kind: 'banner', position: row.position })}
                              onChange={(e) => setBanner(row.position, { photoId: e.target.value.trim() || null })}
                              placeholder="Photo id or leave blank"
                              className="min-w-0 flex-1 rounded-full border border-sand-soft px-3 py-1.5 font-mono-tech text-[11px] outline-none focus:border-terra"
                            />
                            <button
                              type="button"
                              onClick={() => setBanner(row.position, { photoId: null, category: null })}
                              className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                            >
                              Auto
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )}
          </section>
        ))}
      </div>
    </AdminShell>
  )
}
