import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { HomePageDto, PhotoDto, PhotographerDto } from '@vuekumi/shared'
import { SearchForm } from '../../components/shared'
import { api } from '../../api/client'
import { categoryPath } from '../../lib/categories'
import { fmt } from '../../lib/format'
import { publicQueryKeys } from '../../lib/query-keys'
import { useSiteContent } from '../../context/SiteContentContext'

const art = {
  portrait: '/home/portrait.jpg',
  city: '/home/lagos.jpg',
  elephants: '/home/elephants.jpg',
  acacia: '/home/acacia-sun.jpg',
  sunset: '/home/safari-sunset.jpg',
  giraffe: '/home/safari.jpg',
  coast: '/home/kente.jpg',
  beach: '/home/beach.jpg',
  desert: '/home/dunes.jpg',
  camels: '/home/baobab.jpg',
  safari: '/home/lion.jpg',
  people: '/home/market.jpg',
  family: '/home/family.jpg',
  creator: '/home/man.jpg',
  camera: '/home/creator-camera.jpg',
  smile: '/home/creator-smile.jpg',
  hoops: '/home/creator-hoops.jpg',
  cityWoman: '/home/creator-city.jpg',
  orange: '/home/creator-orange.jpg',
  fashion: '/home/fashion-portrait.jpg',
  food: '/home/bowl.jpg',
  falls: '/home/falls.jpg',
  business: '/home/business.jpg',
  balloons: '/home/balloons.jpg',
}

type Frame = { src: string; title: string; subtitle: string; href: string; chip?: string }

function hidden(home: HomePageDto | null, key: string) {
  return Boolean(home?.layout.hidden.includes(key))
}

function frameFromPhoto(photo: PhotoDto | undefined, fallback: Frame): Frame {
  if (!photo) return fallback
  return {
    src: photo.src,
    title: photo.title,
    subtitle: [photo.photographerName ?? photo.photographer, photo.country].filter(Boolean).join(' · '),
    href: `/photo/${photo.id}`,
    chip: fallback.chip,
  }
}

function SectionHead({ title, text, to, label }: { title: string; text: string; to: string; label: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[32px] leading-none text-ink">{title}</h2>
        <p className="text-sm text-ink-soft">{text}</p>
      </div>
      <Link to={to} className="shrink-0 text-sm font-semibold text-[#ef5b24] hover:text-ink">{label} →</Link>
    </div>
  )
}

function Arrow() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-sm text-ink">→</span>
  )
}

function StoryCard({ frame, className = '', radius = 'rounded-[6px]' }: { frame: Frame; className?: string; radius?: string }) {
  return (
    <Link to={frame.href} className={`group relative block overflow-hidden bg-[#1c1612] ${radius} ${className}`}>
      <img src={frame.src} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/10" />
      {frame.chip && (
        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-ink">{frame.chip}</span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight text-white">{frame.title}</p>
          {frame.subtitle && <p className="mt-0.5 truncate text-xs text-white/80">{frame.subtitle}</p>}
        </div>
        <Arrow />
      </div>
    </Link>
  )
}

function GeoPattern({ id }: { id: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full text-[#e6c27a]/30" aria-hidden="true">
      <defs>
        <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M16 2 L30 16 L16 30 L2 16 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M16 9 L23 16 L16 23 L9 16 Z" fill="currentColor" opacity="0.45" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

const DESIGN_CREATORS = [
  { name: 'Amina Bello', country: 'Nigeria', flag: '🇳🇬', src: '/home/design/creator-1.png', href: '/creators' },
  { name: 'Kojo Mensah', country: 'Ghana', flag: '🇬🇭', src: '/home/design/creator-2.png', href: '/creators' },
  { name: 'Zuri Ndlovu', country: 'South Africa', flag: '🇿🇦', src: '/home/design/creator-3.png', href: '/creators' },
  { name: 'Fatima Diallo', country: 'Senegal', flag: '🇸🇳', src: '/home/design/creator-4.png', href: '/models' },
  { name: 'Tunde Okafor', country: 'Nigeria', flag: '🇳🇬', src: '/home/design/creator-5.png', href: '/creators' },
  { name: 'Lila Tesfaye', country: 'Ethiopia', flag: '🇪🇹', src: '/home/design/creator-6.png', href: '/creators' },
  { name: 'Moses Kiplagat', country: 'Kenya', flag: '🇰🇪', src: '/home/design/creator-7.png', href: '/creators' },
  { name: 'Nadia Ali', country: 'Egypt', flag: '🇪🇬', src: '/home/design/creator-8.png', href: '/models' },
]

export function DiscoveryHome({ home }: { home: HomePageDto | null }) {
  const { content } = useSiteContent()
  const featured = home?.featured
  const heroPhotos = featured?.hero ?? []
  const edge = featured?.edge ?? []
  const editorial = featured?.editorial ?? []
  const pricing = featured?.pricing ?? []
  const categories = featured?.categories ?? []

  const influencerRail = home?.layout.people.photo_influencers.people ?? []
  const photographerRail = home?.layout.people.photographers.people ?? []
  const contributorRail = home?.layout.people.contributors.people ?? home?.contributors ?? []
  const people = [
    ...(!hidden(home, 'photographers') ? photographerRail : []),
    ...(!hidden(home, 'photo_influencers') ? influencerRail : []),
    ...(!hidden(home, 'contributors') ? contributorRail : []),
  ].filter((person, index, list) => list.findIndex((row) => row.handle === person.handle) === index)
  const spotlight = [
    ...(!hidden(home, 'photo_influencers') ? influencerRail : []),
    ...(!hidden(home, 'photographers') ? photographerRail : []),
    ...(!hidden(home, 'contributors') ? contributorRail : []),
  ][0]
  const showSpotlight = !(home && hidden(home, 'photo_influencers') && hidden(home, 'photographers') && hidden(home, 'contributors'))

  const { data: latest = [] } = useQuery({
    queryKey: publicQueryKeys.homeFeed,
    queryFn: () => api.photos({ page: 1, limit: 8, facets: '0' }).then((data) => data.items).catch(() => [] as PhotoDto[]),
  })

  const heroLink = content.home.hero.primaryTo.startsWith('#')
    ? (hidden(home, 'feed') ? '/search' : content.home.hero.primaryTo)
    : content.home.hero.primaryTo

  const collage = [
    frameFromPhoto(heroPhotos[0], { src: art.portrait, title: '', subtitle: '', href: categoryPath('People') }),
    frameFromPhoto(heroPhotos[1], { src: art.city, title: '', subtitle: '', href: categoryPath('Urban') }),
    frameFromPhoto(heroPhotos[2], { src: art.family, title: '', subtitle: '', href: categoryPath('People') }),
    frameFromPhoto(heroPhotos[3], { src: art.elephants, title: '', subtitle: '', href: categoryPath('Wildlife') }),
    frameFromPhoto(edge[0], { src: art.orange, title: '', subtitle: '', href: categoryPath('Culture') }),
  ]
  const featuredMain = [
    frameFromPhoto(edge[0], { src: '/home/design/feat-women.png', title: 'Women of Africa', subtitle: 'Strength. Beauty. Leadership.', href: categoryPath('People'), chip: 'People' }),
    frameFromPhoto(edge[1], { src: '/home/design/feat-city.png', title: 'Modern Africa', subtitle: 'Dynamic cities. Endless opportunities.', href: categoryPath('Urban'), chip: 'City' }),
  ]
  const featuredStack = [
    frameFromPhoto(edge[2], { src: '/home/design/feat-wildlife.png', title: "Africa's Majestic Nature", subtitle: 'Wildlife. Icons of the continent.', href: categoryPath('Wildlife'), chip: 'Wildlife' }),
    frameFromPhoto(editorial[0], { src: '/home/design/feat-coast.png', title: 'Breathtaking Landscapes', subtitle: 'Coast. Travel. Open light.', href: categoryPath('Coast'), chip: 'Travel' }),
  ]
  const icons = [
    { label: 'People', href: categoryPath('People'), src: art.portrait },
    { label: 'Africa Cities', href: categoryPath('Urban'), src: art.city },
    { label: 'Nature', href: categoryPath('Wildlife'), src: art.falls },
    { label: 'Travel & Landscapes', href: categoryPath('Landscape'), src: art.acacia },
    { label: 'Culture', href: categoryPath('Culture'), src: art.fashion },
    { label: 'Business', href: '/search?q=business', src: art.business, pos: 'object-[center_20%]' },
    { label: 'Food', href: categoryPath('Food & Craft'), src: art.food, pos: 'object-[center_70%]' },
    { label: 'Fashion', href: categoryPath('Fashion'), src: art.hoops },
    { label: 'Family', href: categoryPath('People'), src: art.family },
    { label: 'Wildlife', href: categoryPath('Wildlife'), src: art.elephants },
  ]
  const browse = [
    { label: 'People', href: categoryPath('People'), src: categories.find((row) => row.category === 'People')?.photo.src ?? art.portrait, icon: 'person' },
    { label: 'Business', href: '/search?q=business', src: art.business, icon: 'case' },
    { label: 'Culture', href: categoryPath('Culture'), src: categories.find((row) => row.category === 'Culture')?.photo.src ?? art.fashion, icon: 'culture' },
    { label: 'Travel', href: categoryPath('Coast'), src: art.beach, icon: 'plane' },
    { label: 'Nature', href: categoryPath('Wildlife'), src: art.falls, icon: 'leaf' },
    { label: 'City Life', href: categoryPath('Urban'), src: categories.find((row) => row.category === 'Urban')?.photo.src ?? art.city, icon: 'city' },
    { label: 'Food', href: categoryPath('Food & Craft'), src: categories.find((row) => row.category === 'Food & Craft')?.photo.src ?? art.food, icon: 'food' },
    { label: 'Fashion', href: categoryPath('Fashion'), src: categories.find((row) => row.category === 'Fashion')?.photo.src ?? art.hoops, icon: 'fashion' },
  ]
  const collections = [
    frameFromPhoto(editorial[0], { src: art.portrait, title: 'Pan African Pride', subtitle: 'People. Beauty. Leadership.', href: categoryPath('People') }),
    frameFromPhoto(editorial[1], { src: art.elephants, title: 'African Wildlife', subtitle: 'Icons of the Continent', href: categoryPath('Wildlife') }),
    frameFromPhoto(editorial[2], { src: art.family, title: 'Vibrant Cultures', subtitle: 'Traditions. Festivals. Heritage.', href: categoryPath('Culture') }),
    frameFromPhoto(editorial[3], { src: art.city, title: 'African Cities', subtitle: 'Progress. Innovation. Tomorrow.', href: categoryPath('Urban') }),
  ]
  const trending = [
    { label: 'African business', href: '/search?q=business' },
    { label: 'Pan African', href: categoryPath('Culture') },
    { label: 'Women', href: categoryPath('People') },
    { label: 'Nature', href: categoryPath('Wildlife') },
    { label: 'Culture', href: categoryPath('Culture') },
    { label: 'Travel', href: categoryPath('Coast') },
  ]
  const latestFallback: Frame[] = [
    { src: art.city, title: 'Cities', subtitle: '', href: categoryPath('Urban') },
    { src: art.desert, title: 'Desert', subtitle: '', href: categoryPath('Landscape') },
    { src: art.family, title: 'People', subtitle: '', href: categoryPath('People') },
    { src: art.food, title: 'Food', subtitle: '', href: categoryPath('Food & Craft') },
    { src: art.portrait, title: 'Portrait', subtitle: '', href: categoryPath('People') },
    { src: art.camels, title: 'Travel', subtitle: '', href: categoryPath('Landscape') },
    { src: art.safari, title: 'Safari', subtitle: '', href: categoryPath('Wildlife') },
    { src: art.coast, title: 'Coast', subtitle: '', href: categoryPath('Coast') },
  ]
  const film: Frame[] = latest.length
    ? latest.map((photo) => frameFromPhoto(photo, { src: art.acacia, title: photo.title, subtitle: photo.category, href: `/photo/${photo.id}` }))
    : latestFallback
  const licenseSrc = pricing[0]?.src ?? art.balloons
  const continentSrc = featured?.statsBackground?.src ?? art.sunset
  const spotlightPhoto = spotlight
    ? (heroPhotos.find((photo) => photo.photographer === spotlight.handle)?.src ?? spotlight.avatarUrl ?? art.camera)
    : art.camera

  return (
    <div className="bg-white">
      {!hidden(home, 'hero') && (
        <section className="relative overflow-hidden bg-[#120f0c] text-white">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.15fr)]">
            <div className="relative px-6 py-8 lg:px-10 lg:py-10">
              <GeoPattern id="vk-hero-geo" />
              <div className="relative max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e6c27a]">Authentic people. Diverse places. Real Africa.</p>
                <h1 className="font-display mt-3 text-[44px] leading-[0.95] text-white md:text-[58px]">
                  Images that tell<br />
                  <span className="text-[#ff7227]">Africa&apos;s</span> story.
                </h1>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
                  Discover premium photos, videos and illustrations celebrating African life, culture, business and creativity.
                </p>
                <div className="mt-5 max-w-lg">
                  <SearchForm wide iconButton scope placeholder="Search photos, videos, vectors and more..." />
                </div>
                <Link to={heroLink} className="mt-4 inline-flex text-sm font-semibold text-[#e6c27a] hover:text-white">
                  {content.home.hero.primaryLabel}
                </Link>
              </div>
            </div>
            <Link to={collage[0].href} className="relative block self-center">
              <img src="/home/design/hero-collage.png" alt="" className="h-auto w-full object-contain" />
            </Link>
          </div>
          <div className="border-t border-white/10 bg-black/45">
            <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto px-6 py-2.5 no-scrollbar">
              <span className="shrink-0 text-xs font-semibold text-[#e6c27a]">Trending:</span>
              {trending.map((chip) => (
                <Link key={chip.label} to={chip.href} className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white hover:border-[#e6c27a]">
                  {chip.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!hidden(home, 'marquee') && (
        <section className="border-b border-[#efe8e1] bg-white">
          <div className="mx-auto flex max-w-[1440px] items-start justify-between gap-1 overflow-x-auto px-5 py-4 no-scrollbar lg:px-8">
            {icons.map((icon) => (
              <Link key={icon.label} to={icon.href} className="w-[104px] shrink-0 text-center">
                <img src={icon.src} alt="" className={`mx-auto h-[77px] w-[96px] rounded-[6px] object-cover shadow-sm ${'pos' in icon ? icon.pos : ''}`} />
                <p className="mt-1.5 text-[11px] font-medium leading-tight text-ink">{icon.label}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!hidden(home, 'featured') && (
        <section className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
          <SectionHead title="Featured Photos" text="Handpicked African stories from across the continent." to="/search" label="View all featured" />
          <div className="grid h-auto gap-3 md:grid-cols-3 md:h-[420px]">
            {featuredMain.map((card) => (
              <StoryCard key={card.title} frame={card} className="h-[280px] md:h-full" />
            ))}
            <div className="grid gap-2 md:grid-rows-2">
              {featuredStack.map((card) => (
                <StoryCard key={card.title} frame={card} className="h-[200px] md:h-full" />
              ))}
            </div>
          </div>
        </section>
      )}

      {!hidden(home, 'category_banners') && (
        <section className="bg-[#faf8f6] px-5 py-10 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <SectionHead title="Browse by Categories" text="Explore Africa’s diversity through curated categories." to="/search" label="View all categories" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {browse.map((card) => (
                <Link key={card.label} to={card.href} className="group relative h-40 overflow-hidden rounded-[6px]">
                  <img src={card.src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <p className="absolute bottom-3 left-3 flex items-center gap-1.5 text-sm font-semibold text-white">
                    <CatIcon name={card.icon} />
                    {card.label}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!hidden(home, 'editorial') && (
        <section className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
          <SectionHead title="Featured Collections" text="Curated stories for every project." to="/search" label="View all collections" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {collections.map((card) => (
              <StoryCard key={card.title} frame={card} radius="rounded-[3px]" className="h-52" />
            ))}
          </div>
        </section>
      )}

      {!hidden(home, 'cta') && (
        <section className="relative overflow-hidden bg-[#1a120c] text-white">
          <img src={continentSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/35" />
          <GeoPattern id="vk-continent-geo" />
          <div className="relative mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-6 py-7 md:flex-row md:items-center md:px-10">
            <div>
              <h2 className="font-display text-3xl leading-[1.05] md:text-4xl">A continent of stories.<br />For creators like you.</h2>
              <p className="mt-2 max-w-xl text-sm text-white/80">Get the visuals you need to tell authentic African stories.</p>
              <Link to="/search" className="mt-3 inline-flex rounded-full bg-[#ef5b24] px-5 py-2.5 text-sm font-semibold text-white">Explore Photos</Link>
            </div>
            <div className="flex flex-col items-start gap-2 text-xs font-semibold md:items-end">
              <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">Authentic</span>
              <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">Commercial use ready</span>
              <span className="rounded-full bg-black/50 px-3 py-1">Trusted by Global Brands</span>
            </div>
          </div>
        </section>
      )}

      {showSpotlight && <Spotlight person={spotlight} photo={spotlightPhoto} />}

      {!hidden(home, 'contributors') && (
        <section className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
          <SectionHead title="Top African Creators" text="Talented photographers, filmmakers and visual artists from across Africa." to="/creators" label="View all creators" />
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous creators" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e6ddd4] text-ink" onClick={(event) => event.currentTarget.parentElement?.querySelector('[data-creators]')?.scrollBy({ left: -240, behavior: 'smooth' })}>‹</button>
            <div data-creators className="flex flex-1 gap-3 overflow-x-auto pb-2 no-scrollbar">
              {(people.length > 0 ? people.slice(0, 8).map((person) => ({
                name: person.name,
                country: person.location || 'Africa',
                flag: '',
                src: person.avatarUrl,
                href: `/p/${person.handle}`,
              })) : DESIGN_CREATORS).map((person) => (
                <CreatorChip key={person.name} name={person.name} country={person.country} flag={person.flag} src={person.src} href={person.href} />
              ))}
            </div>
            <button type="button" aria-label="Next creators" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e6ddd4] text-ink" onClick={(event) => event.currentTarget.parentElement?.querySelector('[data-creators]')?.scrollBy({ left: 240, behavior: 'smooth' })}>›</button>
          </div>
        </section>
      )}

      {!hidden(home, 'pricing') && (
        <section className="px-5 pb-2 lg:px-8">
          <Link to="/pricing" className="relative mx-auto flex min-h-[150px] max-w-[1440px] items-center justify-between gap-6 overflow-hidden px-8 py-8 text-white">
            <img src={licenseSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/15" />
            <div className="relative">
              <h2 className="font-display max-w-xl text-3xl leading-tight md:text-4xl">License authentic African content for your next big idea.</h2>
              <p className="mt-2 text-sm text-white/85">Flexible plans. Commercial use. Global reach.</p>
            </div>
            <span className="relative shrink-0 rounded-full bg-[#ef5b24] px-5 py-3 text-sm font-semibold">View Pricing</span>
          </Link>
        </section>
      )}

      {!hidden(home, 'feed') && (
        <section id="feed" className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-display text-[32px] leading-none text-ink">Latest from the Library</h2>
              <p className="text-sm text-ink-soft">Fresh African imagery, added daily.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">All</span>
              <Link to="/search" className="rounded-full bg-[#f3eee9] px-3 py-1 text-xs font-semibold text-ink">Photos</Link>
              <Link to="/search" className="rounded-full bg-[#f3eee9] px-3 py-1 text-xs font-semibold text-ink">Videos</Link>
              <Link to="/search" className="rounded-full bg-[#f3eee9] px-3 py-1 text-xs font-semibold text-ink">Illustrations</Link>
              <Link to="/search" className="ml-2 text-sm font-semibold text-[#ef5b24]">View more →</Link>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {(latest.length ? film : Array.from({ length: 10 }, (_, index) => ({
              src: `/home/design/latest-${index + 1}.png`,
              title: '',
              subtitle: '',
              href: '/search',
            }))).slice(0, 10).map((item, index) => (
              <Link key={item.src + index} to={item.href} className="block overflow-hidden rounded-[6px]">
                <img src={item.src} alt="" className="aspect-[3/4] w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CreatorChip({ name, country, flag, src, href }: { name: string; country: string; flag: string; src?: string | null; href: string }) {
  return (
    <div className="w-[108px] shrink-0 text-center">
      <Link to={href}>
        {src ? (
          <img src={src} alt="" className="mx-auto h-[72px] w-[72px] rounded-full object-cover" />
        ) : (
          <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#efe6dc] text-lg font-semibold">{name.slice(0, 1)}</span>
        )}
        <p className="mt-2 truncate text-sm font-semibold text-ink">{name}</p>
        <p className="truncate text-[11px] text-ink-soft">{flag} {country}</p>
      </Link>
      <Link to={href} className="mt-2 inline-flex rounded-full border border-[#ef5b24] px-3 py-1 text-[11px] font-semibold text-[#ef5b24]">Follow</Link>
    </div>
  )
}

function Spotlight({ person, photo }: { person?: PhotographerDto; photo: string }) {
  const href = person ? `/p/${person.handle}` : '/creators'
  const design = !person
  const name = person?.name ?? 'Kojo Mensah'
  const place = person?.location ?? 'Accra, Ghana'
  const portrait = design ? '/home/design/creator-2.png' : (person?.avatarUrl || photo)
  const scene = design ? '/home/design/spotlight-photo.png' : photo
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-[32px] leading-none text-ink">Contributor Spotlight</h2>
          <p className="text-sm text-ink-soft">Meet amazing African creators shaping global visuals.</p>
        </div>
        <Link to="/creators" className="shrink-0 text-sm font-semibold text-[#ef5b24]">View all contributors →</Link>
      </div>
      <div className="grid items-center gap-5 lg:grid-cols-[1.45fr_0.95fr_150px]">
        <div className="relative min-h-[230px] overflow-hidden bg-[#1a120c] text-white">
          <img src={scene} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
          <div className="relative flex h-full min-h-[230px] items-center justify-between gap-4 p-6">
            <div className="max-w-sm">
              <h3 className="font-display text-4xl leading-[1.05]">Real creators.<br />Global impact.</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                {person?.bio || 'VueKumi empowers African photographers, filmmakers and visual storytellers to share the world with their voice.'}
              </p>
              <Link to={person ? href : '/login?redirect=/contributor/upload&signup=photographer'} className="mt-4 inline-flex rounded-full bg-[#ef5b24] px-4 py-2 text-sm font-semibold text-white">
                Join as a Contributor →
              </Link>
            </div>
            <ul className="hidden space-y-2 text-sm sm:block">
              <li className="flex items-center gap-2"><Check /> Earn from your work</li>
              <li className="flex items-center gap-2"><Check /> Global exposure</li>
              <li className="flex items-center gap-2"><Check /> Keep your creative rights</li>
            </ul>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <img src={portrait} alt="" className="h-16 w-16 rounded-full object-cover" />
            <div>
              <span className="inline-flex rounded-full bg-[#ef5b24] px-2 py-0.5 text-[10px] font-semibold text-white">Verified Creator</span>
              <p className="mt-1 text-lg font-semibold text-ink">{name} <span aria-hidden="true">🇬🇭</span></p>
              <p className="text-sm text-ink-soft">{place}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 text-center">
            <Stat label="Assets" value={design ? '320' : fmt(person?.photosCount ?? 0)} />
            <Stat label="Downloads" value={design ? '126K' : fmt(person?.downloads ?? 0)} />
            <Stat label="Rating" value={design ? '4.9' : fmt(person?.followers ?? 0)} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {['People', 'Nature', 'Culture', 'Travel'].map((label) => (
              <span key={label} className="rounded-full bg-[#f3eee9] px-3 py-1 text-[11px] font-medium text-ink">{label}</span>
            ))}
          </div>
        </div>
        <Link to={href} className="flex flex-col items-center text-center">
          <QrMark />
          <span className="mt-2 max-w-[9rem] text-[11px] leading-snug text-ink-soft">Scan to view my VueKumi Creator ID</span>
        </Link>
      </div>
    </section>
  )
}

function Check() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ef5b24] text-[10px] text-white">✓</span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1">
      <dd className="text-lg font-semibold text-ink">{value}</dd>
      <dt className="text-[11px] text-ink-soft">{label}</dt>
    </div>
  )
}

function QrMark() {
  const cells = [1,1,1,0,1,0,1,1,1, 1,0,1,0,0,1,0,1,0,1, 1,1,1,0,1,0,1,1,1, 0,0,0,0,1,0,0,0,0, 1,0,1,1,0,1,1,0,1, 0,1,0,0,1,0,0,1,0, 1,1,1,0,1,0,1,1,1, 1,0,1,0,0,1,0,1,0,1, 1,1,1,0,1,0,1,1,1]
  return (
    <span className="relative grid h-[92px] w-[92px] shrink-0 grid-cols-9 gap-px border border-[#eadfd4] bg-white p-1.5" aria-hidden="true">
      {cells.map((on, index) => (
        <span key={index} className={on ? 'bg-ink' : 'bg-transparent'} />
      ))}
      <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white text-sm font-bold text-[#ef5b24]">V</span>
    </span>
  )
}

function CatIcon({ name }: { name: string }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  if (name === 'case') return <svg {...common} aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2" /></svg>
  if (name === 'plane') return <svg {...common} aria-hidden="true"><path d="M3 12l18-7-7 18-2-7-9-4z" /></svg>
  if (name === 'leaf') return <svg {...common} aria-hidden="true"><path d="M5 19C14 19 19 10 19 5 10 5 5 10 5 19z" /><path d="M8 16c2-2 4-4 7-6" /></svg>
  if (name === 'city') return <svg {...common} aria-hidden="true"><path d="M4 20V9l5-3v14M9 20V6l6 3v11M15 20V10l5 2v8" /></svg>
  if (name === 'food') return <svg {...common} aria-hidden="true"><path d="M6 3v8a3 3 0 006 0V3M9 11v10M16 3c2 3 2 6 0 8v9" /></svg>
  if (name === 'fashion') return <svg {...common} aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M6 20c1-4 3-6 6-6s5 2 6 6" /></svg>
  if (name === 'culture') return <svg {...common} aria-hidden="true"><circle cx="8" cy="14" r="3" /><circle cx="16" cy="14" r="3" /><path d="M8 11V7h8v4" /></svg>
  return <svg {...common} aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 19c1.2-3 3.4-4.5 7-4.5S17.8 16 19 19" /></svg>
}
