import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { LicenseProductDto, PaymentMethodsDto, PhotoDto } from '@vuekumi/shared'
import { permissionPublicCopy } from '@vuekumi/shared'
import { fmt } from '../data/content'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../context/AuthContext'
import { BlurImage, PhotoMasonry, SectionHead, SiteHeader } from '../components/shared'
import { CollectionPicker } from '../components/CollectionPicker'
import { FollowButton } from '../components/FollowButton'
import { api, ApiError } from '../api/client'
import { toast } from 'sonner'

function AgencyInquiryPanel({ photoId }: { photoId: string }) {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <p className="mt-6 border border-sand bg-cream px-4 py-3 text-sm text-ink-soft">
        Inquiry sent. VueKumi staff will contact you about licensing this photograph.
      </p>
    )
  }

  return (
    <form
      className="mt-6 space-y-2 border border-sand bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.photoInquiry(photoId, { name, email, company: company || undefined, message })
          setSent(true)
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not send the inquiry')
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        Licensing inquiry — VueQuatro represented
      </p>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        This photograph is agency-protected and not self-serve stock. Tell us about your intended
        usage and staff will respond with terms.
      </p>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company (optional)"
        className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <textarea
        required
        minLength={10}
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Intended usage — territory, duration, channels…"
        className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-ink py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send inquiry'}
      </button>
    </form>
  )
}

export default function PhotoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { format } = useCurrency()
  const { user, refresh } = useAuth()

  const [photo, setPhoto] = useState<PhotoDto | null>(null)
  const [related, setRelated] = useState<PhotoDto[]>([])
  const [options, setOptions] = useState<LicenseProductDto[]>([])
  const [license, setLicense] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  const [grantCode, setGrantCode] = useState<string | null>(null)
  const [quote, setQuote] = useState({ territory: '', duration: '', channels: '', notes: '' })
  const [methods, setMethods] = useState<PaymentMethodsDto | null>(null)
  const [provider, setProvider] = useState<'stripe' | 'flutterwave' | undefined>(undefined)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!id) return
    setStatus('loading')
    setGrantCode(null)
    api.photo(id).then((p) => {
      setPhoto(p)
      setStatus('ready')
    }).catch(() => {
      setPhoto(null)
      setStatus('missing')
    })
    api.photoLicenses(id).then((d) => {
      setOptions(d.items)
      const first = d.items.find((i) => i.offered) ?? d.items[0]
      if (first) setLicense(first.type)
    }).catch(() => setOptions([]))
    api.relatedPhotos(id).then((d) => setRelated(d.items)).catch(() => setRelated([]))
    if (user) {
      api.paymentMethods().then((m) => {
        setMethods(m)
        if (m.defaultProvider === 'stripe' || m.defaultProvider === 'flutterwave') {
          setProvider(m.defaultProvider)
        }
      }).catch(() => undefined)
    }
  }, [id, user])

  if (status === 'missing') {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 pb-24 pt-36 text-center">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">404</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light">Photograph not found.</h1>
          <Link to="/search" className="mt-8 inline-block bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper">
            Back to the library
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'loading' || !photo) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <p className="pt-36 text-center font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">Loading photograph…</p>
      </div>
    )
  }

  const view = photo
  const photographer = {
    handle: view.photographer,
    name: view.photographerName ?? view.photographer,
    avatar: view.photographerAvatar ?? '',
    location: view.photographerLocation ?? view.country,
  }

  const selected = options.find((o) => o.type === license)
  const activePrice = selected?.priceUsd ?? null
  const agencyProtected = view.permissionState === 'agency_protected' && !view.rights?.exclusiveSold

  async function toggleFavorite() {
    if (!id) return
    if (!user) {
      navigate(`/login?redirect=/photo/${id}`)
      return
    }
    setFavBusy(true)
    try {
      const result = await api.toggleFavorite(id)
      setPhoto((p) => p ? { ...p, favorited: result.favorited, likes: result.likes } : p)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save favourite')
    } finally {
      setFavBusy(false)
    }
  }

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
      await refresh()
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
          <Link to="/search" className="hover:text-terra">Library</Link>
          <span className="mx-2 text-ink-faint">/</span>
          <Link to={`/search?category=${encodeURIComponent(view.category)}`} className="hover:text-terra">{view.category}</Link>
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
              <Link to={`/p/${photographer.handle}`} className="flex flex-1 items-center gap-4">
                {photographer.avatar ? (
                  <img src={photographer.avatar} alt={photographer.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-cream" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{photographer.name}</p>
                  <p className="font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-soft">{photographer.location}</p>
                </div>
              </Link>
              <FollowButton
                handle={photographer.handle}
                following={view.photographerFollowed}
                mine={user?.contributorHandle === photographer.handle}
                redirectTo={`/photo/${view.id}`}
                onChange={(result) => {
                  setPhoto((p) => p ? { ...p, photographerFollowed: result.following } : p)
                }}
              />
              <button
                type="button"
                disabled={favBusy}
                onClick={() => void toggleFavorite()}
                className="flex h-10 w-10 items-center justify-center border border-sand hover:border-terra"
                aria-label={view.favorited ? 'Remove from favorites' : 'Save to favorites'}
                aria-pressed={Boolean(view.favorited)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={view.favorited ? '#bc773f' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>

            {((view.appearances ?? []).filter((a) => a.status === 'approved' && a.modelHandle)).length > 0 && (
              <div className="mt-4 border border-sand bg-white p-4">
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">In this photograph</p>
                <ul className="mt-2 space-y-1">
                  {(view.appearances ?? [])
                    .filter((a) => a.status === 'approved' && a.modelHandle)
                    .map((a) => (
                      <li key={a.id}>
                        <Link to={`/m/${a.modelHandle}`} className="text-sm hover:text-terra">
                          {a.displayName}{' '}
                          <span className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                            @{a.modelHandle}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
                <p className="mt-2 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                  Likeness permission — copyright stays with the photographer
                </p>
              </div>
            )}

            <div className="mt-3">
              <CollectionPicker photoId={view.id} />
            </div>

            {view.rights?.exclusiveSold && (
              <p className="mt-4 border border-sand bg-cream px-4 py-3 text-sm text-ink-soft">
                This photograph has been sold exclusively and is no longer available.
              </p>
            )}

            {!view.rights?.exclusiveSold && view.permissionState && permissionPublicCopy(view.permissionState, view.restrictionNotes) && (
              <p className="mt-4 border border-sand bg-cream px-4 py-3 text-sm text-ink-soft">
                {permissionPublicCopy(view.permissionState, view.restrictionNotes)}
              </p>
            )}

            {(view.commercialLocked || view.rights?.commercialLocked) && (
              <p className="mt-4 border border-sand bg-cream px-4 py-3 text-sm text-ink-soft">
                New licensing is paused while staff review a rights report. The photograph stays in the library.
                Existing certificates are unchanged.
              </p>
            )}

            {view.rights?.rightsVerified && (
              <p className="mt-4 border border-sand bg-white px-4 py-3 text-sm">
                <span className="font-medium">Rights Verified ✓</span>
                <span className="mt-1 block font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  Copyright and likeness are VueKumi-verified. Contact details stay private.
                </span>
              </p>
            )}

            {view.rights?.modelReleaseVerified && !view.rights?.rightsVerified && (
              <p className="mt-4 border border-sand bg-white px-4 py-3 text-sm">
                <span className="font-medium">Model Release Verified ✓</span>
                <span className="mt-1 block font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  Likeness permission is cleared. Copyright stays with the photographer. Contact details stay private.
                </span>
              </p>
            )}

            {view.hasRecognizablePeople && view.rights?.twoPartyBlocker && !(view.commercialLocked || view.rights?.commercialLocked) && (
              <p className="mt-4 border border-sand bg-cream px-4 py-3 text-sm text-ink-soft">
                {view.rights.twoPartyBlocker}. A photographer-provided PDF is not VueKumi-verified consent.
              </p>
            )}

            {agencyProtected && <AgencyInquiryPanel photoId={view.id} />}

            <div className="mt-6 space-y-2">
              {(agencyProtected ? [] : options).map((opt) => {
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

            {user && selected?.type === 'royalty_free' && selected.priceUsd === 0 && (
              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                {user.downloadQuotaUnlimited
                  ? 'Vuekumi+ · unlimited royalty-free downloads'
                  : `${user.downloadQuotaRemaining ?? 50} of ${user.downloadQuotaLimit ?? 50} free downloads left today`}
                {' · '}
                <Link to="/pricing" className="text-terra">Plans</Link>
              </p>
            )}

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

            {user?.agencyId && user.agencyStatus && user.agencyStatus !== 'active' && (
              <p className="mt-4 rounded-xl border border-sand-soft bg-cream px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
                {user.agencyStatus === 'suspended'
                  ? 'Agency suspended — licensing paused'
                  : 'Agency pending approval — licensing paused'}
              </p>
            )}
            {user?.agencyRole === 'viewer' && (
              <p className="mt-4 rounded-xl border border-sand-soft bg-cream px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                Viewer role — ask an owner to change your seat to purchase
              </p>
            )}

            {!agencyProtected && (
            <button
              type="button"
              disabled={
                busy
                || !selected
                || (!selected.offered && !selected.quoteOnly)
                || Boolean(view.commercialLocked || view.rights?.commercialLocked)
                || (Boolean(user?.agencyId) && user?.agencyStatus !== 'active')
                || user?.agencyRole === 'viewer'
              }
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
            )}
            <p className="mt-3 text-center font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-faint">
              Vuekumi sells usage permission, not ownership. AI-training is not included in this licence.
            </p>
            <div className="mt-4 border-t border-sand pt-4">
              <Link
                to={`/report-content?photoId=${view.id}`}
                className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-terra"
              >
                Report a rights or safety issue →
              </Link>
              <p className="mt-2 text-xs text-ink-soft">
                Copyright, likeness, fraud, safety, or licensing disputes. Statutory copyright takedown is a separate{' '}
                <Link to={`/dmca?photo=${view.id}`} className="text-terra">DMCA notice</Link>.
              </p>
            </div>
            {user && (
              <p className="mt-2 text-center">
                <Link to="/licenses" className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra">
                  Your licences →
                </Link>
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-1.5">
              {view.tags.map((t) => (
                <Link
                  key={t}
                  to={`/search?tag=${encodeURIComponent(t)}`}
                  className="border border-sand px-2.5 py-1 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-soft hover:border-terra hover:text-terra"
                >
                  {t}
                </Link>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-20">
          <SectionHead kicker="Keep browsing" title="Related images" />
          <PhotoMasonry photos={related} />
        </div>
      </div>
    </div>
  )
}
