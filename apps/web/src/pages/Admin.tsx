import { useState } from 'react';
import { Link } from 'react-router';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PortalShell, StatCard, SectionHead, StatusPill, type PortalLink } from '../components/shared';
import {
  adminStats, fmt, moderationQueue, money, pendingPayouts, photoById, platformUsers, revenueSeries,
} from '../data/content';

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
  gear: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
};

export const adminLinks: PortalLink[] = [
  { to: '/admin', label: 'Overview', icon: icons.dash },
  { to: '/admin/moderation', label: 'Moderation', icon: icons.shield },
  { to: '/admin/users', label: 'Users', icon: icons.users },
  { to: '/admin/payouts', label: 'Payouts', icon: icons.money },
  { to: '/admin/settings', label: 'Settings', icon: icons.gear },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell title="Admin portal" subtitle="Template UI — wire to your admin API & roles." links={adminLinks}>
      {children}
    </PortalShell>
  );
}

/* ---------------- overview ---------------- */

export function AdminDashboard() {
  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Overview</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Platform health.</h1>
      <p className="mt-1 text-sm text-ink-soft">Vuekumi at a glance — September 2026.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total users" value={fmt(adminStats.users)} sub={`${fmt(adminStats.contributors)} contributors`} />
        <StatCard label="Photos live" value={fmt(adminStats.photos)} sub={`${adminStats.pendingReview} pending review`} />
        <StatCard label="Revenue (Aug)" value={money(adminStats.revenueMonth)} sub={`${fmt(adminStats.downloadsMonth)} downloads`} />
      </div>

      <div className="mt-10">
        <SectionHead kicker="Revenue" title="Revenue vs contributor payouts" />
        <div className="rounded-2xl border border-sand-soft bg-white p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke="#efe4da" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a7f76' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v / 1000}k`} />
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
            <h3 className="font-serif-display text-xl font-light">Moderation queue</h3>
            <Link to="/admin/moderation" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">Open →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {moderationQueue.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 border-b border-sand-soft pb-3 last:border-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={photoById(m.photoId)?.src} alt="" className="h-10 w-13 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{photoById(m.photoId)?.title}</p>
                    <p className="font-mono-tech text-[10px] text-ink-faint">{m.id} · {m.age} ago</p>
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
            {pendingPayouts.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-sand-soft pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">@{p.contributor}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{p.method}</p>
                </div>
                <span className="font-mono-tech text-xs font-medium">{money(p.amount)}</span>
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
  const [decided, setDecided] = useState<Record<string, 'approved' | 'rejected'>>({});

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Moderation</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Review queue.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {moderationQueue.length} of {adminStats.pendingReview} submissions shown — approve, reject, or escalate.
      </p>

      <div className="mt-8 space-y-4">
        {moderationQueue.map((m) => {
          const photo = photoById(m.photoId);
          if (!photo) return null;
          const d = decided[m.id];
          return (
            <div key={m.id} className="flex flex-col gap-4 rounded-2xl border border-sand-soft bg-white p-4 sm:flex-row sm:items-center">
              <img src={photo.src} alt={photo.title} className="h-36 w-full rounded-xl object-cover sm:h-28 sm:w-40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{photo.title}</p>
                  <StatusPill status={d ?? m.flag} />
                </div>
                <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                  {m.id} · by @{m.submittedBy} · {photo.country} · {photo.category} · submitted {m.age} ago
                </p>
                <p className="mt-2 line-clamp-2 text-[13px] text-ink-soft">
                  Check EXIF & source files, verify model releases for recognisable people,
                  and confirm the image meets the technical quality bar before publishing.
                </p>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <button
                  onClick={() => setDecided((s) => ({ ...s, [m.id]: 'approved' }))}
                  disabled={!!d}
                  className="flex-1 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-[#2e6b3e] disabled:opacity-30 sm:flex-none"
                >
                  Approve
                </button>
                <button
                  onClick={() => setDecided((s) => ({ ...s, [m.id]: 'rejected' }))}
                  disabled={!!d}
                  className="flex-1 rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft transition-colors hover:border-[#b3382e] hover:text-[#b3382e] disabled:opacity-30 sm:flex-none"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ---------------- users ---------------- */

export function AdminUsers() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'member' | 'contributor' | 'admin'>('all');
  const shown = platformUsers.filter(
    (u) =>
      (role === 'all' || u.role === role) &&
      (u.name.toLowerCase().includes(q.toLowerCase()) ||
        u.email.toLowerCase().includes(q.toLowerCase()) ||
        u.country.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Users</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Accounts.</h1>
      <p className="mt-1 text-sm text-ink-soft">Search, filter and manage members & contributors.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, country…"
          className="w-full max-w-xs rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-terra"
        />
        <div className="flex rounded-full border border-sand-soft bg-cream p-1">
          {(['all', 'member', 'contributor', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-full px-3.5 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors ${
                role === r ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 text-right font-medium">Downloads</th>
              <th className="px-4 py-3 text-right font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className="border-b border-sand-soft last:border-0 hover:bg-cream/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{u.email} · {u.id}</p>
                </td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3">{u.country}</td>
                <td className="px-4 py-3">{u.joined}</td>
                <td className="px-4 py-3 text-right">{fmt(u.downloads)}</td>
                <td className="px-4 py-3 text-right"><StatusPill status={u.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra hover:text-ink">
                    {u.status === 'active' ? 'Suspend' : 'Reinstate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-10 text-center font-mono-tech text-[11px] text-ink-faint">No users match this filter.</p>
        )}
      </div>
    </Shell>
  );
}

/* ---------------- payouts ---------------- */

export function AdminPayouts() {
  const [processed, setProcessed] = useState<Record<string, boolean>>({});
  const total = pendingPayouts.reduce((s, p) => s + p.amount, 0);

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Payouts</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Contributor payouts.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {pendingPayouts.length} requests · {money(total)} total · next batch Oct 1
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
            {pendingPayouts.map((p) => (
              <tr key={p.id} className="border-b border-sand-soft last:border-0 hover:bg-cream/50">
                <td className="px-4 py-3 font-mono-tech text-xs">{p.id}</td>
                <td className="px-4 py-3 font-medium">@{p.contributor}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{p.method}</td>
                <td className="hidden px-4 py-3 md:table-cell">{p.requested}</td>
                <td className="px-4 py-3 text-right font-medium">{money(p.amount)}</td>
                <td className="px-4 py-3 text-right">
                  {processed[p.id] ? (
                    <StatusPill status="paid" />
                  ) : (
                    <button
                      onClick={() => setProcessed((s) => ({ ...s, [p.id]: true }))}
                      className="rounded-full bg-ink px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-[#2e6b3e]"
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-mono-tech text-[10px] text-ink-faint">
        Template UI — connect to your payout provider (Flutterwave, Paystack, M-Pesa, bank rails).
      </p>
    </Shell>
  );
}
