import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { BuyerPlanDto } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

const emptyDraft = {
  name: '',
  slug: '',
  priceUsd: '',
  periodDays: '30',
  description: '',
  features: '',
  badge: '',
  highlighted: false,
  homePhotoId: '',
  sortOrder: '10',
  enabled: true,
}

function featureLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8)
}

export default function AdminPlans() {
  const [items, setItems] = useState<BuyerPlanDto[]>([])
  const [home, setHome] = useState({ kicker: 'studio rates', title: 'Pick a licence' })
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.adminPlans()
      .then((data) => {
        setItems(data.items)
        setHome(data.home)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load buyer plans'))
  }

  useEffect(() => { load() }, [])

  const saveNew = async () => {
    const priceUsd = Number(draft.priceUsd)
    const periodDays = Number(draft.periodDays)
    if (!draft.name.trim() || !Number.isFinite(priceUsd) || !Number.isFinite(periodDays)) {
      toast.error('Name, price, and period are required')
      return
    }
    setBusy(true)
    try {
      await api.createBuyerPlan({
        name: draft.name.trim(),
        slug: draft.slug.trim() || undefined,
        priceUsd,
        periodDays,
        description: draft.description.trim() || undefined,
        features: featureLines(draft.features),
        badge: draft.badge.trim() || null,
        highlighted: draft.highlighted,
        homePhotoId: draft.homePhotoId.trim() || null,
        sortOrder: Number(draft.sortOrder) || 10,
        enabled: draft.enabled,
      })
      setDraft(emptyDraft)
      toast.success('Buyer plan created')
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the plan')
    } finally {
      setBusy(false)
    }
  }

  const saveHeading = async () => {
    if (!home.kicker.trim() || !home.title.trim()) {
      toast.error('Homepage heading needs both lines')
      return
    }
    setBusy(true)
    try {
      const saved = await api.saveHomePricing({ kicker: home.kicker.trim(), title: home.title.trim() })
      setHome(saved.home)
      toast.success('Homepage pricing heading saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the heading')
    } finally {
      setBusy(false)
    }
  }

  const saveRow = async (row: BuyerPlanDto, patch: { name: string; priceUsd: string; periodDays: string; description: string; features: string; badge: string; highlighted: boolean; homePhotoId: string; sortOrder: string; enabled: boolean }) => {
    const priceUsd = Number(patch.priceUsd)
    const periodDays = Number(patch.periodDays)
    if (!patch.name.trim() || !Number.isFinite(priceUsd) || !Number.isFinite(periodDays)) {
      toast.error('Name, price, and period are required')
      return
    }
    setBusy(true)
    try {
      await api.updateBuyerPlan(row.id, {
        name: patch.name.trim(),
        priceUsd,
        periodDays,
        description: patch.description.trim() || null,
        features: featureLines(patch.features),
        badge: patch.badge.trim() || null,
        highlighted: patch.highlighted,
        homePhotoId: patch.homePhotoId.trim() || null,
        sortOrder: Number(patch.sortOrder) || 0,
        enabled: patch.enabled,
      })
      setEditing(null)
      toast.success(`${patch.name.trim()} saved`)
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the plan')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: BuyerPlanDto) => {
    setBusy(true)
    try {
      await api.deleteBuyerPlan(row.id)
      toast.success(`${row.name} removed`)
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove the plan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell subtitle="Plans shown on the homepage and the pricing page.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Money</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Buyer plans.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Enabled plans are the cards on the homepage and on the pricing page. The homepage keeps the same card layout.
        Change the heading, the price, the period, and the lines on each card here. Vuekumi+ stays at the price you save and cannot be deleted.
      </p>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Homepage heading</h2>
        <p className="mt-1 text-sm text-ink-soft">These two lines sit above the pricing cards on the homepage.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Small line</span>
            <input value={home.kicker} onChange={(e) => setHome({ ...home, kicker: e.target.value })} className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Heading</span>
            <input value={home.title} onChange={(e) => setHome({ ...home, title: e.target.value })} className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
        </div>
        <button type="button" disabled={busy} onClick={() => void saveHeading()} className="mt-4 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
          Save homepage heading
        </button>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Add a plan</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Name</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Slug</span>
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="optional" className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Price USD</span>
            <input value={draft.priceUsd} onChange={(e) => setDraft({ ...draft, priceUsd: e.target.value })} inputMode="decimal" className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Period days</span>
            <input value={draft.periodDays} onChange={(e) => setDraft({ ...draft, periodDays: e.target.value })} inputMode="numeric" className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block md:col-span-2">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Card lines, one per line</span>
            <textarea value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} rows={4} className="mt-1 w-full rounded-2xl border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Badge</span>
            <input value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="Most popular" className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Homepage photo id</span>
            <input value={draft.homePhotoId} onChange={(e) => setDraft({ ...draft, homePhotoId: e.target.value })} placeholder="Optional" className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.highlighted} onChange={(e) => setDraft({ ...draft, highlighted: e.target.checked })} />
            Dark card on the pricing page
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveNew()}
          className="mt-4 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          Create plan
        </button>
      </section>

      <div className="mt-8 space-y-4">
        {items.map((row) => (
          <PlanRow key={row.id} row={row} editing={editing === row.id} busy={busy} onEdit={() => setEditing(row.id)} onCancel={() => setEditing(null)} onSave={(patch) => void saveRow(row, patch)} onDelete={() => void remove(row)} />
        ))}
      </div>
    </AdminShell>
  )
}

function PlanRow({
  row,
  editing,
  busy,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  row: BuyerPlanDto
  editing: boolean
  busy: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (patch: { name: string; priceUsd: string; periodDays: string; description: string; features: string; badge: string; highlighted: boolean; homePhotoId: string; sortOrder: string; enabled: boolean }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(row.name)
  const [priceUsd, setPriceUsd] = useState(String(row.priceUsd))
  const [periodDays, setPeriodDays] = useState(String(row.periodDays))
  const [description, setDescription] = useState(row.description ?? '')
  const [features, setFeatures] = useState(row.features.join('\n'))
  const [badge, setBadge] = useState(row.badge ?? '')
  const [highlighted, setHighlighted] = useState(row.highlighted)
  const [homePhotoId, setHomePhotoId] = useState(row.homePhotoId ?? '')
  const [sortOrder, setSortOrder] = useState(String(row.sortOrder))
  const [enabled, setEnabled] = useState(row.enabled)

  useEffect(() => {
    setName(row.name)
    setPriceUsd(String(row.priceUsd))
    setPeriodDays(String(row.periodDays))
    setDescription(row.description ?? '')
    setFeatures(row.features.join('\n'))
    setBadge(row.badge ?? '')
    setHighlighted(row.highlighted)
    setHomePhotoId(row.homePhotoId ?? '')
    setSortOrder(String(row.sortOrder))
    setEnabled(row.enabled)
  }, [row])

  return (
    <article className="rounded-3xl border border-sand-soft bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif-display text-2xl font-light">{row.name}</h2>
          <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {row.slug} · ${row.priceUsd} / {row.periodDays} days · {row.enabled ? 'enabled' : 'disabled'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Edit</button>
          {row.slug !== 'plus' && (
            <button type="button" disabled={busy} onClick={onDelete} className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#b3382e] disabled:opacity-50">Remove</button>
          )}
        </div>
      </div>
      {row.description && !editing && <p className="mt-3 text-sm text-ink-soft">{row.description}</p>}
      {editing && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <input value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <input value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
          <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4} placeholder="Card lines, one per line" className="rounded-2xl border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra md:col-span-2" />
          <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge" className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <input value={homePhotoId} onChange={(e) => setHomePhotoId(e.target.value)} placeholder="Homepage photo id" className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Sort order" className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} />
            Dark card on the pricing page
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => onSave({ name, priceUsd, periodDays, description, features, badge, highlighted, homePhotoId, sortOrder, enabled })} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-50">Save</button>
            <button type="button" onClick={onCancel} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Cancel</button>
          </div>
        </div>
      )}
    </article>
  )
}
