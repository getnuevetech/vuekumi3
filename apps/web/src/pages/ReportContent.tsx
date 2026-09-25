import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  parsePhotoRef,
  photoPagePath,
  RIGHTS_REPORT_CATEGORY_META,
  RIGHTS_REPORT_REASONS,
  type PhotoDto,
  type RightsReportReason,
} from '@vuekumi/shared'
import { toast } from 'sonner'
import { SiteHeader } from '../components/shared'
import { useSiteContent } from '../context/SiteContentContext'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'

function initialPhotoLink(params: URLSearchParams): string {
  const fromUrl = params.get('photoUrl') ?? params.get('url')
  if (fromUrl) return fromUrl
  const id = params.get('photoId') ?? params.get('photo')
  if (id) {
    const path = photoPagePath(id)
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${path}`
    }
    return path
  }
  return ''
}

export default function ReportContentPage() {
  const { user } = useAuth()
  const { content } = useSiteContent()
  const pageCopy = content.pages.report
  const [params] = useSearchParams()

  const [photoLink, setPhotoLink] = useState(() => initialPhotoLink(params))
  const [photo, setPhoto] = useState<PhotoDto | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [reason, setReason] = useState<RightsReportReason>('copyright')
  const [details, setDetails] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ urgent?: boolean; alreadyReported?: boolean } | null>(null)

  const meta = RIGHTS_REPORT_CATEGORY_META[reason]
  const resolvedId = useMemo(() => parsePhotoRef(photoLink), [photoLink])

  useEffect(() => {
    if (!resolvedId) {
      setPhoto(null)
      setPhotoError(photoLink.trim() ? 'Paste a photograph page link like /photo/afr-001' : null)
      return
    }
    let cancelled = false
    api.photo(resolvedId)
      .then((p) => {
        if (!cancelled) {
          setPhoto(p)
          setPhotoError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhoto(null)
          setPhotoError('Photograph not found or not publicly listed.')
        }
      })
    return () => { cancelled = true }
  }, [resolvedId, photoLink])

  const canSubmit = useMemo(() => {
    if (!resolvedId || !photo || details.trim().length < 20) return false
    if (!user && !reporterEmail.trim()) return false
    return true
  }, [resolvedId, photo, details, user, reporterEmail])

  async function submit() {
    if (!canSubmit || !resolvedId) return
    setBusy(true)
    try {
      const result = await api.reportContent({
        photoUrl: photoLink.trim(),
        photoId: resolvedId,
        reason,
        details,
        reporterEmail: user ? undefined : reporterEmail,
        reporterName: user ? undefined : reporterName,
      })
      setDone({ urgent: result.urgent, alreadyReported: result.alreadyReported })
      toast.success(
        result.alreadyReported
          ? 'This report is already with staff.'
          : result.urgent
            ? 'Urgent safety report received. Staff will prioritize it.'
            : 'Report received. Staff will review.',
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{pageCopy.kicker}</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{pageCopy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {pageCopy.intro}{' '}
          <Link to="/dmca" className="text-terra">DMCA notice</Link>
          {' '}·{' '}
          <Link to="/rights" className="text-terra">Your rights</Link>
        </p>

        {done ? (
          <div className="mt-10 space-y-4 rounded-2xl border border-sand-soft bg-white p-6">
            <h2 className="font-serif-display text-2xl font-light">
              {done.alreadyReported ? 'Already filed.' : done.urgent ? 'Safety report received.' : 'Report received.'}
            </h2>
            <p className="text-sm text-ink-soft">
              {done.urgent
                ? 'This was routed to the safety fast-path. New licensing on the photograph is frozen while staff review.'
                : 'Staff will review. New licensing on the photograph is frozen while the report is open. Existing certificates are not revoked.'}
            </p>
            <div className="flex flex-wrap gap-3">
              {photo && (
                <Link to={photoPagePath(photo.id)} className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-terra">
                  Back to photograph →
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setDone(null)
                  setDetails('')
                }}
                className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-soft"
              >
                File another
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <label className="block space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Photograph link</span>
              <input
                value={photoLink}
                onChange={(e) => setPhotoLink(e.target.value)}
                placeholder="https://…/photo/afr-001 or /photo/afr-001"
                required
                inputMode="url"
                autoComplete="url"
                className="w-full rounded-xl border border-sand-soft bg-white px-3 py-2.5 text-sm outline-none focus:border-terra"
              />
              <p className="text-xs text-ink-faint">
                Use the page URL from the browser address bar — not only the id.
              </p>
              {photoError && <p className="text-xs text-[#b3382e]">{photoError}</p>}
              {photo && (
                <Link to={photoPagePath(photo.id)} className="mt-2 flex items-center gap-3 rounded-xl border border-sand-soft bg-white p-2 hover:border-terra">
                  <img src={photo.src} alt="" className="h-14 w-16 rounded-lg object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{photo.title}</span>
                    <span className="block truncate font-mono-tech text-[10px] uppercase text-ink-faint">
                      {photoPagePath(photo.id)}
                    </span>
                  </span>
                </Link>
              )}
            </label>

            <fieldset className="space-y-2">
              <legend className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Category</legend>
              <div className="space-y-2">
                {RIGHTS_REPORT_REASONS.map((key) => {
                  const item = RIGHTS_REPORT_CATEGORY_META[key]
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 ${
                        reason === key ? 'border-ink bg-white' : 'border-sand-soft bg-white/60 hover:border-sand'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={key}
                        checked={reason === key}
                        onChange={() => setReason(key)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {item.label}
                          {item.urgent && (
                            <span className="ml-2 font-mono-tech text-[9px] uppercase tracking-[0.14em] text-[#b3382e]">
                              Fast-path
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{item.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {meta.urgent && (
              <p className="rounded-xl border border-[#b3382e]/40 bg-[#b3382e]/5 px-3 py-2 text-xs text-[#b3382e]">
                Safety reports skip the ordinary copyright queue. If someone is in immediate danger, contact local emergency services first.
              </p>
            )}

            <label className="block space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Details</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the issue (at least 20 characters)"
                rows={5}
                required
                minLength={20}
                className="w-full rounded-xl border border-sand-soft bg-white px-3 py-2.5 text-sm outline-none focus:border-terra"
              />
            </label>

            {!user && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Email (required)</span>
                  <input
                    type="email"
                    required
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    className="w-full rounded-xl border border-sand-soft bg-white px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-ink-faint">Name (optional)</span>
                  <input
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full rounded-xl border border-sand-soft bg-white px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="w-full rounded-full bg-ink py-3.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper disabled:opacity-40"
            >
              {busy ? 'Sending…' : meta.urgent ? 'Submit safety report' : 'Submit report'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
