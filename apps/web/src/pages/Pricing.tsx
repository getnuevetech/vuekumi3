import { Link } from 'react-router';
import { Reveal, SectionHead, SiteHeader, StatusPill } from '../components/shared';
import { useCurrency } from '../context/CurrencyContext';

const plans = [
  {
    name: 'Free',
    price: '$0',
    per: 'forever',
    tone: 'paper' as const,
    cta: 'Start downloading',
    features: [
      'Full access to the free collection',
      'Standard license included',
      'Attribution appreciated, not required',
      'Up to 50 downloads / day',
      'Community support',
    ],
  },
  {
    name: 'Vuekumi+',
    price: '$19',
    per: 'per month',
    tone: 'ink' as const,
    cta: 'Go Vuekumi+',
    badge: 'Most popular',
    features: [
      'Everything in Free',
      'Unlimited premium downloads',
      'Commercial use, no attribution',
      'Access on up to 3 seats',
      'Priority support',
      'Cancel anytime',
    ],
  },
  {
    name: 'Extended',
    price: '$49',
    per: 'per image',
    tone: 'paper' as const,
    cta: 'Buy per image',
    features: [
      'Single premium image, owned forever',
      'Merchandise & resale rights',
      'Print runs above 500,000',
      'Broadcast & OOH advertising',
      'Legal indemnification',
    ],
  },
];

const faqs = [
  {
    q: 'What is the standard license?',
    a: 'Use images in websites, social, presentations and editorial — free for commercial and personal work. Resale of the unmodified image itself is not allowed.',
  },
  {
    q: 'How do contributors earn?',
    a: 'Free downloads earn from the contributor pool (paid per download), and premium sales pay a 50% royalty. Payouts run monthly via bank transfer or mobile money.',
  },
  {
    q: 'Can I use images for client work?',
    a: 'Yes — both the standard and Vuekumi+ licenses cover client projects. Only merchandise/resale use requires an Extended license.',
  },
  {
    q: 'Who owns the copyright?',
    a: 'The photographer, always. Vuekumi licenses usage rights; copyright stays with the contributor.',
  },
];

export default function Pricing() {
  const { format, quote } = useCurrency();
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
              purchase sends 50% straight to the photographer.
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
                  <span className="font-serif-display text-5xl font-light">
                    {p.name === 'Free' ? format(0) : p.name === 'Vuekumi+' ? format(19) : format(49)}
                  </span>
                  <span className={`pb-1.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] ${p.tone === 'ink' ? 'text-paper-faint' : 'text-ink-faint'}`}>
                    {p.per}
                  </span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px]">
                      <svg viewBox="0 0 24 24" className={`mt-0.5 h-4 w-4 shrink-0 ${p.tone === 'ink' ? 'text-terra' : 'text-terra'}`} fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className={p.tone === 'ink' ? 'text-paper-soft' : 'text-ink-soft'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`mt-8 rounded-full py-3 text-center font-mono-tech text-[11px] uppercase tracking-[0.18em] transition-colors ${
                    p.tone === 'ink'
                      ? 'bg-paper text-ink hover:bg-terra hover:text-paper'
                      : 'border border-ink/20 text-ink hover:bg-ink hover:text-paper'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        {/* contributor economics */}
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
                <Link to="/login" className="mt-2 inline-flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-terra hover:gap-3 transition-all">
                  Start earning <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        {/* faq */}
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
  );
}
