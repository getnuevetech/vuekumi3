import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ACCOUNT_FEATURES,
  type AccountFeatureKey,
  type AccountTypeConfigDto,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

export default function AdminAccountTypes() {
  const [items, setItems] = useState<AccountTypeConfigDto[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.adminAccountTypes()
      .then((data) => setItems(data.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load account types'))
  }, [])

  const patch = (accountType: string, next: Partial<AccountTypeConfigDto>) => {
    setItems((rows) => rows.map((row) => row.accountType === accountType ? { ...row, ...next } : row))
  }

  const toggleFeature = (accountType: string, key: AccountFeatureKey) => {
    setItems((rows) => rows.map((row) => {
      if (row.accountType !== accountType) return row
      const features = row.features.includes(key)
        ? row.features.filter((feature) => feature !== key)
        : [...row.features, key]
      return { ...row, features }
    }))
  }

  const save = async () => {
    setBusy(true)
    try {
      const saved = await api.saveAccountTypes({
        items: items.map((row) => ({ accountType: row.accountType, enabled: row.enabled, features: row.features })),
      })
      setItems(saved.items)
      toast.success('Account types saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save account types')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell subtitle="Which account types can sign up, and which features each type includes.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Users</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Account types.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Admin stays outside this matrix. Photo influencers and contributors start with the same posting and copyright-income tools. Photographers start with bookings, commercial stock, and the photographer listing. Turn a type off to close new signups. People who already have that account can still sign in.
      </p>
      <button
        type="button"
        disabled={busy || items.length === 0}
        onClick={() => void save()}
        className="mt-6 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
      >
        Save account types
      </button>
      <div className="mt-8 space-y-6">
        {items.map((row) => (
          <section key={row.accountType} className="rounded-3xl border border-sand-soft bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif-display text-2xl font-light">{row.label}</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  aria-label={`Enable ${row.label}`}
                  onChange={(e) => patch(row.accountType, { enabled: e.target.checked })}
                />
                Open for signup
              </label>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ACCOUNT_FEATURES.map((feature) => (
                <label key={feature.key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={row.features.includes(feature.key)}
                    aria-label={`${row.label} ${feature.label}`}
                    onChange={() => toggleFeature(row.accountType, feature.key)}
                  />
                  <span>
                    <span className="block">{feature.label}</span>
                    <span className="block text-ink-faint">{feature.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  )
}
