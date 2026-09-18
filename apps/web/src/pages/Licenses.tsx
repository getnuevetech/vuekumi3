import { useEffect, useState } from 'react'
import type { LicenseGrantDto, LicenseQuoteDto } from '@vuekumi/shared'
import { SiteHeader, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useCurrency } from '../context/CurrencyContext'
import { Link } from 'react-router'
import { toast } from 'sonner'

export default function Licenses() {
  const { format } = useCurrency()
  const [grants, setGrants] = useState<LicenseGrantDto[]>([])
  const [quotes, setQuotes] = useState<LicenseQuoteDto[]>([])

  const load = () => {
    api.myGrants().then((d) => setGrants(d.items)).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load licences'))
    api.myQuotes().then((d) => setQuotes(d.items)).catch(() => undefined)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-[1100px] px-5 pb-24 pt-28">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Your licences</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Usage grants.</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">
          Vuekumi sells permission to use a photograph, not ownership. Each grant issues a certificate. AI-training is never included.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-sand-soft bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Licence</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Certificate</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b border-sand-soft last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/photo/${g.photoId}`} className="flex items-center gap-3 hover:text-terra">
                      <img src={g.photoSrc} alt="" className="h-11 w-14 rounded-lg object-cover" />
                      <span className="font-medium">{g.photoTitle}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={g.licenseType} /></td>
                  <td className="hidden px-4 py-3 font-mono-tech text-[10px] md:table-cell">{g.certificateCode}</td>
                  <td className="px-4 py-3">{g.amountUsd === 0 ? 'Free' : format(g.amountUsd)}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {g.hasOriginal && (
                      <button
                        type="button"
                        onClick={() => api.downloadGrantFile(g.id).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Download failed'))}
                        className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra hover:text-ink"
                      >
                        Original
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => api.downloadCertificate(g.id).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Download failed'))}
                      className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra hover:text-ink"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-soft">No grants yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {quotes.length > 0 && (
          <div className="mt-12">
            <h2 className="font-serif-display text-2xl font-light">Rights-managed quotes</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-sand-soft bg-white">
              {quotes.map((q) => (
                <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-soft px-4 py-3 last:border-0">
                  <div>
                    <p className="font-medium">{q.photoTitle}</p>
                    <p className="font-mono-tech text-[10px] text-ink-faint">
                      {q.territory} · {q.duration} · {q.channels}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={q.status} />
                    {q.quoteUsd != null && <span className="text-sm">{format(q.quoteUsd)}</span>}
                    {q.status === 'quoted' && (
                      <button
                        type="button"
                        onClick={() => api.acceptQuote(q.id).then((result) => {
                          if (result.checkout) {
                            window.location.assign(result.checkout.url)
                            return
                          }
                          toast.success('Licence granted')
                          load()
                        }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not accept'))}
                        className="rounded-full bg-ink px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper"
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
