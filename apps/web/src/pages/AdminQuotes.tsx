import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { LicenseQuoteDto } from '@vuekumi/shared'
import { StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { money } from '../lib/format'
import { AdminShell } from './Admin'

const FILTERS = ['pending', 'quoted', 'all', 'declined', 'accepted'] as const
type Filter = (typeof FILTERS)[number]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Price rights-managed requests. Vuekumi sells usage permission, not ownership.">
      {children}
    </AdminShell>
  )
}

export function AdminQuotes() {
  const [items, setItems] = useState<LicenseQuoteDto[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    const status = filter === 'all' ? undefined : filter
    api.adminQuotes(status)
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load quotes'))
  }

  useEffect(() => { load() }, [filter])

  const pendingCount = useMemo(() => items.filter((q) => q.status === 'pending').length, [items])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Quotes</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Rights-managed queue.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Price pending requests. Buyers get an email with the amount and a link to accept on Licences.
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
            {key}
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        {items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-soft">
            {filter === 'pending' ? 'No pending rights-managed quotes.' : 'No quotes in this filter.'}
          </p>
        )}
        {items.map((q) => (
          <div key={q.id} className="flex flex-wrap items-start justify-between gap-4 border-b border-sand-soft px-4 py-4 last:border-0">
            <div className="flex min-w-0 items-start gap-3">
              {q.photoSrc && (
                <img src={q.photoSrc} alt="" className="h-14 w-16 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <Link to={`/photo/${q.photoId}`} className="font-medium hover:text-terra">{q.photoTitle}</Link>
                <p className="mt-0.5 font-mono-tech text-[10px] text-ink-faint">
                  {q.territory} · {q.duration} · {q.channels}
                </p>
                <p className="font-mono-tech text-[10px] text-ink-faint">
                  {q.requesterName ? `${q.requesterName} · ` : ''}{q.requesterEmail} · {q.createdAt.slice(0, 10)}
                </p>
                {q.notes && <p className="mt-1 max-w-xl text-sm text-ink-soft">{q.notes}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={q.status} />
              {q.quoteUsd != null && <span className="text-sm font-medium">{money(q.quoteUsd)}</span>}
              {q.status === 'pending' && (
                <>
                  <input
                    value={drafts[q.id] ?? ''}
                    onChange={(e) => setDrafts((s) => ({ ...s, [q.id]: e.target.value }))}
                    placeholder="USD"
                    inputMode="decimal"
                    className="w-24 rounded-xl border border-sand-soft px-3 py-1.5 text-sm outline-none focus:border-terra"
                  />
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={async () => {
                      const amount = Number(drafts[q.id])
                      if (!Number.isFinite(amount) || amount <= 0) {
                        toast.error('Enter a USD amount greater than zero')
                        return
                      }
                      setBusy(q.id)
                      try {
                        await api.priceQuote(q.id, amount)
                        toast.success('Quote sent to the requester')
                        setDrafts((s) => ({ ...s, [q.id]: '' }))
                        load()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not price quote')
                      } finally {
                        setBusy(null)
                      }
                    }}
                    className="rounded-full bg-ink px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra disabled:opacity-50"
                  >
                    Price
                  </button>
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={async () => {
                      setBusy(q.id)
                      try {
                        await api.declineQuote(q.id)
                        toast.success('Quote declined')
                        load()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not decline')
                      } finally {
                        setBusy(null)
                      }
                    }}
                    className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft hover:border-[#b3382e] hover:text-[#b3382e] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {filter === 'all' && pendingCount > 0 && (
        <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
          {pendingCount} still pending
        </p>
      )}
    </Shell>
  )
}
