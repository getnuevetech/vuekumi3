import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { AppearanceDecisionKind, CopyrightInvitePreviewDto, ModelUsagePreference } from '@vuekumi/shared'
import { AI_TRAINING_OPT_IN_COPY } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { LogoMark } from '../components/shared'

export default function JoinPhotographer() {
  const { token } = useParams()
  const [preview, setPreview] = useState<CopyrightInvitePreviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'decided'>('loading')
  const [identity, setIdentity] = useState(false)
  const [terms, setTerms] = useState(false)
  const [usage, setUsage] = useState<ModelUsagePreference>('editorial')
  const [aiTraining, setAiTraining] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      return
    }
    api.copyrightInvitePreview(token)
      .then((d) => {
        setPreview(d.invite)
        setStatus('ready')
      })
      .catch(() => setStatus('missing'))
  }, [token])

  async function decide(action: AppearanceDecisionKind) {
    if (!token) return
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record your decision')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-lg">
        <LogoMark />
        <h1 className="font-serif-display mt-10 text-4xl font-light tracking-tight">Review copyright authorization.</h1>
        {status === 'loading' && <p className="mt-4 text-sm text-ink-soft">Checking notice…</p>}
        {status === 'missing' && (
          <p className="mt-4 text-sm text-[#b3382e]">
            This notice is invalid or expired.{' '}
            <Link to="/login" className="text-terra underline underline-offset-2">Sign in</Link>
          </p>
        )}
        {status === 'decided' && (
          <p className="mt-4 text-sm text-ink-soft">
            VueKumi recorded your decision. You do not need an account for rights clearance.
          </p>
        )}
        {(status === 'ready' || status === 'decided') && preview && (
          <>
            <p className="mt-2 text-sm text-ink-soft">{preview.notice}</p>
            <p className="mt-2 text-sm text-ink-soft">
              Model: <strong>{preview.modelName}</strong>. Images: {preview.imageCount}. You do not need a VueKumi membership to decide.
            </p>
            <ul className="mt-4 space-y-2">
              {preview.images.map((image) => (
                <li key={image.authorizationId} className="flex items-center gap-3 rounded-xl bg-cream px-3 py-2 text-sm">
                  {image.photoSrc && <img src={image.photoSrc} alt="" className="h-12 w-12 rounded object-cover" />}
                  <span>{image.photoTitle}</span>
                </li>
              ))}
            </ul>
            {status === 'ready' && (
              <div className="mt-6 space-y-3">
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
          </>
        )}
      </div>
    </div>
  )
}
