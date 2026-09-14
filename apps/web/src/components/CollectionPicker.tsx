import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { CollectionMembershipDto } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function CollectionPicker({ photoId }: { photoId: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CollectionMembershipDto[]>([])
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [busy, setBusy] = useState(false)
  const agency = Boolean(user?.agencyId)

  function load() {
    api.photoCollections(photoId)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
  }

  useEffect(() => {
    if (open && user) load()
  }, [open, user, photoId])

  async function toggle(col: CollectionMembershipDto) {
    setBusy(true)
    try {
      if (col.contains) await api.removeFromCollection(col.id, photoId)
      else await api.addToCollection(col.id, photoId)
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update collection')
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    setBusy(true)
    try {
      const { collection } = await api.createCollection({ name: trimmed, shared, visibility: 'private' })
      await api.addToCollection(collection.id, photoId)
      setName('')
      load()
      toast.success(`Added to ${collection.name}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create collection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!user) {
            navigate(`/login?redirect=/photo/${photoId}`)
            return
          }
          setOpen((v) => !v)
        }}
        className="w-full border border-sand bg-white py-3 font-mono-tech text-[11px] uppercase tracking-[0.18em] hover:border-terra"
      >
        Add to collection
      </button>
      {open && user && (
        <div className="absolute z-20 mt-2 w-full border border-sand bg-paper p-3 shadow-sm">
          <p className="font-mono-tech text-[9px] uppercase tracking-[0.16em] text-ink-soft">Lightboxes</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {items.map((col) => (
              <li key={col.id}>
                <label className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-sm hover:bg-cream">
                  <input
                    type="checkbox"
                    checked={col.contains}
                    disabled={busy}
                    onChange={() => void toggle(col)}
                    className="accent-[#bc773f]"
                  />
                  <span className="flex-1 truncate">{col.name}</span>
                  {col.shared && (
                    <span className="font-mono-tech text-[8px] uppercase tracking-[0.12em] text-terra">Agency</span>
                  )}
                </label>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-1 py-2 text-sm text-ink-soft">No collections yet.</li>
            )}
          </ul>
          <div className="mt-3 border-t border-sand pt-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New collection name"
              className="w-full border border-sand px-2 py-2 text-sm outline-none focus:border-terra"
            />
            {agency && (
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[#bc773f]" />
                Share with agency
              </label>
            )}
            <button
              type="button"
              disabled={busy || name.trim().length < 2}
              onClick={() => void create()}
              className="mt-2 w-full bg-ink py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper disabled:opacity-40"
            >
              Create & add
            </button>
            <Link to="/collections" className="mt-2 block text-center font-mono-tech text-[9px] uppercase tracking-[0.14em] text-terra">
              Manage collections
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
