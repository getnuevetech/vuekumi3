import { useEffect, useMemo, useState } from 'react'
import {
  ADMIN_CAPABILITY_GROUPS,
  accountWriteCapability,
  adminHas,
  capabilitiesForPreset,
  sameCapabilities,
  type AdminCapability,
  type AdminRole,
} from '@vuekumi/shared'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { CountrySelect, StatusPill } from '../components/shared'
import { splitDisplayName } from '@vuekumi/shared'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { api, ApiError, setActAsCreator, type AdminAccount, type GeoCountry } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { AdminShell } from './Admin'

type Kind = 'users' | 'contributors' | 'photographers' | 'influencers' | 'agencies' | 'admins' | 'models'
type StaffPreset = Exclude<AdminRole, never>

const copy: Record<Kind, { kicker: string; title: string; blurb: string }> = {
  users: { kicker: 'Users', title: 'Members.', blurb: 'Individual buyers — one row per account.' },
  photographers: { kicker: 'Photographers', title: 'Photographers.', blurb: 'Professional commercial inventory. Click a row to edit.' },
  influencers: { kicker: 'Photo influencers', title: 'Photo influencers.', blurb: 'Social and discovery creators — not photographers, not commercial stock. Click a row to edit.' },
  contributors: { kicker: 'Contributors', title: 'Community.', blurb: 'Portfolio and editorial sharing — not commercial stock. Click a row to edit.' },
  agencies: { kicker: 'Agencies', title: 'Enterprise.', blurb: 'Corporate accounts. Activate the agency entity to unlock licensing.' },
  admins: { kicker: 'Admins', title: 'Staff.', blurb: 'Roles are presets. Super-admin assigns the capability matrix. You cannot edit your own access.' },
  models: { kicker: 'Models', title: 'People in photographs.', blurb: 'Invite-only models and self-shot photographers. Confirm likeness per image. They do not earn in this phase.' },
}

const createType: Record<Exclude<Kind, 'admins'>, 'user' | 'photographer' | 'photo_influencer' | 'contributor' | 'agency' | 'model'> = {
  users: 'user',
  photographers: 'photographer',
  influencers: 'photo_influencer',
  contributors: 'contributor',
  agencies: 'agency',
  models: 'model',
}

const PRESETS: { value: StaffPreset; label: string }[] = [
  { value: 'super_admin', label: 'Super-admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'finance', label: 'Finance' },
  { value: 'support', label: 'Support' },
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Separated account types — create, edit, and activate from here.">
      {children}
    </AdminShell>
  )
}

function CapabilityMatrix({
  selected,
  onToggle,
}: {
  selected: AdminCapability[]
  onToggle: (key: AdminCapability) => void
}) {
  const set = useMemo(() => new Set(selected), [selected])
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-sand-soft p-3">
      {ADMIN_CAPABILITY_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">{group.label}</p>
          <div className="mt-1 space-y-1">
            {group.keys.map((key) => (
              <label key={key} className="flex items-start gap-2 text-[12px] text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={set.has(key)}
                  onChange={() => onToggle(key)}
                />
                <span className="font-mono-tech text-[11px]">{key}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminAccountList({ kind }: { kind: Kind }) {
  const meta = copy[kind]
  const { user } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<AdminAccount[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<AdminAccount | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', country: '', status: 'active' })
  const [agencyStatus, setAgencyStatus] = useState('pending')
  const [createDraft, setCreateDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    country: '',
  })
  const [preset, setPreset] = useState<StaffPreset>('support')
  const [caps, setCaps] = useState<AdminCapability[]>(capabilitiesForPreset('support'))
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [saving, setSaving] = useState(false)

  const writeCap = kind === 'admins' ? 'accounts.admins.manage' : accountWriteCapability(createType[kind])
  const canCreate = adminHas(user, writeCap)
  const canWrite = canCreate
  const canReset = adminHas(user, 'accounts.password_reset')
  const canActivate = adminHas(user, 'accounts.agencies.activate')
  const canActAs = adminHas(user, 'content.impersonate_creator')
    && (kind === 'photographers' || kind === 'influencers' || kind === 'contributors')
  const creatorCountry = kind === 'photographers' || kind === 'influencers' || kind === 'contributors'
  const creatorColumns = kind === 'contributors' || kind === 'photographers' || kind === 'influencers'
  const customized = !sameCapabilities(caps, capabilitiesForPreset(preset))

  const load = () => {
    api.adminAccounts(kind, { q }).then((data) => {
      setItems(data.items)
      setTotal(data.total)
    }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load'))
  }

  useEffect(() => { load() }, [kind, q])

  useEffect(() => {
    if (!creating) return
    api.countries(creatorCountry)
      .then((d) => setCountries(d.countries))
      .catch(() => setCountries([]))
  }, [creating, creatorCountry])

  const applyPreset = (next: StaffPreset) => {
    setPreset(next)
    setCaps(capabilitiesForPreset(next))
  }

  const toggleCap = (key: AdminCapability) => {
    setCaps((current) => current.includes(key) ? current.filter((k) => k !== key) : [...current, key])
  }

  const openRow = async (u: AdminAccount) => {
    const parts = splitDisplayName(u.name)
    setDraft({
      firstName: u.firstName || parts.firstName,
      lastName: u.lastName || parts.lastName,
      email: u.email,
      country: u.country ?? '',
      status: u.status,
    })
    setAgencyStatus(u.agencyStatus ?? 'pending')
    setSelected(u)
    const nextPreset = (u.adminRole as StaffPreset | null) ?? 'support'
    setPreset(nextPreset)
    setCaps(u.adminCapabilities?.length ? u.adminCapabilities : capabilitiesForPreset(nextPreset))
    try {
      const detail = await api.adminAccount(u.id)
      setSelected(detail.user)
      const detailParts = splitDisplayName(detail.user.name)
      setDraft({
        firstName: detail.user.firstName || detailParts.firstName,
        lastName: detail.user.lastName || detailParts.lastName,
        email: detail.user.email,
        country: detail.user.country ?? '',
        status: detail.user.status,
      })
      setAgencyStatus(detail.user.agencyStatus ?? 'pending')
      const role = (detail.user.adminRole as StaffPreset | null) ?? nextPreset
      setPreset(role)
      setCaps(detail.user.adminCapabilities?.length ? detail.user.adminCapabilities : capabilitiesForPreset(role))
    } catch {
      /* list row is enough if detail fails */
    }
  }

  const columns = creatorColumns
    ? ['ID', 'Name', 'Email', 'Handle', 'Country', 'Photos', 'Earnings', 'Status']
    : kind === 'models'
      ? ['ID', 'Name', 'Email', 'Handle', 'Country', 'Appearances', 'Joined', 'Status']
      : kind === 'agencies'
        ? ['ID', 'Name', 'Email', 'Agency', 'Agency status', 'Country', 'Joined', 'Status']
        : kind === 'admins'
          ? ['ID', 'Name', 'Email', 'Role', 'Access', 'Country', 'Joined', 'Status']
          : ['ID', 'Name', 'Email', 'Country', 'Plan', 'Downloads', 'Joined', 'Status']

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{meta.kicker}</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{meta.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{meta.blurb} {total} records.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, country…"
          className="w-full max-w-xs rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
        />
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setCreateDraft({ firstName: '', lastName: '', email: '', password: '', country: '' })
              applyPreset('support')
              setCreating(true)
            }}
            className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra"
          >
            {kind === 'admins' ? 'Create staff' : 'Create account'}
          </button>
        )}
      </div>

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
                onClick={() => { void openRow(u) }}
                className="cursor-pointer border-b border-sand-soft last:border-0 hover:bg-cream/50"
              >
                <td className="px-4 py-3 font-mono-tech text-[11px]">{u.id.slice(-8)}</td>
                <td className="px-4 py-3 font-medium">{u.name}{kind === 'models' && u.dualRole ? ' · photographer' : ''}</td>
                <td className="px-4 py-3">{u.email}</td>
                {creatorColumns && <td className="px-4 py-3">@{u.handle}</td>}
                {kind === 'models' && <td className="px-4 py-3">@{u.handle}</td>}
                {kind === 'agencies' && <td className="px-4 py-3">{u.agencyName}</td>}
                {kind === 'agencies' && (
                  <td className="px-4 py-3"><StatusPill status={u.agencyStatus ?? 'pending'} /></td>
                )}
                {kind === 'admins' && <td className="px-4 py-3 capitalize">{(u.adminRole ?? 'support').replace('_', ' ')}</td>}
                {kind === 'admins' && (
                  <td className="px-4 py-3 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {u.adminCapabilitiesCustomized ? 'Custom' : 'Preset'}
                  </td>
                )}
                <td className="px-4 py-3">{u.country ?? '—'}</td>
                {kind === 'users' && <td className="px-4 py-3 capitalize">{u.plan ?? 'free'}</td>}
                {creatorColumns && <td className="px-4 py-3">{u.photos}</td>}
                {creatorColumns && <td className="px-4 py-3">${u.earnings.toFixed(0)}</td>}
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
              <label className="block text-sm">First name
                <input required value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Last name
                <input required value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Email
                <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Country
                <CountrySelect
                  countries={countries}
                  value={draft.country}
                  onChange={(code) => setDraft({ ...draft, country: code })}
                  placeholder="Country"
                  className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm outline-none focus:border-terra"
                />
              </label>
              <label className="block text-sm">Status
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm">
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="pending">pending</option>
                </select>
              </label>
              {selected.agencyId && canActivate && (
                <label className="block text-sm">Agency licensing
                  <select value={agencyStatus} onChange={(e) => setAgencyStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm">
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                </label>
              )}
              {kind === 'admins' && canWrite && selected.id !== user?.id && (
                <>
                  <label className="block text-sm">Preset
                    <select
                      value={preset}
                      onChange={(e) => applyPreset(e.target.value as StaffPreset)}
                      className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm"
                    >
                      {PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                    {customized ? 'Custom capabilities' : 'Preset capabilities'}
                  </p>
                  <CapabilityMatrix selected={caps} onToggle={toggleCap} />
                </>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {canWrite && (
                  <button
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true)
                      try {
                        await api.patchAccount(selected.id, draft)
                        if (kind === 'admins' && selected.id !== user?.id) {
                          await api.patchAdmin(selected.id, {
                            preset,
                            capabilities: customized ? caps : undefined,
                          })
                        }
                        if (selected.agencyId && canActivate && agencyStatus !== (selected.agencyStatus ?? 'pending')) {
                          await api.setAgencyStatus(selected.agencyId, agencyStatus as 'pending' | 'active' | 'suspended')
                        }
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
                )}
                {canReset && (
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
                )}
                {canActAs && selected.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => {
                      const label = selected.handle
                        ? `${selected.name} (@${selected.handle})`
                        : selected.name
                      setActAsCreator({ id: selected.id, label })
                      toast.success(`Acting as ${label}`)
                      navigate('/contributor')
                    }}
                    className="rounded-full border border-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink hover:bg-ink hover:text-paper"
                  >
                    Open as creator
                  </button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif-display text-2xl font-light">
              {kind === 'admins' ? 'Create staff' : 'Create account'}
            </SheetTitle>
          </SheetHeader>
          {canCreate && (
            <form
              className="space-y-3 px-4 pb-8"
              onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                try {
                  if (kind === 'admins') {
                    await api.createAdmin({
                      email: createDraft.email,
                      firstName: createDraft.firstName,
                      lastName: createDraft.lastName,
                      password: createDraft.password,
                      country: createDraft.country || undefined,
                      preset,
                      capabilities: customized ? caps : undefined,
                    })
                  } else {
                    await api.createAccount({
                      email: createDraft.email,
                      firstName: createDraft.firstName,
                      lastName: createDraft.lastName,
                      password: createDraft.password,
                      accountType: createType[kind],
                      country: createDraft.country || undefined,
                    })
                  }
                  toast.success(kind === 'admins' ? 'Staff created' : 'Account created')
                  setCreating(false)
                  load()
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Could not create the account')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                {copy[kind].kicker}
              </p>
              <label className="block text-sm">First name
                <input required value={createDraft.firstName} onChange={(e) => setCreateDraft({ ...createDraft, firstName: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Last name
                <input required value={createDraft.lastName} onChange={(e) => setCreateDraft({ ...createDraft, lastName: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Email
                <input required type="email" value={createDraft.email} onChange={(e) => setCreateDraft({ ...createDraft, email: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              <label className="block text-sm">Temporary password
                <input required minLength={8} type="password" value={createDraft.password} onChange={(e) => setCreateDraft({ ...createDraft, password: e.target.value })} className="mt-1 w-full rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
              </label>
              {kind !== 'admins' && (
                <label className="block text-sm">{creatorCountry ? 'African country' : 'Country (optional)'}
                  <select
                    required={creatorCountry}
                    value={createDraft.country}
                    onChange={(e) => setCreateDraft({ ...createDraft, country: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{creatorCountry ? 'Select country' : 'None'}</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>{c.name} · {c.code}</option>
                    ))}
                  </select>
                </label>
              )}
              {kind === 'agencies' && (
                <p className="font-mono-tech text-[10px] text-ink-faint">
                  New agencies start pending. Open the row after create to activate licensing.
                </p>
              )}
              {kind === 'admins' && (
                <>
                  <label className="block text-sm">Preset
                    <select
                      value={preset}
                      onChange={(e) => applyPreset(e.target.value as StaffPreset)}
                      className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm"
                    >
                      {PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
                    {customized ? 'Custom capabilities' : 'Preset capabilities — tick to customise'}
                  </p>
                  <CapabilityMatrix selected={caps} onToggle={toggleCap} />
                </>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra"
              >
                Create
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </Shell>
  )
}

export function AdminUsers() { return <AdminAccountList kind="users" /> }
export function AdminPhotographers() { return <AdminAccountList kind="photographers" /> }
export function AdminInfluencers() { return <AdminAccountList kind="influencers" /> }
export function AdminContributors() { return <AdminAccountList kind="contributors" /> }
export function AdminAgencies() { return <AdminAccountList kind="agencies" /> }
export function AdminAdmins() { return <AdminAccountList kind="admins" /> }
export function AdminModels() { return <AdminAccountList kind="models" /> }
