import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { BookingAdminDto } from '@vuekumi/shared'
import { SectionHead, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Booking briefs and quotes. Off-platform settlement — no booking commission.">
      {children}
    </AdminShell>
  )
}

export default function AdminBookings() {
  const [items, setItems] = useState<BookingAdminDto[]>([])

  useEffect(() => {
    api.adminBookings()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load bookings'))
  }, [])

  const open = items.filter((b) => b.status === 'pending' || b.status === 'quoted')
  const decided = items.filter((b) => b.status !== 'pending' && b.status !== 'quoted')

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Production</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Bookings.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Staff visibility only. Parties still quote, accept, decline, or withdraw. Vuekumi records
        the agreement — settlement stays off-platform and there is no booking commission.
      </p>

      <div className="mt-10">
        <SectionHead kicker="Active" title={`Open (${open.length})`} />
        {open.length === 0 && <p className="mt-3 text-sm text-ink-soft">No open booking requests.</p>}
        <div className="mt-3 space-y-3">
          {open.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      </div>

      <div className="mt-12">
        <SectionHead kicker="History" title={`Decided (${decided.length})`} />
        {decided.length === 0 && <p className="mt-3 text-sm text-ink-soft">No decided bookings yet.</p>}
        <div className="mt-3 space-y-3">
          {decided.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      </div>
    </Shell>
  )
}

function BookingCard({ booking: b }: { booking: BookingAdminDto }) {
  return (
    <div className="rounded-2xl border border-sand-soft bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{b.title}</p>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {b.kind} · {b.requesterName} ({b.requesterEmail}) → {b.targetName} ({b.targetEmail})
            {b.targetHandle ? (
              <>
                {' · '}
                <Link
                  to={b.kind === 'photographer' ? `/p/${b.targetHandle}` : `/m/${b.targetHandle}`}
                  className="text-terra hover:text-ink"
                >
                  @{b.targetHandle}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <StatusPill status={b.status} />
      </div>
      <p className="mt-3 text-sm text-ink-soft whitespace-pre-wrap">{b.brief}</p>
      <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {[
          b.location,
          b.startDate && `from ${b.startDate}`,
          b.endDate && `to ${b.endDate}`,
          b.budgetUsd != null && `budget $${b.budgetUsd.toLocaleString()}`,
          b.quoteUsd != null && `quote $${b.quoteUsd.toLocaleString()}`,
          `opened ${new Date(b.createdAt).toLocaleDateString()}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {b.quoteNote && <p className="mt-2 text-sm text-ink-soft">Quote note: “{b.quoteNote}”</p>}
    </div>
  )
}
