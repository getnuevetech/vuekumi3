import { useEffect, useState } from 'react'
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
    <AdminShell subtitle="Add African payout rails and AI APIs without a deploy.">
      {children}
    </AdminShell>
  )
}

const fieldClass = 'rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm outline-none focus:border-terra'

function slugify(value: string) {
  return value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '')
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
      className={`${fieldClass} min-h-28`}
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

function GatewayRow({
  gateway,
  countries,
  onSaved,
}: {
  gateway: PaymentGateway
  countries: GeoCountry[]
  onSaved: () => void
}) {
  const [secretKey, setSecretKey] = useState('')
  const [publicKey, setPublicKey] = useState(gateway.publicKey ?? '')
  const [notes, setNotes] = useState(gateway.notes ?? '')
  const [selected, setSelected] = useState(gateway.countries)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPublicKey(gateway.publicKey ?? '')
    setNotes(gateway.notes ?? '')
    setSelected(gateway.countries)
    setSecretKey('')
  }, [gateway])

  return (
    <div className="rounded-2xl border border-sand-soft bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{gateway.name} <span className="font-mono-tech text-[10px] text-ink-faint">/{gateway.slug}</span></p>
          <p className="mt-1 text-sm text-ink-soft">
            {gateway.kind} · {gateway.countries.length ? gateway.countries.join(', ') : 'all countries'} · {gateway.currencies.length ? gateway.currencies.join(', ') : 'all currencies'}
            {gateway.hasSecret && gateway.secretReadable !== false ? ` · key ${gateway.secretMasked}` : ''}
            {gateway.hasSecret && gateway.secretReadable === false ? ' · stored key could not be read' : ''}
            {!gateway.hasSecret ? ' · no key yet' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={gateway.enabled ? 'active' : 'suspended'} />
          <button
            type="button"
            onClick={async () => {
              try {
                await api.patchGateway(gateway.id, { enabled: !gateway.enabled })
                onSaved()
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not update gateway')
              }
            }}
            className="font-mono-tech text-[10px] uppercase text-terra"
          >
            {gateway.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Delete this gateway?')) return
              try {
                await api.deleteGateway(gateway.id)
                onSaved()
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not delete gateway')
              }
            }}
            className="font-mono-tech text-[10px] uppercase text-[#b3382e]"
          >
            Delete
          </button>
        </div>
      </div>
      <form
        className="mt-4 grid gap-2 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api.patchGateway(gateway.id, {
              publicKey,
              notes,
              countries: selected,
              ...(secretKey ? { secretKey } : {}),
            })
            toast.success('Gateway saved')
            setSecretKey('')
            onSaved()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not save gateway')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-sm">Countries
          <CountryMultiSelect countries={countries} value={selected} onChange={setSelected} />
          <span className="mt-1 block text-xs text-ink-faint">Leave none selected to allow every country.</span>
        </label>
        <div className="space-y-2">
          <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="Public key (optional)" className={`${fieldClass} w-full`} />
          <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={gateway.hasSecret ? 'New secret (leave blank to keep the current key)' : 'Secret / API key'} className={`${fieldClass} w-full`} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={`${fieldClass} w-full`} />
          <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper disabled:opacity-50">
            {busy ? 'Saving…' : 'Save gateway'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function AdminGateways() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [form, setForm] = useState({
    name: '', slug: '', kind: 'payout', countries: [] as string[], currencies: '', secretKey: '', publicKey: '', notes: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)

  const load = () => {
    api.adminGateways().then((d) => setGateways(d.gateways)).catch((e) => toast.error(e instanceof ApiError ? e.message : 'Could not load gateways'))
  }
  useEffect(() => {
    load()
    api.countries().then((d) => setCountries(d.countries)).catch(() => setCountries([]))
  }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Payment gateways</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Payouts & checkout.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Add Flutterwave, Paystack, M-Pesa, MoMo, or any other African rail. Restrict by country and currency.
        Save a new key on an existing row — adding Stripe again is not required.
      </p>

      <form
        className="mt-6 grid gap-2 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.createGateway({
              ...form,
              slug: slugify(form.slug),
              currencies: form.currencies.split(',').map((s) => s.trim()).filter(Boolean),
            })
            toast.success('Gateway added')
            setForm({ name: '', slug: '', kind: 'payout', countries: [], currencies: '', secretKey: '', publicKey: '', notes: '' })
            setSlugTouched(false)
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not add gateway')
          }
        }}
      >
        <input required placeholder="Name (e.g. Wave Senegal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} className={fieldClass} />
        <input required placeholder="slug-wave-sn" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }) }} className={fieldClass} />
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={fieldClass}>
          <option value="payout">Payout (contributors)</option>
          <option value="checkout">Checkout (buyers)</option>
          <option value="both">Both</option>
        </select>
        <label className="block text-sm">Countries
          <CountryMultiSelect countries={countries} value={form.countries} onChange={(codes) => setForm({ ...form, countries: codes })} />
        </label>
        <input placeholder="Currencies (NGN,GHS) — blank = all" value={form.currencies} onChange={(e) => setForm({ ...form, currencies: e.target.value })} className={fieldClass} />
        <input placeholder="Public key (optional)" value={form.publicKey} onChange={(e) => setForm({ ...form, publicKey: e.target.value })} className={fieldClass} />
        <input type="password" placeholder="Secret / API key" value={form.secretKey} onChange={(e) => setForm({ ...form, secretKey: e.target.value })} className={`${fieldClass} md:col-span-2`} />
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${fieldClass} md:col-span-2`} />
        <button className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper md:col-span-2">Add gateway</button>
      </form>

      <div className="mt-6 space-y-3">
        {gateways.map((g) => (
          <GatewayRow key={g.id} gateway={g} countries={countries} onSaved={load} />
        ))}
      </div>
    </Shell>
  )
}

function ProviderRow({
  provider,
  onSaved,
}: {
  provider: AiProvider
  onSaved: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState(provider.apiBaseUrl ?? '')
  const [notes, setNotes] = useState(provider.notes ?? '')
  const [priority, setPriority] = useState(provider.priority)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setApiBaseUrl(provider.apiBaseUrl ?? '')
    setNotes(provider.notes ?? '')
    setPriority(provider.priority)
    setApiKey('')
  }, [provider])

  return (
    <div className="rounded-2xl border border-sand-soft bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {provider.name} <span className="font-mono-tech text-[10px] text-ink-faint">/{provider.slug} · priority {provider.priority}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {provider.apiBaseUrl ?? 'no base URL'}
            {provider.hasKey && provider.keyReadable !== false ? ` · key ${provider.keyMasked}` : ''}
            {provider.hasKey && provider.keyReadable === false ? ' · stored key could not be read' : ''}
            {!provider.hasKey ? ' · no key yet' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={provider.enabled ? 'active' : 'suspended'} />
          <button
            type="button"
            onClick={async () => {
              try {
                await api.patchAiProvider(provider.id, { enabled: !provider.enabled })
                onSaved()
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not update provider')
              }
            }}
            className="font-mono-tech text-[10px] uppercase text-terra"
          >
            {provider.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Delete this provider?')) return
              try {
                await api.deleteAiProvider(provider.id)
                onSaved()
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not delete provider')
              }
            }}
            className="font-mono-tech text-[10px] uppercase text-[#b3382e]"
          >
            Delete
          </button>
        </div>
      </div>
      <form
        className="mt-4 grid gap-2 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api.patchAiProvider(provider.id, {
              apiBaseUrl,
              notes,
              priority,
              ...(apiKey ? { apiKey } : {}),
            })
            toast.success('Provider saved')
            setApiKey('')
            onSaved()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not save provider')
          } finally {
            setBusy(false)
          }
        }}
      >
        <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="API base URL" className={fieldClass} />
        <input type="number" min={0} value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} className={fieldClass} />
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider.hasKey ? 'New API key (leave blank to keep the current key)' : 'API key'} className={`${fieldClass} md:col-span-2`} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={`${fieldClass} md:col-span-2`} />
        <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper disabled:opacity-50 md:col-span-2">
          {busy ? 'Saving…' : 'Save provider'}
        </button>
      </form>
    </div>
  )
}

export function AdminAiProviders() {
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [form, setForm] = useState({
    name: '', slug: '', purpose: 'image_analysis' as AiProviderPurpose, priority: 0, apiBaseUrl: '', apiKey: '', notes: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)

  const load = () => {
    api.adminAiProviders().then((d) => setProviders(d.providers)).catch((e) => toast.error(e instanceof ApiError ? e.message : 'Could not load providers'))
  }
  useEffect(() => { load() }, [])

  const knownPurposes = new Set<string>(AI_PROVIDER_PURPOSES)
  const byPurpose = [
    ...AI_PROVIDER_PURPOSES.map((purpose) => ({
      purpose,
      label: AI_PROVIDER_PURPOSE_LABELS[purpose],
      rows: providers.filter((p) => p.purpose === purpose).sort((a, b) => a.priority - b.priority),
    })),
    {
      purpose: 'other',
      label: 'Other / legacy purpose',
      rows: providers.filter((p) => !knownPurposes.has(p.purpose)).sort((a, b) => a.priority - b.priority),
    },
  ].filter((group) => group.purpose !== 'other' || group.rows.length > 0)

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">AI APIs</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Providers.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Keys are encrypted. Register more than one provider per purpose to set a fallback — lowest priority number
        wins. Save a new key on an existing row. Suggestions run only when a contributor or admin clicks Suggest.
      </p>

      <form
        className="mt-6 grid gap-2 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.createAiProvider({ ...form, slug: slugify(form.slug) })
            toast.success('Provider added')
            setForm({ name: '', slug: '', purpose: 'image_analysis', priority: 0, apiBaseUrl: '', apiKey: '', notes: '' })
            setSlugTouched(false)
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not add provider')
          }
        }}
      >
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} className={fieldClass} />
        <input required placeholder="slug" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }) }} className={fieldClass} />
        <select
          value={form.purpose}
          onChange={(e) => setForm({ ...form, purpose: e.target.value as AiProviderPurpose })}
          className={fieldClass}
        >
          {AI_PROVIDER_PURPOSES.map((purpose) => (
            <option key={purpose} value={purpose}>{AI_PROVIDER_PURPOSE_LABELS[purpose]}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          placeholder="Priority (0 = tried first)"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
          className={fieldClass}
        />
        <input placeholder="API base URL" value={form.apiBaseUrl} onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })} className={fieldClass} />
        <input type="password" placeholder="API key" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className={`${fieldClass} md:col-span-2`} />
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${fieldClass} md:col-span-2`} />
        <button className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper md:col-span-2">Add AI provider</button>
      </form>

      <div className="mt-8 space-y-8">
        {byPurpose.map(({ purpose, label, rows }) => (
          <div key={purpose}>
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {label}
            </p>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">No provider registered — falls back to the legacy OpenAI key or dev mode.</p>
            ) : (
              <div className="mt-2 space-y-3">
                {rows.map((p) => (
                  <ProviderRow key={p.id} provider={p} onSaved={load} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  )
}
