import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { AdminOverviewDto, EarningsHoldDto, LicenseQuoteDto, PayoutDto, RightsReportDto } from '@vuekumi/shared';
import { adminHas, ADMIN_NAV_CAPABILITY } from '@vuekumi/shared';
import { api, ApiError, type AdminModerationRow } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PortalShell, StatCard, SectionHead, StatusPill, type PortalLink } from '../components/shared';
import { fmt, formatAxisUsd, money, relativeAge } from '../lib/format';

const icons = {
  dash: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
      <path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.4c2.3.7 4 2.6 4 5.6" strokeLinecap="round" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.2c0 3 6 1.5 6 4.6 0 1.3-1.3 2.2-3 2.2s-3-1.1-3-2.5" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
  rights: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  ),
  quatro: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinejoin="round" />
    </svg>
  ),
};

export const adminLinks: PortalLink[] = [
  { to: '/admin', label: 'Overview', icon: icons.dash },
  {
    label: 'Users',
    icon: icons.users,
    children: [
      { to: '/admin/users', label: 'Members', icon: icons.users },
      { to: '/admin/photographers', label: 'Photographers', icon: icons.users },
      { to: '/admin/influencers', label: 'Photo influencers', icon: icons.users },
      { to: '/admin/contributors', label: 'Contributors', icon: icons.users },
      { to: '/admin/agencies', label: 'Agencies', icon: icons.users },
      { to: '/admin/models', label: 'Models', icon: icons.users },
      { to: '/admin/admins', label: 'Admins', icon: icons.shield },
    ],
  },
  {
    label: 'Rights',
    icon: icons.rights,
    children: [
      { to: '/admin/content', label: 'Content', icon: icons.grid },
      { to: '/admin/moderation', label: 'Moderation', icon: icons.shield },
      { to: '/admin/reports', label: 'Reports', icon: icons.shield },
      { to: '/admin/dmca', label: 'DMCA', icon: icons.rights },
      { to: '/admin/quotes', label: 'Quotes', icon: icons.money },
    ],
  },
  {
    label: 'VueQuatro',
    icon: icons.quatro,
    children: [
      { to: '/admin/representation', label: 'Representation', icon: icons.shield },
      { to: '/admin/partner-api', label: 'Partner API', icon: icons.gear },
    ],
  },
  {
    label: 'Money',
    icon: icons.money,
    children: [
      { to: '/admin/payouts', label: 'Payouts', icon: icons.money },
      { to: '/admin/rates', label: 'FX rates', icon: icons.money },
    ],
  },
  {
    label: 'Platform',
    icon: icons.gear,
    children: [
      { to: '/admin/countries', label: 'Countries', icon: icons.gear },
      { to: '/admin/gateways', label: 'Gateways', icon: icons.money },
      { to: '/admin/ai', label: 'AI APIs', icon: icons.gear },
      { to: '/admin/settings', label: 'Settings', icon: icons.gear },
    ],
  },
];

function filterAdminNav(links: PortalLink[], user: ReturnType<typeof useAuth>['user']): PortalLink[] {
  const out: PortalLink[] = []
  for (const link of links) {
    if (link.children?.length) {
      const children = filterAdminNav(link.children, user)
      if (children.length) out.push({ ...link, children })
      continue
    }
    if (!link.to) continue
    const cap = ADMIN_NAV_CAPABILITY[link.to]
    if (!cap || adminHas(user, cap)) out.push(link)
  }
  return out
}

export function useAdminLinks(): PortalLink[] {
  const { user } = useAuth()
  return useMemo(() => filterAdminNav(adminLinks, user), [user])
}

export function AdminShell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  const links = useAdminLinks()
  return (
    <PortalShell title="Admin portal" subtitle={subtitle} links={links}>
      {children}
    </PortalShell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Moderation, accounts, and contributor payouts.">
      {children}
    </AdminShell>
  );
}

/* ---------------- overview ---------------- */

export function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverviewDto | null>(null)
  const [queue, setQueue] = useState<AdminModerationRow[]>([])
  const [pending, setPending] = useState<{ id: string; contributorHandle: string | null; contributorName: string; methodLabel: string; amountUsd: number }[]>([])
  const [quotes, setQuotes] = useState<LicenseQuoteDto[]>([])
  const [reports, setReports] = useState<RightsReportDto[]>([])
  useEffect(() => {
    api.adminOverview()
      .then(setOverview)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load overview'))
    api.adminModeration()
      .then((d) => setQueue(d.items.slice(0, 3)))
      .catch(() => setQueue([]))
    api.adminPayouts('requested')
      .then((d) => setPending(d.items.slice(0, 3)))
      .catch(() => setPending([]))
    api.adminQuotes('pending')
      .then((d) => setQuotes(d.items.slice(0, 3)))
      .catch(() => setQuotes([]))
    api.adminReports('queue')
      .then((d) => setReports(d.items.slice(0, 3)))
      .catch(() => setReports([]))
  }, [])
  const stats = overview?.stats
  const series = overview?.series ?? []
  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Overview</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Platform health.</h1>
      <p className="mt-1 text-sm text-ink-soft">Live counts from the catalog, payments, and payouts.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Total users"
          value={stats ? fmt(stats.users) : '—'}
          sub={stats ? `${fmt(stats.contributors)} contributors` : 'Loading'}
        />
        <StatCard
          label="Photos live"
          value={stats ? fmt(stats.photosLive) : '—'}
          sub={stats ? `${stats.pendingReview} pending review · ${stats.openRightsReports} rights reports` : 'Loading'}
        />
        <StatCard
          label={stats ? `Revenue (${stats.monthLabel})` : 'Revenue'}
          value={stats ? money(stats.revenueMonthUsd) : '—'}
          sub={stats ? `${fmt(stats.downloads)} lifetime downloads` : 'Loading'}
        />
      </div>

      <div className="mt-10">
        <SectionHead kicker="Revenue" title="Revenue vs contributor payouts" />
        <div className="rounded-2xl border border-sand-soft bg-white p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke="#efe4da" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} tickFormatter={formatAxisUsd} />
                <Tooltip
                  formatter={(v: number, name: string) => [money(v), name === 'revenue' ? 'Revenue' : 'Payouts']}
                  contentStyle={{ border: '1px solid #dec9b8', borderRadius: 12, fontSize: 12, background: '#faf6f3' }}
                />
                <Bar dataKey="revenue" fill="#3c3835" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payouts" fill="#bc773f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sand-soft bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-xl font-light">Rights reports</h3>
            <Link to="/admin/reports" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">Open →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {reports.length === 0 && <p className="text-sm text-ink-soft">No open rights reports.</p>}
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-sand-soft pb-3 last:border-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={r.photoSrc} alt="" className="h-10 w-13 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.photoTitle}</p>
                    <p className="font-mono-tech text-[10px] text-ink-faint">{r.reason.replaceAll('_', ' ')} · {relativeAge(r.createdAt)}</p>
                  </div>
                </div>
                <StatusPill status={r.commercialLocked ? 'locked' : r.status} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-sand-soft bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-xl font-light">Moderation queue</h3>
            <Link to="/admin/moderation" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">Open →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {queue.length === 0 && <p className="text-sm text-ink-soft">Queue is clear.</p>}
            {queue.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 border-b border-sand-soft pb-3 last:border-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={m.photo.src} alt="" className="h-10 w-13 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.photo.title}</p>
                    <p className="font-mono-tech text-[10px] text-ink-faint">{m.id.slice(-8)} · {relativeAge(m.createdAt)}</p>
                  </div>
                </div>
                <StatusPill status={m.flag} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-sand-soft bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-xl font-light">Pending payouts</h3>
            <Link to="/admin/payouts" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">Open →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {pending.length === 0 && <p className="text-sm text-ink-soft">No pending payouts.</p>}
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-sand-soft pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">@{p.contributorHandle ?? p.contributorName}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{p.methodLabel}</p>
                </div>
                <span className="font-mono-tech text-xs font-medium">{money(p.amountUsd)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-sand-soft bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-xl font-light">RM quotes</h3>
            <Link to="/admin/quotes" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">Open →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {quotes.length === 0 && <p className="text-sm text-ink-soft">No pending rights-managed quotes.</p>}
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 border-b border-sand-soft pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{q.photoTitle}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{q.territory} · {q.requesterEmail}</p>
                </div>
                <StatusPill status={q.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- moderation ---------------- */

export function AdminModeration() {
  const [items, setItems] = useState<import('../api/client').AdminModerationRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminModeration().then((d) => setItems(d.items)).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load'))
  }
  useEffect(() => { load() }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Moderation</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Review queue.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {items.length} pending. Photos go live only after approval and required rights.
      </p>

      <div className="mt-8 space-y-4">
        {items.map((m) => (
          <div key={m.id} className="flex flex-col gap-4 rounded-2xl border border-sand-soft bg-white p-4 sm:flex-row sm:items-center">
            <img src={m.photo.src} alt={m.photo.title} className="h-36 w-full rounded-xl object-cover sm:h-28 sm:w-40" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{m.photo.title}</p>
                <StatusPill status={m.flag} />
                <StatusPill status={m.liveReady ? 'active' : 'pending'} />
              </div>
              <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                {m.id} · by @{m.submittedBy} · {m.photo.country} · {m.photo.category}
              </p>
              {!m.liveReady && (
                <p className="mt-2 text-[13px] text-[#b3382e]">{m.liveBlockers.join('; ')}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col">
              <button
                disabled={busy === m.id}
                onClick={async () => {
                  setBusy(m.id)
                  try {
                    await api.decideModeration(m.id, 'approve')
                    toast.success('Published')
                    load()
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Approve failed')
                  } finally {
                    setBusy(null)
                  }
                }}
                className="flex-1 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-[#2e6b3e] disabled:opacity-30 sm:flex-none"
              >
                Approve
              </button>
              <button
                disabled={busy === m.id}
                onClick={async () => {
                  setBusy(m.id)
                  try {
                    await api.decideModeration(m.id, 'reject')
                    toast.success('Rejected')
                    load()
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Reject failed')
                  } finally {
                    setBusy(null)
                  }
                }}
                className="flex-1 rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft transition-colors hover:border-[#b3382e] hover:text-[#b3382e] disabled:opacity-30 sm:flex-none"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-soft">Queue is clear.</p>}
      </div>
    </Shell>
  )
}

/* ---------------- payouts ---------------- */

export function AdminPayouts() {
  const [items, setItems] = useState<PayoutDto[]>([])
  const [holds, setHolds] = useState<EarningsHoldDto[]>([])
  const [heldTotal, setHeldTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminPayouts()
      .then((d) => {
        setItems(d.items)
        setPendingCount(d.pendingCount)
        setPendingTotal(d.pendingTotalUsd)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load payouts'))
    api.adminEarningsHolds()
      .then((d) => {
        setHolds(d.items)
        setHeldTotal(d.totalUsd)
      })
      .catch(() => {
        setHolds([])
        setHeldTotal(0)
      })
  }
  useEffect(() => { load() }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Payouts</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Contributor payouts.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {pendingCount} pending · {money(pendingTotal)} to send. {holds.length} held · {money(heldTotal)}.
        Held rows do not pay out until staff release them. Trusted-creator fast path is not in this phase.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-sand-soft bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              <th className="px-4 py-3 font-medium">Payout</th>
              <th className="px-4 py-3 font-medium">Contributor</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Method</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Requested</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-sand-soft last:border-0 hover:bg-cream/50">
                <td className="px-4 py-3 font-mono-tech text-xs">{p.id.slice(-8)}</td>
                <td className="px-4 py-3 font-medium">@{p.contributorHandle ?? p.contributorName}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{p.methodLabel}<span className="block font-mono-tech text-[10px] text-ink-faint">{p.accountRefMasked}</span></td>
                <td className="hidden px-4 py-3 md:table-cell">{p.requestedAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right font-medium">{money(p.amountUsd)}</td>
                <td className="px-4 py-3 text-right">
                  {p.status === 'requested' ? (
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busy === p.id}
                        onClick={async () => {
                          setBusy(p.id)
                          try {
                            await api.payPayout(p.id)
                            toast.success('Marked paid')
                            load()
                          } catch (err) {
                            toast.error(err instanceof ApiError ? err.message : 'Pay failed')
                          } finally {
                            setBusy(null)
                          }
                        }}
                        className="rounded-full bg-ink px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-[#2e6b3e]"
                      >
                        Mark paid
                      </button>
                      <button
                        disabled={busy === p.id}
                        onClick={async () => {
                          setBusy(p.id)
                          try {
                            await api.rejectPayout(p.id, 'Rejected by admin')
                            toast.success('Returned to available balance')
                            load()
                          } catch (err) {
                            toast.error(err instanceof ApiError ? err.message : 'Reject failed')
                          } finally {
                            setBusy(null)
                          }
                        }}
                        className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft hover:border-[#b3382e] hover:text-[#b3382e]"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <StatusPill status={p.status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="px-4 py-6 text-sm text-ink-soft">No payout requests yet.</p>}
      </div>
      <p className="mt-4 font-mono-tech text-[10px] text-ink-faint">
        Manual payouts for now — record the transfer, then mark paid. Earnings return to the contributor if you reject.
      </p>

      {holds.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif-display text-2xl font-light">Payout holds</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-sand-soft bg-white">
            {holds.map((row) => (
              <div key={row.id} className="flex items-center justify-between border-b border-sand-soft px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{row.photoTitle}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">
                    @{row.contributorHandle ?? row.contributorName} · {row.holdReason ?? 'held'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium">{money(row.amountUsd)}</p>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={async () => {
                      setBusy(row.id)
                      try {
                        await api.releaseEarningsHold(row.id)
                        toast.success('Hold released')
                        load()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not release hold')
                      } finally {
                        setBusy(null)
                      }
                    }}
                    className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50"
                  >
                    Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
