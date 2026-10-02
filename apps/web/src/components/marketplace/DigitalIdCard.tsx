import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import QRCode from 'qrcode'
import type { DigitalIdCardType, DigitalIdPreviewDto, DigitalIdPublicDto } from '@vuekumi/shared'
import { DIGITAL_ID_CARD_LABEL } from '@vuekumi/shared'

function cardAccent(cardType: DigitalIdCardType) {
  if (cardType === 'photo_influencer') return '#ef5b24'
  if (cardType === 'model') return '#e0a36a'
  if (cardType === 'contributor') return '#3c3835'
  return '#0b2545'
}

export function DigitalIdCard({
  preview,
  name,
  handle,
  location,
  compact = false,
}: {
  preview: DigitalIdPreviewDto
  name: string
  handle: string
  location?: string | null
  /** Accepted for callers; portrait lives on the surrounding profile chrome. */
  avatarUrl?: string | null
  compact?: boolean
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const href = `/id/${preview.token}`
  const absolute = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href
  const accent = cardAccent(preview.cardType)
  const openCreator = preview.cardType === 'photo_influencer'

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(absolute, {
      margin: 1,
      width: compact ? 96 : 140,
      color: { dark: '#14110e', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url)
    }).catch(() => {
      if (!cancelled) setDataUrl(null)
    })
    return () => { cancelled = true }
  }, [absolute, compact])

  return (
    <Link
      to={href}
      id="digital-id"
      className={`block overflow-hidden rounded-2xl border border-sand bg-white shadow-sm transition-transform hover:-translate-y-0.5 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`overflow-hidden rounded-xl bg-[#f3eee9] ${compact ? 'h-20 w-20' : 'h-28 w-28'}`}>
          {dataUrl ? (
            <img src={dataUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.14em] text-ink-faint">QR</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
            VueKumi Digital ID
          </p>
          <p className={`mt-1 font-semibold text-ink ${compact ? 'text-sm' : 'text-base'}`}>{name}</p>
          <p className="text-xs text-ink-soft">@{handle}{location ? ` · ${location}` : ''}</p>
          <p className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: accent }}>
            {preview.roleLabel || DIGITAL_ID_CARD_LABEL[preview.cardType]}
          </p>
          {openCreator && (
            <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
              Open Creator — Free Library only. Not a stock seller.
            </p>
          )}
          {preview.status === 'revoked' && (
            <p className="mt-2 text-[11px] font-semibold text-terra">Card revoked</p>
          )}
        </div>
      </div>
    </Link>
  )
}

export function DigitalIdPublicView({ card }: { card: DigitalIdPublicDto }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const href = card.profilePath
  const absolute = typeof window !== 'undefined' ? `${window.location.origin}/id/${card.token}` : `/id/${card.token}`
  const accent = cardAccent(card.cardType)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(absolute, { margin: 1, width: 180, color: { dark: '#14110e', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [absolute])

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-sand bg-white p-6 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>VueKumi Digital ID</p>
      <div className="mt-5 flex items-center gap-4">
        {card.avatarUrl ? (
          <img src={card.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream text-xl font-semibold">{card.displayName.slice(0, 1)}</div>
        )}
        <div>
          <h1 className="font-display text-3xl text-ink">{card.displayName}</h1>
          <p className="text-sm text-ink-soft">@{card.handle}{card.location ? ` · ${card.location}` : ''}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
          {card.badge || card.roleLabel}
        </span>
        <span className="rounded-full bg-[#f3eee9] px-3 py-1 text-xs font-semibold text-ink">ID {card.publicId}</span>
        {card.status === 'revoked' && (
          <span className="rounded-full bg-terra/15 px-3 py-1 text-xs font-semibold text-terra">Revoked</span>
        )}
      </div>
      {card.cardType === 'photo_influencer' && (
        <p className="mt-4 text-sm text-ink-soft">
          Open Creator Digital ID. Free Library program only — this is not a monetized stock seller badge.
        </p>
      )}
      <div className="mt-6 flex justify-center">
        {dataUrl ? <img src={dataUrl} alt="" className="h-44 w-44 rounded-2xl border border-sand" /> : null}
      </div>
      <Link to={href} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-terra">
        Open public profile
      </Link>
      <p className="mt-3 text-center text-[11px] text-ink-faint">
        Issued {new Date(card.issuedAt).toLocaleDateString()} · Not an identity verification or KYC document
      </p>
    </div>
  )
}
