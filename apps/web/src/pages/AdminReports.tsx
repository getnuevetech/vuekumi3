import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { RIGHTS_REPORT_CATEGORY_META, type RightsReportDto } from '@vuekumi/shared'
import { StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { relativeAge } from '../lib/format'
import { AdminShell } from './Admin'

const FILTERS = [
  'queue',
  'safety',
  'dmca_copyright',
  'likeness_consent',
  'fraud_strikes',
  'commercial_dispute',
  'open',
  'reviewing',
  'all',
  'dismissed',
  'resolved',
] as const
type Filter = (typeof FILTERS)[number]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Public rights reports. Freeze new licensing without delisting the photograph.">
      {children}
    </AdminShell>
  )
}

function filterLabel(key: Filter): string {
  switch (key) {
    case 'queue':
      return 'open queue'
    case 'safety':
      return 'safety fast-path'
    case 'dmca_copyright':
      return 'copyright'
    case 'likeness_consent':
      return 'likeness'
    case 'fraud_strikes':
      return 'fraud'
    case 'commercial_dispute':
      return 'compensation'
    default:
      return key
  }
}

export function AdminReports() {
  const [params] = useSearchParams()
  const initial = (params.get('status') as Filter | null) ?? 'queue'
  const [items, setItems] = useState<RightsReportDto[]>([])
  const [filter, setFilter] = useState<Filter>(FILTERS.includes(initial as Filter) ? (initial as Filter) : 'queue')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminReports(filter)
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load reports'))
  }

  useEffect(() => { load() }, [filter])

  async function decide(id: string, action: 'lock' | 'unlock' | 'dismiss' | 'resolve') {
    setBusy(`${id}:${action}`)
    try {
      await api.decideRightsReport(id, action, notes[id])
      toast.success(
        action === 'lock'
          ? 'Commercial licensing frozen'
          : action === 'unlock'
            ? 'Licensing restored'
            : action === 'dismiss'
              ? 'Report dismissed'
              : 'Report resolved',
      )
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update report')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Reports</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Rights & takedown.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Intake from <Link to="/report-content" className="text-terra">/report-content</Link>.
        Safety reports sort first. Locking pauses new licences; the photograph stays visible.
      </p>

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
            {filterLabel(key)}
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        {items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-soft">
            {filter === 'queue' ? 'No open rights reports.' : 'No reports in this filter.'}
          </p>
        )}
        {items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start justify-between gap-4 border-b border-sand-soft px-4 py-4 last:border-0">
            <div className="flex min-w-0 items-start gap-3">
              <img src={r.photoSrc} alt="" className="h-14 w-16 rounded-lg object-cover" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/photo/${r.photoId}`} className="font-medium hover:text-terra">{r.photoTitle}</Link>
                  <StatusPill status={r.status} />
                  {r.urgent && (
                    <span className="rounded-full bg-[#b3382e]/10 px-2 py-0.5 font-mono-tech text-[9px] uppercase tracking-[0.14em] text-[#b3382e]">
                      Safety
                    </span>
                  )}
                  <span className="font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                    {RIGHTS_REPORT_CATEGORY_META[r.reason]?.label ?? r.reason}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {r.photographer ? `@${r.photographer}` : 'Unknown creator'} · {relativeAge(r.createdAt)}
                  {r.reporterEmail ? ` · ${r.reporterEmail}` : ''}
                </p>
                <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-ink-soft">{r.details}</p>
                {r.staffNotes && (
                  <p className="mt-2 text-xs text-ink-faint">Staff: {r.staffNotes}</p>
                )}
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))}
                  placeholder="Staff notes (optional)"
                  className="mt-3 w-full max-w-md rounded-lg border border-sand-soft px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!r.commercialLocked && (
                <button
                  type="button"
                  disabled={busy === `${r.id}:lock`}
                  onClick={() => void decide(r.id, 'lock')}
                  className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em]"
                >
                  Freeze
                </button>
              )}
              {r.commercialLocked && (
                <button
                  type="button"
                  disabled={busy === `${r.id}:unlock`}
                  onClick={() => void decide(r.id, 'unlock')}
                  className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em]"
                >
                  Unfreeze
                </button>
              )}
              <button
                type="button"
                disabled={busy === `${r.id}:dismiss`}
                onClick={() => void decide(r.id, 'dismiss')}
                className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em]"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={busy === `${r.id}:resolve`}
                onClick={() => void decide(r.id, 'resolve')}
                className="rounded-full bg-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper"
              >
                Resolve
              </button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
