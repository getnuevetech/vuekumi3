import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PortalShell, StatusPill } from '../components/shared'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { api, ApiError, type AdminAccount } from '../api/client'
import { adminLinks } from './Admin'

type Kind = 'users' | 'contributors' | 'agencies' | 'admins' | 'models'

const copy: Record<Kind, { kicker: string; title: string; blurb: string }> = {
  users: { kicker: 'Users', title: 'Members.', blurb: 'Individual buyers — one row per account.' },
  contributors: { kicker: 'Contributors', title: 'Photographers.', blurb: 'African creators only. Click a row to edit.' },
  agencies: { kicker: 'Agencies', title: 'Enterprise.', blurb: 'Corporate accounts pending or approved.' },
  admins: { kicker: 'Admins', title: 'Staff.', blurb: 'Platform administrators.' },
  models: { kicker: 'Models', title: 'People in photographs.', blurb: 'Invite-only. Confirm likeness per image. They do not earn in this phase.' },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell title="Admin portal" subtitle="Separated account types — click a row to edit." links={adminLinks}>
      {children}
    </PortalShell>
  )
}

export function AdminAccountList({ kind }: { kind: Kind }) {
  const meta = copy[kind]
  const [q, setQ] = useState('')
  const [items, setItems] = useState<AdminAccount[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<AdminAccount | null>(null)
  const [draft, setDraft] = useState({ name: '', email: '', country: '', status: 'active' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.adminAccounts(kind, { q }).then((data) => {
      setItems(data.items)
      setTotal(data.total)
    }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load'))
  }

  useEffect(() => { load() }, [kind, q])

  const columns = kind === 'contributors'
    ? ['ID', 'Name', 'Email', 'Handle', 'Country', 'Photos', 'Earnings', 'Status']
    : kind === 'models'
      ? ['ID', 'Name', 'Email', 'Handle', 'Country', 'Appearances', 'Joined', 'Status']
      : kind === 'agencies'
      ? ['ID', 'Name', 'Email', 'Agency', 'Country', 'Joined', 'Status']
      : kind === 'admins'
        ? ['ID', 'Name', 'Email', 'Role', 'Country', 'Joined', 'Status']
        : ['ID', 'Name', 'Email', 'Country', 'Plan', 'Downloads', 'Joined', 'Status']

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{meta.kicker}</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{meta.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{meta.blurb} {total} records.</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email, country…"
        className="mt-6 w-full max-w-xs rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
      />

      <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {columns.map((c) => (
                <th key={c} className="px-4 py-3 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr
                key={u.id}
                onClick={() => {
                  setSelected(u)
                  setDraft({ name: u.name, email: u.email, country: u.country ?? '', status: u.status })
                }}
                className="cursor-pointer border-b border-sand-soft last:border-0 hover:bg-cream/50"
              >
                <td className="px-4 py-3 font-mono-tech text-[11px]">{u.id.slice(-8)}</td>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                {kind === 'contributors' && <td className="px-4 py-3">@{u.handle}</td>}
                {kind === 'models' && <td className="px-4 py-3">@{u.handle}</td>}
                {kind === 'agencies' && <td className="px-4 py-3">{u.agencyName}</td>}
                {kind === 'admins' && <td className="px-4 py-3 capitalize">{u.adminRole}</td>}
                <td className="px-4 py-3">{u.country ?? '—'}</td>
                {kind === 'users' && <td className="px-4 py-3 capitalize">{u.plan ?? 'free'}</td>}
                {kind === 'contributors' && <td className="px-4 py-3">{u.photos}</td>}
                {kind === 'contributors' && <td className="px-4 py-3">${u.earnings.toFixed(0)}</td>}
                {kind === 'models' && <td className="px-4 py-3">{u.appearances ?? 0}</td>}
                {kind === 'users' && <td className="px-4 py-3">{u.downloads}</td>}
                {(kind === 'users' || kind === 'agencies' || kind === 'admins' || kind === 'models') && <td className="px-4 py-3">{u.joined}</td>}
                <td className="px-4 py-3"><StatusPill status={u.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="px-4 py-10 text-center font-mono-tech text-[11px] text-ink-faint">No accounts match.</p>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif-display text-2xl font-light">Edit account</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-3 px-4 pb-8">
              <p className="font-mono-tech text-[10px] text-ink-faint">{selected.id}</p>
              <label className="block text-sm">Name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Email
                <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Country (ISO)
                <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Status
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm">
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="pending">pending</option>
                </select>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await api.patchAccount(selected.id, draft)
                      toast.success('Account updated')
                      setSelected(null)
                      load()
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Update failed')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra"
                >
                  Save
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.sendPasswordReset(selected.id)
                      toast.success('Reset link sent')
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Could not send reset')
                    }
                  }}
                  className="rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft hover:border-terra"
                >
                  Send password reset
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Shell>
  )
}

export function AdminUsers() { return <AdminAccountList kind="users" /> }
export function AdminContributors() { return <AdminAccountList kind="contributors" /> }
export function AdminAgencies() { return <AdminAccountList kind="agencies" /> }
export function AdminAdmins() { return <AdminAccountList kind="admins" /> }
export function AdminModels() { return <AdminAccountList kind="models" /> }
