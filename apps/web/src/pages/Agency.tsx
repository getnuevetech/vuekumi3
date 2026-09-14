import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type {
  AgencyDto,
  AgencyInviteDto,
  AgencyMemberDto,
  AgencyRole,
  LicenseGrantDto,
  LicenseQuoteDto,
} from '@vuekumi/shared'
import { PortalShell, StatCard, StatusPill, type PortalLink } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'

const icons = {
  dash: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c.8-3 3.2-5 6-5s5.2 2 6 5M14 19c.4-2 1.8-3.5 3.5-3.5 1.5 0 2.7 1 3.2 2.5" strokeLinecap="round" />
    </svg>
  ),
  licenses: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="3" width="14" height="18" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  ),
  quotes: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h10M4 18h13" strokeLinecap="round" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="1" />
      <path d="M3 10h18M8 6V4h8v2" strokeLinecap="round" />
    </svg>
  ),
}

const links: PortalLink[] = [
  { to: '/agency', label: 'Dashboard', icon: icons.dash },
  { to: '/agency/team', label: 'Team', icon: icons.team },
  { to: '/agency/licenses', label: 'Licences', icon: icons.licenses },
  { to: '/agency/quotes', label: 'Quotes', icon: icons.quotes },
  { to: '/collections', label: 'Collections', icon: icons.box },
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      title="Agency portal"
      subtitle="Team licensing — Vuekumi sells usage permission, not ownership."
      links={links}
    >
      {children}
    </PortalShell>
  )
}

function PendingBanner({ status }: { status?: string | null }) {
  if (status === 'active' || !status) return null
  return (
    <div className="mb-8 rounded-2xl border border-sand-soft bg-cream px-5 py-4">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-terra">
        {status === 'suspended' ? 'Suspended' : 'Pending approval'}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {status === 'suspended'
          ? 'This agency cannot purchase licences until an administrator unsuspends it.'
          : 'Your workspace is waiting for Vuekumi admin approval. Team setup is available; purchases stay paused.'}
      </p>
    </div>
  )
}

function canManage(role?: AgencyRole | null) {
  return role === 'owner' || role === 'admin'
}

export function AgencyDashboard() {
  const { user } = useAuth()
  const { format } = useCurrency()
  const [agency, setAgency] = useState<AgencyDto | null>(null)
  const [grants, setGrants] = useState<LicenseGrantDto[]>([])
  const [quotes, setQuotes] = useState<LicenseQuoteDto[]>([])

  useEffect(() => {
    api.agency()
      .then((d) => {
        setAgency(d.agency)
        setGrants(d.recentGrants)
        setQuotes(d.recentQuotes)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load agency'))
  }, [])

  return (
    <Shell>
      <PendingBanner status={agency?.status ?? user?.agencyStatus} />
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Agency</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">
        {agency?.name ?? user?.agencyName ?? 'Agency workspace'}.
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Shared licences for your team. You are {user?.agencyRole ?? 'a member'}.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Seats" value={`${agency?.seatsUsed ?? '—'} / ${agency?.seatLimit ?? '—'}`} sub={`${agency?.pendingInvites ?? 0} pending invites`} />
        <StatCard label="Team" value={String(agency?.membersCount ?? '—')} sub={agency?.plan ?? 'enterprise'} />
        <StatCard label="Licences" value={String(agency?.grantsCount ?? '—')} sub="Agency-wide grants" />
        <StatCard label="Quotes" value={String(agency?.quotesCount ?? '—')} sub="Rights-managed" />
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif-display text-2xl font-light">Recent grants</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-sand-soft bg-white">
            {grants.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-soft">No licences yet.</p>}
            {grants.map((g) => (
              <Link key={g.id} to={`/photo/${g.photoId}`} className="flex items-center gap-3 border-b border-sand-soft px-4 py-3 last:border-0 hover:bg-cream">
                <img src={g.photoSrc} alt="" className="h-10 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{g.photoTitle}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{g.licenseName} · {g.buyerName}</p>
                </div>
                <span className="text-sm">{g.amountUsd === 0 ? 'Free' : format(g.amountUsd)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-serif-display text-2xl font-light">Open quotes</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-sand-soft bg-white">
            {quotes.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-soft">No rights-managed quotes.</p>}
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 border-b border-sand-soft px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{q.photoTitle}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{q.territory} · {q.requesterEmail}</p>
                </div>
                <StatusPill status={q.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}

const assignableRoles: Exclude<AgencyRole, 'owner'>[] = ['admin', 'manager', 'member', 'viewer']

export function AgencyTeam() {
  const { user } = useAuth()
  const [members, setMembers] = useState<AgencyMemberDto[]>([])
  const [invites, setInvites] = useState<AgencyInviteDto[]>([])
  const [seatLimit, setSeatLimit] = useState(20)
  const [seatsUsed, setSeatsUsed] = useState(0)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<AgencyRole, 'owner'>>('member')
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const manage = canManage(user?.agencyRole)

  const load = () => {
    api.agencyMembers()
      .then((d) => {
        setMembers(d.items)
        setInvites(d.invites)
        setSeatLimit(d.seatLimit)
        setSeatsUsed(d.seatsUsed)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load team'))
  }

  useEffect(() => { load() }, [])

  return (
    <Shell>
      <PendingBanner status={user?.agencyStatus} />
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Team</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Seats & roles.</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {seatsUsed} of {seatLimit} seats used. Invited users keep their email; contributors and admins cannot join.
      </p>

      {manage && (
        <form
          className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-sand-soft bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setJoinUrl(null)
            try {
              const result = await api.inviteAgencyMember(email, role)
              if (result.immediate) {
                toast.success('Teammate added')
              } else {
                toast.success('Invite sent')
                setJoinUrl(result.joinUrl ?? null)
              }
              setEmail('')
              load()
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not invite')
            } finally {
              setBusy(false)
            }
          }}
        >
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@agency.com"
            className="min-w-[220px] flex-1 rounded-xl border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<AgencyRole, 'owner'>)}
            className="rounded-xl border border-sand px-3 py-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] outline-none"
          >
            {assignableRoles.filter((r) => user?.agencyRole === 'owner' || r !== 'admin').map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
          >
            Invite
          </button>
        </form>
      )}

      {joinUrl && (
        <p className="mt-3 break-all rounded-2xl border border-sand-soft bg-cream px-4 py-3 font-mono-tech text-[10px] text-ink-soft">
          Invite link: {joinUrl}
        </p>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-sand-soft last:border-0">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-ink-soft">{m.email}</td>
                <td className="px-4 py-3">
                  {manage && m.role !== 'owner' ? (
                    <select
                      value={m.role}
                      onChange={(e) => {
                        const next = e.target.value as Exclude<AgencyRole, 'owner'>
                        api.updateAgencyMemberRole(m.userId, next)
                          .then(() => { toast.success('Role updated'); load() })
                          .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not update role'))
                      }}
                      className="rounded-lg border border-sand bg-transparent px-2 py-1 font-mono-tech text-[10px] uppercase"
                    >
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusPill status={m.role} />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {((manage && m.role !== 'owner') || m.userId === user?.id) && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => {
                        api.removeAgencyMember(m.userId)
                          .then(() => { toast.success('Removed'); load() })
                          .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove'))
                      }}
                      className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-[#b3382e]"
                    >
                      {m.userId === user?.id ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invites.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif-display text-2xl font-light">Pending invites</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-sand-soft bg-white">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-soft px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{inv.role} · expires {inv.expiresAt.slice(0, 10)}</p>
                </div>
                {manage && (
                  <button
                    type="button"
                    onClick={() => {
                      api.revokeAgencyInvite(inv.id)
                        .then(() => { toast.success('Invite revoked'); load() })
                        .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not revoke'))
                    }}
                    className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-[#b3382e]"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}

export function AgencyLicenses() {
  const { format } = useCurrency()
  const [grants, setGrants] = useState<LicenseGrantDto[]>([])

  useEffect(() => {
    api.myGrants()
      .then((d) => setGrants(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load licences'))
  }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Licences</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Agency grants.</h1>
      <p className="mt-2 text-sm text-ink-soft">Every grant is usage permission. Copyright stays with the photographer.</p>

      <div className="mt-10 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Licence</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Buyer</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-b border-sand-soft last:border-0">
                <td className="px-4 py-3">
                  <Link to={`/photo/${g.photoId}`} className="flex items-center gap-3 hover:text-terra">
                    <img src={g.photoSrc} alt="" className="h-11 w-14 rounded-lg object-cover" />
                    <span className="font-medium">{g.photoTitle}</span>
                  </Link>
                </td>
                <td className="px-4 py-3"><StatusPill status={g.licenseType} /></td>
                <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{g.buyerName ?? g.buyerEmail ?? '—'}</td>
                <td className="px-4 py-3">{g.amountUsd === 0 ? 'Free' : format(g.amountUsd)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => api.downloadCertificate(g.id).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Download failed'))}
                    className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra hover:text-ink"
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-soft">No grants yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}

export function AgencyQuotes() {
  const { format } = useCurrency()
  const { user } = useAuth()
  const [quotes, setQuotes] = useState<LicenseQuoteDto[]>([])
  const canAccept = user?.agencyRole === 'owner' || user?.agencyRole === 'admin' || user?.agencyRole === 'manager'

  const load = () => {
    api.myQuotes()
      .then((d) => setQuotes(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load quotes'))
  }

  useEffect(() => { load() }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Quotes</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Rights-managed.</h1>
      <p className="mt-2 text-sm text-ink-soft">Managers can request and accept quotes. Payment still goes through checkout.</p>

      <div className="mt-10 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        {quotes.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-soft">No quotes yet.</p>}
        {quotes.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-soft px-4 py-3 last:border-0">
            <div>
              <Link to={`/photo/${q.photoId}`} className="font-medium hover:text-terra">{q.photoTitle}</Link>
              <p className="font-mono-tech text-[10px] text-ink-faint">
                {q.territory} · {q.duration} · {q.channels} · {q.requesterEmail}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={q.status} />
              {q.quoteUsd != null && <span className="text-sm">{format(q.quoteUsd)}</span>}
              {q.status === 'quoted' && canAccept && (
                <button
                  type="button"
                  onClick={() => api.acceptQuote(q.id).then((result) => {
                    if (result.checkout) {
                      window.location.assign(result.checkout.url)
                      return
                    }
                    toast.success('Licence granted')
                    load()
                  }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not accept'))}
                  className="rounded-full bg-ink px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper"
                >
                  Accept
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}

export default AgencyDashboard
