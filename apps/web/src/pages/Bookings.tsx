import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { BookingDto } from '@vuekumi/shared'
import { toast } from 'sonner'
import { SiteHeader, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function QuoteForm({ booking, onDone }: { booking: BookingDto; onDone: (b: BookingDto) => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          const { booking: updated } = await api.quoteBooking(booking.id, {
            quoteUsd: Number(amount),
            note: note || undefined,
          })
          onDone(updated)
          toast.success('Quote sent')
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not send the quote')
        } finally {
          setBusy(false)
        }
      }}
    >
      <input
        required
        type="number"
        min={1}
        step={10}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Quote (USD)"
        className="w-32 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="min-w-0 flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra disabled:opacity-50"
      >
        Send quote
      </button>
    </form>
  )
}

export default function Bookings() {
  const [items, setItems] = useState<BookingDto[]>([])
  const [tab, setTab] = useState<'all' | 'sent' | 'received'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.bookings()
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const replace = (updated: BookingDto) =>
    setItems((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))

  const act = async (id: string, action: 'accept' | 'decline' | 'withdraw') => {
    try {
      const { booking } = await api.bookingAction(id, action)
      replace(booking)
      toast.success(`Booking ${booking.status}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    }
  }

  const shown = tab === 'all' ? items : items.filter((b) => b.role === tab)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-40 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Bookings</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Briefs & quotes.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Vuekumi records the brief, the quote, and the decision. Payment is settled directly
          between the parties — Vuekumi charges no booking fee in this phase.
        </p>

        <div className="mt-6 flex border border-sand bg-white p-1">
          {(['all', 'sent', 'received'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] transition-colors ${
                tab === t ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <p className="mt-8 font-mono-tech text-[11px] text-ink-faint">Loading…</p>}
        {!loading && shown.length === 0 && (
          <p className="mt-8 text-sm text-ink-soft">
            No bookings yet. Find someone on the{' '}
            <Link to="/creators" className="text-terra underline underline-offset-2">creators</Link> or{' '}
            <Link to="/models" className="text-terra underline underline-offset-2">models</Link> pages.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {shown.map((b) => (
            <div key={b.id} className="border border-sand bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  {b.targetAvatarUrl ? (
                    <img src={b.targetAvatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-cream" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.title}</p>
                    <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                      {b.role === 'sent' ? (
                        <>
                          {b.kind === 'photographer' ? 'Hire' : 'Book'}{' '}
                          <Link
                            to={`/${b.kind === 'photographer' ? 'p' : 'm'}/${b.targetHandle}`}
                            className="text-terra hover:text-ink"
                          >
                            @{b.targetHandle}
                          </Link>
                        </>
                      ) : (
                        <>From {b.requesterName}</>
                      )}
                      {' · '}{new Date(b.createdAt).toLocaleDateString()}
                      {b.location ? ` · ${b.location}` : ''}
                      {b.startDate ? ` · ${b.startDate}${b.endDate ? ` → ${b.endDate}` : ''}` : ''}
                    </p>
                  </div>
                </div>
                <StatusPill status={b.status} />
              </div>

              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{b.brief}</p>

              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {b.budgetUsd != null ? `Indicated budget ${money(b.budgetUsd)}` : 'No budget indicated'}
                {b.quoteUsd != null ? ` · Quote ${money(b.quoteUsd)}` : ''}
              </p>
              {b.quoteNote && <p className="mt-1 text-[13px] text-ink-soft">“{b.quoteNote}”</p>}

              {b.role === 'received' && b.status === 'pending' && (
                <>
                  <QuoteForm booking={b} onDone={replace} />
                  <button
                    onClick={() => act(b.id, 'decline')}
                    className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-[#b3382e]"
                  >
                    Decline
                  </button>
                </>
              )}
              {b.role === 'received' && b.status === 'quoted' && (
                <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  Waiting for the requester to accept.
                </p>
              )}
              {b.role === 'sent' && (b.status === 'pending' || b.status === 'quoted') && (
                <div className="mt-3 flex gap-2">
                  {b.status === 'quoted' && (
                    <button
                      onClick={() => act(b.id, 'accept')}
                      className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-[#2e6b3e]"
                    >
                      Accept quote
                    </button>
                  )}
                  <button
                    onClick={() => act(b.id, 'withdraw')}
                    className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:border-ink"
                  >
                    Withdraw
                  </button>
                </div>
              )}
              {b.status === 'accepted' && (
                <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra">
                  Agreed. Settle payment directly — Vuekumi charges no booking fee in this phase.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
