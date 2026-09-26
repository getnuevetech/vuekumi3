import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CollectionPicker } from './CollectionPicker'
import { api, ApiError, type GeoCountry } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'

let countryList: GeoCountry[] | null = null
let countryLoad: Promise<GeoCountry[]> | null = null

function loadCountries() {
  if (!countryLoad) {
    countryLoad = api.countries().then((data) => {
      countryList = data.countries
      return data.countries
    }).catch(() => {
      countryList = []
      return []
    })
  }
  return countryLoad
}

function useCountryCode(country: string) {
  const [code, setCode] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const known = countryList?.find((row) => row.name.toLowerCase() === country.toLowerCase() || row.code.toLowerCase() === country.toLowerCase())
    if (known) {
      setCode(known.code)
      return
    }
    loadCountries().then((rows) => {
      if (cancelled) return
      const hit = rows.find((row) => row.name.toLowerCase() === country.toLowerCase() || row.code.toLowerCase() === country.toLowerCase())
      setCode(hit?.code ?? null)
    })
    return () => { cancelled = true }
  }, [country])
  return code
}

function flagEmoji(code: string) {
  const pair = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(pair)) return ''
  return String.fromCodePoint(...[...pair].map((char) => 0x1F1E6 + char.charCodeAt(0) - 65))
}

export type HoverPhoto = {
  id: string
  src: string
  title: string
  country: string
  license: string
  price: number
  favorited?: boolean
}

export function CountryMark({ country, className = 'left-2 top-2' }: { country: string; className?: string }) {
  const code = useCountryCode(country)
  const [imageFailed, setImageFailed] = useState(false)
  if (!country) return null
  const src = code && !imageFailed ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : null
  return (
    <span data-country={country} title={country} aria-label={country} className={`pointer-events-none absolute z-10 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          width={24}
          height={18}
          className="h-[18px] w-6 object-cover shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-lg leading-none drop-shadow">{code ? flagEmoji(code) : ''}</span>
      )}
    </span>
  )
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function CollectionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7h5l2 2h11v10H3z" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#bc773f' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

const iconButton = 'pointer-events-auto flex h-9 w-9 items-center justify-center bg-transparent text-white transition-colors [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.9))] hover:text-terra'

function stop(event: ReactMouseEvent | { stopPropagation: () => void; preventDefault?: () => void }) {
  event.stopPropagation()
  event.preventDefault?.()
}

export function PhotoHoverActions({ photo, inline = false }: { photo: HoverPhoto; inline?: boolean }) {
  const { user } = useAuth()
  const { format } = useCurrency()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'download' | 'collection' | null>(null)
  const [liked, setLiked] = useState(Boolean(photo.favorited))
  useEffect(() => {
    setLiked(Boolean(photo.favorited))
  }, [photo.favorited, photo.id])
  const signIn = `/login?redirect=${encodeURIComponent(`/photo/${photo.id}`)}`
  const signUp = `/login?mode=signup&redirect=${encodeURIComponent(`/photo/${photo.id}`)}`
  const premium = photo.license === 'premium'
  const downloadMessage = premium
    ? `A licence is required to download this photograph. The price is ${format(photo.price)}. Sign in or create an account to buy it.`
    : 'An account is required to download this photograph. Sign in or create an account.'

  function onDownload(event: ReactMouseEvent) {
    stop(event)
    if (user) {
      navigate(`/photo/${photo.id}`)
      return
    }
    setDialog('download')
  }

  function onCollection(event: ReactMouseEvent) {
    stop(event)
    setDialog('collection')
  }

  async function onLike(event: ReactMouseEvent) {
    stop(event)
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/photo/${photo.id}`)}`)
      return
    }
    const previous = liked
    setLiked(!previous)
    try {
      const result = await api.toggleFavorite(photo.id)
      setLiked(result.favorited)
    } catch (err) {
      setLiked(previous)
      toast.error(err instanceof ApiError ? err.message : 'Could not save favourite')
    }
  }

  return (
    <>
      <div
        className={inline
          ? 'flex items-center gap-1'
          : 'absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" className={iconButton} aria-label="Download" onClick={onDownload}>
          <DownloadIcon />
        </button>
        <button type="button" className={iconButton} aria-label="Add to collection" onClick={onCollection}>
          <CollectionIcon />
        </button>
        <button
          type="button"
          className={iconButton}
          aria-label={liked ? 'Remove from favorites' : 'Save to favorites'}
          aria-pressed={liked}
          onClick={(event) => { void onLike(event) }}
        >
          <HeartIcon filled={liked} />
        </button>
      </div>
      {dialog === 'download' && !user && (
        <ActionDialog title={photo.title} onClose={() => setDialog(null)}>
          <img src={photo.src} alt={photo.title} className="mt-4 max-h-72 w-full object-cover" />
          <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">{photo.country}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{downloadMessage}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={signIn} className="bg-ink px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.16em] text-paper">Sign in</Link>
            <Link to={signUp} className="border border-ink px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.16em]">Create account</Link>
          </div>
        </ActionDialog>
      )}
      {dialog === 'collection' && !user && (
        <ActionDialog title="Add to a collection" onClose={() => setDialog(null)}>
          <img src={photo.src} alt="" className="mt-4 h-36 w-full object-cover" />
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Sign in to your account, or create one, to add this photograph to a collection.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={signIn} className="bg-ink px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.16em] text-paper">Sign in</Link>
            <Link to={signUp} className="border border-ink px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.16em]">Create account</Link>
          </div>
        </ActionDialog>
      )}
      {dialog === 'collection' && user && (
        <ActionDialog title="Add to a collection" onClose={() => setDialog(null)}>
          <p className="mt-2 text-sm text-ink-soft">{photo.title}</p>
          <div className="mt-4">
            <CollectionPicker photoId={photo.id} variant="panel" />
          </div>
        </ActionDialog>
      )}
    </>
  )
}

function ActionDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-noir/70 p-4"
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-paper p-5 text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif-display text-2xl font-light">{title}</h2>
          <button type="button" onClick={onClose} className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
