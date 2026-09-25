import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { StatusPill } from '../components/shared'
import { api, ApiError, type CountryActivationRow, type CountryPolicyDetail, type FxRate, type GeoCountry } from '../api/client'
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
        Country policy activation (HOLD → ACTIVE) is on{' '}
        <a href="/admin/countries/activation" className="text-terra underline">Activation</a>.
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
            Buyer prices use these rates. Contributor earnings use the payout partner rate on <Link to="/admin/payout-rates" className="text-terra">Payout rates</Link>.
            Override any currency without stopping auto-sync for others.
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

const GATE_STATUSES = ['NOT_STARTED', 'RESEARCHING', 'BLOCKED', 'APPROVED', 'NOT_APPLICABLE'] as const
const FEATURE_SCOPE_STATES = ['ON', 'HOLD', 'CONDITIONAL'] as const

function downloadActivationCsv(rows: CountryActivationRow[]) {
  const header = ['code', 'name', 'region', 'policy_status', 'gates_ready', 'gates_approved', 'gates_na', 'gates_open', 'gates_blocked', 'last_transition']
  const lines = [header.join(',')]
  for (const c of rows) {
    const p = c.policy
    lines.push([
      c.code,
      JSON.stringify(c.name),
      c.region,
      p?.status ?? '',
      p?.gatesReady ? 'yes' : 'no',
      String(p?.gateCounts.approved ?? ''),
      String(p?.gateCounts.notApplicable ?? ''),
      String(p?.gateCounts.open ?? ''),
      String(p?.gateCounts.blocked ?? ''),
      p?.lastTransitionKind ?? '',
    ].join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `country-activation-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminCountryActivation() {
  const [rows, setRows] = useState<CountryActivationRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState('africa')
  const [detail, setDetail] = useState<{
    country: Pick<GeoCountry, 'code' | 'name' | 'region' | 'contributorEligible' | 'enabled'> & {
      overlayKind?: string | null
      counselStatus?: string
    }
    policy: CountryPolicyDetail
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [gateDrafts, setGateDrafts] = useState<Record<string, { rationale: string; evidenceUrl: string; evidenceLabel: string }>>({})

  const load = () => {
    api.adminCountryActivation().then((d) => setRows(d.countries)).catch((e) => toast.error(e.message))
  }
  useEffect(() => { load() }, [])

  const openDetail = async (code: string) => {
    setSelected(code)
    try {
      const d = await api.adminCountryActivationDetail(code)
      setDetail(d)
      const drafts: Record<string, { rationale: string; evidenceUrl: string; evidenceLabel: string }> = {}
      for (const g of d.policy.gates) {
        drafts[g.id] = {
          rationale: g.rationale ?? '',
          evidenceUrl: '',
          evidenceLabel: '',
        }
      }
      setGateDrafts(drafts)
      requestAnimationFrame(() => {
        document.getElementById('country-policy-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Load failed')
    }
  }

  const visible = rows.filter((c) => regionFilter === 'all' || c.region === regionFilter)
  const immutable = detail?.policy.status === 'ACTIVE' || detail?.policy.status === 'OFFBOARDING'

  const detailPanel = detail ? (
    <div id="country-policy-detail" className="mt-6 space-y-4 rounded-2xl border border-sand-soft bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            {detail.country.code} · v{detail.policy.version} · {detail.policy.status}
          </p>
          <h2 className="font-serif-display text-2xl font-light">{detail.country.name}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Attach evidence URLs and rationale per gate. Do not invent counsel clearance — G16 stays counsel-owned.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || detail.policy.status === 'ACTIVE'}
            onClick={async () => {
              setBusy(true)
              try {
                await api.submitCountryPolicy(detail.policy.id)
                toast.success('Submitted for review')
                await openDetail(detail.country.code)
                load()
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : 'Submit failed')
              } finally {
                setBusy(false)
              }
            }}
            className="rounded-full border border-sand-soft px-3 py-1.5 font-mono-tech text-[10px] uppercase"
          >
            Submit review
          </button>
          <button
            disabled={busy || detail.policy.status === 'ACTIVE'}
            onClick={async () => {
              setBusy(true)
              try {
                await api.activateCountryPolicy(detail.policy.id)
                toast.success('Activated')
                await openDetail(detail.country.code)
                load()
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : 'Activation denied')
              } finally {
                setBusy(false)
              }
            }}
            className="rounded-full bg-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase text-paper"
          >
            Authorize ACTIVE
          </button>
          {detail.policy.status === 'ACTIVE' && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await api.suspendCountryPolicy(detail.policy.id)
                  toast.success('Suspended')
                  await openDetail(detail.country.code)
                  load()
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : 'Suspend failed')
                } finally {
                  setBusy(false)
                }
              }}
              className="rounded-full border border-terra px-3 py-1.5 font-mono-tech text-[10px] uppercase text-terra"
            >
              Suspend
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {detail.policy.gates.map((g) => {
          const draft = gateDrafts[g.id] ?? { rationale: g.rationale ?? '', evidenceUrl: '', evidenceLabel: '' }
          return (
            <div key={g.id} className="rounded-xl border border-sand-soft p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono-tech text-xs">{g.code} · {g.status}</p>
                  <p className="text-sm text-ink-soft">{g.title}</p>
                </div>
                <select
                  disabled={busy || immutable}
                  value={g.status}
                  onChange={async (e) => {
                    const status = e.target.value
                    setBusy(true)
                    try {
                      await api.patchCountryGate(g.id, {
                        status,
                        rationale:
                          status === 'NOT_APPLICABLE'
                            ? (draft.rationale.trim() || g.rationale || 'N/A rationale (staff)')
                            : (draft.rationale.trim() || g.rationale),
                        evidence: draft.evidenceLabel.trim()
                          ? {
                              label: draft.evidenceLabel.trim(),
                              ...(draft.evidenceUrl.trim() ? { url: draft.evidenceUrl.trim() } : {}),
                            }
                          : { label: `Status → ${status}` },
                      })
                      toast.success(`${g.code} → ${status}`)
                      await openDetail(detail.country.code)
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Gate update failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="rounded border border-sand-soft bg-white px-2 py-1 text-xs"
                >
                  {GATE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  disabled={busy || immutable}
                  value={draft.rationale}
                  onChange={(e) => setGateDrafts((s) => ({ ...s, [g.id]: { ...draft, rationale: e.target.value } }))}
                  placeholder="Rationale (required for N/A)"
                  className="rounded-lg border border-sand-soft px-2 py-1.5 text-xs sm:col-span-1"
                />
                <input
                  disabled={busy || immutable}
                  value={draft.evidenceLabel}
                  onChange={(e) => setGateDrafts((s) => ({ ...s, [g.id]: { ...draft, evidenceLabel: e.target.value } }))}
                  placeholder="Evidence label"
                  className="rounded-lg border border-sand-soft px-2 py-1.5 text-xs"
                />
                <input
                  disabled={busy || immutable}
                  value={draft.evidenceUrl}
                  onChange={(e) => setGateDrafts((s) => ({ ...s, [g.id]: { ...draft, evidenceUrl: e.target.value } }))}
                  placeholder="https://evidence…"
                  className="rounded-lg border border-sand-soft px-2 py-1.5 text-xs"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || immutable || (!draft.rationale.trim() && !draft.evidenceLabel.trim())}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await api.patchCountryGate(g.id, {
                        rationale: draft.rationale.trim() || null,
                        evidence: draft.evidenceLabel.trim()
                          ? {
                              label: draft.evidenceLabel.trim(),
                              ...(draft.evidenceUrl.trim() ? { url: draft.evidenceUrl.trim() } : {}),
                            }
                          : undefined,
                      })
                      toast.success('Evidence / rationale saved')
                      await openDetail(detail.country.code)
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Save failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[9px] uppercase tracking-[0.12em] disabled:opacity-40"
                >
                  Save notes
                </button>
                {g.evidence.length > 0 && (
                  <ul className="flex flex-wrap gap-2 text-[11px] text-ink-faint">
                    {g.evidence.map((e) => (
                      <li key={e.id}>
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noreferrer" className="text-terra underline">
                            {e.label}
                          </a>
                        ) : (
                          e.label
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-sand-soft p-3">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Feature scopes</p>
        <p className="mt-1 text-xs text-ink-soft">
          Editable on HOLD / REVIEW / SUSPENDED. Activation still applies default ACTIVE scopes.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {detail.policy.featureScopes.map((s) => (
            <label key={s.action} className="flex items-center justify-between gap-2 rounded-lg border border-sand-soft px-3 py-2 text-xs">
              <span className="font-mono-tech uppercase tracking-[0.08em]">{s.action}</span>
              <select
                disabled={busy || immutable}
                value={s.state}
                onChange={async (e) => {
                  const state = e.target.value
                  setBusy(true)
                  try {
                    await api.patchCountryFeatureScope(detail.policy.id, s.action, { state })
                    toast.success(`${s.action} → ${state}`)
                    await openDetail(detail.country.code)
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Scope update failed')
                  } finally {
                    setBusy(false)
                  }
                }}
                className="rounded border border-sand-soft bg-white px-2 py-1"
              >
                {FEATURE_SCOPE_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {detail.policy.transitions.length > 0 && (
        <div className="rounded-xl border border-sand-soft p-3">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Transitions</p>
          <ul className="mt-2 space-y-1 text-xs text-ink-soft">
            {detail.policy.transitions.map((t) => (
              <li key={t.id} className="flex flex-wrap gap-x-2">
                <span className="font-mono-tech uppercase text-ink-faint">{t.kind}</span>
                <span>{t.fromStatus} → {t.toStatus}</span>
                <span className="text-ink-faint">{t.createdAt.slice(0, 19).replace('T', ' ')} UTC</span>
                {t.notes && <span>· {t.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Country policy</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Activation.</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        All markets default HOLD. ACTIVE requires G01–G16 complete and a second staff authorizer.
        Signup still uses Africa-list until Settings flips{' '}
        <code className="font-mono-tech text-xs">geo.contributor_onboarding_policy</code>.
        Phase 53: evidence URLs, feature scopes, transition history, CSV register export.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await api.seedCountryPolicyHold()
              toast.success(`HOLD policies: ${r.created} created / ${r.countries} countries`)
              load()
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : 'Seed failed')
            } finally {
              setBusy(false)
            }
          }}
          className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper"
        >
          Seed HOLD policies
        </button>
        <button
          type="button"
          onClick={() => downloadActivationCsv(visible)}
          className="rounded-full border border-sand-soft px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em]"
        >
          Export CSV
        </button>
        <a href="/admin/countries" className="rounded-full border border-sand-soft px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em]">
          Markets list
        </a>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded-full border border-sand-soft bg-white px-3 py-2 font-mono-tech text-[10px] uppercase"
        >
          <option value="africa">Africa</option>
          <option value="all">All regions</option>
          <option value="americas">Americas</option>
          <option value="europe">Europe</option>
          <option value="asia">Asia</option>
          <option value="oceania">Oceania</option>
          <option value="middle_east">Middle East</option>
        </select>
      </div>

      {detailPanel}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {['Code', 'Name', 'Region', 'Policy', 'Gates', 'Open'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.code} className="border-b border-sand-soft last:border-0">
                <td className="px-4 py-3 font-mono-tech text-xs">{c.code}</td>
                <td className="px-4 py-3">
                  <button type="button" className="text-left hover:text-terra" onClick={() => openDetail(c.code)}>
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 capitalize">{c.region.replace('_', ' ')}</td>
                <td className="px-4 py-3">
                  <StatusPill status={(c.policy?.status ?? 'HOLD').toLowerCase()} />
                </td>
                <td className="px-4 py-3 font-mono-tech text-xs">
                  {c.policy
                    ? `${c.policy.gateCounts.approved + c.policy.gateCounts.notApplicable}/${c.policy.gateCounts.total}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openDetail(c.code)}
                    className="font-mono-tech text-[10px] uppercase text-terra"
                  >
                    {selected === c.code ? 'Selected' : 'Open'}
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
