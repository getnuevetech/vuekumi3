import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { hasModelAccess, type PhotoDto } from '@vuekumi/shared'
import { fmt, type Photo } from '../data/content'
import { api, ApiError, type GeoCountry } from '../api/client'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'

/* ---------------- Reveal on scroll ---------------- */

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setVisible(true), io.disconnect()),
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function CurrencySelect() {
  const { quote, setCountry } = useCurrency()
  const [countries, setCountries] = useState<GeoCountry[]>([])
  useEffect(() => {
    api.countries().then((d) => setCountries(d.countries)).catch(() => undefined)
  }, [])
  return (
    <select
      aria-label="Display currency"
      value={quote.countryCode ?? 'US'}
      onChange={(e) => setCountry(e.target.value)}
      className="max-w-[140px] border border-sand bg-transparent px-2 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft outline-none"
    >
      {countries.map((c) => (
        <option key={c.code} value={c.code}>{c.code} · {c.currency}</option>
      ))}
    </select>
  )
}

/* ---------------- Logo ---------------- */

export function LogoMark({ dark = false, accent = '#bc773f' }: { dark?: boolean; accent?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="13" cy="13" r="12" stroke={dark ? '#faf6f3' : '#3c3835'} strokeWidth="1.4" />
        <circle cx="13" cy="13" r="6.5" stroke={accent} strokeWidth="1.4" />
        <circle cx="13" cy="13" r="2" fill={accent} />
        <path d="M13 1v4M13 21v4M1 13h4M21 13h4" stroke={dark ? '#faf6f3' : '#3c3835'} strokeWidth="1.4" />
      </svg>
      <span className={`font-serif-display text-xl tracking-tight ${dark ? 'text-paper' : 'text-ink'}`}>
        Vuekumi
      </span>
    </Link>
  )
}

/* ---------------- Public search ---------------- */

export function SearchForm({
  dark = false,
  defaultQuery = '',
  compact = false,
}: {
  dark?: boolean
  defaultQuery?: string
  compact?: boolean
}) {
  const reactId = useId()
  const [q, setQ] = useState(defaultQuery)
  const navigate = useNavigate()
  const inputId = dark ? `noir-search-${reactId}` : `site-search-${reactId}`

  useEffect(() => {
    setQ(defaultQuery)
  }, [defaultQuery])

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = q.trim()
    navigate(next ? `/search?q=${encodeURIComponent(next)}` : '/search')
  }

  return (
    <form onSubmit={submit} className={compact ? 'w-44 xl:w-56' : 'w-full max-w-md'}>
      <label className="sr-only" htmlFor={inputId}>Search the library</label>
      <input
        id={inputId}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Africa…"
        className={`w-full px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] outline-none ${
          dark
            ? 'border border-paper/30 bg-transparent text-paper placeholder:text-paper-soft/70 focus:border-terra'
            : 'border border-sand bg-transparent text-ink placeholder:text-ink-faint focus:border-terra'
        }`}
      />
    </form>
  )
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b border-sand-soft bg-paper/90 backdrop-blur-md' : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <LogoMark />
          <nav className="hidden items-center gap-7 font-mono-tech text-[11px] uppercase tracking-[0.16em] text-ink-soft lg:flex">
            <Link to="/search" className="link-slide hover:text-terra">Library</Link>
            <Link to="/creators" className="link-slide hover:text-terra">Creators</Link>
            <Link to="/models" className="link-slide hover:text-terra">Models</Link>
            <Link to="/pricing" className="link-slide hover:text-terra">License & Pricing</Link>
            {user && <Link to="/bookings" className="link-slide hover:text-terra">Bookings</Link>}
            {user && user.accountType !== 'model' && <Link to="/campaigns" className="link-slide hover:text-terra">Campaigns</Link>}
            {user && user.accountType !== 'model' && <Link to="/favorites" className="link-slide hover:text-terra">Favorites</Link>}
            {user && user.accountType !== 'model' && <Link to="/following" className="link-slide hover:text-terra">Following</Link>}
            {user && user.accountType !== 'model' && <Link to="/collections" className="link-slide hover:text-terra">Collections</Link>}
            {user && user.accountType !== 'model' && <Link to="/licenses" className="link-slide hover:text-terra">Licences</Link>}
            {(user?.accountType === 'agency' || user?.agencyId) && (
              <Link to="/agency" className="link-slide hover:text-terra">Agency</Link>
            )}
            {user && hasModelAccess(user) && (
              <Link to="/model" className="link-slide hover:text-terra">Model</Link>
            )}
            <Link to="/contributor" className="link-slide hover:text-terra">Contributor</Link>
            <Link to="/admin" className="link-slide hover:text-terra">Admin</Link>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <SearchForm compact defaultQuery="" />
            <CurrencySelect />
            {user ? (
              <>
                <Link
                  to="/account"
                  className="max-w-[140px] truncate font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-terra"
                >
                  {user.email}
                </Link>
                <button
                  type="button"
                  onClick={() => { void logout().then(() => { window.location.href = '/login' }) }}
                  className="font-mono-tech text-[11px] uppercase tracking-[0.16em] text-ink transition-colors hover:text-terra"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="font-mono-tech text-[11px] uppercase tracking-[0.16em] text-ink transition-colors hover:text-terra"
                >
                  Log in
                </Link>
                <Link
                  to="/login"
                  className="bg-ink px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-terra"
                >
                  Become a contributor
                </Link>
              </>
            )}
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 border border-sand lg:hidden"
            aria-label="Toggle menu"
          >
            <span className={`block h-px w-5 bg-ink transition-transform ${open ? 'translate-y-[3.5px] rotate-45' : ''}`} />
            <span className={`block h-px w-5 bg-ink transition-transform ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
          </button>
        </div>
      </header>
      <div
        className={`fixed inset-0 z-40 bg-paper/98 backdrop-blur transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col justify-center gap-1 px-8">
          {[
            { label: 'Library', href: '/search' },
            { label: 'Creators', href: '/creators' },
            { label: 'Models', href: '/models' },
            { label: 'License & Pricing', href: '/pricing' },
            ...(user ? [{ label: 'Bookings', href: '/bookings' }] : []),
            ...(user && user.accountType !== 'model' ? [{ label: 'Campaigns', href: '/campaigns' }] : []),
            ...(user && user.accountType !== 'model' ? [{ label: 'Favorites', href: '/favorites' }] : []),
            ...(user && user.accountType !== 'model' ? [{ label: 'Following', href: '/following' }] : []),
            ...(user && user.accountType !== 'model' ? [{ label: 'Collections', href: '/collections' }] : []),
            ...(user ? [{ label: 'Account', href: '/account' }] : []),
            ...(user && hasModelAccess(user) ? [{ label: 'Model portal', href: '/model' }] : []),
            { label: 'Contributor Portal', href: '/contributor' },
            { label: 'Admin Portal', href: '/admin' },
            { label: 'Log in', href: '/login' },
          ].map((item, i) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="group flex items-baseline gap-4 border-b border-sand-soft py-4"
            >
              <span className="font-mono-tech text-[10px] text-terra">0{i + 1}</span>
              <span className="font-serif-display text-3xl tracking-tight text-ink transition-colors group-hover:text-terra">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---------------- Lazy image with blur-up ---------------- */

export function BlurImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`img-blur ${loaded ? 'is-loaded' : ''} ${className}`}
    />
  )
}

/* ---------------- Photo card (masonry cell) ---------------- */

type CardPhoto = Pick<Photo, 'id' | 'src' | 'title' | 'country' | 'license' | 'price' | 'downloads'> & {
  likes?: number
  favorited?: boolean
  photographer?: string
  photographerName?: string
}

export function PhotoCard({
  photo,
  photographer,
}: {
  photo: CardPhoto | PhotoDto
  photographer?: { name: string }
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [liked, setLiked] = useState(Boolean(photo.favorited))
  const [busy, setBusy] = useState(false)
  const name = photographer?.name ?? ('photographerName' in photo ? photo.photographerName : undefined) ?? photo.photographer

  useEffect(() => {
    setLiked(Boolean(photo.favorited))
  }, [photo.favorited, photo.id])

  async function toggle(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      navigate(`/login?redirect=/photo/${photo.id}`)
      return
    }
    if (busy) return
    setBusy(true)
    const previous = liked
    setLiked(!previous)
    try {
      const result = await api.toggleFavorite(photo.id)
      setLiked(result.favorited)
    } catch (err) {
      setLiked(previous)
      toast.error(err instanceof ApiError ? err.message : 'Could not save favourite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Link to={`/photo/${photo.id}`} className="group relative block overflow-hidden bg-cream">
      <BlurImage
        src={photo.src}
        alt={photo.title}
        className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      {/* hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/30 via-transparent to-black/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="flex items-start justify-between p-3">
          {photo.license === 'premium' ? (
            <span className="bg-terra px-2 py-1 font-mono-tech text-[9px] uppercase tracking-[0.14em] text-paper">
              Premium · ${photo.price}
            </span>
          ) : (
            <span className="bg-paper/90 px-2 py-1 font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink">
              Free
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { void toggle(e) }}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center bg-paper/90 transition-colors hover:bg-terra hover:text-paper"
            aria-label={liked ? 'Remove from favorites' : 'Save to favorites'}
            aria-pressed={liked}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? '#bc773f' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
        <div className="flex items-end justify-between p-3">
          <div>
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-white/95">{photo.title}</p>
            <p className="mt-0.5 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-white/60">
              {name} — {photo.country}
            </p>
          </div>
          <span className="font-mono-tech text-[9px] text-white/70">{fmt(photo.downloads)}↓</span>
        </div>
      </div>
    </Link>
  )
}

export function PhotoMasonry({ photos }: { photos: PhotoDto[] }) {
  return (
    <div className="masonry mt-8">
      {photos.map((p) => (
        <PhotoCard key={p.id} photo={p} photographer={{ name: p.photographerName ?? p.photographer }} />
      ))}
    </div>
  )
}

/* ---------------- Stat card ---------------- */

export function StatCard({
  label,
  value,
  sub,
  dark = false,
}: {
  label: string
  value: string
  sub?: string
  dark?: boolean
}) {
  return (
    <div className={`border p-5 ${dark ? 'border-paper/15 bg-ink-deep text-paper' : 'border-sand bg-white'}`}>
      <p className={`font-mono-tech text-[10px] uppercase tracking-[0.18em] ${dark ? 'text-paper-soft' : 'text-ink-soft'}`}>
        {label}
      </p>
      <p className="mt-2 font-serif-display text-3xl tracking-tight">{value}</p>
      {sub && <p className={`mt-1 font-mono-tech text-[10px] ${dark ? 'text-paper-faint' : 'text-ink-faint'}`}>{sub}</p>}
    </div>
  )
}

/* ---------------- Portal shell (sidebar layout) ---------------- */

export interface PortalLink {
  to?: string
  label: string
  icon: ReactNode
  children?: PortalLink[]
}

function isPortalRootPath(to: string) {
  return to === '/contributor' || to === '/admin' || to === '/agency' || to === '/model'
}

export function portalLinkActive(pathname: string, to: string | undefined): boolean {
  if (!to) return false
  return pathname === to || (!isPortalRootPath(to) && pathname.startsWith(`${to}/`))
}

function portalGroupActive(pathname: string, link: PortalLink): boolean {
  if (portalLinkActive(pathname, link.to)) return true
  return (link.children ?? []).some((child) => portalGroupActive(pathname, child))
}

export function flattenPortalLeaves(links: PortalLink[]): PortalLink[] {
  return links.flatMap((link) => {
    if (link.children?.length) return flattenPortalLeaves(link.children)
    return link.to ? [link] : []
  })
}

function leafKey(link: PortalLink, fallback: string) {
  return link.to ?? fallback
}

function NavLeaf({
  link,
  pathname,
  index,
  nested = false,
}: {
  link: PortalLink
  pathname: string
  index?: number
  nested?: boolean
}) {
  const to = link.to
  if (!to) return null
  const active = portalLinkActive(pathname, to)
  return (
    <Link
      to={to}
      className={`flex shrink-0 items-center gap-3 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.14em] transition-colors ${
        nested ? 'pl-10 pr-3' : 'px-3'
      } ${active ? 'bg-terra text-paper' : 'text-paper-soft hover:bg-paper/5 hover:text-paper'}`}
    >
      {!nested && index != null && (
        <span className="text-[9px] opacity-60">{String(index + 1).padStart(2, '0')}</span>
      )}
      {link.icon}
      {link.label}
    </Link>
  )
}

function NavGroup({
  link,
  pathname,
  index,
  open,
  onToggle,
}: {
  link: PortalLink
  pathname: string
  index: number
  open: boolean
  onToggle: () => void
}) {
  const children = link.children ?? []
  const groupActive = portalGroupActive(pathname, link)
  return (
    <div className="hidden lg:block">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left font-mono-tech text-[11px] uppercase tracking-[0.14em] transition-colors ${
          groupActive ? 'text-paper' : 'text-paper-soft hover:bg-paper/5 hover:text-paper'
        }`}
      >
        <span className="text-[9px] opacity-60">{String(index + 1).padStart(2, '0')}</span>
        {link.icon}
        <span className="flex-1">{link.label}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 shrink-0 opacity-60 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mb-1 border-l border-paper/10 ml-5">
          {children.map((child) => (
            <NavLeaf
              key={leafKey(child, `${link.label}-${child.label}`)}
              link={child}
              pathname={pathname}
              nested
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PortalShell({
  title,
  subtitle,
  links,
  children,
}: {
  title: string
  subtitle: string
  links: PortalLink[]
  children: ReactNode
}) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const mobileLeaves = flattenPortalLeaves(links)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const open = new Set<string>()
    for (const link of links) {
      if (link.children?.length && (portalGroupActive(pathname, link) || link.children.length === 1)) {
        open.add(link.label)
      }
    }
    return open
  })
  useEffect(() => {
    setExpanded((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const link of links) {
        const auto = Boolean(link.children?.length && (portalGroupActive(pathname, link) || link.children.length === 1))
        if (auto && !next.has(link.label)) {
          next.add(link.label)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [pathname, links])

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      {/* sidebar */}
      <aside className="border-b border-sand bg-ink text-paper lg:fixed lg:inset-y-0 lg:flex lg:w-[260px] lg:flex-col lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-6 lg:py-7">
          <LogoMark dark accent="#d6e6ff" />
          <span className="hidden lg:mt-1.5 lg:block font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper-soft">
            {title}
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-4 no-scrollbar lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:px-3 lg:pb-0 lg:pt-4">
          {mobileLeaves.map((l, i) => (
            <div key={leafKey(l, `m-${i}`)} className="lg:hidden">
              <NavLeaf link={l} pathname={pathname} index={i} />
            </div>
          ))}
          {links.map((l, i) => {
            if (l.children?.length) {
              return (
                <NavGroup
                  key={l.label}
                  link={l}
                  pathname={pathname}
                  index={i}
                  open={expanded.has(l.label)}
                  onToggle={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(l.label)) next.delete(l.label)
                      else next.add(l.label)
                      return next
                    })
                  }}
                />
              )
            }
            return (
              <div key={leafKey(l, `d-${i}`)} className="hidden lg:block">
                <NavLeaf link={l} pathname={pathname} index={i} />
              </div>
            )
          })}
        </nav>
        <div className="hidden border-t border-paper/10 px-6 py-5 lg:block">
          {user && (
            <>
              <Link
                to="/account"
                className="mb-3 block font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper-soft hover:text-terra"
              >
                Account
              </Link>
              <button
                type="button"
                onClick={() => { void logout().then(() => { window.location.href = '/login' }) }}
                className="mb-3 block font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper-soft hover:text-terra"
              >
                Log out · {user.accountType}{user.hasModelProfile && user.accountType !== 'model' ? ' · model' : ''}
              </button>
            </>
          )}
          <Link to="/" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper-soft transition-colors hover:text-terra">
            ← Back to marketplace
          </Link>
          <p className="mt-4 font-mono-tech text-[9px] leading-relaxed tracking-[0.12em] text-paper-faint">
            {subtitle}
          </p>
        </div>
      </aside>
      {/* content */}
      <main className="lg:col-start-2 lg:min-h-screen">
        <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-8 md:py-12">{children}</div>
      </main>
    </div>
  )
}

/* ---------------- small atoms ---------------- */

export function SectionHead({
  kicker,
  title,
  right,
}: {
  kicker: string
  title: string
  right?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-terra">{kicker}</p>
        <h2 className="mt-2 font-serif-display text-3xl tracking-tight text-ink md:text-4xl">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-[#e7f2e9] text-[#2e6b3e]',
    paid: 'bg-[#e7f2e9] text-[#2e6b3e]',
    processing: 'bg-[#f5ece5] text-[#bc773f]',
    suspended: 'bg-[#fbe7e4] text-[#b3382e]',
    'new submission': 'bg-[#e8eef7] text-[#33588f]',
    'quality review': 'bg-[#f5ece5] text-[#bc773f]',
    'copyright check': 'bg-[#f3e9f5] text-[#7a4a8f]',
    reported: 'bg-[#fbe7e4] text-[#b3382e]',
    premium: 'bg-terra text-paper',
    free: 'bg-cream text-ink',
    pending: 'bg-[#f5ece5] text-[#bc773f]',
    requested: 'bg-[#f5ece5] text-[#bc773f]',
    reserved: 'bg-[#f5ece5] text-[#bc773f]',
    verified: 'bg-[#e7f2e9] text-[#2e6b3e]',
    rejected: 'bg-[#fbe7e4] text-[#b3382e]',
    delisted: 'bg-[#fbe7e4] text-[#b3382e]',
    exclusive: 'bg-[#f3e9f5] text-[#7a4a8f]',
    editorial: 'bg-[#e8eef7] text-[#33588f]',
    commercial: 'bg-terra text-paper',
    private: 'bg-cream text-ink-soft',
    portfolio: 'bg-[#e8eef7] text-[#33588f]',
    restricted: 'bg-[#f5ece5] text-[#bc773f]',
    agency_protected: 'bg-[#f3e9f5] text-[#7a4a8f]',
    extended: 'bg-ink text-paper',
    royalty_free: 'bg-cream text-ink',
    rights_managed: 'bg-[#e8eef7] text-[#33588f]',
    quoted: 'bg-[#f5ece5] text-[#bc773f]',
    reviewing: 'bg-[#f5ece5] text-[#bc773f]',
    open: 'bg-[#fbe7e4] text-[#b3382e]',
    locked: 'bg-[#fbe7e4] text-[#b3382e]',
    resolved: 'bg-[#e7f2e9] text-[#2e6b3e]',
    dismissed: 'bg-cream text-ink-soft',
    copyright: 'bg-[#f3e9f5] text-[#7a4a8f]',
    likeness: 'bg-[#e8eef7] text-[#33588f]',
    unauthorized_use: 'bg-[#fbe7e4] text-[#b3382e]',
    accepted: 'bg-[#e7f2e9] text-[#2e6b3e]',
    declined: 'bg-[#fbe7e4] text-[#b3382e]',
    withdrawn: 'bg-cream text-ink-soft',
    represented: 'bg-[#f3e9f5] text-[#7a4a8f]',
    new: 'bg-[#e8eef7] text-[#33588f]',
    answered: 'bg-[#e7f2e9] text-[#2e6b3e]',
    closed: 'bg-cream text-ink-soft',
    revoked: 'bg-[#fbe7e4] text-[#b3382e]',
    not_required: 'bg-cream text-ink',
    owner: 'bg-ink text-paper',
    admin: 'bg-[#f3e9f5] text-[#7a4a8f]',
    manager: 'bg-[#e8eef7] text-[#33588f]',
    member: 'bg-cream text-ink',
    viewer: 'bg-cream text-ink-soft',
    override: 'bg-[#f5ece5] text-[#bc773f]',
    auto: 'bg-[#e7f2e9] text-[#2e6b3e]',
    default: 'bg-cream text-ink',
  }
  return (
    <span className={`inline-block px-2 py-0.5 font-mono-tech text-[9px] uppercase tracking-[0.12em] ${map[status] ?? 'bg-cream text-ink'}`}>
      {status}
    </span>
  )
}
