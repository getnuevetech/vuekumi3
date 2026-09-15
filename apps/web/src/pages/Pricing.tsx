import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Reveal, SectionHead, SiteHeader, StatusPill } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'
import { api, ApiError } from '../api/client'
import { toast } from 'sonner'

const faqs = [
  {
    q: 'What is the standard license?',
    a: 'Use images in websites, social, presentations and editorial — free for commercial and personal work. Resale of the unmodified image itself is not allowed.',
  },
  {
    q: 'What does Vuekumi+ include?',
    a: 'Plus is $19 for 30 days of unlimited royalty-free downloads from the free collection. Premium, extended, editorial, rights-managed and exclusive licences are still billed per image. Photographers keep a 50% royalty on those sales.',
  },
  {
    q: 'How do contributors earn?',
    a: 'Free downloads earn from the contributor pool (paid per download), and premium sales pay a 50% royalty. Payouts run monthly via bank transfer or mobile money.',
  },
  {
    q: 'Can I use images for client work?',
    a: 'Yes — both the standard and Vuekumi+ royalty-free grants cover client projects. Only merchandise/resale use requires an Extended license.',
  },
  {
    q: 'Who owns the copyright?',
    a: 'The photographer, always. Vuekumi licenses usage rights; copyright stays with the contributor.',
  },
]

export default function Pricing() {
  const { format, quote } = useCurrency()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plusBusy, setPlusBusy] = useState(false)
  const plusActive = user?.subscriptionPlan === 'plus'

  async function goPlus() {
    if (!user) {
      navigate('/login?redirect=/pricing')
      return
    }
    if (plusActive) {
      navigate('/account')
      return
    }
    setPlusBusy(true)
    try {
      const { checkout } = await api.startPlusCheckout()
      window.location.assign(checkout.url)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start Vuekumi+ checkout')
      setPlusBusy(false)
    }
  }

  const plans = [
    {
      name: 'Free',
      price: format(0),
      per: 'forever',
      tone: 'paper' as const,
      cta: user ? 'Browse free collection' : 'Start downloading',
      to: user ? '/search?license=free' : `/login?redirect=${encodeURIComponent('/search?license=free')}`,
      features: [
        'Full access to the free collection',
        'Standard royalty-free licence included',
        'Attribution appreciated, not required',
        'Up to 50 royalty-free downloads / UTC day',
        'Community support',
      ],
    },
    {
      name: 'Vuekumi+',
      price: format(19),
      per: 'per 30 days',
      tone: 'ink' as const,
      cta: plusActive ? 'Manage plan' : plusBusy ? 'Starting…' : 'Go Vuekumi+',
      badge: 'Most popular',
      features: [
        'Everything in Free',
        'Unlimited royalty-free downloads from the free collection',
        'Premium images still billed per licence',
        'Commercial RF use, no attribution',
        'Priority support',
        'Cancel anytime — access lasts through the paid period',
      ],
    },
    {
      name: 'Extended',
      price: format(49),
      per: 'per image',
      tone: 'paper' as const,
      cta: 'Buy per image',
      to: '/search?license=premium',
      features: [
        'Single premium image, licensed for extended use',
        'Merchandise & resale rights',
        'Print runs above 500,000',
        'Broadcast & OOH advertising',
        'Usage permission only — copyright stays with the photographer',
      ],
    },
  ]

  return (
    <div className="pt-32 pb-28">
      <SiteHeader />
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-terra">Licence &amp; pricing</p>
            <h1 className="font-serif-display mt-4 text-5xl font-light leading-[1.05] tracking-tight md:text-6xl">
              Simple plans,
              <br />
              <em className="text-terra">fair for everyone.</em>
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              Free for the community, sustainable for the creators. Every premium
              purchase sends 50% straight to the photographer. Vuekumi+ funds the
              free-download pool and lifts your daily royalty-free quota.
              Prices shown in {quote.currency}{quote.countryName ? ` · ${quote.countryName}` : ''}
              {quote.source === 'default' ? ' (USD default)' : ''}.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 90}>
              <div
                className={`relative flex h-full flex-col rounded-3xl border p-8 ${
                  p.tone === 'ink'
                    ? 'border-ink bg-ink text-paper shadow-[0_30px_60px_-20px_rgba(43,37,33,0.4)]'
                    : 'border-sand-soft bg-white'
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-8 rounded-full bg-terra px-3 py-1 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-paper">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h2 className="font-serif-display text-2xl font-light">{p.name}</h2>
                  {p.tone === 'ink' ? <StatusPill status="premium" /> : null}
                </div>
                <div className="mt-6 flex items-end gap-2">
                  <span className="font-serif-display text-5xl font-light">{p.price}</span>
                  <span className={`pb-1.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] ${p.tone === 'ink' ? 'text-paper-faint' : 'text-ink-faint'}`}>
                    {p.per}
                  </span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px]">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-terra" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className={p.tone === 'ink' ? 'text-paper-soft' : 'text-ink-soft'}>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.name === 'Vuekumi+' ? (
                  <button
                    type="button"
                    disabled={plusBusy}
                    onClick={() => void goPlus()}
                    className="mt-8 rounded-full bg-paper py-3 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-terra hover:text-paper disabled:opacity-50"
                  >
                    {p.cta}
                  </button>
                ) : (
                  <Link
                    to={p.to!}
                    className="mt-8 rounded-full border border-ink/20 py-3 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-paper"
                  >
                    {p.cta}
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-20">
            <SectionHead kicker="Licence types" title="Permission, not ownership." />
            <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Royalty-Free', note: 'Free collection. Commercial use. 50 downloads / UTC day on Free; unlimited on Vuekumi+.' },
                { name: 'Commercial', note: 'Premium collection at the photo price. Full resolution. 50% to the photographer.' },
                { name: 'Extended Commercial', note: '$49. Merchandise, unlimited print, broadcast.' },
                { name: 'Editorial', note: 'News and commentary only. Model release not required.' },
                { name: 'Rights-Managed', note: 'Quoted by territory, duration and channels. Not a fixed price.' },
                { name: 'Exclusive', note: 'Contributor opt-in per photo. Sale delists the image.' },
              ].map((item) => (
                <div key={item.name} className="border border-sand-soft bg-white p-5">
                  <h3 className="font-serif-display text-xl font-light">{item.name}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-24 rounded-3xl bg-cream p-8 md:p-12">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-terra">For contributors</p>
                <h2 className="font-serif-display mt-4 text-4xl font-light leading-tight">
                  Where the money goes.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                  Vuekumi takes a 50% platform fee on premium sales to run hosting,
                  licensing and payouts. The rest is yours — plus a share of the
                  free-download pool, funded by Vuekumi+ subscriptions.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Photographer royalty', value: 50, note: 'of every premium sale' },
                  { label: 'Free pool share', value: 32, note: 'of + subscriptions, per download' },
                  { label: 'Platform fee', value: 50, note: 'hosting, licensing, support' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[13px] font-medium">{row.label}</span>
                      <span className="font-mono-tech text-xs text-terra">{row.value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                      <div className="h-full rounded-full bg-terra" style={{ width: `${row.value}%` }} />
                    </div>
                    <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">{row.note}</p>
                  </div>
                ))}
                <Link to="/login?redirect=/contributor" className="mt-2 inline-flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-terra hover:gap-3 transition-all">
                  Start earning <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-24">
          <SectionHead kicker="Questions" title="Good to know." />
          <div className="grid gap-px overflow-hidden rounded-2xl border border-sand-soft bg-sand-soft md:grid-cols-2">
            {faqs.map((f) => (
              <div key={f.q} className="bg-white p-7">
                <h3 className="font-serif-display text-lg font-light">{f.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
