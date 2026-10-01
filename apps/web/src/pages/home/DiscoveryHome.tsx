import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PHOTO_CATEGORIES, LIBRARY_TIER_LABEL, type HomePageDto, type PhotoDto, type PhotographerDto } from '@vuekumi/shared'
import { SearchForm } from '../../components/shared'
import { api } from '../../api/client'
import { categoryPath } from '../../lib/categories'
import { fmt } from '../../lib/format'
import { publicQueryKeys } from '../../lib/query-keys'
import { useSiteContent } from '../../context/SiteContentContext'

function hidden(home: HomePageDto | null, key: string) {
  return Boolean(home?.layout.hidden.includes(key))
}

function dedupePhotos(photos: PhotoDto[]) {
  const seen = new Set<string>()
  return photos.filter((photo) => {
    if (seen.has(photo.id)) return false
    seen.add(photo.id)
    return true
  })
}

function tierLabel(photo: PhotoDto) {
  if (photo.libraryTier) return LIBRARY_TIER_LABEL[photo.libraryTier]
  return photo.license === 'premium' ? 'Premium' : 'Free Library'
}

function PhotoTile({ photo, className = '', showCaption = true }: { photo: PhotoDto; className?: string; showCaption?: boolean }) {
  return (
    <Link to={`/photo/${photo.id}`} className={`group relative block overflow-hidden rounded-2xl bg-cream ${className}`}>
      <img src={photo.src} alt={photo.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm">
        {tierLabel(photo)}
      </span>
      {showCaption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4 pt-16">
          <p className="font-display text-2xl leading-tight text-white">{photo.title}</p>
          <p className="mt-1 text-sm text-white/80">{photo.photographerName ?? photo.photographer} · {photo.country}</p>
        </div>
      )}
    </Link>
  )
}

function EmptyFrame({ className = '' }: { className?: string }) {
  return <div className={`rounded-2xl bg-cream ${className}`} />
}

function SectionHead({ title, text, to, label }: { title: string; text: string; to: string; label: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-3xl text-ink md:text-4xl">{title}</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">{text}</p>
      </div>
      <Link to={to} className="shrink-0 text-sm font-semibold text-terra hover:text-ink">{label}</Link>
    </div>
  )
}

function kindLabel(person: PhotographerDto) {
  if (person.creatorKind === 'photo_influencer') return 'Photo Influencer'
  if (person.creatorKind === 'photographer') return 'Photographer'
  return 'Contributor'
}

export function DiscoveryHome({ home }: { home: HomePageDto | null }) {
  const { content } = useSiteContent()
  const featured = home?.featured
  const heroPhotos = featured?.hero ?? []
  const edge = featured?.edge ?? []
  const editorial = featured?.editorial ?? []
  const pricing = featured?.pricing ?? []
  const categories = featured?.categories ?? []
  const collage = dedupePhotos([...heroPhotos, ...edge, ...editorial]).slice(0, 4)
  const collections = (editorial.length ? editorial : edge).slice(0, 4)
  const influencerRail = home?.layout.people.photo_influencers.people ?? []
  const photographerRail = home?.layout.people.photographers.people ?? []
  const contributorRail = home?.layout.people.contributors.people ?? home?.contributors ?? []
  const spotlightPool = [
    ...(!hidden(home, 'photo_influencers') ? influencerRail : []),
    ...(!hidden(home, 'photographers') ? photographerRail : []),
    ...(!hidden(home, 'contributors') ? contributorRail : []),
  ]
  const spotlight = spotlightPool[0]
  const people = [
    ...(!hidden(home, 'photographers') ? photographerRail : []),
    ...(!hidden(home, 'photo_influencers') ? influencerRail : []),
    ...(!hidden(home, 'contributors') ? contributorRail : []),
  ].filter((person, index, list) => list.findIndex((row) => row.handle === person.handle) === index)
  const chips = (home?.stats.categories ?? []).slice(0, 8)
  const chipLabels = chips.length ? chips.map((row) => row.value) : [...PHOTO_CATEGORIES].slice(0, 8)
  const spotlightPhoto = spotlight
    ? dedupePhotos([...heroPhotos, ...edge, ...editorial, ...pricing]).find((photo) => photo.photographer === spotlight.handle)
    : undefined

  const { data: models = [] } = useQuery({
    queryKey: [...publicQueryKeys.home, 'models'],
    queryFn: () => api.models({ limit: 8 }).then((data) => data.items).catch(() => []),
  })

  const { data: latest = [] } = useQuery({
    queryKey: publicQueryKeys.homeFeed,
    queryFn: () => api.photos({ page: 1, limit: 8, facets: '0' }).then((data) => data.items).catch(() => [] as PhotoDto[]),
  })

  const heroLink = content.home.hero.primaryTo.startsWith('#')
    ? (hidden(home, 'feed') ? '/search' : content.home.hero.primaryTo)
    : content.home.hero.primaryTo

  return (
    <div>
      {!hidden(home, 'hero') && (
        <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-terra">Authentic imagery. Diverse places. Real Africa.</p>
            <h1 className="font-display mt-3 text-5xl leading-[1.02] text-ink md:text-[64px]">Images that tell Africa&apos;s story.</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
              Discover premium photographs celebrating African life, culture, business and creativity.
            </p>
            <div className="mt-6 max-w-xl">
              <SearchForm wide />
            </div>
            {!hidden(home, 'marquee') && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chipLabels.map((label) => (
                  <Link key={label} to={categoryPath(label)} className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-terra">
                    {label}
                  </Link>
                ))}
              </div>
            )}
            <Link to={heroLink} className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra">
              {content.home.hero.primaryLabel}
            </Link>
          </div>
          <div className="grid grid-cols-2 grid-rows-[168px_148px_132px] gap-3 sm:grid-rows-[210px_170px_150px]">
            {collage[0] ? <PhotoTile photo={collage[0]} className="row-span-2 min-h-0" /> : <EmptyFrame className="row-span-2" />}
            {collage[1] ? <PhotoTile photo={collage[1]} showCaption={false} className="min-h-0" /> : <EmptyFrame />}
            {collage[2] ? <PhotoTile photo={collage[2]} showCaption={false} className="min-h-0" /> : <EmptyFrame />}
            {collage[3] ? <PhotoTile photo={collage[3]} className="col-span-2 min-h-0" /> : <EmptyFrame className="col-span-2" />}
          </div>
        </section>
      )}

      {!hidden(home, 'marquee') && categories.length > 0 && (
        <section className="border-y border-sand bg-white">
          <div className="mx-auto flex max-w-[1440px] gap-6 overflow-x-auto px-5 py-5 no-scrollbar lg:px-8">
            {categories.map((banner) => (
              <Link key={banner.category} to={categoryPath(banner.category)} className="w-[4.75rem] shrink-0 text-center">
                <img src={banner.photo.src} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
                <p className="mt-2 text-xs font-medium text-ink">{banner.category}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!hidden(home, 'featured') && (
        <section className="mx-auto max-w-[1440px] px-5 py-12 lg:px-8">
          <SectionHead title="Featured Photos" text="Handpicked African stories from the continent." to="/search" label="View all featured" />
          {edge.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {edge.slice(0, 3).map((photo) => (
                <PhotoTile key={photo.id} photo={photo} className="aspect-[4/5] min-h-72" />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-sand bg-white px-5 py-8 text-sm text-ink-soft">Featured Photos will appear here when staff pin them.</p>
          )}
        </section>
      )}

      {!hidden(home, 'category_banners') && (
        <section className="bg-white px-5 py-12 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <SectionHead title="Browse by Categories" text="Explore Africa’s diversity through curated categories." to="/search" label="View all categories" />
            {categories.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto no-scrollbar">
                {categories.slice(0, 8).map((banner) => (
                  <Link key={banner.category} to={categoryPath(banner.category)} className="group relative aspect-[4/5] w-40 shrink-0 overflow-hidden rounded-2xl sm:w-48">
                    <img src={banner.photo.src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <p className="absolute bottom-3 left-3 right-3 text-lg font-semibold text-white">{banner.category}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {PHOTO_CATEGORIES.map((category) => (
                  <Link key={category} to={categoryPath(category)} className="rounded-full border border-sand bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-terra">
                    {category}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {!hidden(home, 'editorial') && collections.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 py-12 lg:px-8">
          <SectionHead title="Featured Collections" text="Curated sets drawn from the photographs staff pin for this page." to="/search" label="View the library" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {collections.map((photo) => (
              <Link key={photo.id} to={categoryPath(photo.category)} className="group relative aspect-[16/10] overflow-hidden rounded-2xl">
                <img src={photo.src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-lg font-semibold text-white">{photo.category}</p>
                  <p className="truncate text-sm text-white/80">{photo.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!hidden(home, 'cta') && (
        <section className="px-5 py-4 lg:px-8">
          <div
            className="relative mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl bg-[#14110e] px-8 py-12 text-[#faf6f3] md:flex-row md:items-center"
            style={featured?.statsBackground?.src ? { backgroundImage: `linear-gradient(90deg, rgba(20,17,14,0.92), rgba(20,17,14,0.55)), url(${featured.statsBackground.src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            <div>
              <h2 className="font-display text-4xl md:text-5xl">A continent of stories.</h2>
              <p className="mt-2 max-w-xl text-sm text-[#c4b8ae]">For creators like you. Share authentic African photographs with the world.</p>
              {home?.stats && (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#e0a36a]">
                  {fmt(home.stats.photosLive)} photographs · {fmt(home.stats.countries)} countries · {fmt(home.stats.contributors)} creators
                </p>
              )}
            </div>
            <Link to="/search" className="rounded-full bg-terra px-5 py-3 text-sm font-semibold text-white hover:bg-white hover:text-ink">Explore photos</Link>
          </div>
        </section>
      )}

      {spotlight && <Spotlight person={spotlight} photo={spotlightPhoto} />}

      {(people.length > 0 || (!hidden(home, 'models') && models.length > 0)) && (
        <section className="mx-auto max-w-[1440px] px-5 py-12 lg:px-8">
          <SectionHead title="Top African Creators" text="Photographers, photo influencers and models from across Africa." to="/creators" label="View all creators" />
          <div className="flex gap-5 overflow-x-auto pb-2 no-scrollbar">
            {people.slice(0, 10).map((person) => (
              <CreatorChip key={person.handle} person={person} />
            ))}
            {!hidden(home, 'models') && models.slice(0, 4).map((model) => (
              <Link key={model.handle} to={`/m/${model.handle}`} className="w-28 shrink-0 text-center">
                {model.avatarUrl ? (
                  <img src={model.avatarUrl} alt="" className="mx-auto h-20 w-20 rounded-full bg-cream object-cover" />
                ) : (
                  <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream text-lg font-semibold text-ink">{model.name.slice(0, 1)}</span>
                )}
                <p className="mt-2 truncate text-sm font-semibold text-ink">{model.name}</p>
                <p className="text-xs text-ink-soft">Model</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!hidden(home, 'pricing') && (
        <section className="px-5 pb-4 lg:px-8">
          <Link
            to="/pricing"
            className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-6 overflow-hidden rounded-3xl bg-[#1a120c] px-8 py-10 text-white"
            style={pricing[0]?.src ? { backgroundImage: `linear-gradient(90deg, rgba(26,18,12,0.88), rgba(26,18,12,0.45)), url(${pricing[0].src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            <div>
              <h2 className="font-display text-3xl md:text-4xl">License authentic African content for your next big idea.</h2>
              <p className="mt-2 text-sm text-white/75">Flexible plans. Commercial use where rights allow. Global reach.</p>
            </div>
            <span className="shrink-0 rounded-full bg-terra px-5 py-3 text-sm font-semibold">View Pricing</span>
          </Link>
        </section>
      )}

      {!hidden(home, 'feed') && (
        <section id="feed" className="mx-auto max-w-[1440px] px-5 py-12 lg:px-8">
          <SectionHead title="Latest from the Library" text="Fresh African imagery, added daily." to="/search" label="View more" />
          {latest.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {latest.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} className="aspect-[3/4] w-44 shrink-0 sm:w-52" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">New photographs show up here as they are published.</p>
          )}
        </section>
      )}

      {(home?.layout.staticBanners ?? []).filter((banner) => !hidden(home, `banner:${banner.id}`) && banner.images.length > 0).map((banner) => (
        <section key={banner.id} className="mx-auto max-w-[1440px] px-5 pb-12 lg:px-8">
          <h2 className="font-display text-3xl text-ink">{banner.title}</h2>
          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(banner.columns, 1)}, minmax(0, 1fr))` }}>
            {banner.images.map((src) => (
              <img key={src} src={src} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function CreatorChip({ person }: { person: PhotographerDto }) {
  return (
    <Link to={`/p/${person.handle}`} className="w-28 shrink-0 text-center">
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="mx-auto h-20 w-20 rounded-full bg-cream object-cover" />
      ) : (
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream text-lg font-semibold text-ink">{person.name.slice(0, 1)}</span>
      )}
      <p className="mt-2 truncate text-sm font-semibold text-ink">{person.name}</p>
      <p className="text-xs text-ink-soft">{kindLabel(person)}</p>
    </Link>
  )
}

function Spotlight({ person, photo }: { person: PhotographerDto; photo?: PhotoDto }) {
  const influencer = person.creatorKind === 'photo_influencer'
  return (
    <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-12 lg:grid-cols-[0.9fr_1fr_0.9fr] lg:px-8">
      <div>
        <p className="text-sm font-semibold text-terra">Contributor Spotlight</p>
        <h2 className="font-display mt-2 text-4xl text-ink">Real creators. Global impact.</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">{person.bio || 'Photographers and creators sharing African stories with the world.'}</p>
        <Link to={`/p/${person.handle}`} className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra">View profile</Link>
      </div>
      <Link to={`/p/${person.handle}`} className="relative block overflow-hidden rounded-3xl bg-cream">
        {photo ? (
          <img src={photo.src} alt="" className="aspect-[4/3] w-full object-cover" />
        ) : person.avatarUrl ? (
          <img src={person.avatarUrl} alt="" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="aspect-[4/3] w-full" />
        )}
      </Link>
      <div className="rounded-3xl border border-sand bg-white p-5">
        <div className="flex items-center gap-3">
          {person.avatarUrl ? (
            <img src={person.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream font-semibold">{person.name.slice(0, 1)}</span>
          )}
          <div>
            <p className="text-lg font-semibold text-ink">{person.name}</p>
            <p className="text-sm text-ink-soft">{kindLabel(person)}{influencer ? ' · Open Creator' : ''} · {person.location ?? 'Africa'}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-paper px-2 py-3">
            <dt className="text-[11px] text-ink-soft">Photos</dt>
            <dd className="text-sm font-semibold text-ink">{fmt(person.photosCount)}</dd>
          </div>
          <div className="rounded-2xl bg-paper px-2 py-3">
            <dt className="text-[11px] text-ink-soft">Downloads</dt>
            <dd className="text-sm font-semibold text-ink">{fmt(person.downloads)}</dd>
          </div>
          <div className="rounded-2xl bg-paper px-2 py-3">
            <dt className="text-[11px] text-ink-soft">Followers</dt>
            <dd className="text-sm font-semibold text-ink">{fmt(person.followers)}</dd>
          </div>
        </dl>
        <Link to={`/p/${person.handle}`} className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-sand px-3 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          <span>Creator profile</span>
          <span className="font-mono-tech normal-case tracking-normal">@{person.handle}</span>
        </Link>
      </div>
    </section>
  )
}
