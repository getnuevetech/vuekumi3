import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PHOTO_CATEGORIES, type FeaturedFrame, type HomeCategoryBannerDto, type HomeIconKey, type HomeStaticBannerDto, type ModelPublicDto, type PhotoDto, type PhotographerDto, type PublicStatsDto, type SectionFrame } from '@vuekumi/shared'
import { fillSiteTokens, isCreatorAccount, isPhotographerAccount } from '@vuekumi/shared'
import { CountryMark, PhotoHoverActions } from '../../components/PhotoActions'
import { categoryPath } from '../../lib/categories'
import { PublicFooter, Reveal, SearchForm } from '../../components/shared'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import { useSiteContent } from '../../context/SiteContentContext'
import { api } from '../../api/client'
import { fmt } from '../../lib/format'
import { publicQueryKeys } from '../../lib/query-keys'
import { SELL_HREF, siteTokens, contributorPortalHref } from './utils'

/* ---------------- discovery hero ---------------- */

export function HeroSlider({ photos, stats }: { photos: PhotoDto[]; stats: PublicStatsDto | null }) {
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { content, facts } = useSiteContent();
  const photosLive = stats?.photosLive ?? 0;
  const countries = stats?.countries ?? 0;
  const copy = content.home.hero.slides.map((item) => ({
    ...item,
    sub: item.sub.includes('{photos}') && photosLive === 0
      ? 'Authentic images from across the continent. Free and premium.'
      : fillSiteTokens(item.sub, siteTokens(facts, {
        photos: photosLive.toLocaleString('en-US'),
        countries,
        countryWord: countries === 1 ? 'country' : 'countries',
      })),
  }));
  const slides = copy.map((item, i) => {
    const photo = photos[i] ?? photos[0];
    return {
      ...item,
      src: photo?.src,
      alt: photo?.title || photo?.country || '',
      tag: photo?.country ? `${photo.title} — ${photo.country}` : '',
    };
  });

  const go = useCallback((i: number) => {
    setActive(((i % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    timer.current = setInterval(() => setActive((a) => (a + 1) % slides.length), 5200);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [slides.length]);

  const slide = slides[active];
  const collage = (photos.length ? photos : []).filter((photo) => photo.src).slice(0, 4);
  const chips = (stats?.categories ?? []).slice(0, 8);

  return (
    <section className="bg-paper">
      <div className="mx-auto grid max-w-[1500px] items-center gap-8 px-5 py-8 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
        <div>
          <p className="text-sm font-semibold text-terra">{slide.script}</p>
          <h1 key={`t-${active}`} className="font-display mt-2 text-5xl leading-[1.02] text-ink md:text-6xl">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">{slide.sub}</p>
          <div className="mt-6 max-w-xl">
            <SearchForm wide />
          </div>
          {chips.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {chips.map((row) => (
                <Link
                  key={row.value}
                  to={categoryPath(row.value)}
                  className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-terra"
                >
                  {row.value}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {content.home.hero.primaryTo.startsWith('#') ? (
              <a
                href={content.home.hero.primaryTo}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terra"
              >
                {content.home.hero.primaryLabel}
              </a>
            ) : (
              <Link
                to={content.home.hero.primaryTo}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terra"
              >
                {content.home.hero.primaryLabel}
              </Link>
            )}
            <Link
              to={content.home.hero.secondaryTo}
              className="rounded-full border border-sand px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-terra"
            >
              {content.home.hero.secondaryLabel}
            </Link>
          </div>
          {slides.length > 1 && (
            <div className="mt-6 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === active ? 'w-8 bg-terra' : 'w-3 bg-sand hover:bg-terra/60'}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(collage.length ? collage : [{ src: slide.src, title: slide.alt, id: 'hero' }]).slice(0, 4).map((photo, index) => (
            <div key={`${photo.id ?? index}`} className={`overflow-hidden rounded-2xl bg-cream ${index === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/5]'}`}>
              {photo.src ? (
                <img src={photo.src} alt={photo.title || ''} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full min-h-40 w-full bg-cream" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- marquee ticker ---------------- */

export function Marquee({ categories }: { categories: string[] }) {
  const { content } = useSiteContent();
  const items = categories.length ? categories : content.home.marqueeFallback;
  return (
    <div className="border-y border-sand bg-white">
      <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-5 py-3 no-scrollbar md:px-8">
        {items.map((t) => (
          <Link
            key={t}
            to={categoryPath(t)}
            className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-terra hover:text-white"
          >
            {t}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- icon features row ---------------- */

function HomeIcon({ name }: { name: HomeIconKey }) {
  const common = { viewBox: '0 0 24 24', className: 'h-8 w-8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 } as const;
  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'plus') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8M12 8v8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'camera') {
    return (
      <svg {...common}>
        <path d="M4 8h3l2-2h6l2 2h3v10H4V8z" strokeLinejoin="round" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    );
  }
  if (name === 'globe') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z" />
      </svg>
    );
  }
  if (name === 'star') {
    return (
      <svg {...common}>
        <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16l-4.8 2.4.9-5.4L4.2 9.2l5.4-.8L12 3.5z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.8" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRow() {
  const { content } = useSiteContent();
  const feats = content.home.messages;
  return (
    <section className="bg-white px-6 py-14 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        {feats.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div className="rounded-2xl border border-sand bg-paper p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream text-terra">
                <HomeIcon name={f.icon} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- horizontal mouse-wheel strips ---------------- */

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

export function FeaturedStrip({ photos, frame }: { photos: PhotoDto[]; frame: FeaturedFrame }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  if (photos.length === 0) return null
  return (
    <section
      className="bg-paper px-5 py-12 md:px-8"
      aria-label="Featured images"
      style={{ ['--featured-width' as string]: `${frame.widthVw}vw`, ['--featured-height' as string]: `${frame.heightVw}vw` }}
    >
      <div className="mx-auto mb-6 flex max-w-[1500px] items-end justify-between">
        <h2 className="font-display text-3xl text-ink md:text-4xl">Featured photos</h2>
        <Link to="/search" className="text-sm font-semibold text-terra">View all</Link>
      </div>
      <div
        ref={setNode}
        data-strip="featured"
        className="no-scrollbar mx-auto flex max-w-[1500px] cursor-grab gap-4 overflow-x-auto overscroll-x-contain active:cursor-grabbing"
      >
        {photos.map((p, i) => (
          <Link
            key={p.id}
            to={`/photo/${p.id}`}
            className="group block w-[78vw] shrink-0 sm:w-[46vw] lg:w-[31%]"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream">
              <img src={p.src} alt={p.title} loading={i > 1 ? 'lazy' : undefined} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <CountryMark country={p.country} />
              <PhotoHoverActions photo={p} />
            </div>
            <p className="mt-3 text-base font-semibold text-ink">{p.title}</p>
            <p className="text-sm text-ink-soft">{p.category} · {p.photographerName ?? p.photographer}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function CategoryBanners({ banners, frame }: { banners: HomeCategoryBannerDto[]; frame: SectionFrame }) {
  const { content } = useSiteContent();
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  if (banners.length === 0) return null
  return (
    <section className="bg-white px-5 py-12 md:px-8" aria-label="Category banners">
      <div className="mx-auto mb-6 max-w-[1500px]">
        <p className="text-sm font-semibold text-terra">{content.home.categories.kicker}</p>
        <h2 className="font-display mt-1 text-3xl text-ink md:text-4xl">{content.home.categories.title}</h2>
      </div>
      <div
        ref={setNode}
        data-strip="categories"
        className="no-scrollbar mx-auto flex max-w-[1500px] cursor-grab gap-4 overflow-x-auto overscroll-x-contain active:cursor-grabbing"
      >
        {banners.map((banner) => (
          <Link
            key={`${banner.category}-${banner.photo.id}`}
            to={categoryPath(banner.category)}
            className="group w-[70vw] shrink-0 sm:w-[280px]"
          >
            <div className="relative overflow-hidden rounded-2xl bg-cream" style={{ aspectRatio: `${frame.widthVw} / ${frame.heightVw}` }}>
              <img src={banner.photo.src} alt={banner.category} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            </div>
            <p className="mt-3 text-base font-semibold text-ink">{banner.category}</p>
            <p className="text-sm text-ink-soft">{banner.photo.title}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ---------------- black CTA band ---------------- */

export function CtaBand() {
  const { user } = useAuth();
  const { content } = useSiteContent();
  return (
    <section className="px-5 py-6 md:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col items-start justify-between gap-6 rounded-3xl bg-[#0b0a09] px-8 py-12 md:flex-row md:items-center">
        <h2 className="font-display max-w-2xl text-3xl leading-tight text-[#faf6f3] md:text-4xl">
          {content.home.cta.text}<span className="text-terra">{content.home.cta.emphasis}</span>
        </h2>
        <Link
          to={contributorPortalHref(user?.accountType)}
          className="shrink-0 rounded-full bg-terra px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-ink"
        >
          {isPhotographerAccount(user?.accountType) ? 'Open photographer portal' : user?.accountType === 'photo_influencer' ? 'Open photo influencer portal' : isCreatorAccount(user?.accountType) ? 'Open contributor portal' : content.actions.sell}
        </Link>
      </div>
    </section>
  );
}

/* ---------------- endless masonry feed ---------------- */

function FeedCard({ photo }: { photo: PhotoDto }) {
  return (
    <Link to={`/photo/${photo.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl bg-cream">
        <img src={photo.src} alt={photo.title} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <CountryMark country={photo.country} />
        <PhotoHoverActions photo={photo} />
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
          {photo.license === 'premium' ? 'Premium' : 'Free Library'}
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-ink">{photo.title}</p>
      <p className="truncate text-xs text-ink-soft">{photo.photographerName ?? photo.photographer} · {photo.country}</p>
    </Link>
  );
}

function mixCategoryPhotos(groups: PhotoDto[][], cap = 36): PhotoDto[] {
  const seen = new Set<string>();
  const mixed: PhotoDto[] = [];
  let round = 0;
  let added = true;
  while (added && mixed.length < cap) {
    added = false;
    for (const group of groups) {
      const photo = group[round];
      if (!photo || seen.has(photo.id)) continue;
      seen.add(photo.id);
      mixed.push(photo);
      added = true;
      if (mixed.length >= cap) break;
    }
    round += 1;
  }
  return mixed;
}

export function InfiniteFeed() {
  const { content } = useSiteContent();
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: publicQueryKeys.homeFeed,
    queryFn: async () => {
      const groups = await Promise.all(PHOTO_CATEGORIES.map((category) => (
        api.photos({ category, page: 1, limit: 4, facets: '0' })
          .then((data) => data.items)
          .catch(() => [] as PhotoDto[])
      )))
      return mixCategoryPhotos(groups)
    },
  })

  return (
    <section id="feed" className="bg-paper px-5 py-12 md:px-8">
      <div className="mx-auto flex max-w-[1500px] items-end justify-between pb-6">
        <div>
          <p className="text-sm font-semibold text-terra">{content.home.feed.kicker}</p>
          <h2 className="font-display mt-1 text-3xl text-ink md:text-4xl">
            {content.home.feed.title} {content.home.feed.titleAccent}
          </h2>
        </div>
        <Link to="/search" className="hidden text-sm font-semibold text-terra md:block">
          {content.home.feed.browseLabel}
        </Link>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => (
          <FeedCard key={p.id} photo={p} />
        ))}
      </div>

      <div className="flex items-center justify-center py-10">
        {loading ? (
          <span className="text-sm text-ink-soft">{content.home.feed.loading}</span>
        ) : (
          <Link
            to="/search"
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-terra"
          >
            Load more images
          </Link>
        )}
      </div>
    </section>
  );
}

/* ---------------- editorial split with vertical text ---------------- */

export function EditorialSplit({ photos, stats }: { photos: PhotoDto[]; stats: PublicStatsDto | null }) {
  const { user } = useAuth();
  const { content, facts } = useSiteContent();
  const editorial = content.home.editorial;
  const [index, setIndex] = useState(0);
  const photoKey = photos.map((photo) => photo.id).join(',')
  useEffect(() => {
    setIndex(0)
    if (photos.length < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % photos.length), 4500)
    return () => window.clearInterval(timer)
  }, [photoKey, photos.length])
  const a = photos.length ? photos[index % photos.length] : undefined
  const b = photos.length > 1 ? photos[(index + 1) % photos.length] : a
  const uploadHref = isCreatorAccount(user?.accountType)
    ? '/contributor/upload'
    : SELL_HREF;
  return (
    <section className="bg-white px-5 py-12 md:px-8">
      <div className="mx-auto grid max-w-[1500px] items-center gap-6 lg:grid-cols-[1fr_1.1fr_1fr]">
      <div className="group relative overflow-hidden rounded-2xl">
        {a ? <img src={a.src} alt={a.title || ''} loading="lazy" className="h-72 w-full object-cover md:h-[460px]" /> : <div className="h-72 bg-cream md:h-[460px]" />}
        {a && <CountryMark country={a.country} />}
        {a && !a.id.startsWith('upload-') && <PhotoHoverActions photo={a} />}
      </div>
      <div className="flex flex-col justify-center px-2 py-4 md:px-6">
        <p className="text-sm font-semibold text-terra">{editorial.kicker}</p>
        <h2 className="font-display mt-2 text-4xl leading-tight text-ink">
          {editorial.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          {fillSiteTokens(editorial.body, siteTokens(facts))}
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-sand pt-6">
          {[
            [`${facts.photographerPct}%`, editorial.royaltyLabel],
            [fmt(stats?.photosLive ?? 0), editorial.photosLabel],
            [String(stats?.countries ?? 0), editorial.countriesLabel],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-display text-3xl text-terra">{v}</p>
              <p className="mt-1 text-xs text-ink-soft">{l}</p>
            </div>
          ))}
        </div>
        <Link
          to={uploadHref}
          className="mt-8 w-fit rounded-full bg-terra px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink"
        >
          {editorial.cta}
        </Link>
        <p className="mt-4 text-xs text-ink-faint">{editorial.side}</p>
      </div>
      <div className="group relative overflow-hidden rounded-2xl">
        {b ? <img src={b.src} alt={b.title || ''} loading="lazy" className="h-72 w-full object-cover md:h-[460px]" /> : <div className="h-72 bg-cream md:h-[460px]" />}
        {b && <CountryMark country={b.country} />}
        {b && !b.id.startsWith('upload-') && <PhotoHoverActions photo={b} />}
      </div>
      </div>
    </section>
  );
}

/* ---------------- full-bleed stats band with progress rings ---------------- */

function Ring({ value, label }: { value: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-32 md:h-36 md:w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(250,246,243,0.15)" strokeWidth="3" />
          <circle
            cx="60" cy="60" r={r} fill="none" stroke="#bc773f" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-condensed text-2xl font-medium text-paper">
          {value}<span className="text-sm text-terra">%</span>
        </span>
      </div>
      <p className="mt-3 font-condensed text-[13px] uppercase tracking-[0.3em] text-paper-soft">{label}</p>
    </div>
  );
}

export function StatsBand({
  categories,
  background,
}: {
  categories: PublicStatsDto['categories']
  background: PhotoDto | null
}) {
  const { content } = useSiteContent();
  return (
    <section data-on-photo className="relative overflow-hidden">
      {background ? (
        <img src={background.src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-noir" />
      )}
      <div className="absolute inset-0 bg-noir/80" />
      <div className="relative px-6 py-20 md:py-28">
        <Reveal>
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-10 md:grid-cols-4">
            {(categories.length ? categories : [{ value: 'Library', count: 0, sharePct: 0 }]).map((row) => (
              <Ring key={row.value} value={row.sharePct} label={row.value} />
            ))}
          </div>
        </Reveal>
        <p className="mt-12 text-center font-mono-tech text-[10px] uppercase tracking-[0.25em] text-paper-soft">
          {content.home.statsCaption}{background?.country ? ` — ${background.title}, ${background.country}` : ''}
        </p>
      </div>
    </section>
  );
}

export function PeopleRail({
  copy,
  people,
  frame,
  joinTo,
  browseTo,
  badge,
}: {
  copy: { kicker: string; title: string; linkLabel: string; joinScript: string; joinLabel: string }
  people: PhotographerDto[]
  frame: SectionFrame
  joinTo: string
  browseTo: string
  badge?: string
}) {
  void frame
  return (
    <section className="bg-paper px-5 py-12 md:px-8">
      <div className="mx-auto flex max-w-[1500px] items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-terra">{copy.kicker}</p>
          <h2 className="font-display mt-1 text-3xl text-ink md:text-4xl">{copy.title}</h2>
        </div>
        <Link to={browseTo} className="hidden text-sm font-semibold text-terra md:block">
          {copy.linkLabel}
        </Link>
      </div>
      <div className="no-scrollbar mx-auto mt-8 flex max-w-[1500px] gap-5 overflow-x-auto">
        {people.map((ph) => (
          <Link key={ph.handle} to={`/p/${ph.handle}`} className="w-40 shrink-0 text-center">
            <img src={ph.avatarUrl ?? '/images/avatars/photographer-bw.jpg'} alt="" loading="lazy" className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-white" />
            <p className="mt-3 text-sm font-semibold text-ink">{ph.name}</p>
            <p className="text-xs text-ink-soft">{badge ? `${badge} · ` : ''}{ph.location}</p>
            <p className="text-xs text-ink-faint">{fmt(ph.followers)} followers · {ph.photosCount}</p>
          </Link>
        ))}
        <Link to={joinTo} className="flex w-40 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-sand bg-white px-3 text-center">
          <span className="font-script text-3xl text-terra">{copy.joinScript}</span>
          <span className="mt-2 text-xs font-semibold text-ink">{copy.joinLabel}</span>
        </Link>
      </div>
    </section>
  );
}

export function StaticBannerSection({ banner }: { banner: HomeStaticBannerDto }) {
  if (!banner.images.length && !banner.title) return null
  return (
    <section className="bg-paper px-5 py-12 md:px-8" aria-label={banner.title}>
      <h2 className="font-display mx-auto max-w-[1500px] text-3xl text-ink md:text-4xl">
        {banner.title}
      </h2>
      {banner.images.length > 0 && (
        <div
          className="mx-auto mt-8 grid gap-1"
          style={{
            width: '100%',
            maxWidth: `calc(${banner.columns} * ${banner.widthVw}vw)`,
            gridTemplateColumns: `repeat(${banner.columns}, minmax(0, 1fr))`,
          }}
        >
          {banner.images.map((src, index) => (
            <img
              key={`${banner.id}-${index}`}
              src={src}
              alt=""
              loading="lazy"
              className="w-full object-cover"
              style={{ aspectRatio: `${banner.widthVw} / ${banner.heightVw}` }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function ModelsRail() {
  const { content } = useSiteContent();
  const copy = content.home.models;
  const [people, setPeople] = useState<ModelPublicDto[]>([]);

  useEffect(() => {
    api.models({ limit: 12 }).then((d) => setPeople(d.items)).catch(() => setPeople([]));
  }, []);

  if (people.length === 0) return null;

  return (
    <section className="bg-white px-5 py-12 md:px-8">
      <div className="mx-auto flex max-w-[1500px] items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-terra">{copy.kicker}</p>
          <h2 className="font-display mt-1 text-3xl text-ink md:text-4xl">{copy.title}</h2>
        </div>
        <Link to="/models" className="hidden text-sm font-semibold text-terra md:block">
          {copy.linkLabel}
        </Link>
      </div>
      <div className="no-scrollbar mx-auto mt-8 flex max-w-[1500px] gap-5 overflow-x-auto">
        {people.map((model) => (
          <Link key={model.handle} to={`/m/${model.handle}`} className="w-40 shrink-0 text-center">
            <img src={model.avatarUrl ?? '/images/avatars/portrait-botswana.jpg'} alt="" loading="lazy" className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-white" />
            <p className="mt-3 text-sm font-semibold text-ink">{model.name}</p>
            <p className="text-xs text-ink-soft">@{model.handle}</p>
            <p className="text-xs text-ink-faint">{model.photosCount} approved</p>
          </Link>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-[1500px] text-sm text-ink-soft">{copy.note}</p>
    </section>
  );
}

/* ---------------- image-topped pricing cards ---------------- */

export function NoirPricing({ photos }: { photos: PhotoDto[] }) {
  const { format } = useCurrency();
  const { content } = useSiteContent();
  const { data: pack } = useQuery({
    queryKey: publicQueryKeys.plans,
    queryFn: () => api.publicPlans(),
  });
  if (!pack) return null;
  const plans = pack.items.map((plan, index) => ({
    photo: plan.homePhotoSrc
      ? { src: plan.homePhotoSrc }
      : photos[index] ?? photos[0],
    name: plan.name,
    price: format(plan.priceUsd),
    per: `/${plan.periodDays}d`,
    feats: plan.features.length ? plan.features : [plan.description || `${plan.periodDays} days`],
  }));
  if (plans.length === 0) return null;
  return (
    <section className="bg-paper px-5 pb-16 pt-4 md:px-8">
      <div className="mx-auto max-w-[1500px]">
      <p className="text-sm font-semibold text-terra">{pack.home.kicker}</p>
      <h2 className="font-display mt-1 text-3xl text-ink md:text-4xl">{pack.home.title}</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.name} delay={i * 90}>
            <div className="group overflow-hidden rounded-2xl border border-sand bg-white">
              <div className="relative aspect-[16/9] overflow-hidden">
                {p.photo ? (
                <img
                  src={p.photo.src} alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                ) : (
                  <div className="h-full w-full bg-noir" />
                )}
                <span className="absolute left-4 top-4 bg-noir/70 px-3 py-1 font-condensed text-[11px] uppercase tracking-[0.3em] text-paper backdrop-blur-sm">
                  {p.name}
                </span>
              </div>
              <div className="p-6">
                <p className="font-display text-4xl text-ink">
                  {p.price}
                  {p.per && <span className="text-base text-ink-soft">{p.per}</span>}
                </p>
                <ul className="mt-4 space-y-2">
                  {p.feats.map((f) => (
                    <li key={f} className="text-sm text-ink-soft">{f}</li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="mt-6 block rounded-full bg-ink py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-terra"
                >
                  {content.home.pricingCta}
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      </div>
    </section>
  );
}

/* ---------------- footer + back-to-top ---------------- */

export function NoirFooter() {
  return <PublicFooter />
}

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="v-text fixed bottom-24 right-0 z-[60] border-y border-l border-noir bg-noir-soft/90 px-2.5 py-5 font-condensed text-[11px] uppercase tracking-[0.3em] text-paper-soft backdrop-blur-sm transition-colors hover:text-terra"
    >
      Back to top →
    </button>
  );
}

/* ---------------- page ---------------- */

