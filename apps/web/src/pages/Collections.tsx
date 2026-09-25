import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { CollectionDto } from '@vuekumi/shared'
import { SiteHeader } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Collections() {
  const { user } = useAuth()
  const [items, setItems] = useState<CollectionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [busy, setBusy] = useState(false)
  const agency = Boolean(user?.agencyId)

  function load() {
    api.collections()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load collections'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    setBusy(true)
    try {
      const { collection } = await api.createCollection({ name: trimmed, shared, visibility: 'private' })
      setItems((prev) => [collection, ...prev])
      setName('')
      toast.success('Collection created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create collection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1100px] px-5 pb-24 pt-40">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Lightboxes</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Collections.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Group photographs for a campaign or client review. Sharing a link still grants viewing only — Vuekumi sells usage permission, not ownership.
        </p>

        <form onSubmit={(e) => void create(e)} className="mt-8 flex flex-col gap-3 border border-sand bg-white p-4 md:flex-row md:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New collection name"
            className="flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
          />
          {agency && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[#bc773f]" />
              Share with agency
            </label>
          )}
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="bg-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper disabled:opacity-40"
          >
            Create
          </button>
        </form>

        {loading ? (
          <p className="mt-16 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-16 text-sm text-ink-soft">
            No collections yet.{' '}
            <Link to="/search" className="text-terra">Browse the library</Link>
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <Link key={c.id} to={`/c/${c.id}`} className="group overflow-hidden border border-sand bg-white hover:border-terra">
                <div className="aspect-[16/10] bg-cream">
                  {c.coverSrc ? (
                    <img src={c.coverSrc} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                    {c.photoCount} photographs · {c.visibility}
                    {c.agencyName ? ` · ${c.agencyName}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
