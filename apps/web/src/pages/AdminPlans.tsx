import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PLAN_AUDIENCES, type BuyerPlanDto, type DowngradeMode, type PlanAudience, type SiteContent } from '@vuekumi/shared'
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
  audience: 'buyer' as PlanAudience,
}

function featureLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8)
}

export default function AdminPlans() {
  const [items, setItems] = useState<BuyerPlanDto[]>([])
  const [home, setHome] = useState({ kicker: 'studio rates', title: 'Pick a licence' })
  const [policy, setPolicy] = useState<DowngradeMode>('neither')
  const [licences, setLicences] = useState<SiteContent['pages']['pricing']['licences']>([])
  const [site, setSite] = useState<SiteContent | null>(null)
  const [cancellations, setCancellations] = useState<{ id: string; plan: string; reason: string; detail: string | null; email: string | null; createdAt: string }[]>([])
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.adminPlans()
      .then((data) => {
        setItems(data.items)
        setHome(data.home)
        setPolicy(data.policy.downgradeMode)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load buyer plans'))
    api.adminSite()
      .then((page) => {
        setSite(page.content)
        setLicences(page.content.pages.pricing.licences)
      })
      .catch(() => setLicences([]))
    api.planCancellations()
      .then((data) => setCancellations(data.items))
      .catch(() => setCancellations([]))
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
        audience: draft.audience,
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

  const saveRow = async (row: BuyerPlanDto, patch: { name: string; priceUsd: string; periodDays: string; description: string; features: string; badge: string; highlighted: boolean; homePhotoId: string; sortOrder: string; enabled: boolean; audience: PlanAudience }) => {
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
        audience: patch.audience,
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
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Plans.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Each plan belongs to buyers, photographers, contributors, or models. A buyer cannot buy a photographer plan.
        The homepage shows buyer plans. Vuekumi+ stays a buyer plan at the price you save and cannot be deleted.
        Licence notes further down are the extra cards on the pricing page.
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
        <h2 className="font-serif-display text-2xl font-light">Downgrade</h2>
        <p className="mt-1 text-sm text-ink-soft">When someone moves to a cheaper plan, this is what happens to the unused part of the current plan.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Downgrade settlement</span>
            <select value={policy} onChange={(e) => setPolicy(e.target.value as DowngradeMode)} className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra">
              <option value="prorate">Prorate the unused time against the new price</option>
              <option value="refund">Refund the unused time</option>
              <option value="neither">Neither a credit nor a refund</option>
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void api.savePlanPolicy({ downgradeMode: policy }).then(() => toast.success('Downgrade rule saved')).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not save'))} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
            Save downgrade rule
          </button>
        </div>
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
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Account type</span>
            <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as PlanAudience })} className="mt-1 w-full rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra">
              {PLAN_AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience}</option>)}
            </select>
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

      <div className="mt-8 space-y-8">
        {PLAN_AUDIENCES.map((audience) => {
          const rows = items.filter((row) => row.audience === audience)
          return (
            <div key={audience}>
              <h2 className="font-serif-display text-2xl font-light capitalize">{audience} plans</h2>
              {rows.length === 0 && <p className="mt-2 text-sm text-ink-soft">No {audience} plans yet. Add one above.</p>}
              <div className="mt-4 space-y-4">
                {rows.map((row) => (
                  <PlanRow key={row.id} row={row} editing={editing === row.id} busy={busy} onEdit={() => setEditing(row.id)} onCancel={() => setEditing(null)} onSave={(patch) => void saveRow(row, patch)} onDelete={() => void remove(row)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <section className="mt-10 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Pricing page licence notes</h2>
        <p className="mt-1 text-sm text-ink-soft">These are the named cards under the subscription plans on the pricing page.</p>
        <div className="mt-4 space-y-3">
          {licences.map((item, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-2">
              <input value={item.name} aria-label={`Licence name ${index + 1}`} onChange={(e) => setLicences(licences.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
              <input value={item.note} aria-label={`Licence note ${index + 1}`} onChange={(e) => setLicences(licences.map((row, i) => i === index ? { ...row, note: e.target.value } : row))} className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || !site}
          onClick={() => {
            if (!site) return
            setBusy(true)
            const content = { ...site, pages: { ...site.pages, pricing: { ...site.pages.pricing, licences } } }
            api.saveSite(content)
              .then((page) => {
                setSite(page.content)
                setLicences(page.content.pages.pricing.licences)
                toast.success('Licence notes saved')
              })
              .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not save licence notes'))
              .finally(() => setBusy(false))
          }}
          className="mt-4 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          Save licence notes
        </button>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Cancellation reports</h2>
        {cancellations.length === 0 && <p className="mt-2 text-sm text-ink-soft">No cancellations yet.</p>}
        <div className="mt-4 space-y-3">
          {cancellations.map((row) => (
            <p key={row.id} className="text-sm text-ink-soft">
              <span className="font-medium text-ink">{row.plan}</span>{row.email ? ` · ${row.email}` : ''} · {row.reason}{row.detail ? ` — ${row.detail}` : ''} · {row.createdAt.slice(0, 10)}
            </p>
          ))}
        </div>
      </section>
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
  onSave: (patch: { name: string; priceUsd: string; periodDays: string; description: string; features: string; badge: string; highlighted: boolean; homePhotoId: string; sortOrder: string; enabled: boolean; audience: PlanAudience }) => void
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
  const [audience, setAudience] = useState<PlanAudience>(row.audience)

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
    setAudience(row.audience)
  }, [row])

  return (
    <article className="rounded-3xl border border-sand-soft bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif-display text-2xl font-light">{row.name}</h2>
          <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {row.audience} · {row.slug} · ${row.priceUsd} / {row.periodDays} days · {row.enabled ? 'enabled' : 'disabled'}
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
          {row.slug !== 'plus' && (
            <select value={audience} onChange={(e) => setAudience(e.target.value as PlanAudience)} className="rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra">
              {PLAN_AUDIENCES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          )}
          <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4} placeholder="Card lines, one per line" className="rounded-2xl border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra md:col-span-2" />
          <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge" className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <input value={homePhotoId} onChange={(e) => setHomePhotoId(e.target.value)} placeholder="Homepage photo id" className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Sort order" className="rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} />
            Dark card on the pricing page
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => onSave({ name, priceUsd, periodDays, description, features, badge, highlighted, homePhotoId, sortOrder, enabled, audience })} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-50">Save</button>
            <button type="button" onClick={onCancel} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Cancel</button>
          </div>
        </div>
      )}
    </article>
  )
}
