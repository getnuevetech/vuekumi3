import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { AppearanceDecisionKind, ModelInvitePreviewDto, ModelUsagePreference } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { LogoMark } from '../components/shared'
import { useAuth } from '../context/AuthContext'

export default function JoinModel() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [preview, setPreview] = useState<ModelInvitePreviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'decided'>('loading')
  const [likeness, setLikeness] = useState(false)
  const [terms, setTerms] = useState(false)
  const [usage, setUsage] = useState<ModelUsagePreference>('commercial')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      return
    }
    api.modelInvitePreview(token)
      .then((d) => {
        setPreview(d.invite)
        setSelected((d.invite.images ?? []).map((image) => image.appearanceId))
        setStatus('ready')
      })
      .catch(() => setStatus('missing'))
  }, [token])

  const signedInMatch = Boolean(user && preview && user.email.toLowerCase() === preview.email)

  async function decide(action: AppearanceDecisionKind) {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await api.guestModelConsent(token, {
        action,
        appearanceIds: selected.length ? selected : undefined,
        confirmedLikeness: action === 'approved' ? likeness : false,
        usage: action === 'approved' ? usage : 'none',
        acceptReleaseTerms: action === 'approved' ? terms : undefined,
      })
      setStatus('decided')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record your decision')
    } finally {
      setBusy(false)
    }
  }

  async function accept() {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await api.acceptModelInvite(token, preview?.needsAccount ? { name, password } : {})
      await refresh()
      navigate('/model')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not claim invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-lg">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Review likeness consent.</h1>
        {status === 'loading' && <p className="mt-4 text-sm text-ink-soft">Checking invite…</p>}
        {status === 'missing' && (
          <p className="mt-4 text-sm text-[#b3382e]">
            This invite is invalid or expired.{' '}
            <Link to="/login" className="text-terra underline underline-offset-2">Sign in</Link>
          </p>
        )}
        {status === 'decided' && (
          <p className="mt-4 text-sm text-ink-soft">
            VueKumi recorded your decision. You do not need an account for consent. Optionally create a model profile below to manage future photographs.
          </p>
        )}
        {(status === 'ready' || status === 'decided') && preview && (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Photographer: <strong>{preview.photographerName}</strong>. Images: {preview.imageCount}.
              {preview.shootTitle ? ` Shoot: ${preview.shootTitle}.` : ''} You do not need a VueKumi membership to decide.
            </p>
            <ul className="mt-4 space-y-2">
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
              <div className="mt-6 space-y-3">
                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" checked={likeness} onChange={(e) => setLikeness(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
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
                {error && <p className="text-sm text-[#b3382e]">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void decide('approved')} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">Approve selected</button>
                  <button type="button" disabled={busy} onClick={() => void decide('rejected')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] disabled:opacity-50">Reject</button>
                  <button type="button" disabled={busy} onClick={() => void decide('not_me')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] disabled:opacity-50">This is not me</button>
                  <button type="button" disabled={busy} onClick={() => void decide('unauthorized')} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e] disabled:opacity-50">Report unauthorized</button>
                </div>
              </div>
            )}
            <p className="mt-8 text-sm text-ink-soft">
              Optional: create or claim a VueKumi model profile to manage future photographs. Models do not earn.
              {(user?.accountType === 'contributor' || user?.accountType === 'photographer') && signedInMatch
                ? ' You keep this photographer account and add a model profile on the same email.'
                : ''}
            </p>
            {preview.needsAccount ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => { e.preventDefault(); void accept() }}
              >
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                />
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (8+ characters)"
                  className="w-full rounded-2xl border border-sand-soft bg-white px-4 py-3 text-sm outline-none focus:border-terra"
                />
                {error && status === 'decided' && <p className="text-sm text-[#b3382e]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full border border-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper disabled:opacity-50"
                >
                  Create account & claim
                </button>
              </form>
            ) : signedInMatch ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void accept()}
                className="mt-4 w-full rounded-full border border-ink py-3.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper disabled:opacity-50"
              >
                Claim this profile
              </button>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">
                Sign in as {preview.email} only if you want a VueKumi model profile.{' '}
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/invite/model/${token}`)}`}
                  className="text-terra underline underline-offset-2"
                >
                  Sign in
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
