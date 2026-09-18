import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  hasModelAccess,
  isCreatorWorkspaceAccount,
  LIKENESS_CHECK_LABEL,
  MODEL_APPEARANCE_LABEL,
  MODEL_USAGE_LABEL,
  AI_TRAINING_OPT_IN_COPY,
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
  {
    to: '/model/upload',
    label: 'Upload',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20h16" strokeLinecap="round" />
      </svg>
    ),
  },
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

export function modelPortalLinks(hasPhotographerProfile?: boolean): PortalLink[] {
  return hasPhotographerProfile ? [...modelLinks, photographerLink] : modelLinks
}

export default function ModelPortal() {
  const { user } = useAuth()
  const [items, setItems] = useState<PhotoAppearanceDto[]>([])
  const [photos, setPhotos] = useState<import('@vuekumi/shared').PhotoDto[]>([])
  const [handle, setHandle] = useState<string | null>(null)
  const dualRole = Boolean(user && isCreatorWorkspaceAccount(user.accountType) && hasModelAccess(user))
  const links = modelPortalLinks(dualRole)

  const load = () => {
    api.modelPortal().then((d) => setHandle(d.handle)).catch(() => setHandle(null))
    api.modelAppearances()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load'))
    api.modelPhotos()
      .then((d) => setPhotos(d.items))
      .catch(() => setPhotos([]))
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
        {dualRole ? ' You are also the photographer on this account.' : user?.hasPhotographerAgreement ? ' You have accepted the photographer agreement on this same email. Account type stays model.' : ''}
      </p>
      <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        Models do not earn yet. The photographer/model split is undecided. A visual check is optional and cannot grant rights.
      </p>
      {handle && (
        <p className="mt-3 text-sm text-ink-soft">
          View public portfolio:{' '}
          <Link to={`/m/${handle}`} className="text-terra">/m/{handle}</Link>
        </p>
      )}

      {photos.length > 0 && (
        <div className="mt-10">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Your uploads</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {photos.map((p) => (
              <Link key={p.id} to={`/model/photos/${p.id}`} className="flex gap-3 rounded-2xl border border-sand-soft bg-white p-3 hover:border-terra">
                <img src={p.thumbSrc ?? p.src} alt="" className="h-16 w-20 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="font-mono-tech text-[10px] text-ink-faint">{p.permissionState} · {p.rights?.creationClaim ?? 'claim'}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {items.length === 0 && (
          <p className="text-sm text-ink-soft">
            No photographs yet. Photographers invite you from their editor, or <Link to="/model/upload" className="text-terra">upload your own</Link>.
          </p>
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
  const [aiTraining, setAiTraining] = useState(Boolean(row.aiTraining))
  const [busy, setBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [consented, setConsented] = useState(false)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)

  const decide = async (status: 'approved' | 'rejected' | 'revoked') => {
    setBusy(true)
    try {
      await api.decideAppearance(row.id, {
        confirmedLikeness: likeness,
        status,
        usage: status === 'approved' ? usage : 'none',
        aiTraining: status === 'approved' ? aiTraining : false,
      })
      toast.success(
        status === 'approved'
          ? 'Usage approved'
          : status === 'revoked'
            ? 'Consent withdrawn. New sales locked. Past grants remain.'
            : 'Usage rejected',
      )
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save decision')
    } finally {
      setBusy(false)
    }
  }

  const runCheck = async () => {
    if (!selfie) {
      toast.error('Choose a selfie for a one-time comparison')
      return
    }
    setVerifyBusy(true)
    try {
      const imageBase64 = await fileToBase64(selfie)
      const result = await api.verifyLikeness(row.id, {
        consented: true,
        imageBase64,
        mimeType: selfie.type === 'image/png' || selfie.type === 'image/webp' ? selfie.type : 'image/jpeg',
      })
      setSelfie(null)
      setConsented(false)
      setFileKey((n) => n + 1)
      toast.success(result.appearance.verification
        ? LIKENESS_CHECK_LABEL[result.appearance.verification.status]
        : 'Check recorded')
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not run likeness check')
    } finally {
      setVerifyBusy(false)
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
        {row.status === 'revoked' && (
          <p className="mt-2 text-sm text-ink-soft">
            New licensing is locked. Existing certificates are not silently voided. Contest a past grant with a rights report.
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
        <div className="mt-4 rounded-xl border border-sand-soft p-3">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Optional visual check</p>
          <p className="mt-1 text-sm text-ink-soft">
            Compare a selfie to this photograph once. Vuekumi does not keep the selfie or build a face database.
            Similarity is not a release — you still confirm likeness and approve usage yourself.
          </p>
          {row.verification && (
            <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              Last check: {LIKENESS_CHECK_LABEL[row.verification.status]}
              {row.verification.notes ? ` · ${row.verification.notes}` : ''}
            </p>
          )}
          <label className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 accent-[#bc773f]"
            />
            I consent to a one-time comparison. Do not store my selfie.
          </label>
          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-3 block w-full text-sm text-ink-soft"
            onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={verifyBusy || !consented || !selfie}
            onClick={() => void runCheck()}
            className="mt-3 rounded-full border border-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {verifyBusy ? 'Checking…' : 'Run likeness check'}
          </button>
        </div>
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
        <label className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={aiTraining}
            onChange={(e) => setAiTraining(e.target.checked)}
            className="mt-0.5 accent-[#bc773f]"
          />
          {AI_TRAINING_OPT_IN_COPY}
        </label>
        {row.aiTraining && (
          <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            Likeness AI-training opted in
          </p>
        )}
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
          {row.status === 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('revoked')}
              className="rounded-full border border-sand px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:border-[#b3382e] hover:text-[#b3382e] disabled:opacity-50"
            >
              Withdraw consent
            </button>
          )}
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result ?? '')
      const comma = value.indexOf(',')
      resolve(comma >= 0 ? value.slice(comma + 1) : value)
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}
