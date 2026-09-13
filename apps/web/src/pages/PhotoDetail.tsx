import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fmt, photoById, photographerOf, photos } from '../data/content'
import { useCurrency } from '../context/CurrencyContext'
import { BlurImage, PhotoCard, SectionHead, SiteHeader } from '../components/shared'

const licenseOptions = [
  {
    key: 'free',
    name: 'Free License',
    price: 0,
    points: ['Personal & commercial use', 'Attribution appreciated', 'Standard resolution (2MP)'],
  },
  {
    key: 'premium',
    name: 'Premium License',
    price: null, // per-photo
    points: ['Full resolution, no attribution', 'Print runs up to 500k', 'Photographer earns 50%'],
  },
  {
    key: 'extended',
    name: 'Extended License',
    price: 49,
    points: ['Merchandise & resale rights', 'Unlimited print runs', 'Legal indemnification'],
  },
] as const

export default function PhotoDetail() {
  const { id } = useParams()
  const photo = photoById(id ?? '') ?? photos[0]
  const photographer = photographerOf(photo.photographer)
  const { format } = useCurrency()
  const [license, setLicense] = useState<'free' | 'premium' | 'extended'>(photo.license)
  const [downloaded, setDownloaded] = useState(false)

  const related = useMemo(
    () => photos.filter((p) => p.id !== photo.id && (p.category === photo.category || p.country === photo.country)).slice(0, 8),
    [photo],
  )

  const activePrice =
    license === 'free' ? 0 : license === 'premium' ? (photo.license === 'premium' ? photo.price : 12) : 49

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-24 md:px-8 md:pt-28">
        {/* breadcrumb */}
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          <Link to="/" className="hover:text-terra">Library</Link>
          <span className="mx-2 text-ink-faint">/</span>
          {photo.category}
          <span className="mx-2 text-ink-faint">/</span>
          <span className="text-terra">{photo.id.toUpperCase()}</span>
        </p>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* image */}
          <div className="border border-sand bg-cream p-2">
            <BlurImage src={photo.src} alt={photo.title} className="w-full object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              <span>{photo.country}</span>
              <span>{fmt(photo.views)} views · {fmt(photo.downloads)} downloads · {fmt(photo.likes)} likes</span>
            </div>
          </div>

          {/* sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <h1 className="font-serif-display text-4xl tracking-tight">{photo.title}</h1>

            {/* photographer */}
            <div className="mt-6 flex items-center gap-4 border border-sand bg-white p-4">
              <img src={photographer.avatar} alt={photographer.name} className="h-12 w-12 rounded-full object-cover" />
              <div className="flex-1">
                <p className="text-sm font-medium">{photographer.name}</p>
                <p className="font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-soft">{photographer.location}</p>
              </div>
              <button className="border border-ink px-3 py-1.5 font-mono-tech text-[9px] uppercase tracking-[0.14em] transition-colors hover:bg-ink hover:text-paper">
                Follow
              </button>
            </div>

            {/* license picker */}
            <div className="mt-6 space-y-2">
              {licenseOptions.map((opt) => {
                const price = opt.key === 'free' ? 0 : opt.key === 'premium' ? (photo.license === 'premium' ? photo.price : 12) : opt.price
                const active = license === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setLicense(opt.key as typeof license)}
                    className={`w-full border p-4 text-left transition-colors ${
                      active ? 'border-terra bg-terra/5' : 'border-sand bg-white hover:border-ink/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${active ? 'bg-terra' : 'bg-sand'}`} />
                        <span className="text-sm font-medium">{opt.name}</span>
                      </span>
                      <span className="font-mono-tech text-xs">{price === 0 ? 'Free' : format(price)}</span>
                    </div>
                    <ul className="mt-2.5 space-y-1 pl-[18px]">
                      {opt.points.map((pt) => (
                        <li key={pt} className="font-mono-tech text-[10px] tracking-[0.04em] text-ink-soft">
                          — {pt}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setDownloaded(true)}
              className="mt-4 w-full bg-ink py-4 font-mono-tech text-[11px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-terra"
            >
              {downloaded ? '✓ Added to your downloads' : activePrice === 0 ? 'Download free' : `Buy & download — ${format(activePrice)}`}
            </button>
            <p className="mt-3 text-center font-mono-tech text-[9px] uppercase tracking-[0.14em] text-ink-faint">
              Template UI — wire to your checkout & storage
            </p>

            {/* tags */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {photo.tags.map((t) => (
                <span key={t} className="border border-sand px-2.5 py-1 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                  {t}
                </span>
              ))}
            </div>
          </aside>
        </div>

        {/* related */}
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
