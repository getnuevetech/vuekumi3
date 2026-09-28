import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type {
  CompensationProposalDto,
  CompensationTermMode,
  CompensationTermsInput,
} from '@vuekumi/shared'
import { COMPENSATION_PAYMENT_BASE, termsRequestRevenue } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { StatusPill } from './shared'
import { useAuth } from '../context/AuthContext'

const LIVE = new Set(['proposed', 'countered', 'accepted', 'activated'])

function termsLabel(row: Pick<CompensationProposalDto, 'mode' | 'percent' | 'fixedUsd'>): string {
  if (row.mode === 'zero') return 'Zero fee (Open-safe)'
  if (row.mode === 'percentage') return `${row.percent}% of contributor pool`
  if (row.mode === 'fixed') return `$${row.fixedUsd} from contributor pool`
  const bits = []
  if (row.percent > 0) bits.push(`${row.percent}%`)
  if (row.fixedUsd > 0) bits.push(`$${row.fixedUsd}`)
  return `${bits.join(' + ')} of contributor pool`
}

export function CompensationNegotiationPanel({
  photoId,
  appearanceId,
  onChanged,
}: {
  photoId: string
  appearanceId: string
  onChanged?: () => void
}) {
  const { user } = useAuth()
  const [items, setItems] = useState<CompensationProposalDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<CompensationTermMode>('zero')
  const [percent, setPercent] = useState('0')
  const [fixedUsd, setFixedUsd] = useState('0')
  const [notes, setNotes] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.listPhotoCompensation(photoId)
      setItems(data.items.filter((row) => row.appearanceId === appearanceId))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load compensation')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when appearance changes
  }, [photoId, appearanceId])

  const live = [...items].reverse().find((row) => LIVE.has(row.status)) ?? null
  const history = [...items].reverse()

  const buildTerms = (): CompensationTermsInput => {
    const p = mode === 'zero' ? 0 : Number(percent) || 0
    const f = mode === 'zero' ? 0 : Number(fixedUsd) || 0
    return {
      mode,
      percent: p,
      fixedUsd: f,
      notes: notes.trim() || null,
    }
  }

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(ok)
      await load()
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update compensation')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="mt-3 rounded-xl border border-sand-soft bg-white p-3">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-terra">Likeness compensation</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Agreed share comes from the contributor pool ({COMPENSATION_PAYMENT_BASE.replaceAll('_', ' ')}), not the buyer
        price. Revenue % or fixed fee blocks VueKumi Open. Activated terms write ledger lines; payout withdrawal stays
        finance-gated.
      </p>

      {loading ? (
        <p className="mt-2 text-xs text-ink-faint">Loading…</p>
      ) : (
        <>
          {live ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={live.status} />
                <span className="text-sm font-medium">{termsLabel(live)}</span>
                <span className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  by {live.proposedAs}
                </span>
              </div>
              {termsRequestRevenue(live) && (
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-[#b3382e]">
                  Open blocked while revenue share is requested
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(live.status === 'proposed' || live.status === 'countered') && live.proposedById !== user.id && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.acceptCompensation(live.id), 'Terms accepted')}
                      className="rounded-full bg-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.declineCompensation(live.id), 'Terms declined')}
                      className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#b3382e] disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </>
                )}
                {live.status === 'accepted' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.activateCompensation(live.id), 'Agreement activated')}
                    className="rounded-full bg-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-50"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-faint">No live agreement yet.</p>
          )}

          {(!live || live.status === 'declined' || live.status === 'superseded' || live.status === 'proposed' || live.status === 'countered') && (
            <form
              className="mt-3 space-y-2 border-t border-sand-soft pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                const terms = buildTerms()
                if (live && (live.status === 'proposed' || live.status === 'countered') && live.proposedById !== user.id) {
                  void run(() => api.counterCompensation(live.id, terms), 'Counter sent')
                  return
                }
                if (!live || live.status === 'declined' || live.status === 'superseded') {
                  void run(() => api.proposeCompensation(appearanceId, terms), 'Proposal sent')
                }
              }}
            >
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {live && (live.status === 'proposed' || live.status === 'countered') && live.proposedById !== user.id
                  ? 'Counter offer'
                  : 'Propose terms'}
              </p>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: 'zero' as const, t: 'Zero' },
                  { v: 'percentage' as const, t: '%' },
                  { v: 'fixed' as const, t: 'Fixed $' },
                  { v: 'both' as const, t: '% + $' },
                ]).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setMode(o.v)}
                    className={`rounded-full px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] ${
                      mode === o.v ? 'bg-ink text-paper' : 'border border-sand text-ink-soft'
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
              {(mode === 'percentage' || mode === 'both') && (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="% of contributor pool"
                  className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
                />
              )}
              {(mode === 'fixed' || mode === 'both') && (
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={fixedUsd}
                  onChange={(e) => setFixedUsd(e.target.value)}
                  placeholder="Fixed USD from contributor pool"
                  className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
                />
              )}
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
              />
              <button
                type="submit"
                disabled={busy || (live != null && (live.status === 'proposed' || live.status === 'countered') && live.proposedById === user.id)}
                className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra disabled:opacity-50"
              >
                {busy
                  ? 'Saving…'
                  : live && (live.status === 'proposed' || live.status === 'countered') && live.proposedById !== user.id
                    ? 'Send counter'
                    : 'Propose'}
              </button>
            </form>
          )}

          {history.length > 1 && (
            <ul className="mt-3 space-y-1 border-t border-sand-soft pt-2">
              {history.slice(0, 4).map((row) => (
                <li key={row.id} className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {row.status} · {termsLabel(row)} · {row.proposedAs}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
