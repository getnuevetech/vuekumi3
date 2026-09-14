import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { LicenseProductDto, PaymentMethodsDto, PhotoDto } from '@vuekumi/shared'
import { fmt, photoById, photographerOf, photos } from '../data/content'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../context/AuthContext'
import { BlurImage, PhotoCard, SectionHead, SiteHeader } from '../components/shared'
import { api, ApiError } from '../api/client'
import { toast } from 'sonner'

export default function PhotoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mock = photoById(id ?? '') ?? photos[0]
  const { format } = useCurrency()
  const { user } = useAuth()

  const [photo, setPhoto] = useState<PhotoDto | null>(null)
  const [options, setOptions] = useState<LicenseProductDto[]>([])
  const [license, setLicense] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [grantCode, setGrantCode] = useState<string | null>(null)
  const [quote, setQuote] = useState({ territory: '', duration: '', channels: '', notes: '' })
  const [methods, setMethods] = useState<PaymentMethodsDto | null>(null)
  const [provider, setProvider] = useState<'stripe' | 'flutterwave' | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    api.photo(id).then(setPhoto).catch(() => setPhoto(null))
    api.photoLicenses(id).then((d) => {
      setOptions(d.items)
      const first = d.items.find((i) => i.offered) ?? d.items[0]
      if (first) setLicense(first.type)
    }).catch(() => setOptions([]))
    if (user) {
      api.paymentMethods().then((m) => {
        setMethods(m)
        if (m.defaultProvider === 'stripe' || m.defaultProvider === 'flutterwave') {
          setProvider(m.defaultProvider)
        }
      }).catch(() => undefined)
    }
  }, [id, user])

  const view: PhotoDto = photo ?? {
    ...mock,
    status: 'active',
    photographerName: photographerOf(mock.photographer).name,
    photographerAvatar: photographerOf(mock.photographer).avatar,
    photographerLocation: photographerOf(mock.photographer).location,
  }

  const photographer = {
    name: view.photographerName ?? photographerOf(view.photographer)?.name ?? view.photographer,
    avatar: view.photographerAvatar ?? photographerOf(view.photographer)?.avatar ?? '',
    location: view.photographerLocation ?? photographerOf(view.photographer)?.location ?? view.country,
  }

  const related = useMemo(
    () => photos.filter((p) => p.id !== view.id && (p.category === view.category || p.country === view.country)).slice(0, 8),
    [view],
  )

  const selected = options.find((o) => o.type === license)
  const activePrice = selected?.priceUsd ?? null

  async function buy() {
    if (!id || !selected) return
    if (!user) {
      navigate(`/login?redirect=/photo/${id}`)
      return
    }
    setBusy(true)
    try {
      if (selected.quoteOnly) {
        if (!quote.territory || !quote.duration || !quote.channels) {
          toast.error('Territory, duration and channels are required for a rights-managed quote')
          return
        }
        await api.requestQuote(id, quote)
        toast.success('Quote requested. An admin will price the scope.')
        return
      }
      const result = await api.purchaseLicense(id, selected.type, provider)
      if (result.checkout) {
        window.location.assign(result.checkout.url)
        return
      }
      if (!result.grant) throw new Error('No grant returned')
      setGrantCode(result.grant.certificateCode)
      await api.downloadCertificate(result.grant.id)
      if (result.grant.hasOriginal || view.hasOriginal) {
        await api.downloadGrantFile(result.grant.id).catch(() => undefined)
      }
      toast.success(result.existing ? 'Licence already on file — certificate downloaded' : 'Licence granted — certificate downloaded')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not complete licence')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-24 md:px-8 md:pt-28">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          <Link to="/" className="hover:text-terra">Library</Link>
          <span className="mx-2 text-ink-faint">/</span>
          {view.category}
          <span className="mx-2 text-ink-faint">/</span>
          <span className="text-terra">{view.id.toUpperCase()}</span>
        </p>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="border border-sand bg-cream p-2">
            <BlurImage src={view.src} alt={view.title} className="w-full object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              <span>{view.country}</span>
              <span>{fmt(view.views)} views · {fmt(view.downloads)} downloads · {fmt(view.likes)} likes</span>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <h1 className="font-serif-display text-4xl tracking-tight">{view.title}</h1>
            <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Usage permission — not ownership
            </p>

            <div className="mt-6 flex items-center gap-4 border border-sand bg-white p-4">
              {photographer.avatar ? (
                <img src={photographer.avatar} alt={photographer.name} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-cream" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{photographer.name}</p>
                <p className="font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-soft">{photographer.location}</p>
              </div>
            </div>

            {view.rights?.exclusiveSold && (
              <p className="mt-4 border border-sand bg-cream px-4 py-3 text-sm text-ink-soft">
                This photograph has been sold exclusively and is no longer available.
              </p>
            )}

            <div className="mt-6 space-y-2">
              {(options.length ? options : []).map((opt) => {
                const active = license === opt.type
                const priceLabel = opt.quoteOnly ? 'Quote' : opt.priceUsd === 0 ? 'Free' : opt.priceUsd != null ? format(opt.priceUsd) : '—'
                return (
                  <button
                    key={opt.type}
                    type="button"
                    disabled={!opt.offered}
                    onClick={() => setLicense(opt.type)}
                    className={`w-full border p-4 text-left transition-colors disabled:opacity-50 ${
                      active ? 'border-terra bg-terra/5' : 'border-sand bg-white hover:border-ink/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${active ? 'bg-terra' : 'bg-sand'}`} />
                        <span className="text-sm font-medium">{opt.name}</span>
                      </span>
                      <span className="font-mono-tech text-xs">{priceLabel}</span>
                    </div>
                    <ul className="mt-2.5 space-y-1 pl-[18px]">
                      {opt.points.map((pt) => (
                        <li key={pt} className="font-mono-tech text-[10px] tracking-[0.04em] text-ink-soft">
                          — {pt}
                        </li>
                      ))}
                    </ul>
                    {opt.blockedReason && (
                      <p className="mt-2 font-mono-tech text-[10px] text-[#b3382e]">{opt.blockedReason}</p>
                    )}
                  </button>
                )
              })}
            </div>

            {selected?.quoteOnly && (
              <div className="mt-4 space-y-2 border border-sand bg-white p-4">
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">Rights-managed scope</p>
                <input
                  value={quote.territory}
                  onChange={(e) => setQuote((q) => ({ ...q, territory: e.target.value }))}
                  placeholder="Territory (e.g. Nigeria + Ghana)"
                  className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
                <input
                  value={quote.duration}
                  onChange={(e) => setQuote((q) => ({ ...q, duration: e.target.value }))}
                  placeholder="Duration (e.g. 12 months)"
                  className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
                <input
                  value={quote.channels}
                  onChange={(e) => setQuote((q) => ({ ...q, channels: e.target.value }))}
                  placeholder="Channels (e.g. social, OOH, broadcast)"
                  className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
                <textarea
                  value={quote.notes}
                  onChange={(e) => setQuote((q) => ({ ...q, notes: e.target.value }))}
                  placeholder="Campaign notes"
                  rows={2}
                  className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
              </div>
            )}

            {user && methods && (methods.stripe || methods.flutterwave) && (activePrice ?? 0) > 0 && !selected?.quoteOnly && (
              <div className="mt-4 grid gap-2">
                {methods.stripe && (
                  <label className="flex cursor-pointer items-center gap-2 border border-sand bg-white px-3 py-2 text-sm has-checked:border-terra">
                    <input type="radio" name="pay" checked={provider === 'stripe'} onChange={() => setProvider('stripe')} className="accent-[#bc773f]" />
                    Card — Stripe
                  </label>
                )}
                {methods.flutterwave && (
                  <label className="flex cursor-pointer items-center gap-2 border border-sand bg-white px-3 py-2 text-sm has-checked:border-terra">
                    <input type="radio" name="pay" checked={provider === 'flutterwave'} onChange={() => setProvider('flutterwave')} className="accent-[#bc773f]" />
                    Card / mobile money — Flutterwave
                  </label>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={busy || !selected || (!selected.offered && !selected.quoteOnly)}
              onClick={() => void buy()}
              className="mt-4 w-full bg-ink py-4 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-terra disabled:opacity-40"
            >
              {busy
                ? 'Working…'
                : grantCode
                  ? `Certificate ${grantCode}`
                  : selected?.quoteOnly
                    ? 'Request quote'
                    : activePrice === 0
                      ? 'Download free'
                      : activePrice != null
                        ? `License & pay — ${format(activePrice)}`
                        : 'Select a licence'}
            </button>
            <p className="mt-3 text-center font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-faint">
              Vuekumi sells usage permission, not ownership. A certificate PDF is issued with every grant.
            </p>
            {user && (
              <p className="mt-2 text-center">
                <Link to="/licenses" className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra">
                  Your licences →
                </Link>
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-1.5">
              {view.tags.map((t) => (
                <span key={t} className="border border-sand px-2.5 py-1 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                  {t}
                </span>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-20">
          <SectionHead kicker="Keep browsing" title="Related images" />
          <div className="masonry mt-8">
            {related.map((p) => (
              <PhotoCard key={p.id} photo={p} photographer={photographerOf(p.photographer)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
