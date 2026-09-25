import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { PhotographerDto } from '@vuekumi/shared'
import { SiteHeader } from '../components/shared'
import { FollowButton } from '../components/FollowButton'
import { api } from '../api/client'
import { fmt } from '../data/content'

export default function Following() {
  const [items, setItems] = useState<PhotographerDto[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.following({ page: 1, limit: 24 })
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
    const data = await api.following({ page: next, limit: 24 })
    setItems((prev) => [...prev, ...data.items])
    setHasMore(data.hasMore)
    setPage(next)
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Following</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Photographers you follow.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Follow a contributor from their public profile. Hearts still save photographs; this list is people.
        </p>

        {loading ? (
          <p className="mt-16 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-16 text-sm text-ink-soft">
            You are not following anyone yet.{' '}
            <Link to="/search" className="text-terra">Browse the library</Link>
          </p>
        ) : (
          <>
            <p className="mt-6 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {total} photographer{total === 1 ? '' : 's'}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((ph) => (
                <div key={ph.handle} className="flex items-center gap-4 border border-sand bg-white p-4">
                  <Link to={`/p/${ph.handle}`} className="flex flex-1 items-center gap-4 min-w-0">
                    {ph.avatarUrl ? (
                      <img src={ph.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-cream" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ph.name}</p>
                      <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                        @{ph.handle} · {ph.location ?? 'Africa'}
                      </p>
                      <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        {fmt(ph.followers)} followers · {ph.photosCount} photographs
                      </p>
                    </div>
                  </Link>
                  <FollowButton
                    handle={ph.handle}
                    following={ph.following}
                    redirectTo="/following"
                    onChange={(result) => {
                      if (!result.following) {
                        setItems((prev) => prev.filter((row) => row.handle !== ph.handle))
                        setTotal((n) => Math.max(0, n - 1))
                      }
                    }}
                  />
                </div>
              ))}
            </div>
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
