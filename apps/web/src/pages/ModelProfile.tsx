import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { AVAILABILITY_LABELS, formatDayRateUsd, isHireableAvailability } from '@vuekumi/shared'
import { PhotoTileMasonry } from '../components/marketplace'
import { DigitalIdCard } from '../components/marketplace/DigitalIdCard'
import { CountryMark, PhotoHoverActions } from '../components/PhotoActions'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { fmt } from '../lib/format'
import { categoryPath } from '../lib/categories'
import { publicQueryKeys } from '../lib/query-keys'

function memberLabel(iso?: string | null) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export default function ModelProfile() {
  const { handle = '' } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') ?? 'newest'

  const query = useInfiniteQuery({
    queryKey: publicQueryKeys.model(handle, sort),
    queryFn: ({ pageParam }) => api.modelPublic(handle, { page: pageParam, limit: 24, sort }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: Boolean(handle),
    retry: false,
  })

  const profile = query.data?.pages[0]?.model ?? null
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )
  const total = query.data?.pages[0]?.total ?? 0
  const missing = query.isError || (query.isFetched && !profile)
  const cover = profile?.coverPhotoUrl ?? profile?.avatarUrl ?? items[0]?.src ?? null
  const featured = items.slice(0, 4)
  const specialties = profile?.specialties?.length
    ? profile.specialties
    : [...new Set(items.map((photo) => photo.category))].slice(0, 6)
  const photographers = profile?.collaborators ?? []
  const since = memberLabel(profile?.memberSince)
  const hireable = profile ? isHireableAvailability(profile.availability) : false

  if (missing || !handle) {
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

  if (query.isLoading || !profile) {
    return <p className="py-20 text-center text-sm text-ink-soft">Loading model profile…</p>
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="bg-[#14110e] text-white">
        <div className="mx-auto grid max-w-[1500px] items-end gap-8 px-5 py-10 md:px-8 lg:grid-cols-[280px_1fr_300px]">
          <div className="overflow-hidden rounded-3xl bg-white/10">
            {cover ? (
              <img src={cover} alt="" className="aspect-[3/4] w-full object-cover" />
            ) : (
              <div className="aspect-[3/4] w-full" />
            )}
          </div>
          <div className="pb-2">
            <p className="text-sm text-white/70">Home / Models / {profile.name}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#e0a36a] px-3 py-1 text-[11px] font-semibold text-[#14110e]">Verified Model</span>
              <span className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/90">
                {AVAILABILITY_LABELS[profile.availability]}
              </span>
            </div>
            <h1 className="font-display mt-3 text-5xl md:text-6xl">{profile.name}</h1>
            <p className="mt-2 text-sm text-white/75">
              @{profile.handle} · {profile.location ?? 'Africa'}
              {since ? ` · Member since ${since}` : ''}
            </p>
            {profile.bio && <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80">{profile.bio}</p>}
            <p className="mt-4 max-w-xl text-sm text-white/70">
              Photographs this model approved for use. Copyright stays with the photographer. Models do not earn from licences.
            </p>
            {specialties.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {specialties.map((label) => (
                  <Link key={label} to={categoryPath(label)} className="rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/90 hover:border-white">
                    {label}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {hireable && user?.modelHandle !== profile.handle && (
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
            <div className="mt-6 flex flex-wrap gap-6 text-sm text-white/85">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Appearances</p>
                <p className="mt-0.5 font-semibold">{fmt(profile.photosCount)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Commercial cleared</p>
                <p className="mt-0.5 font-semibold">{fmt(profile.commercialAppearanceCount ?? 0)}</p>
              </div>
              {profile.profileViews != null && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Profile views</p>
                  <p className="mt-0.5 font-semibold">{fmt(profile.profileViews)}</p>
                </div>
              )}
              {profile.dayRateUsd != null && hireable && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Day rate</p>
                  <p className="mt-0.5 font-semibold">{formatDayRateUsd(profile.dayRateUsd)}</p>
                </div>
              )}
            </div>
          </div>
          {profile.digitalId && (
            <div className="pb-2">
              <DigitalIdCard
                preview={profile.digitalId}
                name={profile.name}
                handle={profile.handle}
                location={profile.location}
                avatarUrl={profile.avatarUrl}
              />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-10 md:px-8">
        {featured.length > 0 && (
          <section>
            <h2 className="font-display text-3xl text-ink">Featured appearances</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featured.map((photo) => (
                <Link key={photo.id} to={`/photo/${photo.id}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream">
                  <img src={photo.src} alt={photo.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <CountryMark country={photo.country} />
                  <PhotoHoverActions photo={photo} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {photographers.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl text-ink">Collaborating photographers</h2>
            <div className="mt-4 flex gap-5 overflow-x-auto no-scrollbar">
              {photographers.map((person) => (
                <Link key={person.handle} to={`/p/${person.handle}`} className="w-28 shrink-0 text-center">
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream text-lg font-semibold">
                      {person.name.slice(0, 1)}
                    </span>
                  )}
                  <p className="mt-2 truncate text-sm font-semibold text-ink">{person.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(profile.collections?.length ?? 0) > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-3xl text-ink">Featured collections</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(profile.collections ?? []).map((collection) => (
                <Link
                  key={collection.id}
                  to={`/c/${collection.id}`}
                  className="group overflow-hidden rounded-2xl border border-sand bg-white"
                >
                  <div className="aspect-[16/10] bg-cream">
                    {collection.coverSrc ? (
                      <img src={collection.coverSrc} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-ink">{collection.name}</p>
                    <p className="mt-1 text-xs text-ink-soft">{collection.photoCount} photograph{collection.photoCount === 1 ? '' : 's'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl text-ink">Portfolio</h2>
              <p className="mt-1 text-sm text-ink-soft">{total} appearance{total === 1 ? '' : 's'}</p>
            </div>
            <select
              aria-label="Sort portfolio"
              value={sort}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value === 'newest') next.delete('sort')
                else next.set('sort', e.target.value)
                setParams(next)
              }}
              className="rounded-full border border-sand bg-white px-3 py-2 text-sm"
            >
              <option value="newest">Most recent</option>
              <option value="downloads">Downloads</option>
              <option value="views">Views</option>
              <option value="likes">Likes</option>
            </select>
          </div>
          {items.length > 0 ? (
            <PhotoTileMasonry photos={items} modelCredits />
          ) : (
            <p className="text-sm text-ink-soft">No public appearances yet.</p>
          )}
          {query.hasNextPage && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                className="rounded-full border border-sand px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink"
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
