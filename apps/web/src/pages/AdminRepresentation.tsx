import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { RepresentationAdminDto, RepresentationInquiryDto } from '@vuekumi/shared'
import { PortalShell, SectionHead, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { adminLinks } from './Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      title="Admin portal"
      subtitle="VueQuatro representation. Opt-in, no commission, copyright stays with the photographer."
      links={adminLinks}
    >
      {children}
    </PortalShell>
  )
}

export default function AdminRepresentation() {
  const [items, setItems] = useState<RepresentationAdminDto[]>([])
  const [inquiries, setInquiries] = useState<RepresentationInquiryDto[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminRepresentation()
      .then((d) => {
        setItems(d.items)
        setInquiries(d.inquiries)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load representation queue'))
  }

  useEffect(() => { load() }, [])

  async function decide(id: string, action: 'approve' | 'decline' | 'end') {
    setBusy(`${id}:${action}`)
    try {
      const result = await api.decideRepresentation(id, { action, staffNote: notes[id] || undefined })
      toast.success(
        action === 'approve'
          ? 'Representation approved'
          : action === 'decline'
            ? 'Request declined'
            : `Representation ended — ${result.revertedPhotos} photograph${result.revertedPhotos === 1 ? '' : 's'} returned as portfolio-only`,
      )
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  async function decideInquiry(id: string, status: 'answered' | 'closed') {
    setBusy(`${id}:${status}`)
    try {
      await api.decideInquiry(id, { status, staffNote: notes[id] || undefined })
      toast.success(status === 'answered' ? 'Marked answered' : 'Inquiry closed')
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const requests = items.filter((r) => r.status === 'requested')
  const represented = items.filter((r) => r.status === 'represented')

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">VueQuatro</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Representation.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Representation is opt-in and revocable. Approving lets staff mark the contributor's
        photographs agency-protected — out of self-serve stock, licensed through inquiries. No
        representation commission exists, and copyright never moves. Ending representation returns
        protected photographs as portfolio-only.
      </p>

      <div className="mt-10">
        <SectionHead kicker="Queue" title={`Requests (${requests.length})`} />
        {requests.length === 0 && <p className="mt-3 text-sm text-ink-soft">No pending requests.</p>}
        <div className="mt-3 space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-sand-soft bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {r.contributorName}
                    {r.contributorHandle && (
                      <Link to={`/p/${r.contributorHandle}`} className="ml-2 font-mono-tech text-[10px] text-terra hover:text-ink">
                        @{r.contributorHandle}
                      </Link>
                    )}
                  </p>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {r.contributorEmail} · {r.photosCount} photographs · requested {new Date(r.requestedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>
              {r.note && <p className="mt-3 text-sm text-ink-soft">“{r.note}”</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Staff note (optional)"
                  className="min-w-0 flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
                <button
                  disabled={busy === `${r.id}:approve`}
                  onClick={() => decide(r.id, 'approve')}
                  className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-[#2e6b3e] disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy === `${r.id}:decline`}
                  onClick={() => decide(r.id, 'decline')}
                  className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:text-[#b3382e] disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionHead kicker="Roster" title={`Represented (${represented.length})`} />
        {represented.length === 0 && <p className="mt-3 text-sm text-ink-soft">Nobody is represented yet.</p>}
        <div className="mt-3 space-y-3">
          {represented.map((r) => (
            <div key={r.id} className="rounded-2xl border border-sand-soft bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {r.contributorName}
                    {r.contributorHandle && (
                      <Link to={`/p/${r.contributorHandle}`} className="ml-2 font-mono-tech text-[10px] text-terra hover:text-ink">
                        @{r.contributorHandle}
                      </Link>
                    )}
                  </p>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {r.contributorEmail} · {r.photosCount} photographs · {r.protectedCount} agency-protected
                  </p>
                </div>
                <StatusPill status="represented" />
              </div>
              <p className="mt-2 font-mono-tech text-[10px] text-ink-faint">
                Mark photographs agency-protected from the photo's rights panel in{' '}
                <Link to="/admin/content" className="text-terra hover:text-ink">Content</Link>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Staff note (optional)"
                  className="min-w-0 flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
                <button
                  disabled={busy === `${r.id}:end`}
                  onClick={() => decide(r.id, 'end')}
                  className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:text-[#b3382e] disabled:opacity-50"
                >
                  End representation
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionHead kicker="Licensing" title={`Open inquiries (${inquiries.length})`} />
        {inquiries.length === 0 && <p className="mt-3 text-sm text-ink-soft">No open inquiries.</p>}
        <div className="mt-3 space-y-3">
          {inquiries.map((q) => (
            <div key={q.id} className="rounded-2xl border border-sand-soft bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    <Link to={`/photo/${q.photoId}`} className="hover:text-terra">{q.photoTitle}</Link>
                  </p>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {q.name}{q.company ? ` (${q.company})` : ''} · {q.email} · {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={q.status} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{q.message}</p>
              {q.staffNote && <p className="mt-2 text-[13px] text-ink-faint">Staff note: {q.staffNote}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[q.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
                  placeholder="Staff note (optional)"
                  className="min-w-0 flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                />
                {q.status === 'new' && (
                  <button
                    disabled={busy === `${q.id}:answered`}
                    onClick={() => decideInquiry(q.id, 'answered')}
                    className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra disabled:opacity-50"
                  >
                    Mark answered
                  </button>
                )}
                <button
                  disabled={busy === `${q.id}:closed`}
                  onClick={() => decideInquiry(q.id, 'closed')}
                  className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:border-ink disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}
