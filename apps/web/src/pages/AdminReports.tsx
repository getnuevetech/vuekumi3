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
  'escalated',
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

type DecideAction = 'lock' | 'unlock' | 'dismiss' | 'resolve' | 'preserve' | 'notify' | 'escalate'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Rights ops intake — freeze, preserve, notify, escalate. DMCA stays copyright-only.">
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
    case 'escalated':
      return 'escalated'
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
  const [escalateTo, setEscalateTo] = useState<Record<string, 'legal' | 'law_enforcement' | 'counsel' | 'other'>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminReports(filter)
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load reports'))
  }

  useEffect(() => { load() }, [filter])

  async function decide(id: string, action: DecideAction) {
    setBusy(`${id}:${action}`)
    try {
      await api.decideRightsReport(id, action, notes[id], action === 'escalate' ? (escalateTo[id] ?? 'legal') : undefined)
      toast.success(
        action === 'lock'
          ? 'Commercial licensing frozen'
          : action === 'unlock'
            ? 'Licensing restored'
            : action === 'dismiss'
              ? 'Report dismissed'
              : action === 'resolve'
                ? 'Report resolved'
                : action === 'preserve'
                  ? 'Evidence preserved'
                  : action === 'notify'
                    ? 'Notification recorded'
                    : 'Escalated',
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
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Rights ops.</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Intake from <Link to="/report-content" className="text-terra">/report-content</Link>
        {' '}· holders review on <Link to="/rights" className="text-terra">/rights</Link>.
        Staff SOP: <code className="font-mono-tech text-xs">docs/runbooks/rights-ops.md</code>.
        Copyright statutory notices stay on <Link to="/admin/dmca" className="text-terra">DMCA</Link>
        {' '}— counter-notice never clears likeness or safety.
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
                  <span className="rounded-full border border-sand px-2 py-0.5 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                    {r.sopStage}
                  </span>
                  {r.urgent && (
                    <span className="rounded-full bg-[#b3382e]/10 px-2 py-0.5 font-mono-tech text-[9px] uppercase tracking-[0.14em] text-[#b3382e]">
                      Safety
                    </span>
                  )}
                  {r.openDmcaHold && (
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                      DMCA hold
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
                <p className="mt-2 font-mono-tech text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                  {r.evidencePreservedAt ? `Preserved ${r.evidencePreservedAt.slice(0, 10)} · ` : 'Not preserved · '}
                  {r.notifiedAt ? `Notified ${r.notifiedAt.slice(0, 10)} · ` : 'Not notified · '}
                  {r.escalatedAt ? `Escalated → ${r.escalateTo}` : 'Not escalated'}
                </p>
                {r.staffNotes && (
                  <p className="mt-2 text-xs text-ink-faint">Staff: {r.staffNotes}</p>
                )}
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))}
                  placeholder="Staff notes (optional)"
                  className="mt-3 w-full max-w-md rounded-lg border border-sand-soft px-3 py-1.5 text-sm"
                />
                <select
                  value={escalateTo[r.id] ?? 'legal'}
                  onChange={(e) => setEscalateTo((s) => ({ ...s, [r.id]: e.target.value as 'legal' | 'law_enforcement' | 'counsel' | 'other' }))}
                  className="mt-2 rounded-lg border border-sand-soft bg-white px-2 py-1 text-xs"
                >
                  <option value="legal">Escalate → legal</option>
                  <option value="counsel">Escalate → counsel</option>
                  <option value="law_enforcement">Escalate → law enforcement</option>
                  <option value="other">Escalate → other</option>
                </select>
              </div>
            </div>
            <div className="flex max-w-xs flex-wrap gap-2">
              {([
                ['preserve', 'Preserve'],
                ['lock', 'Freeze'],
                ['notify', 'Notify'],
                ['escalate', 'Escalate'],
                ['unlock', 'Unfreeze'],
                ['dismiss', 'Dismiss'],
                ['resolve', 'Resolve'],
              ] as const).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  disabled={busy === `${r.id}:${action}` || (action === 'unlock' && r.openDmcaHold)}
                  title={action === 'unlock' && r.openDmcaHold ? 'Blocked while DMCA hold is open' : undefined}
                  onClick={() => void decide(r.id, action)}
                  className={`rounded-full px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40 ${
                    action === 'resolve' ? 'bg-ink text-paper' : 'border border-sand'
                  }`}
                >
                  {label}
                </button>
              ))}
              {r.reason === 'copyright' && (
                <Link
                  to="/admin/dmca"
                  className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft"
                >
                  DMCA queue
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
