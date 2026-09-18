import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { CampaignAdminDto, CampaignPitchDto } from '@vuekumi/shared'
import { SectionHead, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell subtitle="Brand campaigns and pitches. Off-platform settlement — no production commission.">
      {children}
    </AdminShell>
  )
}

export default function AdminCampaigns() {
  const [items, setItems] = useState<CampaignAdminDto[]>([])
  const [pitches, setPitches] = useState<Record<string, CampaignPitchDto[]>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminCampaigns()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load campaigns'))
  }

  useEffect(() => { load() }, [])

  async function loadPitches(id: string) {
    if (pitches[id]) return
    try {
      const data = await api.adminCampaignPitches(id)
      setPitches((prev) => ({ ...prev, [id]: data.items }))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load pitches')
    }
  }

  async function closeCampaign(id: string) {
    setBusy(id)
    try {
      await api.adminCloseCampaign(id)
      toast.success('Campaign closed')
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Close failed')
    } finally {
      setBusy(null)
    }
  }

  const open = items.filter((c) => c.status === 'open')
  const closed = items.filter((c) => c.status === 'closed')

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Production</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Campaigns.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Staff visibility and moderation close. Accepting a pitch licenses nothing — photographs
        still go through checkout with every rights guard. No production commission.
      </p>

      <div className="mt-10">
        <SectionHead kicker="Open" title={`Live (${open.length})`} />
        {open.length === 0 && <p className="mt-3 text-sm text-ink-soft">No open campaigns.</p>}
        <div className="mt-3 space-y-3">
          {open.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              pitches={pitches[c.id]}
              busy={busy === c.id}
              onExpand={() => loadPitches(c.id)}
              onClose={() => closeCampaign(c.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-12">
        <SectionHead kicker="Closed" title={`Closed (${closed.length})`} />
        {closed.length === 0 && <p className="mt-3 text-sm text-ink-soft">No closed campaigns yet.</p>}
        <div className="mt-3 space-y-3">
          {closed.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              pitches={pitches[c.id]}
              busy={false}
              onExpand={() => loadPitches(c.id)}
            />
          ))}
        </div>
      </div>
    </Shell>
  )
}

function CampaignCard({
  campaign: c,
  pitches,
  busy,
  onExpand,
  onClose,
}: {
  campaign: CampaignAdminDto
  pitches?: CampaignPitchDto[]
  busy: boolean
  onExpand: () => void
  onClose?: () => void
}) {
  return (
    <div className="rounded-2xl border border-sand-soft bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{c.title}</p>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {c.ownerName} ({c.ownerEmail}) · {c.pitchCount} pitch{c.pitchCount === 1 ? '' : 'es'}
            {c.pendingPitchCount > 0 ? ` · ${c.pendingPitchCount} pending` : ''}
            {c.budgetUsd != null ? ` · indicative budget $${c.budgetUsd.toLocaleString()}` : ''}
          </p>
        </div>
        <StatusPill status={c.status} />
      </div>
      <p className="mt-3 text-sm text-ink-soft whitespace-pre-wrap">{c.brief}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExpand}
          className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] hover:border-ink"
        >
          {pitches ? 'Pitches loaded' : 'Load pitches'}
        </button>
        {onClose && c.status === 'open' && (
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:text-[#b3382e] disabled:opacity-50"
          >
            Close campaign
          </button>
        )}
      </div>
      {pitches && (
        <div className="mt-4 space-y-2 border-t border-sand-soft pt-4">
          {pitches.length === 0 && <p className="text-sm text-ink-soft">No pitches yet.</p>}
          {pitches.map((p) => (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">
                  {p.contributorName}
                  {p.contributorHandle ? ` (@${p.contributorHandle})` : ''}
                  {p.rateUsd != null ? ` · $${p.rateUsd.toLocaleString()} indicated` : ''}
                </p>
                <p className="text-ink-soft whitespace-pre-wrap">{p.note}</p>
              </div>
              <StatusPill status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
