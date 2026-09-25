import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  applyShareFormula,
  SHARE_GROUP_LABEL,
  SHARE_MODES,
  type ShareAdminDto,
  type ShareAccountSearchDto,
  type ShareFormulaInput,
  type ShareGroup,
  type ShareMode,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'
import { money } from '../lib/format'

const field = 'mt-1 w-full rounded-2xl border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra'
const label = 'font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint'

function FormulaFields({
  value,
  onChange,
}: {
  value: ShareFormulaInput
  onChange: (next: ShareFormulaInput) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="block">
        <span className={label}>Formula</span>
        <select
          className={field}
          value={value.mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value as ShareMode })}
        >
          {SHARE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode === 'percentage' ? 'Percentage' : mode === 'fixed' ? 'Fixed amount' : 'Percentage and fixed'}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Percent of the sale</span>
        <input
          className={field}
          type="number"
          min={0}
          max={100}
          step={1}
          value={value.percent}
          onChange={(e) => onChange({ ...value, percent: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        <span className={label}>Fixed USD</span>
        <input
          className={field}
          type="number"
          min={0}
          step={0.01}
          value={value.fixedUsd}
          onChange={(e) => onChange({ ...value, fixedUsd: Number(e.target.value) })}
        />
      </label>
    </div>
  )
}

export default function AdminShares() {
  const [data, setData] = useState<ShareAdminDto | null>(null)
  const [groups, setGroups] = useState<Record<string, ShareFormulaInput>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<ShareAccountSearchDto[]>([])
  const [picked, setPicked] = useState<ShareAccountSearchDto | null>(null)
  const [personal, setPersonal] = useState<ShareFormulaInput>({ mode: 'percentage', percent: 50, fixedUsd: 0 })

  const load = () => {
    api.adminShares().then((next) => {
      setData(next)
      const map: Record<string, ShareFormulaInput> = {}
      for (const group of next.groups) {
        map[group.groupKey] = { mode: group.mode, percent: group.percent, fixedUsd: group.fixedUsd }
      }
      setGroups(map)
    }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load profit sharing'))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setFound([])
      return
    }
    const handle = window.setTimeout(() => {
      api.searchShareAccounts(query.trim())
        .then((d) => setFound(d.items))
        .catch(() => setFound([]))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query])

  const saveGroup = async (groupKey: ShareGroup) => {
    const formula = groups[groupKey]
    if (!formula) return
    setBusy(groupKey)
    try {
      const next = await api.saveShareGroup(groupKey, formula)
      setData(next)
      toast.success(`${SHARE_GROUP_LABEL[groupKey]} formula saved`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save formula')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminShell subtitle="Contributor payout formulas by group and by account.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Money</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Profit sharing.</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Each paid licence pays the photographer, photo influencer, or contributor who owns the image.
        A percentage takes that share of the sale. A fixed amount pays that many dollars, never more than the sale.
        Both adds them, then stops at the sale price. An account formula replaces the group formula for that person.
        Models do not earn from licences. The public share line follows the photographer percentage while that group stays on percentage.
      </p>

      <div className="mt-8 space-y-4">
        {(data?.groups ?? []).map((group) => {
          const formula = groups[group.groupKey] ?? group
          return (
            <section key={group.groupKey} className="rounded-3xl border border-sand-soft bg-white p-5">
              <h2 className="font-serif-display text-2xl font-light">{SHARE_GROUP_LABEL[group.groupKey]}</h2>
              <p className="mt-1 text-sm text-ink-soft">On a $10 sale this group receives {money(applyShareFormula(10, formula))}.</p>
              <div className="mt-4">
                <FormulaFields value={formula} onChange={(next) => setGroups((prev) => ({ ...prev, [group.groupKey]: next }))} />
              </div>
              <button
                type="button"
                disabled={busy === group.groupKey}
                onClick={() => void saveGroup(group.groupKey)}
                className="mt-4 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
              >
                Save {SHARE_GROUP_LABEL[group.groupKey].toLowerCase()}
              </button>
            </section>
          )
        })}
      </div>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">One account</h2>
        <p className="mt-1 text-sm text-ink-soft">Use this when a contributor negotiated a different formula from their group.</p>
        <label className="mt-4 block max-w-md">
          <span className={label}>Search name, email, or handle</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={field} placeholder="amara" aria-label="Search contributor" />
        </label>
        {found.length > 0 && (
          <ul className="mt-3 divide-y divide-sand-soft rounded-2xl border border-sand-soft">
            {found.map((row) => (
              <li key={row.userId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-cream/60"
                  onClick={() => {
                    setPicked(row)
                    setPersonal(row.formula ?? { mode: 'percentage', percent: 50, fixedUsd: 0 })
                  }}
                >
                  <span>{row.name} · @{row.handle ?? 'no handle'} · {row.email}</span>
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">{row.accountType}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <div className="mt-4">
            <p className="text-sm font-medium">{picked.name}</p>
            <p className="mt-1 text-sm text-ink-soft">On a $10 sale this account receives {money(applyShareFormula(10, personal))}.</p>
            <div className="mt-3">
              <FormulaFields value={personal} onChange={setPersonal} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === picked.userId}
                onClick={async () => {
                  setBusy(picked.userId)
                  try {
                    const next = await api.saveShareAccount({ userId: picked.userId, ...personal })
                    setData(next)
                    toast.success('Account formula saved')
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not save account formula')
                  } finally {
                    setBusy(null)
                  }
                }}
                className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
              >
                Save account formula
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const next = await api.clearShareAccount(picked.userId)
                    setData(next)
                    setPersonal({ mode: 'percentage', percent: 50, fixedUsd: 0 })
                    toast.success('Account uses the group formula again')
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not clear account formula')
                  }
                }}
                className="rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em]"
              >
                Use group formula
              </button>
            </div>
          </div>
        )}

        {(data?.overrides.length ?? 0) > 0 && (
          <div className="mt-6">
            <h3 className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">Negotiated accounts</h3>
            <ul className="mt-2 divide-y divide-sand-soft">
              {data?.overrides.map((row) => (
                <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span>{row.name} · {row.email}</span>
                  <span className="text-ink-soft">
                    {row.mode} · {row.percent}% · {money(row.fixedUsd)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </AdminShell>
  )
}
