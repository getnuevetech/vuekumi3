import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

interface SettingRow {
  key: string
  label: string
  group: string
  secret: boolean
  placeholder?: string
  configured: boolean
  value: string
  masked?: string
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Platform configuration — API keys live here, not in server env files.">
      {children}
    </AdminShell>
  )
}

export function AdminSettings() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api.adminSettings()
      .then((data) => {
        setRows(data.settings)
        const next: Record<string, string> = {}
        data.settings.forEach((s) => {
          next[s.key] = s.secret ? '' : s.value
        })
        setDrafts(next)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, SettingRow[]>()
    rows.forEach((r) => {
      const list = map.get(r.group) ?? []
      list.push(r)
      map.set(r.group, list)
    })
    return [...map.entries()]
  }, [rows])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Settings</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Integrations.</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Payment, email, AI, storage, Google sign-in, and Sentry keys live here — not in server env files.
        Leave a secret field blank to keep the current value. Google redirect URI is
        <code className="font-mono-tech text-[11px]">{`${window.location.origin}/api/auth/oauth/google/callback`}</code>.
      </p>

      {loading ? (
        <p className="mt-10 font-mono-tech text-[11px] text-ink-faint">Loading settings…</p>
      ) : (
        <form
          className="mt-8 space-y-8"
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget
            setSaving(true)
            try {
              const formData = new FormData(form)
              const payload = rows
                .map((r) => {
                  const fromDom = formData.get(r.key)
                  const value = typeof fromDom === 'string' ? fromDom : (drafts[r.key] ?? '')
                  return { key: r.key, value }
                })
                .filter((s) => s.value.trim().length > 0)
              if (payload.length === 0) {
                const stripe = rows.find((r) => r.key === 'payments.stripe.secret_key')
                toast.error(
                  stripe && !stripe.configured
                    ? 'Nothing was saved. Paste the Stripe secret key (sk_…) into Stripe secret key, then save again.'
                    : 'Nothing new to save. Leave a secret blank to keep the current value.',
                )
                return
              }
              const data = await api.updateAdminSettings(payload)
              setRows(data.settings)
              const savedLabels = rows.filter((r) => payload.some((item) => item.key === r.key)).map((r) => r.label)
              toast.success(`Saved ${savedLabels.join(', ')}`)
              setDrafts((prev) => {
                const next = { ...prev }
                data.settings.forEach((s) => {
                  if (!s.secret) next[s.key] = s.value
                })
                return next
              })
              form.querySelectorAll('input[data-secret="true"]').forEach((el) => {
                if (el instanceof HTMLInputElement) el.value = ''
              })
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Save failed')
            } finally {
              setSaving(false)
            }
          }}
        >
          {groups.map(([group, items]) => (
            <section key={group} className="rounded-2xl border border-sand-soft bg-white p-6">
              <h2 className="font-serif-display text-xl font-light">{group}</h2>
              {group === 'Payments — Stripe' && (
                <p className="mt-2 text-sm text-ink-soft">
                  Checkout uses the secret key (sk_… or rk_…). Saving only the publishable key leaves plan selection unable to start a payment.
                  Leave a secret blank to keep the current value.
                </p>
              )}
              {group === 'Email' && (
                <p className="mt-2 text-sm text-ink-soft">
                  Verification, password reset, and agency invites send through Resend once the API key is saved.
                  Leave the key blank to keep the current value. Env <code className="font-mono-tech text-[11px]">RESEND_API_KEY</code> is fallback only.
                </p>
              )}
              <div className="mt-4 grid gap-4">
                {items.map((item) => (
                  <label key={item.key} className="block">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.configured && (
                        <span className="font-mono-tech text-[9px] uppercase tracking-[0.14em] text-[#2e6b3e]">
                          {item.secret ? `Set ${item.masked}` : 'Configured'}
                        </span>
                      )}
                    </span>
                    {item.secret ? (
                      <input
                        name={item.key}
                        data-secret="true"
                        type="password"
                        autoComplete="off"
                        placeholder={item.configured ? 'Leave blank to keep current' : item.placeholder ?? 'Paste key'}
                        defaultValue=""
                        className="mt-1.5 w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
                      />
                    ) : (
                      <input
                        name={item.key}
                        type="text"
                        autoComplete="off"
                        placeholder={item.placeholder}
                        value={drafts[item.key] ?? ''}
                        onChange={(e) => setDrafts((s) => ({ ...s, [item.key]: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
                      />
                    )}
                  </label>
                ))}
              </div>
              {group === 'Email' && (
                <button
                  type="button"
                  disabled={testing}
                  onClick={async () => {
                    setTesting(true)
                    try {
                      await api.testEmail()
                      toast.success('Test email sent to your admin address')
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Test email failed')
                    } finally {
                      setTesting(false)
                    }
                  }}
                  className="mt-5 rounded-full border border-ink px-6 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper disabled:opacity-50"
                >
                  {testing ? 'Sending…' : 'Send test email'}
                </button>
              )}
            </section>
          ))}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ink px-8 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}
    </Shell>
  )
}
