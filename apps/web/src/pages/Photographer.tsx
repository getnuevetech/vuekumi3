import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { PhotoDto, PhotographerDto } from '@vuekumi/shared'
import { AVAILABILITY_LABELS, creatorKindLabel } from '@vuekumi/shared'
import { PhotoMasonry, SiteHeader } from '../components/shared'
import { FollowButton } from '../components/FollowButton'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import { fmt } from '../data/content'

export default function Photographer() {
  const { handle } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [profile, setProfile] = useState<PhotographerDto | null>(null)
  const [items, setItems] = useState<PhotoDto[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const sort = params.get('sort') ?? 'newest'

  useEffect(() => {
    if (!handle) return
    let cancelled = false
    setStatus('loading')
    api.photographer(handle, { page: 1, limit: 24, sort })
      .then((data) => {
        if (cancelled) return
        setProfile(data.photographer)
        setItems(data.items)
        setTotal(data.total)
        setHasMore(data.hasMore)
        setPage(1)
        setStatus('ready')
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof ApiError && err.status === 404 ? 'missing' : 'missing')
      })
    return () => { cancelled = true }
  }, [handle, sort])

  async function loadMore() {
    if (!handle) return
    const next = page + 1
    const data = await api.photographer(handle, { page: next, limit: 24, sort })
    setItems((prev) => [...prev, ...data.items])
    setHasMore(data.hasMore)
    setPage(next)
  }

  if (status === 'missing' || !handle) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 pb-24 pt-36 text-center">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">404</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light">Photographer not found.</h1>
          <Link to="/search" className="mt-8 inline-block bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper">
            Back to the library
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-28 md:px-8">
        {profile && (
          <div className="flex flex-col gap-6 border border-sand bg-white p-6 md:flex-row md:items-center">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-28 w-28 rounded-full object-cover" />
            ) : (
              <div className="h-28 w-28 rounded-full bg-cream" />
            )}
            <div className="flex-1">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">
                {creatorKindLabel(profile.creatorKind)}
              </p>
              <h1 className="font-serif-display mt-1 text-4xl font-light tracking-tight">{profile.name}</h1>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                @{profile.handle} · {profile.location ?? 'Africa'}
              </p>
              {profile.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
              <p className="mt-4 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {profile.photosCount} live photographs · {fmt(profile.downloads)} downloads · {fmt(profile.followers)} followers
                {profile.profileViews != null ? ` · ${fmt(profile.profileViews)} profile views` : ''}
              </p>
              <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                {AVAILABILITY_LABELS[profile.availability]}
                {profile.dayRateUsd != null ? ` · from $${profile.dayRateUsd.toLocaleString()} / day` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FollowButton
                handle={profile.handle}
                following={profile.following}
                mine={user?.contributorHandle === profile.handle}
                redirectTo={`/p/${profile.handle}`}
                onChange={(result) => {
                  setProfile((p) => p ? { ...p, following: result.following, followers: result.followers } : p)
                }}
              />
              {profile.availability !== 'unavailable' && user?.contributorHandle !== profile.handle && (
                <Link
                  to={`/hire/${profile.handle}`}
                  className="bg-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
                >
                  Hire {profile.name.split(' ')[0]}
                </Link>
              )}
              <Link
                to={`/search?photographer=${encodeURIComponent(profile.handle)}`}
                className="border border-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper"
              >
                Open in search
              </Link>
              {profile.modelHandle && (
                <Link
                  to={`/m/${profile.modelHandle}`}
                  className="border border-sand px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] hover:border-ink"
                >
                  Model portfolio
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 flex items-end justify-between">
          <h2 className="font-serif-display text-2xl tracking-tight">
            {status === 'loading' ? 'Loading…' : `${total} photograph${total === 1 ? '' : 's'}`}
          </h2>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value === 'newest') next.delete('sort')
              else next.set('sort', e.target.value)
              setParams(next)
            }}
            className="border border-sand bg-white px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none"
          >
            <option value="newest">Newest</option>
            <option value="downloads">Downloads</option>
            <option value="views">Views</option>
            <option value="likes">Likes</option>
          </select>
        </div>

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
      </div>
    </div>
  )
}
