import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { LegalOverlayDto } from '@vuekumi/shared'
import { StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

const FILTERS = ['all', 'priority', 'standard', 'buyer'] as const

type CounselStatus = {
  operatorCounselPending: boolean
  dmcaCounselPending: boolean
  complete: boolean
  copyrightOfficeFiling: string
  fields: Record<string, boolean>
  message: string
}

export function AdminLegal() {
  const [items, setItems] = useState<LegalOverlayDto[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('priority')
  const [busy, setBusy] = useState<string | null>(null)
  const [counsel, setCounsel] = useState<CounselStatus | null>(null)

  const load = () => {
    api.adminLegalOverlays(filter)
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load overlays'))
    api.adminCounselStatus()
      .then(setCounsel)
      .catch(() => setCounsel(null))
  }
  useEffect(() => { load() }, [filter])

  return (
    <AdminShell subtitle="Product notices, not signed counsel copy. Overlays never weaken the Global Rights Standard.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Legal overlays</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Country overlays.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Priority countries get a named law label. The rest of Africa uses the standard overlay plus an extra notice.
        Buyer markets stay non-creator. Stage 3 biometric identification is forbidden. Counsel still owns the signed sentences.
      </p>

      {counsel && (
        <div className="mt-6 rounded-2xl border border-sand-soft bg-white p-5 text-sm">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">T3 counsel readiness</p>
          <p className="mt-2 text-ink-soft">{counsel.message}</p>
          <p className="mt-2 font-mono-tech text-[10px] text-ink-faint">
            Operator pending: {counsel.operatorCounselPending ? 'yes' : 'no'} · DMCA pending: {counsel.dmcaCounselPending ? 'yes' : 'no'} ·
            Complete: {counsel.complete ? 'yes' : 'no'} · Copyright Office: {counsel.copyrightOfficeFiling}
          </p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {Object.entries(counsel.fields).map(([key, ok]) => (
              <li key={key} className="font-mono-tech text-[10px] text-ink-faint">
                {ok ? '✓' : '○'} {key}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">
            Fill values in{' '}
            <Link to="/admin/settings" className="text-terra">Admin Settings</Link>
            {' '}(Legal + DMCA). Do not invent entity names in product code.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] ${
              filter === key ? 'bg-ink text-paper' : 'border border-sand text-ink-soft hover:border-ink'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {items.length === 0 && <p className="text-sm text-ink-soft">No overlays in this filter.</p>}
        {items.map((row) => (
          <article key={row.countryCode} className="rounded-2xl border border-sand-soft bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif-display text-2xl font-light">{row.countryName ?? row.countryCode}</h2>
              <StatusPill status={row.overlayKind} />
              <StatusPill status={row.counselStatus.replace('_', ' ')} />
              {row.biometricForbidden && <StatusPill status="no biometrics" />}
            </div>
            {row.lawLabel && (
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">{row.lawLabel}</p>
            )}
            <p className="mt-2 text-sm text-ink-soft">{row.dataTransferNotice}</p>
            <p className="mt-1 text-sm text-ink-soft">{row.commissionedPhotoPrompt}</p>
            {row.extraNotice && <p className="mt-1 text-sm text-ink-soft">{row.extraNotice}</p>}
            <p className="mt-2 font-mono-tech text-[10px] text-ink-faint">
              Creators: {row.contributorAllowed ? 'allowed' : 'not allowed'} · ISO {row.countryCode}
            </p>
            {row.overlayKind !== 'buyer' && (
              <button
                type="button"
                disabled={busy === row.countryCode}
                onClick={async () => {
                  setBusy(row.countryCode)
                  try {
                    await api.patchLegalOverlay(row.countryCode, { biometricForbidden: true })
                    toast.success('Stage 3 remains forbidden')
                    load()
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not save overlay')
                  } finally {
                    setBusy(null)
                  }
                }}
                className="mt-3 rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50"
              >
                Confirm biometric forbidden
              </button>
            )}
          </article>
        ))}
      </div>
    </AdminShell>
  )
}
