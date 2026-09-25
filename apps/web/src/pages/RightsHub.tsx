import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import type {
  AppearanceDecisionKind,
  CopyrightInvitePreviewDto,
  ModelInvitePreviewDto,
  ModelUsagePreference,
  PhotoAppearanceDto,
  RightsPreviewDto,
} from '@vuekumi/shared'
import {
  AI_TRAINING_OPT_IN_COPY,
  MODEL_APPEARANCE_LABEL,
  MODEL_USAGE_LABEL,
  hasModelAccess,
  isCreatorWorkspaceAccount,
} from '@vuekumi/shared'
import { toast } from 'sonner'
import { api, ApiError } from '../api/client'
import { SiteHeader, StatusPill } from '../components/shared'
import { useAuth } from '../context/AuthContext'
import { useSiteContent } from '../context/SiteContentContext'

type HubMode = 'landing' | 'loading' | 'likeness' | 'copyright' | 'missing' | 'model'

export default function RightsHubPage() {
  const { token: pathToken } = useParams()
  const [params] = useSearchParams()
  const token = (pathToken ?? params.get('token') ?? '').trim()
  const { user, refresh } = useAuth()
  const { content } = useSiteContent()
  const pageCopy = content.pages.rights
  const navigate = useNavigate()

  const [mode, setMode] = useState<HubMode>(token ? 'loading' : 'landing')
  const [likeness, setLikeness] = useState<ModelInvitePreviewDto | null>(null)
  const [copyright, setCopyright] = useState<CopyrightInvitePreviewDto | null>(null)
  const [appearances, setAppearances] = useState<PhotoAppearanceDto[]>([])

  useEffect(() => {
    if (!token) {
      if (user && hasModelAccess(user)) {
        setMode('model')
        api.modelAppearances()
          .then((d) => setAppearances(d.items))
          .catch(() => setAppearances([]))
        return
      }
      setMode('landing')
      return
    }
    let cancelled = false
    setMode('loading')
    api.rightsPreview(token)
      .then((preview: RightsPreviewDto) => {
        if (cancelled) return
        if (preview.kind === 'likeness') {
          setLikeness(preview.invite)
          setCopyright(null)
          setMode('likeness')
        } else {
          setCopyright(preview.invite)
          setLikeness(null)
          setMode('copyright')
        }
      })
      .catch(() => {
        if (!cancelled) setMode('missing')
      })
    return () => { cancelled = true }
  }, [token, user])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-40 sm:px-6">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{pageCopy.kicker}</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{pageCopy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {pageCopy.intro}{' '}
          To dispute a listing, use{' '}
          <Link to="/report-content" className="text-terra">Report content</Link>
          {' '}or statutory <Link to="/dmca" className="text-terra">DMCA</Link>.
        </p>

        {mode === 'loading' && <p className="mt-8 text-sm text-ink-soft">Checking invite…</p>}
        {mode === 'missing' && (
          <p className="mt-8 text-sm text-[#b3382e]">
            This invite is invalid or expired.{' '}
            <Link to="/login?redirect=/rights" className="text-terra underline underline-offset-2">Sign in</Link>
            {' '}if you already have a model profile.
          </p>
        )}
        {mode === 'landing' && <Landing />}
        {mode === 'likeness' && likeness && token && (
          <LikenessPanel
            token={token}
            preview={likeness}
            onClaimed={async () => {
              await refresh()
              navigate('/model')
            }}
          />
        )}
        {mode === 'copyright' && copyright && token && (
          <CopyrightPanel token={token} preview={copyright} />
        )}
        {mode === 'model' && (
          <ModelQueue
            items={appearances}
            onChanged={() => {
              api.modelAppearances()
                .then((d) => setAppearances(d.items))
                .catch(() => undefined)
            }}
          />
        )}
      </main>
    </div>
  )
}

function Landing() {
  return (
    <div className="mt-10 space-y-6">
      <div className="rounded-2xl border border-sand-soft bg-white p-6">
        <h2 className="font-serif-display text-2xl font-light">Open an invite</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Use the link from your email — it lands here with a token. Legacy
          {' '}<code className="font-mono-tech text-xs">/invite/model/…</code> and
          {' '}<code className="font-mono-tech text-xs">/invite/photographer/…</code> URLs
          redirect to this hub.
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          Already a model?{' '}
          <Link to="/login?redirect=/rights" className="text-terra underline underline-offset-2">
            Sign in
          </Link>
          {' '}to review pending appearances.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link to="/report-content" className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra">
          Report content →
        </Link>
        <Link to="/dmca" className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft">
          DMCA notice →
        </Link>
        <Link to="/model" className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft">
          Model portal →
        </Link>
      </div>
    </div>
  )
}

function LikenessPanel({
  token,
  preview,
  onClaimed,
}: {
  token: string
  preview: ModelInvitePreviewDto
  onClaimed: () => Promise<void>
}) {
  const { user } = useAuth()
  const [status, setStatus] = useState<'ready' | 'decided'>('ready')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [terms, setTerms] = useState(false)
  const [usage, setUsage] = useState<ModelUsagePreference>('commercial')
  const [aiTraining, setAiTraining] = useState(false)
  const [selected, setSelected] = useState(() => (preview.images ?? []).map((i) => i.appearanceId))
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const signedInMatch = Boolean(user && user.email.toLowerCase() === preview.email)

  async function decide(action: AppearanceDecisionKind) {
    setBusy(true)
    setError(null)
    try {
      await api.guestModelConsent(token, {
        action,
        appearanceIds: selected.length ? selected : undefined,
        confirmedLikeness: action === 'approved' ? confirmed : false,
        usage: action === 'approved' ? usage : 'none',
        aiTraining: action === 'approved' ? aiTraining : false,
        acceptReleaseTerms: action === 'approved' ? terms : undefined,
      })
      setStatus('decided')
      toast.success('Decision recorded')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record your decision')
    } finally {
      setBusy(false)
    }
  }

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await api.acceptModelInvite(token, preview.needsAccount ? { firstName, lastName, password } : {})
      await onClaimed()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not claim invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 space-y-4">
      <h2 className="font-serif-display text-2xl font-light">Likeness consent</h2>
      {status === 'decided' && (
        <p className="text-sm text-ink-soft">
          VueKumi recorded your decision. You do not need an account for consent.
        </p>
      )}
      <p className="text-sm text-ink-soft">
        Photographer: <strong>{preview.photographerName}</strong>. Images: {preview.imageCount}.
        {preview.shootTitle ? ` Shoot: ${preview.shootTitle}.` : ''} You do not need a VueKumi membership to decide.
      </p>
      <ul className="space-y-2">
        {(preview.images ?? []).map((image) => (
          <li key={image.appearanceId} className="flex items-center gap-3 rounded-xl bg-cream px-3 py-2 text-sm">
            {status === 'ready' && (
              <input
                type="checkbox"
                checked={selected.includes(image.appearanceId)}
                onChange={(e) => {
                  setSelected((current) => e.target.checked
                    ? [...current, image.appearanceId]
                    : current.filter((id) => id !== image.appearanceId))
                }}
              />
            )}
            {image.photoSrc && <img src={image.photoSrc} alt="" className="h-12 w-12 rounded object-cover" />}
            <span>{image.photoTitle}</span>
          </li>
        ))}
      </ul>
      {status === 'ready' && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            I confirm that I am the person depicted in the selected images.
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            {preview.terms}
          </label>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            {([
              { v: 'editorial' as const, t: 'Editorial only' },
              { v: 'commercial' as const, t: 'Editorial and commercial' },
            ]).map((o) => (
              <label key={o.v} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft bg-white p-3 text-sm has-[:checked]:border-terra">
                <input type="radio" checked={usage === o.v} onChange={() => setUsage(o.v)} />
                {o.t}
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={aiTraining} onChange={(e) => setAiTraining(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            {AI_TRAINING_OPT_IN_COPY}
          </label>
          {error && <p className="text-sm text-[#b3382e]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void decide('approved')} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">Approve selected</button>
            <button type="button" disabled={busy} onClick={() => void decide('rejected')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] disabled:opacity-50">Reject</button>
            <button type="button" disabled={busy} onClick={() => void decide('not_me')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] disabled:opacity-50">This is not me</button>
            <button type="button" disabled={busy} onClick={() => void decide('unauthorized')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e] disabled:opacity-50">Report unauthorized</button>
          </div>
        </div>
      )}
      <p className="pt-4 text-sm text-ink-soft">
        Optional: create or claim a VueKumi model profile to manage future photographs. Models do not earn.
        {isCreatorWorkspaceAccount(user?.accountType) && signedInMatch
          ? ' You keep this photographer account and add a model profile on the same email.'
          : ''}
      </p>
      {preview.needsAccount ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void accept() }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra" />
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra" />
          </div>
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra" />
          {error && status === 'decided' && <p className="text-sm text-[#b3382e]">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-full border border-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper disabled:opacity-50">
            Create account & claim
          </button>
        </form>
      ) : signedInMatch ? (
        <button type="button" disabled={busy} onClick={() => void accept()} className="w-full rounded-full border border-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper disabled:opacity-50">
          Claim this profile
        </button>
      ) : (
        <p className="text-sm text-ink-soft">
          Sign in as {preview.email} only if you want a VueKumi model profile.{' '}
          <Link to={`/login?redirect=${encodeURIComponent(`/rights?token=${token}`)}`} className="text-terra underline underline-offset-2">Sign in</Link>
        </p>
      )}
    </div>
  )
}

function CopyrightPanel({ token, preview }: { token: string; preview: CopyrightInvitePreviewDto }) {
  const [status, setStatus] = useState<'ready' | 'decided'>('ready')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identity, setIdentity] = useState(false)
  const [terms, setTerms] = useState(false)
  const [usage, setUsage] = useState<ModelUsagePreference>('editorial')
  const [aiTraining, setAiTraining] = useState(false)

  async function decide(action: AppearanceDecisionKind) {
    setBusy(true)
    setError(null)
    try {
      await api.guestCopyrightConsent(token, {
        action,
        confirmedIdentity: action === 'approved' ? identity : false,
        usage: action === 'approved' ? usage : 'none',
        aiTraining: action === 'approved' ? aiTraining : false,
        acceptAuthorizationTerms: action === 'approved' ? terms : undefined,
      })
      setStatus('decided')
      toast.success('Decision recorded')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record your decision')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 space-y-4">
      <h2 className="font-serif-display text-2xl font-light">Copyright authorization</h2>
      {status === 'decided' && (
        <p className="text-sm text-ink-soft">VueKumi recorded your decision. You do not need an account for rights clearance.</p>
      )}
      <p className="text-sm text-ink-soft">{preview.notice}</p>
      <p className="text-sm text-ink-soft">
        Model: <strong>{preview.modelName}</strong>. Images: {preview.imageCount}.
      </p>
      <ul className="space-y-2">
        {preview.images.map((image) => (
          <li key={image.authorizationId} className="flex items-center gap-3 rounded-xl bg-cream px-3 py-2 text-sm">
            {image.photoSrc && <img src={image.photoSrc} alt="" className="h-12 w-12 rounded object-cover" />}
            <span>{image.photoTitle}</span>
          </li>
        ))}
      </ul>
      {status === 'ready' && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={identity} onChange={(e) => setIdentity(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            I confirm I am the copyright holder VueKumi contacted.
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            {preview.terms}
          </label>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            {([
              { v: 'editorial' as const, t: 'Display / editorial only' },
              { v: 'commercial' as const, t: 'Commercial sublicensing through VueKumi' },
            ]).map((o) => (
              <label key={o.v} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft bg-white p-3 text-sm has-[:checked]:border-terra">
                <input type="radio" checked={usage === o.v} onChange={() => setUsage(o.v)} />
                {o.t}
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={aiTraining} onChange={(e) => setAiTraining(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            {AI_TRAINING_OPT_IN_COPY}
          </label>
          {error && <p className="text-sm text-[#b3382e]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void decide('approved')} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">Approve</button>
            <button type="button" disabled={busy} onClick={() => void decide('rejected')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] disabled:opacity-50">Reject</button>
            <button type="button" disabled={busy} onClick={() => void decide('not_me')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] disabled:opacity-50">This is not me</button>
            <button type="button" disabled={busy} onClick={() => void decide('unauthorized')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e] disabled:opacity-50">Report unauthorized</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ModelQueue({ items, onChanged }: { items: PhotoAppearanceDto[]; onChanged: () => void }) {
  const pending = items.filter((row) => row.status === 'invited' || row.status === 'claimed' || row.status === 'identified')
  const others = items.filter((row) => !pending.includes(row))

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif-display text-2xl font-light">Your appearances</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Approve or reject from here. Optional likeness check and uploads stay on the{' '}
            <Link to="/model" className="text-terra">model portal</Link>.
          </p>
        </div>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-ink-soft">No photographs yet. Open an invite email or wait for a photographer to name you.</p>
      )}
      {[...pending, ...others].map((row) => (
        <ModelAppearanceRow key={row.id} row={row} onChanged={onChanged} />
      ))}
    </div>
  )
}

function ModelAppearanceRow({ row, onChanged }: { row: PhotoAppearanceDto; onChanged: () => void }) {
  const [confirmed, setConfirmed] = useState(row.confirmedLikeness)
  const [usage, setUsage] = useState<ModelUsagePreference>(row.usage === 'none' ? 'editorial' : row.usage)
  const [aiTraining, setAiTraining] = useState(Boolean(row.aiTraining))
  const [busy, setBusy] = useState(false)
  const canDecide = row.status === 'invited' || row.status === 'claimed' || row.status === 'identified' || row.status === 'approved'

  async function decide(status: 'approved' | 'rejected' | 'revoked') {
    setBusy(true)
    try {
      await api.decideAppearance(row.id, {
        confirmedLikeness: confirmed,
        status,
        usage: status === 'approved' ? usage : 'none',
        aiTraining: status === 'approved' ? aiTraining : false,
      })
      toast.success(status === 'approved' ? 'Usage approved' : status === 'revoked' ? 'Consent withdrawn' : 'Usage rejected')
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save decision')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="flex flex-wrap gap-4 rounded-2xl border border-sand-soft bg-white p-4">
      {row.photoSrc ? (
        <img src={row.photoSrc} alt="" className="h-24 w-28 rounded-xl object-cover" />
      ) : (
        <div className="h-24 w-28 rounded-xl bg-cream" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{row.photoTitle ?? 'Photograph'}</h3>
          <StatusPill status={MODEL_APPEARANCE_LABEL[row.status]} />
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {row.photographerName ?? 'Photographer'} · {MODEL_USAGE_LABEL[row.usage]}
        </p>
        {canDecide && (
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
              I confirm this is my likeness
            </label>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              {([
                { v: 'editorial' as const, t: 'Editorial only' },
                { v: 'commercial' as const, t: 'Editorial and commercial' },
              ]).map((o) => (
                <label key={o.v} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft p-2 text-xs has-[:checked]:border-terra">
                  <input type="radio" name={`hub-usage-${row.id}`} checked={usage === o.v} onChange={() => setUsage(o.v)} />
                  {o.t}
                </label>
              ))}
            </fieldset>
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={aiTraining} onChange={(e) => setAiTraining(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
              {AI_TRAINING_OPT_IN_COPY}
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void decide('approved')} className="rounded-full bg-ink px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-50">Approve</button>
              <button type="button" disabled={busy} onClick={() => void decide('rejected')} className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-50">Reject</button>
              {row.status === 'approved' && (
                <button type="button" disabled={busy} onClick={() => void decide('revoked')} className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#b3382e] disabled:opacity-50">Revoke</button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
