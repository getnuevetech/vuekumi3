import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { PhotoDto, PhotographerDto } from '@vuekumi/shared'
import { AVAILABILITY_LABELS, creatorKindLabel } from '@vuekumi/shared'
import { PhotoMasonry } from '../components/shared'
import { FollowButton } from '../components/FollowButton'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import { fmt } from '../data/content'
import { categoryPath } from '../lib/categories'

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

  const openCreator = profile?.creatorKind === 'photo_influencer'
  const featured = items.slice(0, 4)
  const downloaded = useMemo(() => [...items].sort((a, b) => b.downloads - a.downloads).slice(0, 4), [items])
  const verifiedPlus = items.filter((photo) => photo.libraryTier === 'VERIFIED_PLUS').slice(0, 8)
  const categories = useMemo(() => {
    const counts = new Map<string, { count: number; photo: PhotoDto }>()
    for (const photo of items) {
      const current = counts.get(photo.category)
      if (current) current.count += 1
      else counts.set(photo.category, { count: 1, photo })
    }
    return [...counts.entries()].slice(0, 8)
  }, [items])

  if (status === 'missing' || !handle) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <div className="mx-auto max-w-md px-6 pb-24 pt-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-terra">404</p>
          <h1 className="font-display mt-2 text-4xl">Photographer not found.</h1>
          <Link to="/search" className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
            Back to the library
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="relative min-h-[280px] overflow-hidden bg-[#14110e] md:min-h-[360px]">
        {items[0]?.src && <img src={items[0].src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
        <p className="relative px-5 pt-6 text-sm text-white/80 md:px-8">Home / Creators / {profile?.name ?? handle}</p>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 md:px-8">
        {profile && (
          <div className={`grid gap-6 rounded-3xl border border-sand bg-white p-6 md:grid-cols-[auto_1fr_auto] md:items-center ${items[0]?.src ? '-mt-20' : 'mt-8'}`}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-white" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-cream text-3xl font-semibold ring-4 ring-white">{profile.name.slice(0, 1)}</div>
            )}
            <div>
              <p className="text-sm font-semibold text-terra">
                {creatorKindLabel(profile.creatorKind)}
                {openCreator ? ' · Open Creator' : ''}
              </p>
              <h1 className="font-display mt-1 text-4xl text-ink md:text-5xl">{profile.name}</h1>
              <p className="mt-1 text-sm text-ink-soft">@{profile.handle} · {profile.location ?? 'Africa'}</p>
              {profile.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <FollowButton
                  handle={profile.handle}
                  following={profile.following}
                  mine={user?.contributorHandle === profile.handle}
                  redirectTo={`/p/${profile.handle}`}
                  onChange={(result) => {
                    setProfile((p) => p ? { ...p, following: result.following, followers: result.followers } : p)
                  }}
                />
                {!openCreator && profile.availability !== 'unavailable' && user?.contributorHandle !== profile.handle && (
                  <Link to={`/hire/${profile.handle}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra">
                    Hire {profile.name.split(' ')[0]}
                  </Link>
                )}
                <Link to={`/search?photographer=${encodeURIComponent(profile.handle)}`} className="rounded-full border border-sand px-5 py-2.5 text-sm font-semibold hover:border-ink">
                  Open in search
                </Link>
                {profile.modelHandle && (
                  <Link to={`/m/${profile.modelHandle}`} className="rounded-full border border-sand px-5 py-2.5 text-sm font-semibold hover:border-ink">
                    Model portfolio
                  </Link>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 md:w-72">
              <Stat label="Photos" value={fmt(profile.photosCount)} />
              <Stat label="Downloads" value={fmt(profile.downloads)} />
              <Stat label="Followers" value={fmt(profile.followers)} />
            </dl>
          </div>
        )}

        {profile && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-sand bg-white p-6">
              <h2 className="font-display text-3xl text-ink">About</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {profile.bio || (openCreator
                  ? 'Photo Influencer photographs stay in the Free Library. This profile is for discovery, not paid stock.'
                  : 'Photographs on this profile are offered under the rights recorded for each image.')}
              </p>
              <p className="mt-4 text-sm text-ink-soft">
                {AVAILABILITY_LABELS[profile.availability]}
                {!openCreator && profile.dayRateUsd != null ? ` · from $${profile.dayRateUsd.toLocaleString()} / day` : ''}
                {profile.represented ? ' · Represented by VueQuatro' : ''}
                {profile.profileViews != null ? ` · ${fmt(profile.profileViews)} profile views` : ''}
              </p>
            </div>
            <div className="rounded-3xl border border-sand bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Creator profile</p>
              <p className="font-display mt-2 text-2xl text-ink">{profile.name}</p>
              <p className="mt-1 text-sm text-ink-soft">@{profile.handle}</p>
              <p className="mt-3 text-sm text-ink-soft">
                {openCreator ? 'Free Library only. Photo Influencer accounts do not sell licensed stock from this page.' : `${profile.photosCount} live photographs · ${fmt(profile.downloads)} downloads`}
              </p>
              <p className="mt-4 text-xs text-ink-faint">Public profile card. This is not an identity check.</p>
            </div>
          </div>
        )}

        {openCreator && (
          <div className="mt-6 rounded-3xl bg-[#14110e] px-6 py-6 text-white md:flex md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#e0a36a]">Open Creator</p>
              <h2 className="font-display mt-1 text-3xl">Take your creativity further</h2>
              <p className="mt-2 max-w-xl text-sm text-white/75">Photo Influencer work stays in the Free Library. A Photographer or Contributor account is how paid library tiers are offered.</p>
            </div>
            <Link to="/account" className="mt-4 inline-flex rounded-full bg-terra px-5 py-3 text-sm font-semibold text-white md:mt-0">Upgrade now</Link>
          </div>
        )}

        <PhotoRow
          title={openCreator ? 'Featured Open Images' : 'Featured Shoots'}
          photos={featured}
          sort={sort}
          onSort={(value) => {
            const next = new URLSearchParams(params)
            if (value === 'newest') next.delete('sort')
            else next.set('sort', value)
            setParams(next)
          }}
        />

        {!openCreator && downloaded.length > 0 && (
          <PhotoRow title="Most downloaded" photos={downloaded} />
        )}

        {!openCreator && verifiedPlus.length > 0 && (
          <PhotoRow title="Verified+" photos={verifiedPlus} />
        )}

        {categories.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl text-ink">Categories</h2>
            <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar">
              {categories.map(([name, row]) => (
                <Link key={name} to={categoryPath(name)} className="relative h-28 w-40 shrink-0 overflow-hidden rounded-2xl">
                  <img src={row.photo.src} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute bottom-2 left-3 text-sm font-semibold text-white">{name}</p>
                  <p className="absolute right-3 top-2 text-xs text-white">{row.count}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {profile && (
          <section className="mt-12 grid gap-3 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-4">
            <Stat label="Live photos" value={fmt(total || profile.photosCount)} />
            <Stat label="Downloads" value={fmt(profile.downloads)} />
            <Stat label="Followers" value={fmt(profile.followers)} />
            <Stat label="Profile views" value={fmt(profile.profileViews ?? 0)} />
          </section>
        )}

        {items.length > 4 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl text-ink">Portfolio</h2>
            <PhotoMasonry photos={items.slice(4)} />
          </section>
        )}

        {hasMore && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              className="rounded-full border border-ink px-8 py-3 text-sm font-semibold hover:bg-ink hover:text-white"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-3 text-center">
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  )
}

function PhotoRow({
  title,
  photos,
  sort,
  onSort,
}: {
  title: string
  photos: PhotoDto[]
  sort?: string
  onSort?: (value: string) => void
}) {
  if (photos.length === 0) return null
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-3xl text-ink">{title}</h2>
        {onSort && (
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            className="rounded-full border border-sand bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="newest">Newest</option>
            <option value="downloads">Downloads</option>
            <option value="views">Views</option>
            <option value="likes">Likes</option>
          </select>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {photos.map((photo) => (
          <Link key={photo.id} to={`/photo/${photo.id}`} className="group block">
            <div className="overflow-hidden rounded-2xl bg-cream">
              <img src={photo.src} alt={photo.title} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-ink">{photo.title}</p>
            <p className="truncate text-xs text-ink-soft">{photo.country} · {fmt(photo.downloads)} downloads</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
