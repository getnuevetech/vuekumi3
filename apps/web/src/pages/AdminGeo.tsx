import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { StatusPill } from '../components/shared'
import { api, ApiError, type FxRate, type GeoCountry } from '../api/client'
import { AdminShell } from './Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Countries and live FX — admin can add or override any time.">
      {children}
    </AdminShell>
  )
}

export function AdminCountries() {
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [form, setForm] = useState({
    code: '', name: '', currency: '', currencyName: '', region: 'africa', contributorEligible: false, enabled: true,
  })

  const load = () => {
    api.adminCountries().then((d) => setCountries(d.countries)).catch((e) => toast.error(e.message))
  }
  useEffect(() => { load() }, [])

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Countries</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Markets.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Contributors must be African. Buyers can be anywhere. Add any extra country here.
      </p>

      <form
        className="mt-6 grid gap-2 rounded-2xl border border-sand-soft bg-white p-4 sm:grid-cols-6"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.upsertCountry(form)
            toast.success('Country saved')
            setForm({ code: '', name: '', currency: '', currencyName: '', region: 'africa', contributorEligible: false, enabled: true })
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Save failed')
          }
        }}
      >
        <input required maxLength={2} placeholder="ISO" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm sm:col-span-2" />
        <input required maxLength={4} placeholder="CUR" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <input required placeholder="Currency name" value={form.currencyName} onChange={(e) => setForm({ ...form, currencyName: e.target.value })} className="rounded-xl border border-sand-soft px-3 py-2 text-sm" />
        <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm">
          {['africa', 'americas', 'europe', 'asia', 'oceania', 'middle_east'].map((r) => <option key={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs sm:col-span-2">
          <input type="checkbox" checked={form.contributorEligible} onChange={(e) => setForm({ ...form, contributorEligible: e.target.checked })} />
          Contributor eligible (Africa)
        </label>
        <button className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper sm:col-span-2">Add / update</button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {['Code', 'Name', 'Currency', 'Region', 'Contributor', 'Overlay', 'Enabled'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.code} className="border-b border-sand-soft last:border-0">
                <td className="px-4 py-3 font-mono-tech text-xs">{c.code}</td>
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">{c.currency} · {c.currencyName}</td>
                <td className="px-4 py-3 capitalize">{c.region.replace('_', ' ')}</td>
                <td className="px-4 py-3"><StatusPill status={c.contributorEligible ? 'active' : 'free'} /></td>
                <td className="px-4 py-3 font-mono-tech text-[10px] uppercase text-ink-faint">{c.overlayKind ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={async () => { await api.patchCountry(c.code, { enabled: !c.enabled }); load() }}
                    className="font-mono-tech text-[10px] uppercase text-terra"
                  >
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}

export function AdminRates() {
  const [rates, setRates] = useState<FxRate[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)

  const load = () => {
    api.adminRates().then((d) => setRates(d.rates)).catch((e) => toast.error(e.message))
  }
  useEffect(() => { load() }, [])

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Exchange rates</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">FX to USD.</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Live rates from currency-api (jsDelivr). Override any currency without stopping auto-sync for others.
          </p>
        </div>
        <button
          disabled={syncing}
          onClick={async () => {
            setSyncing(true)
            try {
              const r = await api.syncRates()
              toast.success(`Updated ${r.updated} currencies`)
              load()
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Sync failed')
            } finally {
              setSyncing(false)
            }
          }}
          className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra"
        >
          {syncing ? 'Syncing…' : 'Refresh live rates'}
        </button>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {['Currency', 'Live rate / USD', 'Override', 'Effective', 'Source'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.currency} className="border-b border-sand-soft last:border-0">
                <td className="px-4 py-3 font-medium">{r.currency}</td>
                <td className="px-4 py-3 font-mono-tech text-xs">{r.rateToUsd.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <form
                    className="flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const raw = overrides[r.currency]
                      const value = raw === '' || raw == null ? null : Number(raw)
                      await api.overrideRate(r.currency, value)
                      toast.success(`${r.currency} updated`)
                      load()
                    }}
                  >
                    <input
                      placeholder={r.overrideRate != null ? String(r.overrideRate) : 'auto'}
                      value={overrides[r.currency] ?? ''}
                      onChange={(e) => setOverrides((s) => ({ ...s, [r.currency]: e.target.value }))}
                      className="w-28 rounded-lg border border-sand-soft px-2 py-1 text-sm"
                    />
                    <button className="font-mono-tech text-[9px] uppercase text-terra">Save</button>
                    {r.overrideRate != null && (
                      <button type="button" onClick={async () => { await api.overrideRate(r.currency, null); load() }} className="font-mono-tech text-[9px] uppercase text-ink-faint">Clear</button>
                    )}
                  </form>
                </td>
                <td className="px-4 py-3">{r.effectiveRate.toLocaleString()}</td>
                <td className="px-4 py-3"><StatusPill status={r.effectiveSource} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}
