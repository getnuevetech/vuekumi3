import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { HomePageDto, PhotoDto, PhotographerDto } from '@vuekumi/shared'
import { SearchForm } from '../../components/shared'
import { CountryMark, PhotoHoverActions, type HoverPhoto } from '../../components/PhotoActions'
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
type Shot = Frame & { country: string; photo?: HoverPhoto }

function toHover(photo: PhotoDto): HoverPhoto {
  return {
    id: photo.id,
    src: photo.src,
    title: photo.title,
    country: photo.country,
    license: photo.license,
    price: photo.price,
    favorited: photo.favorited,
  }
}

function managedHeroSrc(photos: PhotoDto[], index: number) {
  const row = photos[index]
  if (!row?.src || row.id.startsWith('empty-hero-')) return null
  return row.src
}

function hidden(home: HomePageDto | null, key: string) {
  return Boolean(home?.layout.hidden.includes(key))
}

function SectionHead({ title, text, to, label, className = 'mb-4' }: { title: string; text: string; to: string; label: string; className?: string }) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
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

function useBidirectionalWheel(node: HTMLDivElement | null) {
  useEffect(() => {
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      const max = node.scrollWidth - node.clientWidth
      if (max <= 1) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (delta === 0) return
      const atStart = node.scrollLeft <= 0 && delta < 0
      const atEnd = node.scrollLeft >= max - 1 && delta > 0
      if (atStart || atEnd) return
      event.preventDefault()
      node.scrollLeft = Math.max(0, Math.min(max, node.scrollLeft + delta))
    }
    let dragging = false
    let moved = false
    let startX = 0
    let startLeft = 0
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      dragging = true
      moved = false
      startX = event.clientX
      startLeft = node.scrollLeft
    }
    const onMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = event.clientX - startX
      if (Math.abs(dx) < 5) return
      moved = true
      node.scrollLeft = startLeft - dx
    }
    const onUp = () => { dragging = false }
    const onClick = (event: MouseEvent) => {
      if (!moved) return
      event.preventDefault()
      event.stopPropagation()
      moved = false
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    node.addEventListener('pointerdown', onDown)
    node.addEventListener('pointermove', onMove)
    node.addEventListener('pointerup', onUp)
    node.addEventListener('pointercancel', onUp)
    node.addEventListener('click', onClick, true)
    return () => {
      node.removeEventListener('wheel', onWheel)
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerup', onUp)
      node.removeEventListener('pointercancel', onUp)
      node.removeEventListener('click', onClick, true)
    }
  }, [node])
}

function ScrollStrip({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  return (
    <div ref={setNode} className={`no-scrollbar flex cursor-grab gap-3 overflow-x-auto overscroll-x-contain pb-1 active:cursor-grabbing ${className}`}>
      {children}
    </div>
  )
}

function DemoActions() {
  const navigate = useNavigate()
  const go = (event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    navigate('/login')
  }
  const button = 'flex h-8 w-8 items-center justify-center text-white [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.9))]'
  return (
    <div className="absolute right-1.5 top-1.5 z-20 flex items-center">
      <button type="button" className={button} aria-label="Download" onClick={go}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M5 21h14" /></svg>
      </button>
      <button type="button" className={button} aria-label="Add to collection" onClick={go}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7h5l2 2h11v10H3z" /></svg>
      </button>
      <button type="button" className={button} aria-label="Save to favorites" onClick={go}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
      </button>
    </div>
  )
}

function Marks({ country, photo }: { country: string; photo?: HoverPhoto }) {
  const real = Boolean(photo?.id && !photo.id.startsWith('demo-') && !photo.id.startsWith('empty-') && !photo.id.startsWith('upload-'))
  return (
    <>
      <CountryMark country={country} />
      {real && photo ? <PhotoHoverActions photo={photo} /> : <DemoActions />}
    </>
  )
}

function shotFrom(photo: PhotoDto | undefined, fallback: Shot): Shot {
  if (!photo?.src) return fallback
  return {
    src: photo.src,
    title: photo.title || fallback.title,
    subtitle: [photo.category, photo.country].filter(Boolean).join(' · ') || fallback.subtitle,
    href: photo.id.startsWith('upload-') ? fallback.href : `/photo/${photo.id}`,
    country: photo.country || fallback.country,
    photo: toHover(photo),
  }
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

const CREATOR_ISO: Record<string, string> = {
  Nigeria: 'ng',
  Ghana: 'gh',
  'South Africa': 'za',
  Senegal: 'sn',
  Ethiopia: 'et',
  Kenya: 'ke',
  Egypt: 'eg',
  Tanzania: 'tz',
  Morocco: 'ma',
  Namibia: 'na',
  Zimbabwe: 'zw',
  Botswana: 'bw',
  Uganda: 'ug',
  Rwanda: 'rw',
}

function countryFromLocation(location?: string | null) {
  const value = location?.trim() || 'Africa'
  const known = Object.keys(CREATOR_ISO).sort((a, b) => b.length - a.length)
  return known.find((country) => value.toLowerCase().includes(country.toLowerCase())) ?? value
}

const DESIGN_CREATORS = [
  { name: 'Amina Bello', country: 'Nigeria', src: '/home/design/creator-1.png', href: '/creators' },
  { name: 'Kojo Mensah', country: 'Ghana', src: '/home/design/creator-2.png', href: '/creators' },
  { name: 'Zuri Ndlovu', country: 'South Africa', src: '/home/design/creator-3.png', href: '/creators' },
  { name: 'Fatima Diallo', country: 'Senegal', src: '/home/design/creator-4.png', href: '/models' },
  { name: 'Tunde Okafor', country: 'Nigeria', src: '/home/design/creator-5.png', href: '/creators' },
  { name: 'Lila Tesfaye', country: 'Ethiopia', src: '/home/design/creator-6.png', href: '/creators' },
  { name: 'Moses Kiplagat', country: 'Kenya', src: '/home/design/creator-7.png', href: '/creators' },
  { name: 'Nadia Ali', country: 'Egypt', src: '/home/design/creator-8.png', href: '/models' },
  { name: 'Youssef El Fassi', country: 'Morocco', src: '/home/design/creator-9.png', href: '/creators' },
  { name: 'Aline Uwase', country: 'Rwanda', src: '/home/design/creator-10.png', href: '/creators' },
  { name: 'Samuel Okello', country: 'Uganda', src: '/home/design/creator-11.png', href: '/creators' },
  { name: 'Selma Nakale', country: 'Namibia', src: '/home/design/creator-12.png', href: '/creators' },
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
  ].slice(0, 2)
  const showSpotlight = !(home && hidden(home, 'photo_influencers') && hidden(home, 'photographers') && hidden(home, 'contributors'))

  const { data: latest = [] } = useQuery({
    queryKey: publicQueryKeys.homeFeed,
    queryFn: () => api.photos({ page: 1, limit: 16, facets: '0' }).then((data) => data.items).catch(() => [] as PhotoDto[]),
  })

  const heroLink = content.home.hero.primaryTo.startsWith('#')
    ? (hidden(home, 'feed') ? '/search' : content.home.hero.primaryTo)
    : content.home.hero.primaryTo

  const bannerSrc = managedHeroSrc(heroPhotos, 0) ?? '/home/design/hero-collage.png'
  const backgroundSrc = managedHeroSrc(heroPhotos, 1)
  const bannerPhoto = heroPhotos[0]
  const bannerHref = bannerPhoto?.src && !bannerPhoto.id.startsWith('empty-hero-') && !bannerPhoto.id.startsWith('upload-hero-')
    ? `/photo/${bannerPhoto.id}`
    : categoryPath('People')
  const featuredFallback: Shot[] = [
    { src: art.portrait, title: 'Women of Africa', subtitle: 'Strength. Beauty. Leadership.', href: categoryPath('People'), country: 'Nigeria' },
    { src: art.city, title: 'Modern Africa', subtitle: 'Dynamic cities. Endless opportunities.', href: categoryPath('Urban'), country: 'South Africa' },
    { src: art.elephants, title: "Africa's Majestic Nature", subtitle: 'Wildlife. Icons of the continent.', href: categoryPath('Wildlife'), country: 'Kenya' },
    { src: art.coast, title: 'Breathtaking Landscapes', subtitle: 'Coast. Travel. Open light.', href: categoryPath('Coast'), country: 'South Africa' },
    { src: art.falls, title: 'Highland Water', subtitle: 'Nature. Travel.', href: categoryPath('Landscape'), country: 'Zimbabwe' },
    { src: art.fashion, title: 'Ankara Light', subtitle: 'Fashion. Culture.', href: categoryPath('Fashion'), country: 'Ghana' },
    { src: art.business, title: 'African Business', subtitle: 'Work. Cities. Ambition.', href: '/search?q=business', country: 'Nigeria' },
    { src: art.food, title: 'From the Market', subtitle: 'Food. Craft.', href: categoryPath('Food & Craft'), country: 'Kenya' },
    { src: art.safari, title: 'On Safari', subtitle: 'Wildlife. Travel.', href: categoryPath('Wildlife'), country: 'Tanzania' },
    { src: art.beach, title: 'Coastal Light', subtitle: 'Travel. Landscapes.', href: categoryPath('Coast'), country: 'Ghana' },
    { src: art.family, title: 'Together', subtitle: 'People. Family.', href: categoryPath('People'), country: 'Nigeria' },
    { src: art.desert, title: 'Desert Road', subtitle: 'Landscape. Travel.', href: categoryPath('Landscape'), country: 'Namibia' },
  ]
  const featuredShots: Shot[] = edge.length
    ? edge.map((photo) => shotFrom(photo, { src: photo.src, title: photo.title, subtitle: photo.category, href: `/photo/${photo.id}`, country: photo.country || 'Nigeria' }))
    : featuredFallback
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
  const collections: Shot[] = [
    shotFrom(editorial[0], { src: art.portrait, title: 'Pan African Pride', subtitle: 'People. Beauty. Leadership.', href: categoryPath('People'), country: 'Nigeria' }),
    shotFrom(editorial[1], { src: art.elephants, title: 'African Wildlife', subtitle: 'Icons of the Continent', href: categoryPath('Wildlife'), country: 'Kenya' }),
    shotFrom(editorial[2], { src: art.family, title: 'Vibrant Cultures', subtitle: 'Traditions. Festivals. Heritage.', href: categoryPath('Culture'), country: 'Ghana' }),
    shotFrom(editorial[3], { src: art.city, title: 'African Cities', subtitle: 'Progress. Innovation. Tomorrow.', href: categoryPath('Urban'), country: 'South Africa' }),
    shotFrom(editorial[4], { src: art.beach, title: 'Coastal Africa', subtitle: 'Travel. Open water.', href: categoryPath('Coast'), country: 'Tanzania' }),
    shotFrom(editorial[5], { src: art.food, title: 'Market Tables', subtitle: 'Food. Craft. Colour.', href: categoryPath('Food & Craft'), country: 'Morocco' }),
  ]
  const trending = [
    { label: 'African business', href: '/search?q=business' },
    { label: 'Pan African', href: categoryPath('Culture') },
    { label: 'Women', href: categoryPath('People') },
    { label: 'Nature', href: categoryPath('Wildlife') },
    { label: 'Culture', href: categoryPath('Culture') },
    { label: 'Travel', href: categoryPath('Coast') },
  ]
  const latestDemo: Shot[] = [
    { src: '/home/design/latest-1.png', title: 'City at dusk', subtitle: '', href: '/search', country: 'South Africa' },
    { src: '/home/design/latest-2.png', title: 'Desert light', subtitle: '', href: '/search', country: 'Namibia' },
    { src: '/home/design/latest-3.png', title: 'Market day', subtitle: '', href: '/search', country: 'Nigeria' },
    { src: '/home/design/latest-4.png', title: 'Portrait study', subtitle: '', href: '/search', country: 'Ghana' },
    { src: '/home/design/latest-5.png', title: 'Wildlife', subtitle: '', href: '/search', country: 'Kenya' },
    { src: '/home/design/latest-6.png', title: 'Coast road', subtitle: '', href: '/search', country: 'South Africa' },
    { src: '/home/design/latest-7.png', title: 'Family', subtitle: '', href: '/search', country: 'Senegal' },
    { src: '/home/design/latest-8.png', title: 'Pattern', subtitle: '', href: '/search', country: 'Ghana' },
    { src: '/home/design/latest-9.png', title: 'Architecture', subtitle: '', href: '/search', country: 'Morocco' },
    { src: '/home/design/latest-10.png', title: 'Waterfall', subtitle: '', href: '/search', country: 'Zimbabwe' },
    { src: art.elephants, title: 'Herd at dusk', subtitle: '', href: categoryPath('Wildlife'), country: 'Kenya' },
    { src: art.falls, title: 'Highland falls', subtitle: '', href: categoryPath('Landscape'), country: 'Zimbabwe' },
    { src: art.beach, title: 'Shoreline', subtitle: '', href: categoryPath('Coast'), country: 'Ghana' },
    { src: art.food, title: 'Shared plate', subtitle: '', href: categoryPath('Food & Craft'), country: 'Kenya' },
    { src: art.business, title: 'At work', subtitle: '', href: '/search?q=business', country: 'Nigeria' },
    { src: art.safari, title: 'Safari evening', subtitle: '', href: categoryPath('Wildlife'), country: 'Tanzania' },
    { src: art.portrait, title: 'Studio light', subtitle: '', href: categoryPath('People'), country: 'Nigeria' },
    { src: art.city, title: 'Skyline', subtitle: '', href: categoryPath('Urban'), country: 'South Africa' },
    { src: art.family, title: 'Afternoon', subtitle: '', href: categoryPath('People'), country: 'Senegal' },
    { src: art.desert, title: 'Dunes', subtitle: '', href: categoryPath('Landscape'), country: 'Namibia' },
    { src: art.camels, title: 'Caravan', subtitle: '', href: categoryPath('Landscape'), country: 'Morocco' },
    { src: art.coast, title: 'Open coast', subtitle: '', href: categoryPath('Coast'), country: 'South Africa' },
    { src: art.fashion, title: 'Textile', subtitle: '', href: categoryPath('Fashion'), country: 'Ghana' },
  ]
  const film: Shot[] = [
    ...latest.map((photo) => shotFrom(photo, { src: photo.src, title: photo.title, subtitle: photo.category, href: `/photo/${photo.id}`, country: photo.country || 'Nigeria' })),
    ...latestDemo,
  ].slice(0, 24)
  const licenseSrc = pricing[0]?.src ?? art.balloons
  const continentSrc = featured?.statsBackground?.src ?? art.sunset
  const spotlightLead = spotlight[0]
  const spotlightPhoto = spotlightLead
    ? (heroPhotos.find((photo) => photo.photographer === spotlightLead.handle)?.src ?? spotlightLead.avatarUrl ?? art.camera)
    : art.camera

  return (
    <div className="bg-white">
      {!hidden(home, 'hero') && (
        <section className="relative overflow-hidden bg-[#120f0c] text-white">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.15fr)]">
            <div className="relative px-6 py-8 lg:px-10 lg:py-10">
              {backgroundSrc && (
                <>
                  <img src={backgroundSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[#120f0c]/72" />
                </>
              )}
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
            <Link to={bannerHref} className="relative block self-center">
              <img src={bannerSrc} alt="" className="h-auto w-full object-contain" />
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
              <Link key={icon.label} to={icon.href} className="w-[124px] shrink-0 text-center">
                <img src={icon.src} alt="" className={`mx-auto h-[77px] w-[115px] rounded-[6px] object-cover shadow-sm ${'pos' in icon ? icon.pos : ''}`} />
                <p className="mt-1.5 text-[11px] font-medium leading-tight text-ink">{icon.label}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!hidden(home, 'featured') && (
        <section className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
          <SectionHead title="Featured Photos" text="Handpicked African stories from across the continent." to="/search" label="View all featured" />
          <ScrollStrip>
            {featuredShots.map((card) => (
              <PortraitCard key={card.title + card.src} shot={card} />
            ))}
          </ScrollStrip>
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
          <ScrollStrip>
            {collections.map((card) => (
              <CollectionCard key={card.title + card.src} shot={card} />
            ))}
          </ScrollStrip>
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

      {showSpotlight && <Spotlight people={spotlight} photo={spotlightPhoto} />}

      {!hidden(home, 'contributors') && (
        <section className="mx-auto max-w-[1440px] px-3 py-6 lg:px-4">
          <SectionHead className="mb-3" title="Top African Creators" text="Talented photographers, filmmakers and visual artists from across Africa." to="/creators" label="View all creators" />
          <CreatorRow people={people.length > 0 ? people.slice(0, 12).map((person) => ({
            name: person.name,
            country: countryFromLocation(person.location),
            src: person.avatarUrl,
            href: `/p/${person.handle}`,
          })) : DESIGN_CREATORS} />
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
          <LatestStrip items={film} />
        </section>
      )}
    </div>
  )
}

function PortraitCard({ shot }: { shot: Shot }) {
  return (
    <Link to={shot.href} className="group relative block h-[476px] w-[264px] shrink-0 overflow-hidden rounded-[6px] bg-[#1c1612]">
      <img src={shot.src} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      <Marks country={shot.country} photo={shot.photo} />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-base font-semibold leading-tight text-white">{shot.title}</p>
        {shot.subtitle && <p className="mt-0.5 truncate text-xs text-white/80">{shot.subtitle}</p>}
      </div>
    </Link>
  )
}

function CollectionCard({ shot }: { shot: Shot }) {
  return (
    <Link to={shot.href} className="group relative block h-52 w-[320px] shrink-0 overflow-hidden rounded-[3px] bg-[#1c1612]">
      <img src={shot.src} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/15" />
      <Marks country={shot.country} photo={shot.photo} />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight text-white">{shot.title}</p>
          {shot.subtitle && <p className="mt-0.5 truncate text-xs text-white/80">{shot.subtitle}</p>}
        </div>
        <Arrow />
      </div>
    </Link>
  )
}

function LatestStrip({ items }: { items: Shot[] }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  return (
    <div
      ref={setNode}
      className="no-scrollbar grid cursor-grab auto-cols-[336px] grid-flow-col grid-rows-4 gap-2 overflow-x-auto overscroll-x-contain active:cursor-grabbing"
    >
      {items.map((item, index) => (
        <Link key={item.src + index} to={item.href} className="group relative block h-[450px] overflow-hidden rounded-[6px]">
          <img src={item.src} alt="" className="h-full w-full object-cover" />
          <Marks country={item.country} photo={item.photo} />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-8 text-[11px] font-semibold leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100">{item.title}</span>
        </Link>
      ))}
    </div>
  )
}

function CreatorFlag({ country }: { country: string }) {
  const code = CREATOR_ISO[country]
  if (!code) return null
  return <img src={`https://flagcdn.com/w40/${code}.png`} alt="" className="h-2.5 w-[14px] shrink-0 rounded-[1px] object-cover" />
}

function CreatorRow({ people }: { people: { name: string; country: string; src?: string | null; href: string }[] }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  return (
    <div ref={setNode} className="no-scrollbar flex cursor-grab items-center gap-3 overflow-x-auto overscroll-x-contain active:cursor-grabbing">
      {people.map((person) => (
        <CreatorChip key={person.name} name={person.name} country={person.country} src={person.src} href={person.href} />
      ))}
    </div>
  )
}

function CreatorChip({ name, country, src, href }: { name: string; country: string; src?: string | null; href: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 pr-2">
      <Link to={href} className="shrink-0">
        {src ? (
          <span className="block h-[58px] w-[58px] overflow-hidden rounded-full ring-1 ring-[#ece6e0]">
            <img src={src} alt="" className="h-full w-full scale-110 object-cover" />
          </span>
        ) : (
          <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#efe6dc] text-lg font-semibold ring-1 ring-[#ece6e0]">{name.slice(0, 1)}</span>
        )}
      </Link>
      <div>
        <Link to={href} className="block whitespace-nowrap text-[13px] font-semibold leading-tight text-ink">{name}</Link>
        <p className="mt-1 flex items-center gap-1 text-[11px] leading-none text-[#8a837c]">
          <CreatorFlag country={country} />
          <span className="truncate">{country}</span>
        </p>
        <Link to={href} className="mt-1.5 inline-flex rounded-full border border-[#e4ddd6] bg-white px-3 py-1 text-[11px] font-medium leading-none text-[#3f3a36] hover:border-[#cfc6bd]">Follow</Link>
      </div>
    </div>
  )
}

const CREATOR_FLAG: Record<string, string> = {
  Nigeria: '🇳🇬',
  Ghana: '🇬🇭',
  'South Africa': '🇿🇦',
  Senegal: '🇸🇳',
  Ethiopia: '🇪🇹',
  Kenya: '🇰🇪',
  Egypt: '🇪🇬',
  Tanzania: '🇹🇿',
  Morocco: '🇲🇦',
  Namibia: '🇳🇦',
  Zimbabwe: '🇿🇼',
  Botswana: '🇧🇼',
  Uganda: '🇺🇬',
  Rwanda: '🇷🇼',
}

type SpotlightCard = {
  name: string
  place: string
  flag: string
  portrait: string
  assets: string
  downloads: string
  rating: string
  tags: string[]
  qr: string
  href: string
}

const DESIGN_SPOTLIGHT: SpotlightCard[] = [
  {
    name: 'Kojo Mensah',
    place: 'Accra, Ghana',
    flag: '🇬🇭',
    portrait: '/home/design/creator-2.png',
    assets: '320',
    downloads: '126K',
    rating: '4.9',
    tags: ['People', 'Nature', 'Culture', 'Travel'],
    qr: '/home/design/creator-qr.png',
    href: '/creators',
  },
  {
    name: 'Amina Bello',
    place: 'Lagos, Nigeria',
    flag: '🇳🇬',
    portrait: '/home/design/creator-1.png',
    assets: '248',
    downloads: '98K',
    rating: '4.8',
    tags: ['Portrait', 'Fashion', 'City', 'People'],
    qr: '/home/design/creator-qr-2.png',
    href: '/creators',
  },
]

function spotlightCard(person: PhotographerDto, photo: string, index: number): SpotlightCard {
  const country = countryFromLocation(person.location)
  const fallback = DESIGN_SPOTLIGHT[index] ?? DESIGN_SPOTLIGHT[0]
  return {
    name: person.name,
    place: person.location?.trim() || country,
    flag: CREATOR_FLAG[country] ?? '',
    portrait: person.avatarUrl || photo || fallback.portrait,
    assets: fmt(person.photosCount ?? 0),
    downloads: fmt(person.downloads ?? 0),
    rating: fmt(person.followers ?? 0),
    tags: fallback.tags,
    qr: fallback.qr,
    href: `/p/${person.handle}`,
  }
}

function Spotlight({ people, photo }: { people: PhotographerDto[]; photo: string }) {
  const design = people.length === 0
  const cards = design
    ? DESIGN_SPOTLIGHT
    : [...people.map((person, index) => spotlightCard(person, photo, index)), ...DESIGN_SPOTLIGHT].slice(0, 2)
  const scene = design ? '/home/design/spotlight-photo.png' : photo
  const lead = people[0]
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-6 lg:px-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-[32px] leading-none text-ink">Contributor Spotlight</h2>
          <p className="text-sm text-ink-soft">Meet amazing African creators shaping global visuals.</p>
        </div>
        <Link to="/creators" className="shrink-0 text-sm font-semibold text-[#ef5b24]">View all contributors →</Link>
      </div>
      <div className="flex w-full flex-wrap items-center gap-4 xl:flex-nowrap">
        {design ? (
          <Link to="/login?redirect=/contributor/upload&signup=photographer" className="block w-[min(100%,560px)] shrink-0 overflow-hidden rounded-[8px]">
            <img src="/home/design/spotlight-banner.png" alt="Real creators. Global impact. Join as a Contributor." className="h-auto w-full" />
          </Link>
        ) : (
          <div className="relative min-h-[200px] w-[min(100%,560px)] shrink-0 overflow-hidden rounded-[8px] bg-[#1a120c] text-white">
            <img src={scene} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
            <div className="relative flex min-h-[200px] items-center justify-between gap-3 p-5">
              <div className="max-w-xs">
                <h3 className="font-display text-3xl leading-[1.05]">Real creators.<br />Global impact.</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{lead?.bio || 'VueKumi empowers African photographers, filmmakers and visual storytellers to share the world with their voice.'}</p>
                <Link to={cards[0].href} className="mt-3 inline-flex rounded-full bg-[#ef5b24] px-4 py-2 text-sm font-semibold text-white">Join as a Contributor →</Link>
              </div>
              <ul className="hidden space-y-1.5 text-sm sm:block">
                <li className="flex items-center gap-2"><Check /> Earn from your work</li>
                <li className="flex items-center gap-2"><Check /> Global exposure</li>
                <li className="flex items-center gap-2"><Check /> Keep your creative rights</li>
              </ul>
            </div>
          </div>
        )}
        {cards.map((card) => (
          <CreatorIdCard key={card.name} card={card} />
        ))}
      </div>
    </section>
  )
}

function CreatorIdCard({ card }: { card: SpotlightCard }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="w-[236px]">
        <div className="flex items-center gap-3">
          <img src={card.portrait} alt="" className="h-14 w-14 rounded-full object-cover" />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ef5b24] px-2 py-0.5 text-[10px] font-semibold text-white">✓ Verified Creator</span>
            <p className="mt-1 truncate text-base font-semibold text-ink">{card.name}</p>
            <p className="truncate text-xs text-ink-soft">📍 {card.place} {card.flag ? <span aria-hidden="true">{card.flag}</span> : null}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 text-center">
          <Stat label="Assets" value={card.assets} />
          <Stat label="Downloads" value={card.downloads} />
          <Stat label="Rating" value={card.rating} />
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((label) => (
            <span key={label} className="rounded-full bg-[#f3eee9] px-2.5 py-1 text-[11px] font-medium text-ink">{label}</span>
          ))}
        </div>
      </div>
      <Link to={card.href} className="flex w-[112px] shrink-0 flex-col items-center text-center">
        <img src={card.qr} alt="" className="h-[108px] w-[108px] rounded-[4px] bg-white" />
        <span className="mt-1.5 max-w-[7.5rem] text-[11px] leading-snug text-ink-soft">Scan to view my VueKumi Creator ID</span>
      </Link>
    </div>
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
