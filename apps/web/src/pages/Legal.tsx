import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { LegalOverlayDto, LegalStandardDto } from '@vuekumi/shared'
import { CountrySelect, SiteHeader } from '../components/shared'
import { useSiteContent } from '../context/SiteContentContext'
import { api, type GeoCountry } from '../api/client'

export default function LegalPage() {
  const { content } = useSiteContent()
  const pageCopy = content.pages.legal
  const [params] = useSearchParams()
  const [page, setPage] = useState<LegalStandardDto | null>(null)
  const [code, setCode] = useState((params.get('country') ?? 'NG').toUpperCase())
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [overlay, setOverlay] = useState<LegalOverlayDto | null>(null)

  useEffect(() => {
    api.legalStandard().then(setPage).catch(() => setPage(null))
    api.countries().then((d) => setCountries(d.countries)).catch(() => setCountries([]))
  }, [])

  useEffect(() => {
    if (!code || code.length !== 2) {
      setOverlay(null)
      return
    }
    api.legalOverlay(code)
      .then((d) => setOverlay(d.overlay))
      .catch(() => setOverlay(null))
  }, [code])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-40">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{pageCopy.kicker}</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{pageCopy.title}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {page?.contractingNote}
        </p>
        <p className="mt-2 font-mono-tech text-[10px] text-ink-faint">{page?.counselGated}</p>

        <ol className="mt-8 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
          {(page?.rules ?? []).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-sand-soft bg-white p-5">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">Country overlay</p>
          <p className="mt-2 text-sm text-ink-soft">
            Priority fill: {(page?.priorityCountries ?? []).join(', ')}. Everyone else uses the standard overlay plus an extra notice. Overlays never weaken this standard.
          </p>
          <CountrySelect
            countries={countries}
            value={code}
            onChange={setCode}
            placeholder="Country"
            className="mt-4 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm outline-none focus:border-terra"
          />
          {overlay && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">{overlay.countryName ?? overlay.countryCode} · {overlay.overlayKind} · {overlay.counselStatus.replace('_', ' ')}</p>
              {overlay.lawLabel && <p className="font-mono-tech text-[10px] text-ink-faint">{overlay.lawLabel}</p>}
              <p className="text-ink-soft">{overlay.dataTransferNotice}</p>
              <p className="text-ink-soft">{overlay.commissionedPhotoPrompt}</p>
              {overlay.extraNotice && <p className="text-ink-soft">{overlay.extraNotice}</p>}
              <p className="font-mono-tech text-[10px] text-ink-faint">
                Creators allowed: {overlay.contributorAllowed ? 'yes' : 'no'}. Stage 3 biometrics: {overlay.biometricForbidden ? 'forbidden' : 'counsel must sign'}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-sand-soft bg-white p-5">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">Agreement stack</p>
          <p className="mt-2 text-sm text-ink-soft">{page?.rightsClearanceContactCopy}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {(page?.agreementStack ?? []).map((row) => (
              <li key={row.kind}>
                <span className="font-medium">{row.title}</span>
                <span className="font-mono-tech text-[10px] text-ink-faint"> · {row.version} · {row.counselStatus.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft">{page?.withdrawal.copy}</p>
        </div>

        <div className="mt-10 rounded-2xl border border-sand-soft bg-white p-5">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">AI-training</p>
          <p className="mt-2 text-sm text-ink-soft">{page?.aiTraining.copy}</p>
          <p className="mt-2 font-mono-tech text-[10px] text-ink-faint">
            Separate opt-in: {page?.aiTraining.separateOptIn ? 'yes' : 'no'}. Included in buyer licences: {page?.aiTraining.includedInBuyerLicences ? 'yes' : 'no'}. Dataset pricing decided: {page?.aiTraining.datasetPricingDecided ? 'yes' : 'no'}. Access offered: {page?.aiTraining.accessOffered ? 'yes' : 'no'}.
          </p>
        </div>

        <p className="mt-8 text-sm text-ink-soft">
          Copyright takedown is a separate <Link to="/dmca" className="text-terra">DMCA notice</Link>.
        </p>
      </div>
    </div>
  )
}
