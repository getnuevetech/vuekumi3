import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { LibraryTier, PhotoDto, PhotographerDto } from '@vuekumi/shared'
import { AVAILABILITY_LABELS, LIBRARY_TIER_LABEL, creatorKindLabel } from '@vuekumi/shared'
import { PhotoTileMasonry } from '../components/marketplace'
import { DigitalIdCard } from '../components/marketplace/DigitalIdCard'
import { CountryMark, PhotoHoverActions } from '../components/PhotoActions'
import { FollowButton } from '../components/FollowButton'
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

function FeaturedRow({ photos }: { photos: PhotoDto[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {photos.map((photo) => (
        <Link key={photo.id} to={`/photo/${photo.id}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream">
          <img src={photo.src} alt={photo.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <CountryMark country={photo.country} />
          <PhotoHoverActions photo={photo} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
            <p className="text-sm font-semibold text-white">{photo.title}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

const PORTFOLIO_TIER_ORDER: LibraryTier[] = ['LICENSED', 'EDITORIAL', 'VERIFIED_PLUS', 'OPEN', 'PRIVATE']

export default function Photographer() {
  const { handle = '' } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') ?? 'newest'
  const libraryTier = (params.get('libraryTier') ?? '') as LibraryTier | ''

  const query = useInfiniteQuery({
    queryKey: publicQueryKeys.photographer(handle, sort, libraryTier),
    queryFn: ({ pageParam }) => api.photographer(handle, {
      page: pageParam,
      limit: 24,
      sort,
      ...(libraryTier ? { libraryTier } : {}),
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: Boolean(handle),
    retry: false,
  })

  const profile = query.data?.pages[0]?.photographer ?? null
  const tierFacets = query.data?.pages[0]?.libraryTierFacets ?? []
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )
  const total = query.data?.pages[0]?.total ?? 0
  const missing = query.isError || (query.isFetched && !profile)
  const openCreator = profile?.creatorKind === 'photo_influencer' || profile?.accountType === 'photo_influencer'
  const paidContributor = profile?.accountType === 'contributor' && !openCreator
  const verifiedPhotographer = !openCreator && !paidContributor
  const cover = profile?.coverPhotoUrl ?? items[0]?.src ?? null
  const featured = items.slice(0, 4)
  const downloaded = useMemo(
    () => [...items]
      .filter((photo) => photo.libraryTier === 'LICENSED' || photo.libraryTier === 'VERIFIED_PLUS')
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 4),
    [items],
  )
  const verifiedPlus = items.filter((photo) => photo.libraryTier === 'VERIFIED_PLUS').slice(0, 8)
  const specialties = profile?.specialties?.length
    ? profile.specialties
    : [...new Set(items.map((photo) => photo.category))].slice(0, 6)
  const since = memberLabel(profile?.memberSince)
  const showTier = !openCreator
  const portfolioTiers = PORTFOLIO_TIER_ORDER
    .map((tier) => ({
      tier,
      count: tierFacets.find((row) => row.value === tier)?.count ?? 0,
    }))
    // D05: do not show an empty Free Library tab for paid contributors / photographers.
    .filter((row) => row.count > 0 && !(row.tier === 'OPEN' && (paidContributor || verifiedPhotographer)))
    .filter((row) => row.tier !== 'PRIVATE')

  const setLibraryTier = (nextTier: LibraryTier | '') => {
    const next = new URLSearchParams(params)
    if (!nextTier) next.delete('libraryTier')
    else next.set('libraryTier', nextTier)
    setParams(next)
  }

  if (missing || !handle) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <div className="mx-auto max-w-md px-6 pb-24 pt-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-terra">404</p>
          <h1 className="font-display mt-2 text-4xl">Creator not found.</h1>
          <Link to="/creators" className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
            Browse creators
          </Link>
        </div>
      </div>
    )
  }

  if (query.isLoading || !profile) {
    return <p className="py-20 text-center text-sm text-ink-soft">Loading creator profile…</p>
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="relative min-h-[280px] overflow-hidden bg-[#14110e] md:min-h-[360px]">
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
        <p className="relative px-5 pt-6 text-sm text-white/80 md:px-8">Home / Creators / {profile.name}</p>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 md:px-8">
        <div className={`grid gap-6 rounded-3xl border border-sand bg-white p-6 lg:grid-cols-[auto_1fr_320px] lg:items-start ${cover ? '-mt-20' : 'mt-8'}`}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-white" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-cream text-3xl font-semibold ring-4 ring-white">{profile.name.slice(0, 1)}</div>
          )}
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${openCreator ? 'bg-[#ef5b24] text-white' : 'bg-ink text-white'}`}>
                {openCreator ? 'Photo Influencer · Open Creator' : paidContributor ? 'Contributor' : creatorKindLabel(profile.creatorKind)}
              </span>
              {verifiedPhotographer && profile.represented && (
                <span className="rounded-full bg-[#f3eee9] px-3 py-1 text-[11px] font-semibold text-ink">Represented</span>
              )}
            </div>
            <h1 className="font-display mt-2 text-4xl text-ink md:text-5xl">{profile.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              @{profile.handle} · {profile.location ?? 'Africa'}
              {since ? ` · Member since ${since}` : ''}
            </p>
            {profile.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
            {specialties.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {specialties.map((label) => (
                  <Link key={label} to={categoryPath(label)} className="rounded-full border border-sand px-3 py-1 text-xs font-medium text-ink hover:border-terra">
                    {label}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <FollowButton
                handle={profile.handle}
                following={profile.following}
                mine={user?.contributorHandle === profile.handle}
                redirectTo={`/p/${profile.handle}`}
                onChange={() => { void query.refetch() }}
              />
              {!openCreator && profile.availability !== 'unavailable' && user?.contributorHandle !== profile.handle && (
                <Link to={`/hire/${profile.handle}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra">
                  Hire {profile.name.split(' ')[0]}
                </Link>
              )}
              {profile.modelHandle && (
                <Link to={`/m/${profile.modelHandle}`} className="rounded-full border border-sand px-5 py-2.5 text-sm font-semibold text-ink">
                  Model portfolio
                </Link>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-6 text-sm">
              <Stat label="Photos" value={fmt(profile.photosCount)} />
              {!openCreator && <Stat label="Downloads" value={fmt(profile.downloads)} />}
              <Stat label="Followers" value={fmt(profile.followers)} />
              {profile.profileViews != null && <Stat label="Profile views" value={fmt(profile.profileViews)} />}
              {!openCreator && <Stat label="Availability" value={AVAILABILITY_LABELS[profile.availability]} />}
            </div>
          </div>
          {profile.digitalId && (
            <DigitalIdCard
              preview={profile.digitalId}
              name={profile.name}
              handle={profile.handle}
              location={profile.location}
              avatarUrl={profile.avatarUrl}
            />
          )}
        </div>

        {openCreator && (
          <div className="mt-8 rounded-3xl border border-[#ef5b24]/30 bg-[#fff7f2] p-6 md:flex md:items-center md:justify-between md:gap-6">
            <div>
              <p className="text-sm font-semibold text-[#ef5b24]">Open Creator program</p>
              <p className="mt-2 max-w-2xl text-sm text-ink-soft">
                Free Library uploads only. Monetized participation starts after an account upgrade and image reclassification — current Open images are not for sale.
              </p>
            </div>
            <Link to="/account" className="mt-4 inline-flex rounded-full bg-[#ef5b24] px-5 py-2.5 text-sm font-semibold text-white md:mt-0">
              Upgrade account
            </Link>
          </div>
        )}

        {paidContributor && (
          <p className="mt-8 text-sm text-ink-soft">
            Paid Contributor portfolio — Licensed and Editorial work. Photographers and Contributors do not upload to Free Library.
          </p>
        )}

        {featured.length > 0 && !libraryTier && (
          <section className="mt-12">
            <SectionTitle title={openCreator ? 'Featured Open images' : verifiedPhotographer ? 'Featured shoots' : 'Featured portfolio'} />
            <FeaturedRow photos={featured} />
          </section>
        )}

        {!openCreator && downloaded.length > 0 && !libraryTier && (
          <section className="mt-12">
            <SectionTitle title="Top licensed work" />
            <FeaturedRow photos={downloaded} />
          </section>
        )}

        {!openCreator && verifiedPlus.length > 0 && !libraryTier && (
          <section className="mt-12">
            <SectionTitle title="Verified+" note="Marketplace placement — separate from rights clearance." />
            <FeaturedRow photos={verifiedPlus} />
          </section>
        )}

        {(profile.collaborators?.length ?? 0) > 0 && !libraryTier && (
          <section className="mt-12">
            <SectionTitle title="Collaborating models" note="Approved likeness on public photographs." />
            <div className="mt-4 flex gap-5 overflow-x-auto no-scrollbar">
              {(profile.collaborators ?? []).map((person) => (
                <Link key={person.handle} to={`/m/${person.handle}`} className="w-28 shrink-0 text-center">
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

        {(profile.collections?.length ?? 0) > 0 && !libraryTier && (
          <section className="mt-12">
            <SectionTitle title="Collections" note="Public boards that include this photographer's work." />
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
            <SectionTitle title="Portfolio" note={`${total} photograph${total === 1 ? '' : 's'}`} />
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
          {showTier && portfolioTiers.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Portfolio library tier">
              <button
                type="button"
                role="tab"
                aria-selected={!libraryTier}
                onClick={() => setLibraryTier('')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!libraryTier ? 'bg-ink text-white' : 'border border-sand text-ink hover:border-ink'}`}
              >
                All
              </button>
              {portfolioTiers.map(({ tier, count }) => (
                <button
                  key={tier}
                  type="button"
                  role="tab"
                  aria-selected={libraryTier === tier}
                  onClick={() => setLibraryTier(tier)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${libraryTier === tier ? 'bg-ink text-white' : 'border border-sand text-ink hover:border-ink'}`}
                >
                  {LIBRARY_TIER_LABEL[tier]} · {count}
                </button>
              ))}
            </div>
          )}
          {items.length > 0 ? (
            <PhotoTileMasonry photos={items} />
          ) : (
            <p className="text-sm text-ink-soft">
              {libraryTier
                ? `No ${LIBRARY_TIER_LABEL[libraryTier]} photographs in this portfolio.`
                : 'No public photographs yet.'}
            </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
    </div>
  )
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-3xl text-ink">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink-soft">{note}</p>}
    </div>
  )
}

// Keep type import used for documentation / future layout helpers.
export type CreatorProfile = PhotographerDto
