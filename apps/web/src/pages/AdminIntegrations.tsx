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

export function AdminGateways() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [form, setForm] = useState({
    name: '', slug: '', kind: 'payout', countries: '', currencies: '', secretKey: '', publicKey: '', notes: '',
  })

  const load = () => { api.adminGateways().then((d) => setGateways(d.gateways)).catch((e) => toast.error(e.message)) }
  useEffect(() => { load() }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Payment gateways</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Payouts & checkout.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Add Flutterwave, Paystack, M-Pesa, MoMo, or any other African rail. Restrict by country and currency.
      </p>

      <form
        className="mt-6 grid gap-2 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.createGateway({
              ...form,
              countries: form.countries.split(',').map((s) => s.trim()).filter(Boolean),
              currencies: form.currencies.split(',').map((s) => s.trim()).filter(Boolean),
            })
            toast.success('Gateway added')
            setForm({ name: '', slug: '', kind: 'payout', countries: '', currencies: '', secretKey: '', publicKey: '', notes: '' })
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not add gateway')
          }
        }}
      >
        <input required placeholder="Name (e.g. Wave Senegal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input required placeholder="slug-wave-sn" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm">
          <option value="payout">Payout (contributors)</option>
          <option value="checkout">Checkout (buyers)</option>
          <option value="both">Both</option>
        </select>
        <input placeholder="Countries ISO, comma (NG,GH,KE) — blank = all" value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input placeholder="Currencies (NGN,GHS) — blank = all" value={form.currencies} onChange={(e) => setForm({ ...form, currencies: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input placeholder="Public key (optional)" value={form.publicKey} onChange={(e) => setForm({ ...form, publicKey: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input type="password" placeholder="Secret / API key" value={form.secretKey} onChange={(e) => setForm({ ...form, secretKey: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm md:col-span-2" />
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm md:col-span-2" />
        <button className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper md:col-span-2">Add gateway</button>
      </form>

      <div className="mt-6 space-y-3">
        {gateways.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-soft bg-white p-4">
            <div>
              <p className="font-medium">{g.name} <span className="font-mono-tech text-[10px] text-ink-faint">/{g.slug}</span></p>
              <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                {g.kind} · {g.countries.length ? g.countries.join(', ') : 'all countries'} · {g.currencies.length ? g.currencies.join(', ') : 'all currencies'}
                {g.hasSecret ? ` · key ${g.secretMasked}` : ' · no key yet'}
              </p>
              {g.notes && <p className="mt-1 text-[13px] text-ink-soft">{g.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={g.enabled ? 'active' : 'suspended'} />
              <button onClick={async () => { await api.patchGateway(g.id, { enabled: !g.enabled }); load() }} className="font-mono-tech text-[10px] uppercase text-terra">
                {g.enabled ? 'Disable' : 'Enable'}
              </button>
              <button onClick={async () => { if (confirm('Delete this gateway?')) { await api.deleteGateway(g.id); load() } }} className="font-mono-tech text-[10px] uppercase text-[#b3382e]">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}

export function AdminAiProviders() {
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [form, setForm] = useState({
    name: '', slug: '', purpose: 'image_analysis' as AiProviderPurpose, priority: 0, apiBaseUrl: '', apiKey: '', notes: '',
  })

  const load = () => { api.adminAiProviders().then((d) => setProviders(d.providers)).catch((e) => toast.error(e.message)) }
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
      label: 'Other / legacy purpose (not in the current list — still active, rename or retire below)',
      rows: providers.filter((p) => !knownPurposes.has(p.purpose)).sort((a, b) => a.priority - b.priority),
    },
  ].filter((group) => group.purpose !== 'other' || group.rows.length > 0)

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">AI APIs</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Providers.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Keys are encrypted. Register more than one provider per purpose to set a fallback — lowest priority number
        wins. Suggestions run only when a contributor or admin clicks Suggest — never on upload.
      </p>

      <form
        className="mt-6 grid gap-2 rounded-2xl border border-sand-soft bg-white p-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.createAiProvider(form)
            toast.success('Provider added')
            setForm({ name: '', slug: '', purpose: 'image_analysis', priority: 0, apiBaseUrl: '', apiKey: '', notes: '' })
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not add provider')
          }
        }}
      >
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input required placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <select
          value={form.purpose}
          onChange={(e) => setForm({ ...form, purpose: e.target.value as AiProviderPurpose })}
          className="rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm"
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
          className="rounded-xl border border-sand-soft px-3 py-2 text-sm"
        />
        <input placeholder="API base URL" value={form.apiBaseUrl} onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input type="password" placeholder="API key" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm md:col-span-2" />
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm md:col-span-2" />
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
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-soft bg-white p-4">
                    <div>
                      <p className="font-medium">
                        {p.name} <span className="font-mono-tech text-[10px] text-ink-faint">/{p.slug} · priority {p.priority}</span>
                      </p>
                      <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                        {p.apiBaseUrl ?? 'no base URL'} · {p.hasKey ? `key ${p.keyMasked}` : 'no key yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={p.enabled ? 'active' : 'suspended'} />
                      <button onClick={async () => { await api.patchAiProvider(p.id, { enabled: !p.enabled }); load() }} className="font-mono-tech text-[10px] uppercase text-terra">
                        {p.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={async () => { if (confirm('Delete this provider?')) { await api.deleteAiProvider(p.id); load() } }} className="font-mono-tech text-[10px] uppercase text-[#b3382e]">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  )
}
