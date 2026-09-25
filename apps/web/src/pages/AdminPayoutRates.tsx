import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { adminHas } from '@vuekumi/shared'
import { api, ApiError, type PayoutRatePage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { AdminShell } from './Admin'

const REGIONS = [
  ['africa', 'Africa'],
  ['all', 'All regions'],
  ['americas', 'Americas'],
  ['europe', 'Europe'],
  ['asia', 'Asia'],
  ['oceania', 'Oceania'],
  ['middle_east', 'Middle East'],
] as const

export function AdminPayoutRates() {
  const { user } = useAuth()
  const canAssign = adminHas(user, 'geo.fx.override')
  const canSync = adminHas(user, 'geo.fx.sync')
  const [page, setPage] = useState<PayoutRatePage | null>(null)
  const [region, setRegion] = useState('africa')
  const [creatorsOnly, setCreatorsOnly] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  const load = () => {
    api.adminPayoutRates().then(setPage).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load payout rates'))
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const list = page?.countries ?? []
    return list.filter((row) => {
      if (creatorsOnly && !row.contributorEligible) return false
      if (region !== 'all' && row.region !== region) return false
      return true
    })
  }, [page, region, creatorsOnly])

  return (
    <AdminShell subtitle="Payout partner rates for contributor home currencies.">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Payout rates</p>
          <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Contributor home currency.</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Sales and buyer prices stay in USD. A contributor&apos;s earnings are shown in the currency of their country, using the exchange rate from that country&apos;s payout partner.
            When that partner does not return a rate, the next payout partner in the same region is used.
            Buyer display rates stay on <Link to="/admin/rates" className="text-terra">FX rates</Link>.
          </p>
        </div>
        {canSync && (
          <button
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true)
              try {
                const result = await api.syncPayoutRates()
                toast.success(result.updated > 0 ? `Pulled ${result.updated} payout rates` : 'No payout partner returned a rate')
                load()
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Pull failed')
              } finally {
                setSyncing(false)
              }
            }}
            className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra disabled:opacity-50"
          >
            {syncing ? 'Pulling…' : 'Pull partner rates'}
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Region"
          className="rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm"
        >
          {REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={creatorsOnly} onChange={(e) => setCreatorsOnly(e.target.checked)} />
          Contributor countries
        </label>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-soft bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand-soft font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {['Country', 'Currency', 'Payout partner', 'Rate for 1 USD', 'Rate from', 'Pulled'].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-sand-soft last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.name}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{row.code}</p>
                </td>
                <td className="px-4 py-3">{row.currency}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Payout partner for ${row.name}`}
                    disabled={!canAssign || saving === row.code}
                    value={row.gatewayId ?? ''}
                    onChange={async (e) => {
                      const gatewayId = e.target.value || null
                      setSaving(row.code)
                      try {
                        const result = await api.assignPayoutPartner(row.code, gatewayId)
                        toast.success(result.updated > 0 ? `${row.name} rate pulled` : `${row.name} partner saved`)
                        load()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not save partner')
                      } finally {
                        setSaving(null)
                      }
                    }}
                    className="max-w-[16rem] rounded-lg border border-sand-soft px-2 py-1 text-sm"
                  >
                    <option value="">
                      Automatic{row.automatic && row.effectiveGatewayName ? ` · ${row.effectiveGatewayName}` : ''}
                    </option>
                    {(page?.gateways ?? []).map((gateway) => (
                      <option key={gateway.id} value={gateway.id}>{gateway.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 font-mono-tech text-xs">
                  {row.currency === 'USD' ? '1' : row.rate ? row.rate.rateToUsd.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {row.rate ? (
                    <span>
                      {row.rate.partnerName}
                      <span className="mt-0.5 block font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        {row.rate.source === 'alternate' ? 'Alternate partner' : 'Country partner'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-faint">{row.effectiveGatewayName ?? 'No payout partner'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{row.rate ? row.rate.fetchedAt.slice(0, 16).replace('T', ' ') : 'Not pulled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-sm text-ink-soft">No countries in this filter.</p>}
      </div>
    </AdminShell>
  )
}
