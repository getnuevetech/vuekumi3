import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  hasModelAccess,
  MODEL_APPEARANCE_LABEL,
  MODEL_USAGE_LABEL,
  type ModelUsagePreference,
  type PhotoAppearanceDto,
} from '@vuekumi/shared'
import { PortalShell, StatusPill, type PortalLink } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'

const icons = {
  dash: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
    </svg>
  ),
}

const modelLinks: PortalLink[] = [
  { to: '/model', label: 'Appearances', icon: icons.dash },
]

const photographerLink: PortalLink = {
  to: '/contributor',
  label: 'Photographer',
  icon: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 6l1.2-2h5.6L16 6" />
    </svg>
  ),
}

export default function ModelPortal() {
  const { user } = useAuth()
  const [items, setItems] = useState<PhotoAppearanceDto[]>([])
  const [handle, setHandle] = useState<string | null>(null)
  const dualRole = Boolean(user && user.accountType === 'contributor' && hasModelAccess(user))
  const links = dualRole ? [...modelLinks, photographerLink] : modelLinks

  const load = () => {
    api.modelPortal().then((d) => setHandle(d.handle)).catch(() => setHandle(null))
    api.modelAppearances()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load'))
  }

  useEffect(() => { load() }, [])

  return (
    <PortalShell
      title="Model portal"
      subtitle="Confirm likeness, then approve or reject usage. You do not earn from licences in this phase."
      links={links}
    >
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Appearances</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Your likeness.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {handle ? `@${handle}` : 'Claimed model account'}. Usage permission, not ownership. A checkbox is not consent — confirm each photograph. Commercial sale of your likeness needs your commercial approval.
        {dualRole ? ' You are also the photographer on this account.' : ''}
      </p>
      <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        Models do not earn yet. The photographer/model split is undecided.
      </p>

      <div className="mt-8 space-y-4">
        {items.length === 0 && (
          <p className="text-sm text-ink-soft">No photographs yet. Photographers invite you from their editor.</p>
        )}
        {items.map((row) => (
          <AppearanceCard key={row.id} row={row} onChanged={load} />
        ))}
      </div>
    </PortalShell>
  )
}

function AppearanceCard({ row, onChanged }: { row: PhotoAppearanceDto; onChanged: () => void }) {
  const [likeness, setLikeness] = useState(row.confirmedLikeness)
  const [usage, setUsage] = useState<ModelUsagePreference>(row.usage === 'none' ? 'editorial' : row.usage)
  const [busy, setBusy] = useState(false)

  const decide = async (status: 'approved' | 'rejected') => {
    setBusy(true)
    try {
      await api.decideAppearance(row.id, {
        confirmedLikeness: likeness,
        status,
        usage: status === 'approved' ? usage : 'none',
      })
      toast.success(status === 'approved' ? 'Usage approved' : 'Usage rejected')
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save decision')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="grid gap-4 rounded-2xl border border-sand-soft bg-white p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
      {row.photoSrc ? (
        <img src={row.photoSrc} alt="" className="h-36 w-full rounded-xl object-cover" />
      ) : (
        <div className="h-36 rounded-xl bg-cream" />
      )}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif-display text-2xl font-light">{row.photoTitle ?? 'Photograph'}</h2>
          <StatusPill status={MODEL_APPEARANCE_LABEL[row.status]} />
          {row.selfShot && <StatusPill status="Self-shot" />}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Photographer {row.photographerName ?? '—'} · named as {row.displayName}
        </p>
        {row.status === 'approved' && (
          <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {MODEL_USAGE_LABEL[row.usage]}
          </p>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={likeness}
            onChange={(e) => setLikeness(e.target.checked)}
            className="mt-0.5 accent-[#bc773f]"
          />
          I confirm this is my likeness
        </label>
        <p className="mt-1 font-mono-tech text-[10px] text-ink-faint">
          Untick this and reject if it is not you. Approving still requires the confirmation.
        </p>
        <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            { v: 'editorial' as const, t: 'Editorial only' },
            { v: 'commercial' as const, t: 'Editorial and commercial' },
          ]).map((o) => (
            <label key={o.v} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft p-3 text-sm has-[:checked]:border-terra">
              <input
                type="radio"
                name={`usage-${row.id}`}
                checked={usage === o.v}
                onChange={() => setUsage(o.v)}
                className="accent-[#bc773f]"
              />
              {o.t}
            </label>
          ))}
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide('approved')}
            className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
          >
            Approve usage
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide('rejected')}
            className="rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e] disabled:opacity-50"
          >
            Reject
          </button>
          {row.photoId && (
            <Link to={`/photo/${row.photoId}`} className="rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:border-ink">
              View
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
