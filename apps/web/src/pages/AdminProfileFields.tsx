import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PROFILE_FIELD_KEYS, PROFILE_FIELD_LABEL, type ProfileFieldKey } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

const ACCOUNT_LABEL: Record<string, string> = {
  user: 'Buyer',
  agency: 'Agency',
  photographer: 'Photographer',
  photo_influencer: 'Photo influencer',
  contributor: 'Contributor',
  model: 'Model',
  admin: 'Admin',
}

export default function AdminProfileFields() {
  const [items, setItems] = useState<{ accountType: string; fields: ProfileFieldKey[] }[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.profileFields()
      .then((page) => setItems(page.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load profile rules'))
  }, [])

  function toggle(accountType: string, field: ProfileFieldKey) {
    setItems((current) => current.map((row) => {
      if (row.accountType !== accountType) return row
      const fields = row.fields.includes(field)
        ? row.fields.filter((item) => item !== field)
        : [...row.fields, field]
      return { ...row, fields }
    }))
  }

  return (
    <AdminShell subtitle="Which profile details each account type must fill.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Users</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Profile fields.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Buyers and agencies can leave these blank unless you mark them required. Photographers, photo influencers, contributors, and models start with a few required fields. Email, first name, and last name stay required for every account.
      </p>

      <div className="mt-8 space-y-4">
        {items.map((row) => (
          <section key={row.accountType} className="rounded-3xl border border-sand-soft bg-white p-5">
            <h2 className="font-serif-display text-2xl font-light">{ACCOUNT_LABEL[row.accountType] ?? row.accountType}</h2>
            <div className="mt-4 flex flex-wrap gap-4">
              {PROFILE_FIELD_KEYS.map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.fields.includes(field)}
                    onChange={() => toggle(row.accountType, field)}
                  />
                  {PROFILE_FIELD_LABEL[field]}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || items.length === 0}
        onClick={() => {
          setBusy(true)
          api.saveProfileFields({ items })
            .then((page) => {
              setItems(page.items)
              toast.success('Profile rules saved')
            })
            .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not save profile rules'))
            .finally(() => setBusy(false))
        }}
        className="mt-6 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
      >
        Save profile rules
      </button>
    </AdminShell>
  )
}
