import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { DEFAULT_FEATURED_FRAME, PHOTO_CATEGORIES, type FeaturedFrame, type HomeCategoryBannerDto, type HomeIconKey, type HomePageDto, type ModelPublicDto, type PhotoDto, type PhotographerDto, type PublicStatsDto, type SiteFacts } from '@vuekumi/shared';
import { fillSiteTokens, isCreatorAccount, isPhotographerAccount, menuLinkVisible, menuTypeClass, sortMenuLinks } from '@vuekumi/shared';
import { ThemeToggle } from '../components/ThemeToggle';
import { CountryMark, PhotoHoverActions } from '../components/PhotoActions';
import { categoryPath } from '../lib/categories';
import { AccountMenu, LogoMark, Reveal, SearchForm } from '../components/shared';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSiteContent } from '../context/SiteContentContext';
import { api } from '../api/client';
import { fmt } from '../lib/format';

const SELL_HREF = '/login?redirect=/contributor/upload&signup=photographer';

function siteTokens(facts: SiteFacts, extra: Record<string, string | number> = {}) {
  return {
    share: `${facts.photographerPct}%`,
    minimum: facts.payoutMinimumUsd,
    photographerPct: facts.photographerPct,
    platformPct: 100 - facts.photographerPct,
    ...extra,
  };
}

function contributorPortalHref(accountType?: string) {
  return isCreatorAccount(accountType) ? '/contributor' : SELL_HREF;
}

/* ---------------- header ---------------- */

function NoirHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { content } = useSiteContent();
  const links = sortMenuLinks(content.menu).filter((link) => menuLinkVisible(link, user));
  const menuClass = `${menuTypeClass(content.menuStyle.font)} font-light uppercase text-paper-soft transition-colors hover:text-terra`;
  const menuStyle = { fontSize: `${content.menuStyle.sizePx}px`, letterSpacing: '0.14em' };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-noir bg-noir/85 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 md:px-10">
          <LogoMark dark condensed accent="#bc773f" />
          <nav className="hidden items-center gap-5 lg:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                style={menuStyle}
                className={menuClass}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle tone="dark" />
            <AccountMenu tone="dark" />
            {!user && (
              <Link
                to={contributorPortalHref()}
                className="hidden border border-paper/70 px-5 py-2 font-condensed text-[12px] uppercase tracking-[0.22em] text-paper transition-colors hover:border-terra hover:bg-terra lg:inline-block"
              >
                {content.actions.sell}
              </Link>
            )}
            <button
              onClick={() => setOpen(!open)}
              className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
              aria-label="Menu"
            >
              <span className={`h-px w-6 bg-paper transition-transform ${open ? 'translate-y-[3.5px] rotate-45' : ''}`} />
              <span className={`h-px w-6 bg-paper transition-transform ${open ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
            </button>
          </div>
        </div>
        <div className="px-5 pb-4 md:px-10">
          <SearchForm dark wide />
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-noir/95 backdrop-blur-xl lg:hidden">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={() => setOpen(false)}
              className="font-condensed text-2xl font-light uppercase tracking-[0.25em] text-paper"
            >
              {l.label}
            </Link>
          ))}
          <Link to={contributorPortalHref(user?.accountType)} onClick={() => setOpen(false)} className="mt-4 border border-terra px-8 py-3 font-condensed text-sm uppercase tracking-[0.25em] text-terra">
            {content.actions.sell}
          </Link>
        </div>
      )}
    </>
  );
}

/* ---------------- full-screen hero slider ---------------- */

function HeroSlider({ photos, stats }: { photos: PhotoDto[]; stats: PublicStatsDto | null }) {
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
      alt: photo?.title ?? '',
      tag: photo ? `${photo.title} — ${photo.country}` : 'Vuekumi library',
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

  return (
    <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-noir">
      {slides.map((s, i) => (
        <div key={s.title} className={`noir-slide absolute inset-0 ${i === active ? 'is-active' : ''}`}>
          {s.src ? <img src={s.src} alt={s.alt} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-noir" />}
          <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/35 to-noir/30" />
        </div>
      ))}

      {/* copy */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p key={`s-${active}`} className="font-script text-5xl text-terra md:text-7xl">
          {slide.script}
        </p>
        <h1
          key={`t-${active}`}
          className="font-condensed mt-1 text-[clamp(4.5rem,16vw,13rem)] font-semibold uppercase leading-[0.9] tracking-[0.04em] text-paper"
        >
          {slide.title}
        </h1>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-paper-soft">{slide.sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {content.home.hero.primaryTo.startsWith('#') ? (
            <a
              href={content.home.hero.primaryTo}
              className="bg-paper px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-noir transition-colors hover:bg-terra hover:text-paper"
            >
              {content.home.hero.primaryLabel}
            </a>
          ) : (
            <Link
              to={content.home.hero.primaryTo}
              className="bg-paper px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-noir transition-colors hover:bg-terra hover:text-paper"
            >
              {content.home.hero.primaryLabel}
            </Link>
          )}
          <Link
            to={content.home.hero.secondaryTo}
            className="border border-paper/50 px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-paper transition-colors hover:border-terra hover:text-terra"
          >
            {content.home.hero.secondaryLabel}
          </Link>
        </div>
      </div>

      {/* edge tabs */}
      <button
        onClick={() => go(active - 1)}
        aria-label="Previous slide"
        className="v-text absolute left-0 top-1/2 hidden -translate-y-1/2 border-y border-r border-paper/20 bg-noir/50 px-2.5 py-5 font-condensed text-[11px] uppercase tracking-[0.3em] text-paper-soft backdrop-blur-sm transition-colors hover:text-terra md:block"
      >
        Prev
      </button>
      <button
        onClick={() => go(active + 1)}
        aria-label="Next slide"
        className="v-text absolute right-0 top-1/2 hidden -translate-y-1/2 border-y border-l border-paper/20 bg-noir/50 px-2.5 py-5 font-condensed text-[11px] uppercase tracking-[0.3em] text-paper-soft backdrop-blur-sm transition-colors hover:text-terra md:block"
      >
        Next
      </button>

      {/* bottom meta */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-6 md:px-10">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-paper-soft">
          {String(active + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')} — {slide.tag}
        </p>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-[3px] transition-all ${i === active ? 'w-10 bg-terra' : 'w-5 bg-paper/30 hover:bg-paper/60'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- marquee ticker ---------------- */

function Marquee({ categories }: { categories: string[] }) {
  const { content } = useSiteContent();
  const items = categories.length ? categories : content.home.marqueeFallback;
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-noir bg-noir py-4">
      <div className="marquee-track items-center gap-10">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <Link
              to={categoryPath(t)}
              className="font-condensed text-xl font-light uppercase tracking-[0.3em] text-paper-soft hover:text-terra"
            >
              {t}
            </Link>
            <span className="h-1.5 w-1.5 rotate-45 bg-terra" />
          </span>
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

function IconRow() {
  const { content } = useSiteContent();
  const feats = content.home.messages;
  return (
    <section className="bg-noir px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3 md:gap-8">
        {feats.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-noir bg-noir-soft text-terra">
                <HomeIcon name={f.icon} />
              </div>
              <h3 className="font-condensed mt-5 text-lg font-medium uppercase tracking-[0.25em] text-paper">{f.title}</h3>
              <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-noir-soft">{f.text}</p>
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

function FeaturedStrip({ photos, frame }: { photos: PhotoDto[]; frame: FeaturedFrame }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  if (photos.length === 0) return null
  return (
    <section
      className="bg-noir"
      aria-label="Featured images"
      style={{ ['--featured-width' as string]: `${frame.widthVw}vw`, ['--featured-height' as string]: `${frame.heightVw}vw` }}
    >
      <div
        ref={setNode}
        data-strip="featured"
        className="no-scrollbar flex cursor-grab gap-1 overflow-x-auto overscroll-x-contain active:cursor-grabbing"
      >
        {photos.map((p, i) => (
          <Link
            key={p.id}
            to={`/photo/${p.id}`}
            className="strip-cell featured-frame group relative block shrink-0 overflow-hidden"
          >
            <img src={p.src} alt={p.title} loading={i > 1 ? 'lazy' : undefined} className="h-full w-full object-cover" />
            <CountryMark country={p.country} />
            <PhotoHoverActions photo={p} />
            <div className="strip-meta absolute inset-x-0 bottom-0 p-5">
              <p className="font-condensed text-lg font-medium uppercase tracking-[0.18em] text-paper">{p.title}</p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">
                {p.category} — {p.photographerName ?? p.photographer}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function CategoryBanners({ banners }: { banners: HomeCategoryBannerDto[] }) {
  const { content } = useSiteContent();
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useBidirectionalWheel(node)
  if (banners.length === 0) return null
  return (
    <section className="bg-noir pb-8" aria-label="Category banners">
      <div className="px-5 pb-4 pt-10 md:px-10">
        <p className="font-script text-3xl text-terra">{content.home.categories.kicker}</p>
        <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
          {content.home.categories.title}
        </h2>
      </div>
      <div
        ref={setNode}
        data-strip="categories"
        className="no-scrollbar flex cursor-grab gap-1 overflow-x-auto overscroll-x-contain px-1 active:cursor-grabbing"
      >
        {banners.map((banner) => (
          <Link
            key={`${banner.category}-${banner.photo.id}`}
            to={categoryPath(banner.category)}
            className="strip-cell group relative block aspect-[3/4] w-[72vw] shrink-0 overflow-hidden sm:w-[46vw] lg:w-[28vw]"
          >
            <img src={banner.photo.src} alt={banner.category} loading="lazy" className="h-full w-full object-cover" />
            <div className="strip-meta absolute inset-x-0 bottom-0 p-5">
              <p className="font-condensed text-lg font-medium uppercase tracking-[0.18em] text-paper">{banner.category}</p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">{banner.photo.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ---------------- black CTA band ---------------- */

function CtaBand() {
  const { user } = useAuth();
  const { content } = useSiteContent();
  return (
    <section className="border-y border-noir bg-noir-soft">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center md:px-10">
        <h2 className="font-condensed max-w-2xl text-2xl font-light uppercase leading-snug tracking-[0.12em] text-paper md:text-3xl">
          {content.home.cta.text}<span className="text-terra">{content.home.cta.emphasis}</span>
        </h2>
        <Link
          to={contributorPortalHref(user?.accountType)}
          className="shrink-0 bg-paper px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-noir transition-colors hover:bg-terra hover:text-paper"
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
    <Link to={`/photo/${photo.id}`} className="strip-cell group relative mb-1 block break-inside-avoid overflow-hidden">
      <img src={photo.src} alt={photo.title} loading="lazy" className="min-h-48 w-full object-cover" />
      <CountryMark country={photo.country} />
      <PhotoHoverActions photo={photo} />
      <div className="strip-meta absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/90 to-transparent p-4 pt-10">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-condensed text-sm font-medium uppercase tracking-[0.14em] text-paper">
              {photo.title}
            </p>
            <p className="mt-0.5 font-mono-tech text-[9px] uppercase tracking-[0.16em] text-terra">
              {photo.photographerName ?? photo.photographer} — {photo.country}
            </p>
          </div>
          <span className="shrink-0 font-mono-tech text-[9px] text-paper-soft">{fmt(photo.downloads)}↓</span>
        </div>
      </div>
      {photo.license === 'premium' && (
        <span className="absolute left-2 top-8 bg-terra px-2 py-0.5 font-mono-tech text-[8px] uppercase tracking-[0.18em] text-paper">
          Premium
        </span>
      )}
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

function InfiniteFeed() {
  const { content } = useSiteContent();
  const [items, setItems] = useState<PhotoDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(PHOTO_CATEGORIES.map((category) => (
      api.photos({ category, page: 1, limit: 4, facets: '0' })
        .then((data) => data.items)
        .catch(() => [] as PhotoDto[])
    ))).then((groups) => {
      if (!cancelled) setItems(mixCategoryPhotos(groups));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="feed" className="bg-noir">
      <div className="flex items-end justify-between px-5 pb-6 pt-16 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">{content.home.feed.kicker}</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-6xl">
            {content.home.feed.title}<span className="text-outline-paper">{content.home.feed.titleAccent}</span>
          </h2>
        </div>
        <Link to="/search" className="hidden font-mono-tech text-[10px] uppercase tracking-[0.2em] text-noir-soft hover:text-terra md:block">
          {content.home.feed.browseLabel}
        </Link>
      </div>

      <div className="columns-2 gap-1 px-1 md:columns-3 xl:columns-4">
        {items.map((p) => (
          <FeedCard key={p.id} photo={p} />
        ))}
      </div>

      <div className="flex items-center justify-center py-10">
        {loading ? (
          <span className="font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
            {content.home.feed.loading}
          </span>
        ) : (
          <Link
            to="/search"
            className="border border-paper px-8 py-3 font-condensed text-[12px] uppercase tracking-[0.22em] text-paper transition-colors hover:border-terra hover:bg-terra"
          >
            Load more images
          </Link>
        )}
      </div>
    </section>
  );
}

/* ---------------- editorial split with vertical text ---------------- */

function EditorialSplit({ photos, stats }: { photos: PhotoDto[]; stats: PublicStatsDto | null }) {
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
    <section className="relative flex flex-col bg-noir lg:flex-row">
      <div className="hidden w-16 shrink-0 items-center justify-center border-r border-noir lg:flex">
        <span className="v-text font-condensed text-sm font-light uppercase tracking-[0.4em] text-noir-soft">
          {editorial.side}
        </span>
      </div>
      <div className="group relative flex-1">
        {a ? <img src={a.src} alt={a.title} loading="lazy" className="h-72 w-full object-cover md:h-[520px]" /> : <div className="h-72 bg-noir-soft md:h-[520px]" />}
        {a && <CountryMark country={a.country} />}
        {a && <PhotoHoverActions photo={a} />}
        {a && (
          <p className="absolute bottom-4 left-4 bg-noir/70 px-3 py-1.5 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper backdrop-blur-sm">
            {a.title} — {a.country}
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-14 md:px-14">
        <p className="font-script text-4xl text-terra">{editorial.kicker}</p>
        <h2 className="font-condensed mt-2 text-4xl font-semibold uppercase leading-[1.02] tracking-[0.05em] text-paper md:text-5xl">
          {editorial.title}
        </h2>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-noir-soft">
          {fillSiteTokens(editorial.body, siteTokens(facts))}
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-noir pt-6">
          {[
            [`${facts.photographerPct}%`, editorial.royaltyLabel],
            [fmt(stats?.photosLive ?? 0), editorial.photosLabel],
            [String(stats?.countries ?? 0), editorial.countriesLabel],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-condensed text-3xl font-medium text-terra">{v}</p>
              <p className="mt-1 font-mono-tech text-[9px] uppercase tracking-[0.15em] text-noir-faint">{l}</p>
            </div>
          ))}
        </div>
        <Link
          to={uploadHref}
          className="mt-8 w-fit border border-terra px-7 py-3 font-condensed text-[12px] uppercase tracking-[0.25em] text-terra transition-colors hover:bg-terra hover:text-paper"
        >
          {editorial.cta}
        </Link>
      </div>
      <div className="group relative flex-1">
        {b ? <img src={b.src} alt={b.title} loading="lazy" className="h-72 w-full object-cover md:h-[520px] lg:h-full" /> : <div className="h-72 bg-noir-soft md:h-[520px]" />}
        {b && <CountryMark country={b.country} />}
        {b && <PhotoHoverActions photo={b} />}
        {b && (
          <p className="absolute bottom-4 right-4 bg-noir/70 px-3 py-1.5 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper backdrop-blur-sm">
            {b.title} — {b.country}
          </p>
        )}
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

function StatsBand({
  categories,
  background,
}: {
  categories: PublicStatsDto['categories']
  background: PhotoDto | null
}) {
  const { content } = useSiteContent();
  return (
    <section className="relative overflow-hidden">
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
          {content.home.statsCaption}{background ? ` — ${background.title}, ${background.country}` : ''}
        </p>
      </div>
    </section>
  );
}

/* ---------------- contributors rail ---------------- */

function ContributorsRail() {
  const { content } = useSiteContent();
  const copy = content.home.contributors;
  const [makers, setMakers] = useState<PhotographerDto[]>([]);

  useEffect(() => {
    api.photographers({ limit: 20 }).then((d) => setMakers(d.items)).catch(() => setMakers([]));
  }, []);

  return (
    <section className="bg-noir py-20 md:py-24">
      <div className="flex items-end justify-between px-5 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">{copy.kicker}</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
            {copy.title}
          </h2>
        </div>
        <Link to="/creators" className="hidden font-condensed text-[12px] uppercase tracking-[0.25em] text-noir-soft transition-colors hover:text-terra md:block">
          {copy.linkLabel}
        </Link>
      </div>
      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1">
        {makers.map((ph) => (
          <Link
            key={ph.handle}
            to={`/p/${ph.handle}`}
            className="strip-cell group relative w-[70vw] shrink-0 snap-start overflow-hidden sm:w-[44vw] lg:w-[30vw]"
          >
            <img src={ph.avatarUrl ?? '/images/avatars/photographer-bw.jpg'} alt={ph.name} loading="lazy" className="aspect-[4/5] w-full object-cover" />
            <div className="strip-meta absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/90 to-transparent p-5 pt-12">
              <p className="font-condensed text-xl font-medium uppercase tracking-[0.15em] text-paper">
                {ph.name} <span className="mx-1 text-terra">—</span> <span className="text-sm font-light text-paper-soft">{ph.location}</span>
              </p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-terra">
                {ph.creatorKind === 'photo_influencer' ? 'Photo influencer · ' : ''}
                {fmt(ph.followers)} followers · {ph.photosCount} photographs
              </p>
            </div>
          </Link>
        ))}
        <Link
          to={SELL_HREF}
          className="flex w-[70vw] shrink-0 snap-start items-center justify-center border border-noir bg-noir-soft transition-colors hover:border-terra sm:w-[44vw] lg:w-[30vw]"
        >
          <span className="text-center">
            <span className="font-script block text-4xl text-terra">{copy.joinScript}</span>
            <span className="font-condensed mt-2 block text-sm uppercase tracking-[0.3em] text-paper-soft">{copy.joinLabel}</span>
          </span>
        </Link>
      </div>
    </section>
  );
}

function ModelsRail() {
  const { content } = useSiteContent();
  const copy = content.home.models;
  const [people, setPeople] = useState<ModelPublicDto[]>([]);

  useEffect(() => {
    api.models({ limit: 12 }).then((d) => setPeople(d.items)).catch(() => setPeople([]));
  }, []);

  if (people.length === 0) return null;

  return (
    <section className="bg-noir pb-20 md:pb-24">
      <div className="flex items-end justify-between px-5 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">{copy.kicker}</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
            {copy.title}
          </h2>
        </div>
        <Link to="/models" className="hidden font-condensed text-[12px] uppercase tracking-[0.25em] text-noir-soft transition-colors hover:text-terra md:block">
          {copy.linkLabel}
        </Link>
      </div>
      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1">
        {people.map((model) => (
          <Link
            key={model.handle}
            to={`/m/${model.handle}`}
            className="strip-cell group relative w-[58vw] shrink-0 snap-start overflow-hidden sm:w-[36vw] lg:w-[22vw]"
          >
            <img src={model.avatarUrl ?? '/images/avatars/portrait-botswana.jpg'} alt={model.name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
            <div className="strip-meta absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/90 to-transparent p-5 pt-12">
              <p className="font-condensed text-xl font-medium uppercase tracking-[0.15em] text-paper">
                {model.name}
              </p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-terra">
                @{model.handle} · {model.photosCount} approved
              </p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-6 px-5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-noir-soft md:px-10">
        {copy.note}
      </p>
    </section>
  );
}

/* ---------------- image-topped pricing cards ---------------- */

function NoirPricing({ photos }: { photos: PhotoDto[] }) {
  const { format } = useCurrency();
  const { content } = useSiteContent();
  const [pack, setPack] = useState<import('@vuekumi/shared').PublicPlansDto | null>(null);
  useEffect(() => {
    api.publicPlans().then(setPack).catch(() => setPack({ items: [], home: { kicker: 'studio rates', title: 'Pick a licence' } }));
  }, []);
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
    <section className="bg-noir px-5 pb-24 pt-4 md:px-10">
      <p className="font-script text-3xl text-terra">{pack.home.kicker}</p>
      <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
        {pack.home.title}
      </h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.name} delay={i * 90}>
            <div className="group overflow-hidden border border-noir bg-noir-soft transition-colors hover:border-terra/60">
              <div className="relative aspect-[16/9] overflow-hidden">
                {p.photo ? (
                <img
                  src={p.photo.src} alt=""
                  loading="lazy"
                  className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                />
                ) : (
                  <div className="h-full w-full bg-noir" />
                )}
                <span className="absolute left-4 top-4 bg-noir/70 px-3 py-1 font-condensed text-[11px] uppercase tracking-[0.3em] text-paper backdrop-blur-sm">
                  {p.name}
                </span>
              </div>
              <div className="p-7">
                <p className="font-condensed text-5xl font-light text-paper">
                  {p.price}
                  {p.per && <span className="text-base text-noir-soft">{p.per}</span>}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {p.feats.map((f) => (
                    <li key={f} className="font-serif-display text-sm italic text-noir-soft">{f}</li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="mt-7 block border border-paper/30 py-3 text-center font-condensed text-[11px] uppercase tracking-[0.3em] text-paper transition-colors hover:border-terra hover:bg-terra"
                >
                  {content.home.pricingCta}
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- footer + back-to-top ---------------- */

function NoirFooter() {
  const { content } = useSiteContent();
  const name = content.brand.name;
  const mark = content.brand.accent;
  const highlight = mark && name.endsWith(mark) ? name.slice(0, name.length - mark.length) : name;
  return (
    <footer className="border-t border-noir bg-noir px-6 py-16 text-center">
      <Link to="/" className="font-condensed text-3xl font-semibold uppercase tracking-[0.3em] text-paper">
        {highlight}{mark && name.endsWith(mark) ? <span className="text-terra">{mark}</span> : null}
      </Link>
      <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-noir-soft">
        {content.footer.blurb}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {sortMenuLinks(content.footer.links).map((s) => (
          <Link key={`${s.to}-${s.label}`} to={s.to} className="font-condensed text-[13px] font-light uppercase tracking-[0.3em] text-paper-soft transition-colors hover:text-terra">
            {s.label}
          </Link>
        ))}
      </div>
      <p className="mt-10 font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
        {content.footer.copyright}
      </p>
    </footer>
  );
}

function BackToTop() {
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

export default function Home() {
  const [home, setHome] = useState<HomePageDto | null>(null);

  useEffect(() => {
    api.home().then(setHome).catch(() => setHome(null));
  }, []);

  const stats = home?.stats ?? null;
  const featured = home?.featured;

  return (
    <div className="min-h-screen bg-noir font-sans text-paper antialiased">
      <NoirHeader />
      <HeroSlider photos={featured?.hero ?? []} stats={stats} />
      <Marquee categories={stats ? stats.categories.map((c) => c.value) : []} />
      <FeaturedStrip photos={featured?.edge ?? []} frame={featured?.frame ?? DEFAULT_FEATURED_FRAME} />
      <IconRow />
      <CategoryBanners banners={featured?.categories ?? []} />
      <CtaBand />
      <InfiniteFeed />
      <EditorialSplit photos={featured?.editorial ?? []} stats={stats} />
      <StatsBand categories={stats?.categories ?? []} background={featured?.statsBackground ?? null} />
      <ContributorsRail />
      <ModelsRail />
      <NoirPricing photos={featured?.pricing ?? []} />
      <NoirFooter />
      <BackToTop />
    </div>
  );
}
