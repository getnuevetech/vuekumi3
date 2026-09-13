import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Reveal } from '../components/shared';
import { fmt, money, photoById, photographerOf, photographers, photos, type Photo } from '../data/content';

/* ============================================================
   NOIR — a dark, edge-to-edge, endlessly scrolling variant.
   Sections deliberately use different arrangements:
   hero slider → marquee → icon row → hover strip → CTA band →
   infinite masonry feed → rotated editorial split → ring stats
   → contributor rail → image-topped pricing → centered footer
   ============================================================ */

const pick = (id: string): Photo => photoById(id) ?? photos[0];

/* ---------------- header ---------------- */

function NoirHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Library', to: '#feed' },
    { label: 'License & Pricing', to: '/pricing' },
    { label: 'Contributor', to: '/contributor' },
    { label: 'Admin', to: '/admin' },
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
            <Link
              to="/login"
              className="font-condensed text-[13px] font-light uppercase tracking-[0.22em] text-paper-soft transition-colors hover:text-terra"
            >
              Log in
            </Link>
            <Link
              to="/login"
              className="border border-paper/70 px-5 py-2 font-condensed text-[12px] uppercase tracking-[0.22em] text-paper transition-colors hover:border-terra hover:bg-terra"
            >
              Sell your photos
            </Link>
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
          <Link to="/login" onClick={() => setOpen(false)} className="mt-4 border border-terra px-8 py-3 font-condensed text-sm uppercase tracking-[0.25em] text-terra">
            Sell your photos
          </Link>
        </div>
      )}
    </>
  );
}

/* ---------------- full-screen hero slider ---------------- */

const heroSlides = [
  {
    photo: pick('afr-020'),
    script: 'the real',
    title: 'AFRICA',
    sub: 'Unfiltered light, colour and story — shot by the people who live it.',
    tag: 'Baobab Reflection — Madagascar',
  },
  {
    photo: pick('afr-009'),
    script: 'in every',
    title: 'FRAME',
    sub: '212,400 authentic images from all 54 countries. Free and premium.',
    tag: 'Festival Dancers — Senegal',
  },
  {
    photo: pick('afr-026'),
    script: 'your next',
    title: 'STORY',
    sub: 'License instantly. Photographers keep their copyright — and earn 50%.',
    tag: 'Nairobi Electric — Kenya',
  },
];

function HeroSlider() {
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((i: number) => {
    setActive(((i % heroSlides.length) + heroSlides.length) % heroSlides.length);
  }, []);

  useEffect(() => {
    timer.current = setInterval(() => setActive((a) => (a + 1) % heroSlides.length), 5200);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const slide = heroSlides[active];

  return (
    <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-noir">
      {heroSlides.map((s, i) => (
        <div key={s.title} className={`noir-slide absolute inset-0 ${i === active ? 'is-active' : ''}`}>
          <img src={s.photo.src} alt={s.photo.title} className="h-full w-full object-cover" />
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
          {String(active + 1).padStart(2, '0')} / {String(heroSlides.length).padStart(2, '0')} — {slide.tag}
        </p>
        <div className="flex gap-1.5">
          {heroSlides.map((_, i) => (
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

function Marquee() {
  const items = ['Portraits', 'Wildlife', 'Landscape', 'Urban', 'Culture', 'Food & Craft', 'Coast', 'Fashion', 'Architecture'];
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-noir bg-noir py-4">
      <div className="marquee-track items-center gap-10">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="font-condensed text-xl font-light uppercase tracking-[0.3em] text-paper-soft">{t}</span>
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
      title: 'Curated weekly',
      text: 'Every submission passes a human review for craft, metadata and rights before it goes live.',
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

function EdgeStrip() {
  const ids = ['afr-001', 'afr-012', 'afr-011', 'afr-008'];
  return (
    <section className="grid grid-cols-2 bg-noir lg:grid-cols-4">
      {ids.map((id, i) => {
        const p = pick(id);
        const ph = photographerOf(p.photographer);
        return (
          <Link
            key={id}
            to={`/photo/${p.id}`}
            className="strip-cell group relative block aspect-[3/4] overflow-hidden"
          >
            <img src={p.src} alt={p.title} loading={i > 1 ? 'lazy' : undefined} className="h-full w-full object-cover" />
            <div className="strip-meta absolute inset-x-0 bottom-0 p-5">
              <p className="font-condensed text-lg font-medium uppercase tracking-[0.18em] text-paper">{p.title}</p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">
                {p.category} — {ph.name}
              </p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

/* ---------------- black CTA band ---------------- */

function CtaBand() {
  return (
    <section className="border-y border-noir bg-noir-soft">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center md:px-10">
        <h2 className="font-condensed max-w-2xl text-2xl font-light uppercase leading-snug tracking-[0.12em] text-paper md:text-3xl">
          Your work deserves an audience of the whole world — <span className="text-terra">and a fair cut of it.</span>
        </h2>
        <Link
          to="/contributor"
          className="shrink-0 bg-paper px-8 py-3.5 font-condensed text-[12px] uppercase tracking-[0.25em] text-noir transition-colors hover:bg-terra hover:text-paper"
        >
          Open contributor portal
        </Link>
      </div>
    </section>
  );
}

/* ---------------- endless masonry feed ---------------- */

const BATCH = 8;

function FeedCard({ photo }: { photo: Photo }) {
  const ph = photographerOf(photo.photographer);
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
              {ph.name} — {photo.country}
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
  const [batches, setBatches] = useState(3);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          setLoading(true);
          // simulated fetch delay — replace with real pagination API
          setTimeout(() => {
            setBatches((b) => b + 1);
            setLoading(false);
          }, 450);
        }
      },
      { rootMargin: '900px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading]);

  const feed = Array.from({ length: batches * BATCH }, (_, i) => photos[i % photos.length]);

  return (
    <section id="feed" className="bg-noir">
      <div className="flex items-end justify-between px-5 pb-6 pt-16 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">the library</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-6xl">
            Endless<span className="text-outline-paper"> Scroll</span>
          </h2>
        </div>
        <p className="hidden font-mono-tech text-[10px] uppercase tracking-[0.2em] text-noir-soft md:block">
          {feed.length} images loaded — keep scrolling
        </p>
      </div>

      <div className="columns-2 gap-1 px-1 md:columns-3 xl:columns-4">
        {feed.map((p, i) => (
          <FeedCard key={`${p.id}-${i}`} photo={p} />
        ))}
      </div>

      <div ref={sentinel} className="flex items-center justify-center gap-3 py-10">
        <span className="feed-pulse h-1.5 w-1.5 rounded-full bg-terra" />
        <span className="feed-pulse h-1.5 w-1.5 rounded-full bg-terra" style={{ animationDelay: '0.15s' }} />
        <span className="feed-pulse h-1.5 w-1.5 rounded-full bg-terra" style={{ animationDelay: '0.3s' }} />
        <span className="ml-2 font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
          Loading more from the continent
        </span>
      </div>
    </section>
  );
}

/* ---------------- editorial split with vertical text ---------------- */

function EditorialSplit() {
  const a = pick('afr-006');
  const b = pick('afr-007');
  return (
    <section className="relative flex flex-col bg-noir lg:flex-row">
      {/* vertical rail */}
      <div className="hidden w-16 shrink-0 items-center justify-center border-r border-noir lg:flex">
        <span className="v-text font-condensed text-sm font-light uppercase tracking-[0.4em] text-noir-soft">
          Shot by the continent — Est. 2026
        </span>
      </div>
      <div className="relative flex-1">
        <img src={a.src} alt={a.title} loading="lazy" className="h-72 w-full object-cover md:h-[520px]" />
        <p className="absolute bottom-4 left-4 bg-noir/70 px-3 py-1.5 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper backdrop-blur-sm">
          {a.title} — {a.country}
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-14 md:px-14">
        <p className="font-script text-4xl text-terra">our promise</p>
        <h2 className="font-condensed mt-2 text-4xl font-semibold uppercase leading-[1.02] tracking-[0.05em] text-paper md:text-5xl">
          Every image pays its maker
        </h2>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-noir-soft">
          Vuekumi is built backwards from the contributor: 50% royalty on premium licences,
          a subscription-funded pool for free downloads, and payouts over bank transfer,
          M-Pesa or mobile money — monthly, on the first.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-noir pt-6">
          {[
            ['50%', 'royalty on premium'],
            ['48h', 'review turnaround'],
            ['54', 'countries covered'],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-condensed text-3xl font-medium text-terra">{v}</p>
              <p className="mt-1 font-mono-tech text-[9px] uppercase tracking-[0.15em] text-noir-faint">{l}</p>
            </div>
          ))}
        </div>
        <Link
          to="/contributor/upload"
          className="mt-8 w-fit border border-terra px-7 py-3 font-condensed text-[12px] uppercase tracking-[0.25em] text-terra transition-colors hover:bg-terra hover:text-paper"
        >
          Start uploading
        </Link>
      </div>
      <div className="relative flex-1">
        <img src={b.src} alt={b.title} loading="lazy" className="h-72 w-full object-cover md:h-[520px] lg:h-full" />
        <p className="absolute bottom-4 right-4 bg-noir/70 px-3 py-1.5 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper backdrop-blur-sm">
          {b.title} — {b.country}
        </p>
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

function StatsBand() {
  const bg = pick('afr-008');
  return (
    <section className="relative overflow-hidden">
      <img src={bg.src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-noir/80" />
      <div className="relative px-6 py-20 md:py-28">
        <Reveal>
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-10 md:grid-cols-4">
            <Ring value={92} label="People" />
            <Ring value={74} label="Wildlife" />
            <Ring value={61} label="Landscape" />
            <Ring value={85} label="Culture" />
          </div>
        </Reveal>
        <p className="mt-12 text-center font-mono-tech text-[10px] uppercase tracking-[0.25em] text-paper-soft">
          Share of library by genre — Avenue of the Baobabs, Madagascar
        </p>
      </div>
    </section>
  );
}

/* ---------------- contributors rail ---------------- */

function ContributorsRail() {
  return (
    <section className="bg-noir py-20 md:py-24">
      <div className="flex items-end justify-between px-5 md:px-10">
        <div>
          <p className="font-script text-3xl text-terra">the makers</p>
          <h2 className="font-condensed mt-1 text-4xl font-semibold uppercase tracking-[0.06em] text-paper md:text-5xl">
            Contributors
          </h2>
        </div>
        <Link to="/contributor" className="hidden font-condensed text-[12px] uppercase tracking-[0.25em] text-noir-soft transition-colors hover:text-terra md:block">
          View all →
        </Link>
      </div>
      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1">
        {photographers.map((ph) => (
          <Link
            key={ph.handle}
            to="/contributor"
            className="strip-cell group relative w-[70vw] shrink-0 snap-start overflow-hidden sm:w-[44vw] lg:w-[30vw]"
          >
            <img src={ph.avatar} alt={ph.name} loading="lazy" className="aspect-[4/5] w-full object-cover" />
            <div className="strip-meta absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/90 to-transparent p-5 pt-12">
              <p className="font-condensed text-xl font-medium uppercase tracking-[0.15em] text-paper">
                {ph.name} <span className="mx-1 text-terra">—</span> <span className="text-sm font-light text-paper-soft">{ph.location}</span>
              </p>
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-terra">
                {fmt(ph.downloads)} downloads · {money(ph.earnings)} earned
              </p>
            </div>
          </Link>
        ))}
        <Link
          to="/login"
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

/* ---------------- image-topped pricing cards ---------------- */

function NoirPricing() {
  const plans = [
    {
      photo: pick('afr-014'), name: 'Superior', price: 'Free',
      feats: ['Full free collection', 'Standard licence', '50 downloads / day'],
    },
    {
      photo: pick('afr-013'), name: 'Premium', price: '$19', per: '/mo',
      feats: ['Unlimited premium downloads', 'Commercial, no attribution', 'Photographers earn 50%'],
    },
    {
      photo: pick('afr-024'), name: 'Superpro', price: '$49', per: '/img',
      feats: ['Extended licence', 'Merchandise & resale rights', 'Legal indemnification'],
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
                <img
                  src={p.photo.src} alt=""
                  loading="lazy"
                  className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                />
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
        Afri<span className="text-terra">Stock</span>
      </Link>
      <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-noir-soft">
        The stock image platform for authentic African photography. Free and premium
        images, licensed directly from the continent's photographers.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {['Instagram', 'Behance', 'X / Twitter', 'LinkedIn', 'Pinterest'].map((s) => (
          <a key={s} href="#" className="font-condensed text-[13px] font-light uppercase tracking-[0.3em] text-paper-soft transition-colors hover:text-terra">
            {s}
          </a>
        ))}
      </div>
      <p className="mt-10 font-mono-tech text-[9px] uppercase tracking-[0.25em] text-noir-faint">
        © 2026 Vuekumi — design template · all photography is demo content
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
  return (
    <div className="min-h-screen bg-noir font-sans text-paper antialiased">
      <NoirHeader />
      <HeroSlider />
      <Marquee />
      <IconRow />
      <EdgeStrip />
      <CtaBand />
      <InfiniteFeed />
      <EditorialSplit />
      <StatsBand />
      <ContributorsRail />
      <NoirPricing />
      <NoirFooter />
      <BackToTop />
    </div>
  );
}
