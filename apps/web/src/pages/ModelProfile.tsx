import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { ModelPublicDto, PhotoDto } from '@vuekumi/shared'
import { AVAILABILITY_LABELS } from '@vuekumi/shared'
import { PhotoMasonry } from '../components/shared'
import { CountryMark, PhotoHoverActions } from '../components/PhotoActions'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import { fmt } from '../data/content'
import { categoryPath } from '../lib/categories'

export default function ModelProfile() {
  const { handle } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [profile, setProfile] = useState<ModelPublicDto | null>(null)
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
    api.modelPublic(handle, { page: 1, limit: 24, sort })
      .then((data) => {
        if (cancelled) return
        setProfile(data.model)
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
    const data = await api.modelPublic(handle, { page: next, limit: 24, sort })
    setItems((prev) => [...prev, ...data.items])
    setHasMore(data.hasMore)
    setPage(next)
  }

  const featured = items.slice(0, 4)
  const categories = useMemo(() => {
    const counts = new Map<string, { count: number; photo: PhotoDto }>()
    for (const photo of items) {
      const current = counts.get(photo.category)
      if (current) current.count += 1
      else counts.set(photo.category, { count: 1, photo })
    }
    return [...counts.entries()].slice(0, 6)
  }, [items])
  const photographers = useMemo(() => {
    const seen = new Map<string, PhotoDto>()
    for (const photo of items) {
      if (!photo.photographer || seen.has(photo.photographer)) continue
      seen.set(photo.photographer, photo)
    }
    return [...seen.values()].slice(0, 8)
  }, [items])

  if (status === 'missing' || !handle) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <div className="mx-auto max-w-md px-6 pb-24 pt-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-terra">404</p>
          <h1 className="font-display mt-2 text-4xl">Model not found.</h1>
          <Link to="/models" className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
            Browse models
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="bg-[#14110e] text-white">
        <div className="mx-auto grid max-w-[1500px] items-end gap-8 px-5 py-10 md:px-8 lg:grid-cols-[280px_1fr]">
          <div className="overflow-hidden rounded-3xl bg-white/10">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="aspect-[3/4] w-full object-cover" />
            ) : items[0]?.src ? (
              <img src={items[0].src} alt="" className="aspect-[3/4] w-full object-cover" />
            ) : (
              <div className="aspect-[3/4] w-full" />
            )}
          </div>
          <div className="pb-2">
            <p className="text-sm text-white/70">Home / Models{profile ? ` / ${profile.name}` : ''}</p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-[#e0a36a]">Model</p>
            <h1 className="font-display mt-2 text-5xl md:text-6xl">{profile?.name ?? 'Model'}</h1>
            {profile && <p className="mt-2 text-sm text-white/75">@{profile.handle} · {profile.location ?? 'Africa'}</p>}
            {profile?.bio && <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80">{profile.bio}</p>}
            <p className="mt-4 max-w-xl text-sm text-white/70">
              Photographs this model approved for use. Copyright stays with the photographer. Models do not earn from licences.
            </p>
            {profile && (
              <div className="mt-6 flex flex-wrap gap-3">
                {profile.availability !== 'unavailable' && user?.modelHandle !== profile.handle && (
                  <Link to={`/book/${profile.handle}`} className="rounded-full bg-terra px-5 py-2.5 text-sm font-semibold text-white">
                    Book {profile.name.split(' ')[0]}
                  </Link>
                )}
                {profile.photographerHandle && (
                  <Link to={`/p/${profile.photographerHandle}`} className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold">
                    Photographer page
                  </Link>
                )}
                <Link to="/models" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold">All models</Link>
              </div>
            )}
            {profile && (
              <dl className="mt-6 grid max-w-lg grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs text-white/60">Appearances</dt>
                  <dd className="text-xl font-semibold">{fmt(profile.photosCount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/60">Profile views</dt>
                  <dd className="text-xl font-semibold">{fmt(profile.profileViews ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/60">Availability</dt>
                  <dd className="text-sm font-semibold">{AVAILABILITY_LABELS[profile.availability]}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-10 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-ink">Featured Appearances</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {status === 'loading'
                ? 'Loading…'
                : total === 0
                  ? 'No public photographs yet'
                  : `${total} photograph${total === 1 ? '' : 's'}`}
            </p>
          </div>
          {total > 0 && (
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value === 'newest') next.delete('sort')
                else next.set('sort', e.target.value)
                setParams(next)
              }}
              className="rounded-full border border-sand bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="newest">Newest</option>
              <option value="downloads">Downloads</option>
              <option value="views">Views</option>
              <option value="likes">Likes</option>
            </select>
          )}
        </div>

        {status === 'ready' && total === 0 && (
          <p className="mt-8 max-w-xl text-sm text-ink-soft">
            This model has a public profile, but no approved likeness photographs are visible yet.
          </p>
        )}

        {featured.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((photo) => (
              <Link key={photo.id} to={`/photo/${photo.id}`} className="group block overflow-hidden rounded-2xl bg-cream">
                <div className="relative">
                  <img src={photo.src} alt={photo.title} className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <CountryMark country={photo.country} />
                  <PhotoHoverActions photo={photo} />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink">{photo.title}</p>
                  <p className="truncate text-xs text-ink-soft">{photo.photographerName ?? photo.photographer}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {photographers.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl text-ink">Collaborating photographers</h2>
            <div className="mt-4 flex gap-5 overflow-x-auto no-scrollbar">
              {photographers.map((photo) => (
                <Link key={photo.photographer} to={`/p/${photo.photographer}`} className="w-28 shrink-0 text-center">
                  {photo.photographerAvatar ? (
                    <img src={photo.photographerAvatar} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream text-lg font-semibold">{(photo.photographerName ?? photo.photographer).slice(0, 1)}</span>
                  )}
                  <p className="mt-2 truncate text-sm font-semibold">{photo.photographerName ?? photo.photographer}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl text-ink">Style categories</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map(([name, row]) => (
                <Link key={name} to={categoryPath(name)} className="relative aspect-square overflow-hidden rounded-2xl">
                  <img src={row.photo.src} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute bottom-2 left-3 text-sm font-semibold text-white">{name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {profile && (
          <section className="mt-12 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-sand bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Public profile</p>
              <p className="font-display mt-2 text-3xl">{profile.name}</p>
              <p className="mt-1 text-sm text-ink-soft">{profile.location ?? 'Africa'}</p>
              <p className="mt-3 text-sm text-ink-soft">Models do not earn from licences. Copyright stays with the photographer.</p>
            </div>
            <div className="rounded-3xl border border-sand bg-white p-6">
              <h2 className="font-display text-3xl">Availability</h2>
              <p className="mt-3 text-sm text-ink-soft">{AVAILABILITY_LABELS[profile.availability]}</p>
              {profile.dayRateUsd != null && (
                <p className="mt-2 text-sm text-ink-soft">From ${profile.dayRateUsd.toLocaleString()} / day</p>
              )}
              {profile.availability !== 'unavailable' && user?.modelHandle !== profile.handle && (
                <Link to={`/book/${profile.handle}`} className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra">
                  Send a booking inquiry
                </Link>
              )}
            </div>
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
