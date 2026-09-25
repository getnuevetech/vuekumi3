import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { CollectionPicker } from './CollectionPicker'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'

export type HoverPhoto = {
  id: string
  src: string
  title: string
  country: string
  license: string
  price: number
}

export function CountryMark({ country, className = 'left-2 top-2' }: { country: string; className?: string }) {
  if (!country) return null
  return (
    <span data-country={country} className={`pointer-events-none absolute z-10 inline-flex max-w-[75%] items-center gap-1 bg-noir/75 px-2 py-1 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-paper backdrop-blur-sm ${className}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <span className="truncate">{country}</span>
    </span>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function CollectionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7h5l2 2h11v10H3z" />
    </svg>
  )
}

const iconButton = 'pointer-events-auto flex h-8 w-8 items-center justify-center bg-paper/90 text-ink transition-colors hover:bg-terra hover:text-paper'

function stop(event: ReactMouseEvent | { stopPropagation: () => void; preventDefault?: () => void }) {
  event.stopPropagation()
  event.preventDefault?.()
}

export function PhotoHoverActions({ photo, inline = false }: { photo: HoverPhoto; inline?: boolean }) {
  const { user } = useAuth()
  const { format } = useCurrency()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'download' | 'collection' | null>(null)
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
