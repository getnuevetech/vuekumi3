import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { BookingKind } from '@vuekumi/shared'
import { toast } from 'sonner'
import { SiteHeader } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'

export default function BookCreator({ kind }: { kind: BookingKind }) {
  const { handle } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)

  const backTo = kind === 'photographer' ? `/p/${handle}` : `/m/${handle}`
  const verb = kind === 'photographer' ? 'Hire' : 'Book'

  if (!loading && !user) {
    navigate(`/login?redirect=${encodeURIComponent(`/${kind === 'photographer' ? 'hire' : 'book'}/${handle}`)}`)
    return null
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-28 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Booking</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">
          {verb} @{handle}.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Send a brief. The {kind === 'photographer' ? 'photographer' : 'model'} quotes it, and you
          accept or withdraw. Vuekumi records the agreement — payment is settled directly between
          you, and Vuekumi charges no booking fee in this phase.
        </p>

        <form
          className="mt-8 space-y-4 border border-sand bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              await api.createBooking({
                kind,
                handle: handle ?? '',
                title,
                brief,
                location: location || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                budgetUsd: budget ? Number(budget) : undefined,
              })
              toast.success('Booking request sent')
              navigate('/bookings')
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not send the request')
            } finally {
              setBusy(false)
            }
          }}
        >
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title (e.g. Lagos brand campaign)"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <textarea
            required
            minLength={10}
            rows={6}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="The brief — deliverables, usage, style references, crew, timing…"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
              />
            </label>
            <label className="block">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
              />
            </label>
            <label className="block">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Budget (USD, optional)</span>
              <input
                type="number"
                min={0}
                step={50}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1 w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send booking request'}
            </button>
            <Link to={backTo} className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-ink">
              Cancel
            </Link>
          </div>
        </form>

        {kind === 'model' && (
          <p className="mt-4 font-mono-tech text-[10px] leading-relaxed text-ink-faint">
            Booking a model is a direct engagement. It does not license any photograph, and it does
            not change licence earnings — models do not earn from licences.
          </p>
        )}
      </div>
    </div>
  )
}
