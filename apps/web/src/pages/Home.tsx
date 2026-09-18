import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { HomePageDto, ModelPublicDto, PhotoDto, PhotographerDto, PublicStatsDto } from '@vuekumi/shared';
import { hasModelAccess, isCreatorAccount, isPhotographerAccount, creatorPortalLabel } from '@vuekumi/shared';
import { Reveal, SearchForm } from '../components/shared';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { fmt } from '../lib/format';

const SELL_HREF = '/login?redirect=/contributor/upload&signup=photographer';
const MARQUEE_FALLBACK = ['People', 'Wildlife', 'Landscape', 'Urban', 'Culture', 'Food & Craft', 'Coast', 'Fashion', 'Architecture'];

function contributorPortalHref(accountType?: string) {
  return isCreatorAccount(accountType) ? '/contributor' : SELL_HREF;
}

/* ---------------- header ---------------- */

function NoirHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Library', to: '/search' },
    { label: 'Creators', to: '/creators' },
    { label: 'Models', to: '/models' },
    { label: 'License & Pricing', to: '/pricing' },
    ...(user && user.accountType !== 'model' ? [{ label: 'Favorites', to: '/favorites' }] : []),
    ...(user && user.accountType !== 'model' ? [{ label: 'Following', to: '/following' }] : []),
    ...(user && user.accountType !== 'model' ? [{ label: 'Collections', to: '/collections' }] : []),
    ...(user ? [{ label: 'Account', to: '/account' }] : []),
    ...(user && user.accountType !== 'model' ? [{ label: 'Licences', to: '/licenses' }] : []),
    ...((user?.accountType === 'agency' || user?.agencyId) ? [{ label: 'Agency', to: '/agency' }] : []),
    ...(user && hasModelAccess(user) ? [{ label: 'Model', to: '/model' }] : []),
    ...((isCreatorAccount(user?.accountType)) ? [{ label: creatorPortalLabel(user?.accountType), to: '/contributor' }] : []),
    ...(user?.accountType === 'admin' ? [{ label: 'Admin', to: '/admin' }] : []),
  ];

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-noir bg-noir/85 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 md:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <circle cx="13" cy="13" r="12" stroke="#faf6f3" strokeWidth="1.4" />
              <circle cx="13" cy="13" r="6.5" stroke="#bc773f" strokeWidth="1.4" />
              <circle cx="13" cy="13" r="2" fill="#bc773f" />
              <path d="M13 1v4M13 21v4M1 13h4M21 13h4" stroke="#faf6f3" strokeWidth="1.4" />
            </svg>
            <span className="font-condensed text-lg font-medium uppercase tracking-[0.24em] text-paper">
              Vuekumi
            </span>
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="font-condensed text-[13px] font-light uppercase tracking-[0.22em] text-paper-soft transition-colors hover:text-terra"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <SearchForm dark compact />
            {user ? (
              <>
                <Link
                  to="/account"
                  className="max-w-[160px] truncate font-condensed text-[12px] uppercase tracking-[0.18em] text-paper-soft hover:text-terra"
                >
                  {user.email}
                </Link>
                <button
                  type="button"
                  onClick={() => { void logout().then(() => { window.location.href = '/login' }) }}
                  className="font-condensed text-[13px] font-light uppercase tracking-[0.22em] text-paper-soft transition-colors hover:text-terra"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="font-condensed text-[13px] font-light uppercase tracking-[0.22em] text-paper-soft transition-colors hover:text-terra"
                >
                  Log in
                </Link>
                <Link
                  to={contributorPortalHref()}
                  className="border border-paper/70 px-5 py-2 font-condensed text-[12px] uppercase tracking-[0.22em] text-paper transition-colors hover:border-terra hover:bg-terra"
                >
                  Sell your photos
                </Link>
              </>
            )}
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-label="Menu"
          >
            <span className={`h-px w-6 bg-paper transition-transform ${open ? 'translate-y-[3.5px] rotate-45' : ''}`} />
            <span className={`h-px w-6 bg-paper transition-transform ${open ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
          </button>
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
            Sell your photos
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
  const photosLive = stats?.photosLive ?? 0;
  const countries = stats?.countries ?? 0;
  const copy = [
    {
      script: 'the real',
      title: 'AFRICA',
      sub: 'Unfiltered light, colour and story — shot by the people who live it.',
    },
    {
      script: 'in every',
      title: 'FRAME',
      sub: photosLive > 0
        ? `${photosLive.toLocaleString('en-US')} authentic images from ${countries} ${countries === 1 ? 'country' : 'countries'}. Free and premium.`
        : 'Authentic images from across the continent. Free and premium.',
    },
    {
      script: 'your next',
      title: 'STORY',
      sub: 'License instantly. Photographers keep copyright — and 50% of paid licences.',
    },
  ];
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
          <a
            href="#feed"
            className="bg-paper px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-noir transition-colors hover:bg-terra hover:text-paper"
          >
            Explore the library
          </a>
          <Link
            to="/pricing"
            className="border border-paper/50 px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-paper transition-colors hover:border-terra hover:text-terra"
          >
            License & pricing
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
  const items = categories.length ? categories : MARQUEE_FALLBACK;
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-noir bg-noir py-4">
      <div className="marquee-track items-center gap-10">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <Link
              to={`/search?category=${encodeURIComponent(t)}`}
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

function IconRow() {
  const feats = [
    {
      title: 'Staff featured',
      text: 'Homepage highlights are staff-pinned live stock; empty slots follow ranking. Featuring is not a licence — commercial sales still need cleared rights.',
      icon: (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.8" />
          <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'Copyright protected',
      text: 'Photographers keep 100% of their copyright. Licences are issued per image, on record.',
      icon: (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'Instant licence',
      text: 'Free downloads with attribution, or premium and extended licences bought in one click.',
      icon: (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8M12 8v8" strokeLinecap="round" />
        </svg>
      ),
    },
  ];
  return (
    <section className="bg-noir px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3 md:gap-8">
        {feats.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-noir bg-noir-soft text-terra">
                {f.icon}
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

/* ---------------- edge-to-edge hover strip ---------------- */

function EdgeStrip({ photos }: { photos: PhotoDto[] }) {
  return (
    <section className="grid grid-cols-2 bg-noir lg:grid-cols-4">
      {photos.map((p, i) => (
          <Link
            key={p.id}
            to={`/photo/${p.id}`}
            className="strip-cell group relative block aspect-[3/4] overflow-hidden"
          >
            <img src={p.src} alt={p.title} loading={i > 1 ? 'lazy' : undefined} className="h-full w-full object-cover" />
            <div className="strip-meta absolute inset-x-0 bottom-0 p-5">
              <p className="font-condensed text-lg font-medium uppercase tracking-[0.18em] text-paper">{p.title}</p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">
                {p.category} — {p.photographerName ?? p.photographer}
              </p>
            </div>
          </Link>
      ))}
    </section>
  );
}

/* ---------------- black CTA band ---------------- */

function CtaBand() {
  const { user } = useAuth();
  return (
    <section className="border-y border-noir bg-noir-soft">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center md:px-10">
        <h2 className="font-condensed max-w-2xl text-2xl font-light uppercase leading-snug tracking-[0.12em] text-paper md:text-3xl">
          Your work deserves an audience of the whole world — <span className="text-terra">and a fair cut of it.</span>
        </h2>
        <Link
          to={contributorPortalHref(user?.accountType)}
          className="shrink-0 bg-paper px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-noir transition-colors hover:bg-terra hover:text-paper"
        >
          {isPhotographerAccount(user?.accountType) ? 'Open photographer portal' : user?.accountType === 'photo_influencer' ? 'Open photo influencer portal' : isCreatorAccount(user?.accountType) ? 'Open contributor portal' : 'Become a photographer'}
        </Link>
      </div>
    </section>
  );
}

/* ---------------- endless masonry feed ---------------- */

function FeedCard({ photo }: { photo: PhotoDto }) {
  return (
    <Link to={`/photo/${photo.id}`} className="strip-cell group relative mb-1 block break-inside-avoid overflow-hidden">
      <img src={photo.src} alt={photo.title} loading="lazy" className="w-full" />
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
        <span className="absolute left-3 top-3 bg-terra px-2 py-0.5 font-mono-tech text-[8px] uppercase tracking-[0.18em] text-paper">
          Premium
        </span>
      )}
    </Link>
  );
}

function InfiniteFeed() {
  const [items, setItems] = useState<PhotoDto[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await api.photos({ page: nextPage, limit: 12, facets: '0' });
      setItems((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(nextPage);
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && page > 0 && !loadingRef.current) {
          void load(page + 1);
        }
      },
      { rootMargin: '900px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, load]);

  return (
    <section id="feed" className="bg-noir">
      <div className="flex items-end justify-between px-5 pb-6 pt-16 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">the library</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-6xl">
            Endless<span className="text-outline-paper"> Scroll</span>
          </h2>
        </div>
        <Link to="/search" className="hidden font-mono-tech text-[10px] uppercase tracking-[0.2em] text-noir-soft hover:text-terra md:block">
          {total ? `${fmt(total)} images` : 'Browse'} — search the catalog →
        </Link>
      </div>

      <div className="columns-2 gap-1 px-1 md:columns-3 xl:columns-4">
        {items.map((p) => (
          <FeedCard key={p.id} photo={p} />
        ))}
      </div>

      <div ref={sentinel} className="flex items-center justify-center gap-3 py-10">
        {hasMore || loading ? (
          <>
            <span className="feed-pulse h-1.5 w-1.5 rounded-full bg-terra" />
            <span className="feed-pulse h-1.5 w-1.5 rounded-full bg-terra" style={{ animationDelay: '0.15s' }} />
            <span className="feed-pulse h-1.5 w-1.5 rounded-full bg-terra" style={{ animationDelay: '0.3s' }} />
            <span className="ml-2 font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
              Loading more from the continent
            </span>
          </>
        ) : (
          <span className="font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
            That is the live library — {fmt(total)} photographs
          </span>
        )}
      </div>
    </section>
  );
}

/* ---------------- editorial split with vertical text ---------------- */

function EditorialSplit({ photos, stats }: { photos: PhotoDto[]; stats: PublicStatsDto | null }) {
  const { user } = useAuth();
  const a = photos[0];
  const b = photos[1] ?? photos[0];
  const uploadHref = isCreatorAccount(user?.accountType)
    ? '/contributor/upload'
    : SELL_HREF;
  return (
    <section className="relative flex flex-col bg-noir lg:flex-row">
      <div className="hidden w-16 shrink-0 items-center justify-center border-r border-noir lg:flex">
        <span className="v-text font-condensed text-sm font-light uppercase tracking-[0.4em] text-noir-soft">
          Shot by the continent — Est. 2026
        </span>
      </div>
      <div className="relative flex-1">
        {a ? <img src={a.src} alt={a.title} loading="lazy" className="h-72 w-full object-cover md:h-[520px]" /> : <div className="h-72 bg-noir-soft md:h-[520px]" />}
        {a && (
          <p className="absolute bottom-4 left-4 bg-noir/70 px-3 py-1.5 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper backdrop-blur-sm">
            {a.title} — {a.country}
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-14 md:px-14">
        <p className="font-script text-4xl text-terra">our promise</p>
        <h2 className="font-condensed mt-2 text-4xl font-semibold uppercase leading-[1.02] tracking-[0.05em] text-paper md:text-5xl">
          Paid licences pay their maker
        </h2>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-noir-soft">
          Vuekumi is built backwards from the contributor: 50% of every paid licence,
          copyright stays with the photographer, and payouts over bank transfer or mobile
          money when you request them — $10 minimum. Free-collection downloads are a $0 grant.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-noir pt-6">
          {[
            ['50%', 'royalty on premium'],
            [fmt(stats?.photosLive ?? 0), 'photographs live'],
            [String(stats?.countries ?? 0), 'countries in the library'],
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
          Start uploading
        </Link>
      </div>
      <div className="relative flex-1">
        {b ? <img src={b.src} alt={b.title} loading="lazy" className="h-72 w-full object-cover md:h-[520px] lg:h-full" /> : <div className="h-72 bg-noir-soft md:h-[520px]" />}
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
          Share of the live library by genre{background ? ` — ${background.title}, ${background.country}` : ''}
        </p>
      </div>
    </section>
  );
}

/* ---------------- contributors rail ---------------- */

function ContributorsRail() {
  const [makers, setMakers] = useState<PhotographerDto[]>([]);

  useEffect(() => {
    api.photographers({ limit: 20 }).then((d) => setMakers(d.items)).catch(() => setMakers([]));
  }, []);

  return (
    <section className="bg-noir py-20 md:py-24">
      <div className="flex items-end justify-between px-5 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">the makers</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
            Contributors
          </h2>
        </div>
        <Link to="/creators" className="hidden font-condensed text-[12px] uppercase tracking-[0.25em] text-noir-soft transition-colors hover:text-terra md:block">
          Browse creators →
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
            <span className="font-script block text-4xl text-terra">you?</span>
            <span className="font-condensed mt-2 block text-sm uppercase tracking-[0.3em] text-paper-soft">Become a contributor</span>
          </span>
        </Link>
      </div>
    </section>
  );
}

function ModelsRail() {
  const [people, setPeople] = useState<ModelPublicDto[]>([]);

  useEffect(() => {
    api.models({ limit: 12 }).then((d) => setPeople(d.items)).catch(() => setPeople([]));
  }, []);

  if (people.length === 0) return null;

  return (
    <section className="bg-noir pb-20 md:pb-24">
      <div className="flex items-end justify-between px-5 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">the people</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
            In the photographs
          </h2>
        </div>
        <Link to="/models" className="hidden font-condensed text-[12px] uppercase tracking-[0.25em] text-noir-soft transition-colors hover:text-terra md:block">
          Browse models →
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
        Likeness permission — copyright stays with the photographer
      </p>
    </section>
  );
}

/* ---------------- image-topped pricing cards ---------------- */

function NoirPricing({ photos }: { photos: PhotoDto[] }) {
  const plans = [
    {
      photo: photos[0], name: 'Free', price: 'Free',
      feats: ['Full free collection', 'Standard licence', '50 RF downloads / day'],
    },
    {
      photo: photos[1] ?? photos[0], name: 'Vuekumi+', price: '$19', per: '/30d',
      feats: ['Unlimited free-collection RF', 'Premium still billed per image', 'Buyer quota — not a contributor pool'],
    },
    {
      photo: photos[2] ?? photos[0], name: 'Extended', price: '$49', per: '/img',
      feats: ['Extended licence', 'Merchandise & resale rights', 'Usage permission only'],
    },
  ];
  return (
    <section className="bg-noir px-5 pb-24 pt-4 md:px-10">
      <p className="font-script text-3xl text-terra">studio rates</p>
      <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
        Pick a licence
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
                  View more
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
  return (
    <footer className="border-t border-noir bg-noir px-6 py-16 text-center">
      <Link to="/" className="font-condensed text-3xl font-semibold uppercase tracking-[0.3em] text-paper">
        Vue<span className="text-terra">kumi</span>
      </Link>
      <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-noir-soft">
        The stock image platform for authentic African photography. Free and premium
        images, licensed directly from the continent's photographers.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {[
          { label: 'Library', href: '/search' },
          { label: 'Creators', href: '/creators' },
          { label: 'Models', href: '/models' },
          { label: 'License & Pricing', href: '/pricing' },
          { label: 'DMCA', href: '/dmca' },
          { label: 'Legal', href: '/legal' },
          { label: 'Contribute', href: SELL_HREF },
          { label: 'Account', href: '/account' },
        ].map((s) => (
          <Link key={s.label} to={s.href} className="font-condensed text-[13px] font-light uppercase tracking-[0.3em] text-paper-soft transition-colors hover:text-terra">
            {s.label}
          </Link>
        ))}
      </div>
      <p className="mt-10 font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
        © 2026 Vuekumi — usage permission, never ownership
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
      <Marquee categories={stats ? stats.categories.map((c) => c.value) : MARQUEE_FALLBACK} />
      <IconRow />
      <EdgeStrip photos={featured?.edge ?? []} />
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
