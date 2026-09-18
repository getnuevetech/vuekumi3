import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { RightsReportDto } from '@vuekumi/shared'
import { StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { relativeAge } from '../lib/format'
import { AdminShell } from './Admin'

const FILTERS = ['queue', 'open', 'reviewing', 'all', 'dismissed', 'resolved'] as const
type Filter = (typeof FILTERS)[number]

const REASON_LABEL: Record<RightsReportDto['reason'], string> = {
  copyright: 'Copyright',
  likeness: 'Likeness',
  unauthorized_use: 'Unauthorized use',
  other: 'Other',
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Public rights reports. Freeze new licensing without delisting the photograph.">
      {children}
    </AdminShell>
  )
}

export function AdminReports() {
  const [items, setItems] = useState<RightsReportDto[]>([])
  const [filter, setFilter] = useState<Filter>('queue')
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
        Anyone can report a listing. Locking pauses new licences and quotes; the photograph stays visible.
        Existing certificates are not revoked.
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
            {key === 'queue' ? 'open queue' : key}
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
                  {r.commercialLocked && <StatusPill status="locked" />}
                </div>
                <p className="mt-0.5 font-mono-tech text-[10px] text-ink-faint">
                  {REASON_LABEL[r.reason]} · @{r.photographer || 'unknown'} · {relativeAge(r.createdAt)}
                </p>
                <p className="mt-2 max-w-xl text-sm text-ink-soft">{r.details}</p>
                <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                  Reporter {r.reporterName || '—'} · {r.reporterEmail || 'no email'}
                </p>
                {r.staffNotes && (
                  <p className="mt-1 text-[13px] text-ink-soft">Staff: {r.staffNotes}</p>
                )}
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Staff notes"
                  className="mt-2 w-full max-w-md border border-sand px-3 py-1.5 text-sm outline-none focus:border-terra"
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
              {!r.commercialLocked ? (
                <button
                  type="button"
                  disabled={busy?.startsWith(r.id)}
                  onClick={() => void decide(r.id, 'lock')}
                  className="rounded-full bg-ink px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-40"
                >
                  Freeze licensing
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy?.startsWith(r.id)}
                  onClick={() => void decide(r.id, 'unlock')}
                  className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                >
                  Unlock
                </button>
              )}
              {r.status !== 'dismissed' && r.status !== 'resolved' && (
                <>
                  <button
                    type="button"
                    disabled={busy?.startsWith(r.id)}
                    onClick={() => void decide(r.id, 'dismiss')}
                    className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={busy?.startsWith(r.id)}
                    onClick={() => void decide(r.id, 'resolve')}
                    className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                  >
                    Resolve
                  </button>
                </>
              )}
              <Link
                to={`/admin/content`}
                className="rounded-full border border-sand px-4 py-1.5 text-center font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:text-ink"
              >
                Content →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
