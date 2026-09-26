import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  PHOTO_CATEGORIES,
  featuredPinIneligibleReason,
  type HomeFeaturedAdminDto,
  type PhotoDto,
} from '@vuekumi/shared'
import { api, ApiError, type AdminContentRow } from '../api/client'
import { AdminShell } from './Admin'

export default function AdminFeatured() {
  const [page, setPage] = useState<HomeFeaturedAdminDto | null>(null)
  const [category, setCategory] = useState<string>(PHOTO_CATEGORIES[0])
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalog, setCatalog] = useState<AdminContentRow[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [widthVw, setWidthVw] = useState('')
  const [heightVw, setHeightVw] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.adminHomepage()
      .then(setPage)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load featured images'))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!page) return
    setWidthVw(String(page.frame.widthVw))
    setHeightVw(String(page.frame.heightVw))
  }, [page])

  useEffect(() => {
    let cancelled = false
    api.adminContent({ category, status: 'active', page: catalogPage })
      .then((data) => {
        if (cancelled) return
        setCatalog(data.items)
        setCatalogTotal(data.total)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Failed to load this category')
      })
    return () => { cancelled = true }
  }, [category, catalogPage])

  const saveEdge = async (edge: (string | null)[], message: string) => {
    setBusy(true)
    try {
      const next = await api.saveHomepage({ pins: { edge } })
      setPage(next)
      toast.success(message)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update featured images')
    } finally {
      setBusy(false)
    }
  }

  const saveSize = async () => {
    const width = Number(widthVw)
    const height = Number(heightVw)
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      toast.error('Enter a width and a height')
      return
    }
    setBusy(true)
    try {
      const next = await api.saveHomepage({ pins: {}, frame: { widthVw: width, heightVw: height } })
      setPage(next)
      toast.success('Featured image size saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the size')
    } finally {
      setBusy(false)
    }
  }

  const feature = (photo: PhotoDto) => {
    if (!page) return
    const reason = featuredPinIneligibleReason(photo)
    if (reason) {
      toast.error(reason)
      return
    }
    const edge = [...page.pins.edge]
    if (edge.includes(photo.id)) {
      toast.message('That photograph is already featured')
      return
    }
    const slot = edge.findIndex((id) => !id)
    if (slot < 0) {
      toast.error('The featured list is full. Remove one before adding another.')
      return
    }
    edge[slot] = photo.id
    void saveEdge(edge, 'Photograph featured')
  }

  const remove = (position: number) => {
    if (!page) return
    const edge = [...page.pins.edge]
    edge[position] = null
    void saveEdge(edge, 'Removed from featured images')
  }

  const move = (position: number, delta: number) => {
    if (!page) return
    const next = position + delta
    const edge = [...page.pins.edge]
    if (next < 0 || next >= edge.length || !edge[position]) return
    const current = edge[position]
    edge[position] = edge[next] ?? null
    edge[next] = current ?? null
    void saveEdge(edge, 'Featured order updated')
  }

  const rows = page?.slots.edge ?? []
  const pinned = new Set((page?.pins.edge ?? []).filter((id): id is string => Boolean(id)))
  const categoryCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.photo) continue
    categoryCounts.set(row.photo.category, (categoryCounts.get(row.photo.category) ?? 0) + 1)
  }

  return (
    <AdminShell subtitle="The homepage featured strip. Only an admin can choose these photographs.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Featured images</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Featured images.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        This is the only place the homepage featured strip is edited. The same photographs can be switched on from Content, and they appear in this list. Choose photographs from any category. Contributors cannot mark their own images as featured.
        A paid featuring offer for contributors can be added later. It is not available from contributor accounts.
        Other homepage slots stay on <Link to="/admin/homepage" className="text-terra">Homepage</Link>.
        Empty places fill from the live library until you choose a photograph.
      </p>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Size</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Desktop width and height, each as a percent of the screen width. Phone and tablet keep this shape and scale with the screen.
          The starting size is 23.52 wide and 41.81 tall.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Width</span>
            <input
              type="number"
              min={12}
              max={70}
              step={0.1}
              value={widthVw}
              aria-label="Featured width"
              onChange={(e) => setWidthVw(e.target.value)}
              className="mt-1 w-32 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra"
            />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Height</span>
            <input
              type="number"
              min={16}
              max={95}
              step={0.1}
              value={heightVw}
              aria-label="Featured height"
              onChange={(e) => setHeightVw(e.target.value)}
              className="mt-1 w-32 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSize()}
            className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
          >
            Save size
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">On the homepage</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {rows.filter((row) => row.photo).length} photographs
          {page ? ` · ${page.capacities.edge} places` : ''}
          {pinned.size ? ` · ${pinned.size} chosen by an admin` : ''}
        </p>
        {categoryCounts.size > 0 && (
          <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {[...categoryCounts.entries()].map(([name, count]) => `${name} ${count}`).join(' · ')}
          </p>
        )}
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <article key={row.position} className="flex flex-wrap items-center gap-3 rounded-2xl border border-sand-soft p-3">
              {row.photo ? (
                <img src={row.photo.src} alt="" className="h-16 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-cream text-[10px] text-ink-faint">Empty</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.photo?.title ?? 'No photograph yet'}</p>
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  #{row.position + 1}
                  {row.photo ? ` · ${row.photo.category}` : ''}
                  {row.photo ? ` · ${row.photo.photographerName ?? row.photo.photographer}` : ''}
                  {` · ${row.source === 'pinned' ? 'Chosen by admin' : 'Automatic'}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || row.source !== 'pinned' || row.position === 0} onClick={() => move(row.position, -1)} className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">Earlier</button>
                <button type="button" disabled={busy || row.source !== 'pinned' || row.position === rows.length - 1} onClick={() => move(row.position, 1)} className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">Later</button>
                <button type="button" disabled={busy || row.source !== 'pinned'} onClick={() => remove(row.position)} className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">Remove</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Add from a category</h2>
        <label className="mt-4 block max-w-xs">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Category</span>
          <select
            value={category}
            aria-label="Featured category"
            onChange={(e) => {
              setCategory(e.target.value)
              setCatalogPage(1)
            }}
            className="mt-1 w-full rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
          >
            {PHOTO_CATEGORIES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-sm text-ink-soft">{catalogTotal} live photographs in {category}.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((photo) => {
            const reason = featuredPinIneligibleReason(photo)
            const already = pinned.has(photo.id)
            return (
              <article key={photo.id} className="rounded-2xl border border-sand-soft p-3">
                <img src={photo.src} alt="" className="h-36 w-full rounded-xl object-cover" />
                <p className="mt-2 text-sm font-medium">{photo.title}</p>
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {photo.photographerName ?? photo.photographer} · {photo.country}
                </p>
                {reason && <p className="mt-2 text-sm text-ink-soft">{reason}</p>}
                <button
                  type="button"
                  disabled={busy || already || Boolean(reason)}
                  onClick={() => feature(photo)}
                  className="mt-3 rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra disabled:opacity-40"
                >
                  {already ? 'Featured' : 'Feature'}
                </button>
              </article>
            )
          })}
        </div>
        {catalog.length === 0 && <p className="mt-4 text-sm text-ink-soft">No live photographs in this category.</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={catalogPage <= 1} onClick={() => setCatalogPage((n) => Math.max(1, n - 1))} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40">Previous</button>
          <button type="button" disabled={catalogPage * 25 >= catalogTotal} onClick={() => setCatalogPage((n) => n + 1)} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40">Next</button>
        </div>
      </section>
    </AdminShell>
  )
}
