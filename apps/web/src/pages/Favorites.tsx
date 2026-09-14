import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { PhotoDto } from '@vuekumi/shared'
import { PhotoMasonry, SiteHeader } from '../components/shared'
import { api } from '../api/client'

export default function Favorites() {
  const [items, setItems] = useState<PhotoDto[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.favorites({ page: 1, limit: 24 })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
        setHasMore(data.hasMore)
        setPage(1)
      })
      .catch(() => {
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [])

  async function loadMore() {
    const next = page + 1
    const data = await api.favorites({ page: next, limit: 24 })
    setItems((prev) => [...prev, ...data.items])
    setHasMore(data.hasMore)
    setPage(next)
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-28 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Saved</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Favorites.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Hearts on the library save a photograph to this list. Group a campaign in{' '}
          <Link to="/collections" className="text-terra">collections</Link>. Vuekumi still sells usage permission, not ownership.
        </p>

        {loading ? (
          <p className="mt-16 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-16 text-sm text-ink-soft">
            Nothing saved yet.{' '}
            <Link to="/search" className="text-terra">Browse the library</Link>
          </p>
        ) : (
          <>
            <p className="mt-6 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {total} saved
            </p>
            <PhotoMasonry photos={items} />
            {hasMore && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="border border-ink px-8 py-3 font-mono-tech text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
