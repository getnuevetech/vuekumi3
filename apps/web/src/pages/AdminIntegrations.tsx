import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { StatusPill } from '../components/shared'
import {
  api,
  ApiError,
  AI_PROVIDER_PURPOSES,
  AI_PROVIDER_PURPOSE_LABELS,
  type AiProvider,
  type AiProviderPurpose,
  type GeoCountry,
  type PaymentGateway,
} from '../api/client'
import { AdminShell } from './Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Every payment gateway and AI provider already added to the platform.">
      {children}
    </AdminShell>
  )
}

const fieldClass = 'rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm outline-none focus:border-terra'
const actionClass = 'font-mono-tech text-[10px] uppercase text-terra'

function slugify(value: string) {
  return value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function kindLabel(kind: string) {
  if (kind === 'payout') return 'Payout'
  if (kind === 'checkout') return 'Checkout'
  if (kind === 'both') return 'Payout and checkout'
  return kind
}

function purposeLabel(purpose: string) {
  if (purpose === 'vision') return 'Vision (older purpose)'
  return purpose in AI_PROVIDER_PURPOSE_LABELS
    ? AI_PROVIDER_PURPOSE_LABELS[purpose as AiProviderPurpose]
    : purpose
}

function credentialLabels(slug: string) {
  const key = slug.toLowerCase()
  if (key === 'stripe' || key.startsWith('stripe-')) {
    return {
      public: 'Publishable key (pk_…)',
      secret: 'Secret key (sk_… or rk_…)',
      webhook: 'Webhook secret (whsec_…)',
    }
  }
  if (key === 'flutterwave' || key.startsWith('flutterwave-')) {
    return { public: 'Public key', secret: 'Secret key', webhook: 'Webhook hash' }
  }
  return { public: 'Public key', secret: 'Secret / API key', webhook: 'Webhook secret' }
}

function keyStatus(input: {
  has: boolean
  readable?: boolean
  masked?: string
  source?: string | null
}) {
  if (input.has && input.readable === false) return 'Replace stored key'
  if (!input.has) return 'No key yet'
  const where = input.source === 'settings' ? 'from Settings' : 'saved here'
  return `${input.masked || '••••'} · ${where}`
}

function secretPlaceholder(input: {
  has: boolean
  readable?: boolean
  masked?: string
  source?: string | null
  empty: string
}) {
  if (input.has && input.readable === false) return 'Stored key could not be read. Paste a replacement.'
  if (input.source === 'settings') return `Still in old Settings (${input.masked || '••••'}). Paste a key to save it on this row.`
  if (input.has) return `Leave blank to keep ${input.masked || 'the current key'}`
  return input.empty
}

function CountryMultiSelect({
  countries,
  value,
  onChange,
}: {
  countries: GeoCountry[]
  value: string[]
  onChange: (codes: string[]) => void
}) {
  const extras = value.filter((code) => !countries.some((c) => c.code === code))
  return (
    <select
      multiple
      value={value}
      onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((option) => option.value))}
      className={`${fieldClass} min-h-28 w-full`}
    >
      {extras.map((code) => (
        <option key={code} value={code}>{code}</option>
      ))}
      {countries.map((c) => (
        <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
      ))}
    </select>
  )
}

function CurrencyMultiSelect({
  countries,
  value,
  onChange,
}: {
  countries: GeoCountry[]
  value: string[]
  onChange: (codes: string[]) => void
}) {
  const known = useMemo(
    () => [...new Set(countries.map((c) => c.currency).filter(Boolean))].sort(),
    [countries],
  )
  const extras = value.filter((code) => !known.includes(code))
  return (
    <select
      multiple
      value={value}
      onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((option) => option.value))}
      className={`${fieldClass} min-h-28 w-full`}
    >
      {extras.map((code) => (
        <option key={code} value={code}>{code}</option>
      ))}
      {known.map((code) => (
        <option key={code} value={code}>{code}</option>
      ))}
    </select>
  )
}

function coverage(codes: string[], empty: string) {
  if (!codes.length) return empty
  if (codes.length <= 4) return codes.join(', ')
  return `${codes.slice(0, 3).join(', ')} +${codes.length - 3}`
}

export function AdminGateways() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    api.adminGateways()
      .then((d) => {
        setGateways(d.gateways)
        setLoadError(null)
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Could not load gateways'))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    api.countries().then((d) => setCountries(d.countries)).catch(() => setCountries([]))
  }, [])

  const editing = gateways.find((g) => g.id === editingId) ?? null

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Payment gateways</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Added gateways.</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Every gateway already on the platform is listed here. Open a row to change its name, countries, currencies, and keys.
            A key marked “from Settings” was saved on the old settings page and still works until you replace it here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((open) => !open)}
          className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper"
        >
          {showAdd ? 'Close add form' : 'Add a gateway'}
        </button>
      </div>

      {showAdd && (
        <AddGatewayForm
          countries={countries}
          onAdded={() => {
            setShowAdd(false)
            load()
          }}
        />
      )}

      <section className="mt-8">
        <h2 className="font-serif-display text-2xl font-light">Added gateways ({gateways.length})</h2>
        {loading && <p className="mt-4 text-sm text-ink-faint">Loading gateways…</p>}
        {loadError && (
          <p className="mt-4 rounded-2xl border border-[#b3382e]/30 bg-white px-4 py-3 text-sm text-[#b3382e]">{loadError}</p>
        )}
        {!loading && !loadError && gateways.length === 0 && (
          <p className="mt-4 rounded-2xl border border-sand-soft bg-white px-4 py-6 text-sm text-ink-soft">
            No payment gateways have been added yet.
          </p>
        )}
        {gateways.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-normal">Gateway</th>
                  <th className="px-4 py-3 font-normal">Kind</th>
                  <th className="px-4 py-3 font-normal">Countries</th>
                  <th className="px-4 py-3 font-normal">Currencies</th>
                  <th className="px-4 py-3 font-normal">Key</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal" />
                </tr>
              </thead>
              <tbody>
                {gateways.map((gateway) => (
                  <tr key={gateway.id} className={editingId === gateway.id ? 'bg-sand-soft/40' : undefined}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{gateway.name}</p>
                      <p className="font-mono-tech text-[10px] text-ink-faint">/{gateway.slug}</p>
                    </td>
                    <td className="px-4 py-3">{kindLabel(gateway.kind)}</td>
                    <td className="px-4 py-3">{coverage(gateway.countries, 'All')}</td>
                    <td className="px-4 py-3">{coverage(gateway.currencies, 'All')}</td>
                    <td className="px-4 py-3">
                      {keyStatus({
                        has: gateway.hasSecret,
                        readable: gateway.secretReadable,
                        masked: gateway.secretMasked,
                        source: gateway.secretSource,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={gateway.enabled ? 'active' : 'suspended'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className={actionClass} onClick={() => setEditingId(editingId === gateway.id ? null : gateway.id)}>
                        {editingId === gateway.id ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <GatewayEditor
          key={`${editing.id}:${editing.updatedAt ?? ''}:${editing.secretMasked ?? ''}:${editing.publicKey ?? ''}`}
          gateway={editing}
          countries={countries}
          onCancel={() => setEditingId(null)}
          onSaved={load}
          onDeleted={() => {
            setEditingId(null)
            load()
          }}
        />
      )}
    </Shell>
  )
}

function AddGatewayForm({ countries, onAdded }: { countries: GeoCountry[]; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: '', slug: '', kind: 'payout', countries: [] as string[], currencies: [] as string[], secretKey: '', webhookSecret: '', publicKey: '', notes: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const labels = credentialLabels(form.slug || form.name)

  return (
    <form
      className="mt-6 grid gap-3 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.createGateway({
            ...form,
            slug: slugify(form.slug),
          })
          toast.success('Gateway added')
          onAdded()
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not add gateway')
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="font-serif-display text-xl font-light md:col-span-2">Add a gateway</p>
      <label className="block text-sm">Name
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Slug
        <input required value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }) }} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Kind
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={`${fieldClass} mt-1 w-full`}>
          <option value="payout">Payout (contributors)</option>
          <option value="checkout">Checkout (buyers)</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="block text-sm">Notes
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Countries
        <CountryMultiSelect countries={countries} value={form.countries} onChange={(codes) => setForm({ ...form, countries: codes })} />
        <span className="mt-1 block text-xs text-ink-faint">Leave none selected to allow every country.</span>
      </label>
      <label className="block text-sm">Currencies
        <CurrencyMultiSelect countries={countries} value={form.currencies} onChange={(codes) => setForm({ ...form, currencies: codes })} />
        <span className="mt-1 block text-xs text-ink-faint">Leave none selected to allow every currency.</span>
      </label>
      <label className="block text-sm">{labels.public}
        <input value={form.publicKey} onChange={(e) => setForm({ ...form, publicKey: e.target.value })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">{labels.webhook}
        <input type="password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm md:col-span-2">{labels.secret}
        <input type="password" value={form.secretKey} onChange={(e) => setForm({ ...form, secretKey: e.target.value })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper disabled:opacity-50 md:col-span-2">
        {busy ? 'Adding…' : 'Add gateway'}
      </button>
    </form>
  )
}

function GatewayEditor({
  gateway,
  countries,
  onCancel,
  onSaved,
  onDeleted,
}: {
  gateway: PaymentGateway & { updatedAt?: string }
  countries: GeoCountry[]
  onCancel: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(gateway.name)
  const [slug, setSlug] = useState(gateway.slug)
  const [kind, setKind] = useState(gateway.kind)
  const [selectedCountries, setSelectedCountries] = useState(gateway.countries)
  const [currencies, setCurrencies] = useState(gateway.currencies)
  const [publicKey, setPublicKey] = useState(gateway.publicKey ?? '')
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [notes, setNotes] = useState(gateway.notes ?? '')
  const [enabled, setEnabled] = useState(gateway.enabled)
  const [busy, setBusy] = useState(false)
  const labels = credentialLabels(slug)

  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.patchGateway(gateway.id, {
            name,
            slug,
            kind,
            countries: selectedCountries,
            currencies,
            publicKey,
            notes,
            enabled,
            ...(secretKey ? { secretKey } : {}),
            ...(webhookSecret ? { webhookSecret } : {}),
          })
          toast.success(`${name} saved`)
          setSecretKey('')
          setWebhookSecret('')
          onSaved()
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not save gateway')
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="md:col-span-2">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-terra">Edit gateway</p>
        <h2 className="font-serif-display text-2xl font-light">{gateway.name}</h2>
      </div>
      <label className="block text-sm">Name
        <input required value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Slug
        <input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Kind
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${fieldClass} mt-1 w-full`}>
          <option value="payout">Payout (contributors)</option>
          <option value="checkout">Checkout (buyers)</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="mt-6 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enabled
      </label>
      <label className="block text-sm">Countries
        <CountryMultiSelect countries={countries} value={selectedCountries} onChange={setSelectedCountries} />
        <span className="mt-1 block text-xs text-ink-faint">Leave none selected to allow every country.</span>
      </label>
      <label className="block text-sm">Currencies
        <CurrencyMultiSelect countries={countries} value={currencies} onChange={setCurrencies} />
        <span className="mt-1 block text-xs text-ink-faint">Leave none selected to allow every currency.</span>
      </label>
      <label className="block text-sm">{labels.public}
        {gateway.publicKeySource === 'settings' && (
          <span className="ml-2 font-mono-tech text-[10px] uppercase text-ink-faint">from Settings</span>
        )}
        <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">{labels.webhook}
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={secretPlaceholder({
            has: Boolean(gateway.hasWebhook),
            readable: gateway.webhookReadable,
            masked: gateway.webhookMasked,
            source: gateway.webhookSource,
            empty: 'Optional',
          })}
          className={`${fieldClass} mt-1 w-full`}
        />
      </label>
      <label className="block text-sm md:col-span-2">{labels.secret}
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={secretPlaceholder({
            has: gateway.hasSecret,
            readable: gateway.secretReadable,
            masked: gateway.secretMasked,
            source: gateway.secretSource,
            empty: 'Paste a key',
          })}
          className={`${fieldClass} mt-1 w-full`}
        />
      </label>
      <label className="block text-sm md:col-span-2">Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper disabled:opacity-50">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className={actionClass}>Cancel</button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`Delete ${gateway.name}?`)) return
            try {
              await api.deleteGateway(gateway.id)
              toast.success('Gateway deleted')
              onDeleted()
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not delete gateway')
            }
          }}
          className="font-mono-tech text-[10px] uppercase text-[#b3382e]"
        >
          Delete
        </button>
      </div>
    </form>
  )
}

export function AdminAiProviders() {
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    api.adminAiProviders()
      .then((d) => {
        setProviders(d.providers)
        setLoadError(null)
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Could not load providers'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const editing = providers.find((p) => p.id === editingId) ?? null

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">AI APIs</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Added providers.</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Every AI provider already on the platform is listed here. Open a row to change its purpose, model, and key.
            Lowest priority number is tried first. A key marked “from Settings” still works until you replace it here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((open) => !open)}
          className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper"
        >
          {showAdd ? 'Close add form' : 'Add an AI provider'}
        </button>
      </div>

      {showAdd && (
        <AddProviderForm onAdded={() => { setShowAdd(false); load() }} />
      )}

      <section className="mt-8">
        <h2 className="font-serif-display text-2xl font-light">Added AI providers ({providers.length})</h2>
        {loading && <p className="mt-4 text-sm text-ink-faint">Loading providers…</p>}
        {loadError && (
          <p className="mt-4 rounded-2xl border border-[#b3382e]/30 bg-white px-4 py-3 text-sm text-[#b3382e]">{loadError}</p>
        )}
        {!loading && !loadError && providers.length === 0 && (
          <p className="mt-4 rounded-2xl border border-sand-soft bg-white px-4 py-6 text-sm text-ink-soft">
            No AI providers have been added yet.
          </p>
        )}
        {providers.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-normal">Provider</th>
                  <th className="px-4 py-3 font-normal">Purpose</th>
                  <th className="px-4 py-3 font-normal">Priority</th>
                  <th className="px-4 py-3 font-normal">Model</th>
                  <th className="px-4 py-3 font-normal">Key</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal" />
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id} className={editingId === provider.id ? 'bg-sand-soft/40' : undefined}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{provider.name}</p>
                      <p className="font-mono-tech text-[10px] text-ink-faint">/{provider.slug}</p>
                    </td>
                    <td className="px-4 py-3">{purposeLabel(provider.purpose)}</td>
                    <td className="px-4 py-3">{provider.priority}</td>
                    <td className="px-4 py-3">
                      {provider.model || 'Default'}
                      {provider.modelSource === 'settings' ? ' · from Settings' : ''}
                    </td>
                    <td className="px-4 py-3">
                      {keyStatus({
                        has: provider.hasKey,
                        readable: provider.keyReadable,
                        masked: provider.keyMasked,
                        source: provider.keySource,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={provider.enabled ? 'active' : 'suspended'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className={actionClass} onClick={() => setEditingId(editingId === provider.id ? null : provider.id)}>
                        {editingId === provider.id ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <ProviderEditor
          key={`${editing.id}:${editing.model ?? ''}:${editing.keyMasked ?? ''}`}
          provider={editing}
          onCancel={() => setEditingId(null)}
          onSaved={load}
          onDeleted={() => { setEditingId(null); load() }}
        />
      )}
    </Shell>
  )
}

function AddProviderForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({
    name: '', slug: '', purpose: 'image_analysis' as AiProviderPurpose, priority: 0, apiBaseUrl: '', apiKey: '', model: '', notes: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="mt-6 grid gap-3 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.createAiProvider({ ...form, slug: slugify(form.slug) })
          toast.success('Provider added')
          onAdded()
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not add provider')
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="font-serif-display text-xl font-light md:col-span-2">Add an AI provider</p>
      <label className="block text-sm">Name
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Slug
        <input required value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }) }} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Purpose
        <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as AiProviderPurpose })} className={`${fieldClass} mt-1 w-full`}>
          {AI_PROVIDER_PURPOSES.map((purpose) => (
            <option key={purpose} value={purpose}>{AI_PROVIDER_PURPOSE_LABELS[purpose]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">Priority
        <input type="number" min={0} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })} className={`${fieldClass} mt-1 w-full`} />
        <span className="mt-1 block text-xs text-ink-faint">0 is tried first.</span>
      </label>
      <label className="block text-sm">API base URL
        <input value={form.apiBaseUrl} onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })} placeholder="https://api.openai.com/v1" className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Model
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o-mini" className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm md:col-span-2">API key
        <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm md:col-span-2">Notes
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper disabled:opacity-50 md:col-span-2">
        {busy ? 'Adding…' : 'Add AI provider'}
      </button>
    </form>
  )
}

function ProviderEditor({
  provider,
  onCancel,
  onSaved,
  onDeleted,
}: {
  provider: AiProvider
  onCancel: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(provider.name)
  const [slug, setSlug] = useState(provider.slug)
  const [purpose, setPurpose] = useState(provider.purpose)
  const [priority, setPriority] = useState(provider.priority)
  const [apiBaseUrl, setApiBaseUrl] = useState(provider.apiBaseUrl ?? '')
  const [model, setModel] = useState(provider.model ?? '')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState(provider.notes ?? '')
  const [enabled, setEnabled] = useState(provider.enabled)
  const [busy, setBusy] = useState(false)
  const knownPurpose = (AI_PROVIDER_PURPOSES as readonly string[]).includes(purpose)

  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.patchAiProvider(provider.id, {
            name,
            slug,
            purpose,
            priority,
            apiBaseUrl,
            model,
            notes,
            enabled,
            ...(apiKey ? { apiKey } : {}),
          })
          toast.success(`${name} saved`)
          setApiKey('')
          onSaved()
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not save provider')
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="md:col-span-2">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-terra">Edit AI provider</p>
        <h2 className="font-serif-display text-2xl font-light">{provider.name}</h2>
      </div>
      <label className="block text-sm">Name
        <input required value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Slug
        <input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Purpose
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${fieldClass} mt-1 w-full`}>
          {!knownPurpose && <option value={purpose}>{purposeLabel(purpose)}</option>}
          {AI_PROVIDER_PURPOSES.map((item) => (
            <option key={item} value={item}>{AI_PROVIDER_PURPOSE_LABELS[item]}</option>
          ))}
        </select>
        {!knownPurpose && (
          <span className="mt-1 block text-xs text-ink-faint">
            This provider still uses an older purpose. Saving keeps it. Choose Image analysis if this key should run tagging and descriptions.
          </span>
        )}
      </label>
      <label className="block text-sm">Priority
        <input type="number" min={0} value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">API base URL
        <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="block text-sm">Model
        {provider.modelSource === 'settings' && (
          <span className="ml-2 font-mono-tech text-[10px] uppercase text-ink-faint">from Settings</span>
        )}
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" className={`${fieldClass} mt-1 w-full`} />
      </label>
      <label className="mt-6 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enabled
      </label>
      <label className="block text-sm md:col-span-2">API key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={secretPlaceholder({
            has: provider.hasKey,
            readable: provider.keyReadable,
            masked: provider.keyMasked,
            source: provider.keySource,
            empty: 'Paste a key',
          })}
          className={`${fieldClass} mt-1 w-full`}
        />
      </label>
      <label className="block text-sm md:col-span-2">Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper disabled:opacity-50">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className={actionClass}>Cancel</button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`Delete ${provider.name}?`)) return
            try {
              await api.deleteAiProvider(provider.id)
              toast.success('Provider deleted')
              onDeleted()
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not delete provider')
            }
          }}
          className="font-mono-tech text-[10px] uppercase text-[#b3382e]"
        >
          Delete
        </button>
      </div>
    </form>
  )
}
