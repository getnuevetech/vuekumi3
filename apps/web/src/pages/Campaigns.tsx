import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { CampaignDto, CampaignPitchDto } from '@vuekumi/shared'
import { toast } from 'sonner'
import { SiteHeader, StatusPill } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const OFF_PLATFORM_NOTE =
  'Vuekumi records the brief, the pitches, and the decision. Production payment is settled directly between the parties — Vuekumi charges no production fee in this phase. Accepting a pitch licenses nothing: photographs are still licensed through normal checkout with every rights check.'

function CreateCampaignForm({ onCreated }: { onCreated: (c: CampaignDto) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [usage, setUsage] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra"
      >
        + New campaign brief
      </button>
    )
  }

  return (
    <form
      className="mt-6 space-y-3 border border-sand bg-white p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          const { campaign } = await api.createCampaign({
            title,
            brief,
            deliverables: deliverables || undefined,
            usage: usage || undefined,
            location: location || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            budgetUsd: budget ? Number(budget) : undefined,
          })
          onCreated(campaign)
          toast.success('Campaign posted')
          setOpen(false)
          setTitle(''); setBrief(''); setDeliverables(''); setUsage(''); setLocation(''); setStartDate(''); setEndDate(''); setBudget('')
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not post the campaign')
        } finally {
          setBusy(false)
        }
      }}
    >
      <input
        required
        minLength={3}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Campaign title (e.g. Q4 fintech launch, Lagos)"
        className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
      />
      <textarea
        required
        minLength={10}
        rows={5}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="The brief — what the campaign needs, look and feel, references…"
        className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
      />
      <input
        value={deliverables}
        onChange={(e) => setDeliverables(e.target.value)}
        placeholder="Deliverables (e.g. 40 final images, 3 shoot days)"
        className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
      />
      <input
        value={usage}
        onChange={(e) => setUsage(e.target.value)}
        placeholder="Intended usage (territory, duration, channels)"
        className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra" />
        <input
          type="number"
          min={0}
          step={500}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="Budget (USD)"
          className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post campaign'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function PitchList({ campaign }: { campaign: CampaignDto }) {
  const [pitches, setPitches] = useState<CampaignPitchDto[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.campaignPitches(campaign.id).then((d) => setPitches(d.items)).catch(() => setPitches([]))
  }
  useEffect(() => { load() }, [campaign.id])

  const act = async (id: string, action: 'accept' | 'decline') => {
    setBusy(`${id}:${action}`)
    try {
      await api.pitchAction(id, action)
      toast.success(`Pitch ${action === 'accept' ? 'accepted' : 'declined'}`)
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (!pitches) return <p className="mt-3 font-mono-tech text-[10px] text-ink-faint">Loading pitches…</p>
  if (pitches.length === 0) return <p className="mt-3 text-sm text-ink-soft">No pitches yet.</p>

  return (
    <div className="mt-3 space-y-2 border-t border-sand pt-3">
      {pitches.map((p) => (
        <div key={p.id} className="flex flex-wrap items-start justify-between gap-2 bg-cream/60 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {p.contributorName}
              {p.contributorHandle && (
                <Link to={`/p/${p.contributorHandle}`} className="ml-2 font-mono-tech text-[10px] text-terra hover:text-ink">
                  @{p.contributorHandle}
                </Link>
              )}
              {p.rateUsd != null && (
                <span className="ml-2 font-mono-tech text-[10px] text-ink-faint">indicative {money(p.rateUsd)}</span>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{p.note}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={p.status} />
            {p.status === 'pending' && (
              <>
                <button
                  disabled={busy === `${p.id}:accept`}
                  onClick={() => act(p.id, 'accept')}
                  className="bg-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-paper hover:bg-[#2e6b3e] disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  disabled={busy === `${p.id}:decline`}
                  onClick={() => act(p.id, 'decline')}
                  className="border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:border-ink hover:text-[#b3382e] disabled:opacity-50"
                >
                  Decline
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function PitchForm({ campaign, onDone }: { campaign: CampaignDto; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [rate, setRate] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="mt-3 space-y-2 border-t border-sand pt-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.pitchCampaign(campaign.id, { note, rateUsd: rate ? Number(rate) : undefined })
          toast.success('Pitch sent')
          onDone()
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not send the pitch')
        } finally {
          setBusy(false)
        }
      }}
    >
      <textarea
        required
        minLength={10}
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Your pitch — relevant work, availability, approach…"
        className="w-full border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          step={100}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Indicative rate (USD, optional)"
          className="w-56 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send pitch'}
        </button>
      </div>
    </form>
  )
}

export default function Campaigns() {
  const { user } = useAuth()
  const [items, setItems] = useState<CampaignDto[]>([])
  const [loading, setLoading] = useState(true)
  const isBrand = user?.accountType === 'user' || user?.accountType === 'agency'
  const isContributor = user?.accountType === 'contributor'

  const load = () => {
    api.campaigns()
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const close = async (id: string) => {
    try {
      await api.closeCampaign(id)
      toast.success('Campaign closed')
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not close the campaign')
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-28 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Brand production</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Campaigns.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {isBrand
            ? 'Source campaign-shaped work, not just single images. Post a brief; contributors pitch; you decide.'
            : 'Open campaign briefs from brands. Pitch the ones that fit your work.'}{' '}
          {OFF_PLATFORM_NOTE}
        </p>

        {isBrand && <CreateCampaignForm onCreated={() => load()} />}

        {loading && <p className="mt-8 font-mono-tech text-[11px] text-ink-faint">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="mt-8 text-sm text-ink-soft">
            {isBrand ? 'No campaigns yet — post your first brief above.' : 'No open campaigns right now. Check back soon.'}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {items.map((c) => (
            <div key={c.id} className="border border-sand bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {c.mine ? `${c.pitchCount} pitch${c.pitchCount === 1 ? '' : 'es'}` : `By ${c.ownerName}`}
                    {' · '}{new Date(c.createdAt).toLocaleDateString()}
                    {c.location ? ` · ${c.location}` : ''}
                    {c.startDate ? ` · ${c.startDate}${c.endDate ? ` → ${c.endDate}` : ''}` : ''}
                    {c.budgetUsd != null ? ` · budget ${money(c.budgetUsd)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={c.status} />
                  {c.mine && c.status === 'open' && (
                    <button
                      onClick={() => close(c.id)}
                      className="border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:border-ink"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{c.brief}</p>
              {(c.deliverables || c.usage) && (
                <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {c.deliverables ?? ''}
                  {c.deliverables && c.usage ? ' · ' : ''}
                  {c.usage ?? ''}
                </p>
              )}

              {c.mine && <PitchList campaign={c} />}

              {isContributor && !c.mine && c.myPitch && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand pt-3">
                  <StatusPill status={c.myPitch.status} />
                  <p className="text-[13px] text-ink-soft">Your pitch: {c.myPitch.note}</p>
                  {c.myPitch.status === 'pending' && (
                    <button
                      onClick={async () => {
                        try {
                          await api.pitchAction(c.myPitch!.id, 'withdraw')
                          toast.success('Pitch withdrawn')
                          load()
                        } catch (err) {
                          toast.error(err instanceof ApiError ? err.message : 'Could not withdraw')
                        }
                      }}
                      className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-[#b3382e]"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              )}
              {isContributor && !c.mine && !c.myPitch && c.status === 'open' && (
                <PitchForm campaign={c} onDone={load} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
