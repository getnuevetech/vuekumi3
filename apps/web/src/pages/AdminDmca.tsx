import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { DmcaNoticeDto, RightsStrikeDto } from '@vuekumi/shared'
import { StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { relativeAge } from '../lib/format'
import { AdminShell } from './Admin'

const FILTERS = ['all', 'processing', 'counter_received', 'waiting_restore', 'restored', 'rejected', 'closed'] as const

export function AdminDmca() {
  const [items, setItems] = useState<DmcaNoticeDto[]>([])
  const [strikes, setStrikes] = useState<RightsStrikeDto[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [strike, setStrike] = useState({ userId: '', reason: 'upheld_copyright_fraud' as RightsStrikeDto['reason'], notes: '' })

  const load = () => {
    api.adminDmca(filter)
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load DMCA notices'))
    api.adminStrikes()
      .then((d) => setStrikes(d.items))
      .catch(() => setStrikes([]))
  }

  useEffect(() => { load() }, [filter])

  return (
    <AdminShell subtitle="Copyright notices only. Likeness stays on Rights → Reports. Restore is never automatic.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">DMCA</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Copyright notices.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        DMCA is copyright. Do not treat this queue as a shield for likeness, privacy, or contract complaints.
        A notice freezes new licensing and holds unpaid earnings. A strike is only for upheld fraud.
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
            {key.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {items.length === 0 && <p className="text-sm text-ink-soft">No notices in this filter.</p>}
        {items.map((row) => (
          <article key={row.id} className="rounded-2xl border border-sand-soft bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif-display text-2xl font-light">{row.photoTitle ?? 'Unmatched URL'}</h2>
              <StatusPill status={row.status.replaceAll('_', ' ')} />
              {row.commercialLocked && <StatusPill status="locked" />}
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {row.claimantName} · {row.claimantEmail} · {relativeAge(row.receivedAt)}
              {row.photographer ? ` · @${row.photographer}` : ''}
            </p>
            <p className="mt-2 text-sm">{row.workDescription}</p>
            {row.restoreEligibleAt && (
              <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                Restore eligible {row.restoreEligibleAt.slice(0, 10)} — staff must still act
              </p>
            )}
            <textarea
              value={notes[row.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
              placeholder="Staff notes"
              rows={2}
              className="mt-3 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(['process', 'reject', 'close', 'restore'] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={busy === row.id}
                  onClick={async () => {
                    setBusy(row.id)
                    try {
                      await api.decideDmcaNotice(row.id, action, notes[row.id])
                      toast.success(action === 'restore' ? 'Licensing freeze lifted. Rights are not auto-verified.' : 'Notice updated')
                      load()
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Could not update notice')
                    } finally {
                      setBusy(null)
                    }
                  }}
                  className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50"
                >
                  {action}
                </button>
              ))}
              {row.photoId && (
                <Link to={`/photo/${row.photoId}`} className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  View
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <form
        className="mt-12 space-y-3 rounded-2xl border border-sand-soft bg-white p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            const data = await api.createRightsStrike({
              userId: strike.userId,
              reason: strike.reason,
              notes: strike.notes,
            })
            toast.success(data.strike.terminated ? 'Account suspended as a repeat infringer' : `Strike ${data.strike.strikeCount} recorded`)
            setStrike({ userId: '', reason: 'upheld_copyright_fraud', notes: '' })
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not record strike')
          }
        }}
      >
        <p className="font-serif-display text-2xl font-light">Repeat-infringer strike</p>
        <p className="text-sm text-ink-soft">
          Only for upheld fraud: fake release, fake photographer, false creation claim. A DMCA notice is not a strike.
        </p>
        <input required value={strike.userId} onChange={(e) => setStrike((s) => ({ ...s, userId: e.target.value }))} placeholder="User id" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
        <select value={strike.reason} onChange={(e) => setStrike((s) => ({ ...s, reason: e.target.value as RightsStrikeDto['reason'] }))} className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra">
          <option value="fake_release">Fake model release</option>
          <option value="fake_photographer">Fake photographer</option>
          <option value="false_creation_claim">False “I created this”</option>
          <option value="upheld_copyright_fraud">Upheld copyright fraud</option>
          <option value="upheld_likeness_fraud">Upheld likeness fraud</option>
        </select>
        <textarea required minLength={8} value={strike.notes} onChange={(e) => setStrike((s) => ({ ...s, notes: e.target.value }))} placeholder="Why this is upheld fraud" rows={3} className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
        <button className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra">Record strike</button>
      </form>

      {strikes.length > 0 && (
        <div className="mt-8 space-y-2">
          {strikes.map((row) => (
            <p key={row.id} className="text-sm text-ink-soft">
              {row.userName} · {row.reason.replaceAll('_', ' ')} · strike count {row.strikeCount}
              {row.terminated ? ' · terminated' : ''}
            </p>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
