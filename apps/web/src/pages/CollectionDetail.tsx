import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { CollectionDetailDto, CollectionVisibility } from '@vuekumi/shared'
import { PhotoMasonry, SiteHeader } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function CollectionDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const token = params.get('token') ?? undefined
  const [data, setData] = useState<CollectionDetailDto | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [busy, setBusy] = useState(false)

  function load() {
    if (!id) return
    api.collection(id, { token, limit: 48 })
      .then((d) => {
        setData(d)
        setStatus('ready')
      })
      .catch(() => {
        setData(null)
        setStatus('missing')
      })
  }

  useEffect(() => { load() }, [id, token])

  async function setVisibility(visibility: CollectionVisibility) {
    if (!id) return
    setBusy(true)
    try {
      const { collection } = await api.updateCollection(id, { visibility })
      setData((prev) => prev ? { ...prev, ...collection } : prev)
      toast.success(visibility === 'private' ? 'Now private' : visibility === 'unlisted' ? 'Share link enabled' : 'Marked public')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!id) return
    if (!window.confirm('Delete this collection? Photographs stay in the library.')) return
    setBusy(true)
    try {
      await api.deleteCollection(id)
      toast.success('Collection deleted')
      navigate('/collections')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete')
      setBusy(false)
    }
  }

  async function dropPhoto(photoId: string) {
    if (!id) return
    try {
      await api.removeFromCollection(id, photoId)
      setData((prev) => prev ? {
        ...prev,
        items: prev.items.filter((p) => p.id !== photoId),
        photoCount: Math.max(0, prev.photoCount - 1),
        total: Math.max(0, prev.total - 1),
      } : prev)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove')
    }
  }

  if (status === 'missing') {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 pb-24 pt-40 text-center">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">404</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light">Collection not found.</h1>
          <Link to={user ? '/collections' : '/search'} className="mt-8 inline-block bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper">
            {user ? 'Your collections' : 'Back to the library'}
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'loading' || !data) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <p className="pt-40 text-center font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading collection…</p>
      </div>
    )
  }

  const shareUrl = !data.canEdit
    ? null
    : data.visibility === 'unlisted' && data.shareToken
      ? `${window.location.origin}/c/${data.id}?token=${data.shareToken}`
      : data.visibility === 'public'
        ? `${window.location.origin}/c/${data.id}`
        : null

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          <Link to="/collections" className="hover:text-terra">Collections</Link>
          <span className="mx-2 text-ink-faint">/</span>
          {data.visibility}
        </p>
        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-display text-4xl font-light tracking-tight">{data.name}</h1>
            {data.description && <p className="mt-2 max-w-xl text-sm text-ink-soft">{data.description}</p>}
            <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {data.total} photographs · {data.ownerName}
              {data.agencyName ? ` · ${data.agencyName}` : ''}
            </p>
          </div>
          {data.canEdit && (
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Visibility"
                value={data.visibility}
                disabled={busy}
                onChange={(e) => void setVisibility(e.target.value as CollectionVisibility)}
                className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em]"
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted link</option>
                <option value="public">Public link</option>
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="border border-sand px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:border-[#b3382e] hover:text-[#b3382e]"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {data.canEdit && shareUrl && (
          <p className="mt-4 break-all border border-sand bg-white px-4 py-3 font-mono-tech text-[10px] text-ink-soft">
            Share: {shareUrl}
          </p>
        )}

        {data.items.length === 0 ? (
          <p className="mt-16 text-sm text-ink-soft">
            Empty for now.{' '}
            <Link to="/search" className="text-terra">Add photographs from the library</Link>
          </p>
        ) : (
          <>
            <PhotoMasonry photos={data.items} />
            {data.canEdit && (
              <div className="mt-8 flex flex-wrap gap-2">
                {data.items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void dropPhoto(p.id)}
                    className="font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-soft hover:text-[#b3382e]"
                  >
                    Remove {p.title}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
