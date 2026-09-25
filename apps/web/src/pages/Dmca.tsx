import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { CreateDmcaNoticeInput, DmcaNoticeDto, DmcaPublicPageDto } from '@vuekumi/shared'
import { toast } from 'sonner'
import { SiteHeader } from '../components/shared'
import { useSiteContent } from '../context/SiteContentContext'
import { api, ApiError } from '../api/client'

export default function DmcaPage() {
  const { content } = useSiteContent()
  const pageCopy = content.pages.dmca
  const { id } = useParams()
  const [page, setPage] = useState<DmcaPublicPageDto | null>(null)
  const [notice, setNotice] = useState<DmcaNoticeDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    photoId: new URLSearchParams(window.location.search).get('photo') ?? '',
    photoUrl: '',
    claimantName: '',
    claimantEmail: '',
    claimantAddress: '',
    claimantPhone: '',
    workDescription: '',
    originalLocation: '',
    infringingLocation: '',
    goodFaith: false,
    perjury: false,
    signature: '',
  })
  const [counter, setCounter] = useState({
    senderName: '',
    senderEmail: '',
    senderAddress: '',
    statement: '',
    consentToJurisdiction: false,
    perjury: false,
    signature: '',
  })

  useEffect(() => {
    api.dmcaPage().then(setPage).catch(() => setPage(null))
  }, [])

  useEffect(() => {
    if (!id) return
    api.dmcaNotice(id).then((d) => setNotice(d.notice)).catch(() => setNotice(null))
  }, [id])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-28">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{pageCopy.kicker}</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{pageCopy.title}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {pageCopy.intro}{' '}
          <Link to="/report-content" className="text-terra">Report content</Link>
        </p>

        {page && (
          <div className="mt-8 space-y-3 rounded-2xl border border-sand-soft bg-white p-5 text-sm">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-faint">Designated agent</p>
            <p className="font-medium">{page.agent.name}</p>
            <p className="text-ink-soft">{page.agent.address}</p>
            <p className="text-ink-soft">{page.agent.email}{page.agent.phone ? ` · ${page.agent.phone}` : ''}</p>
            <p className="font-mono-tech text-[10px] text-ink-faint">{page.copyrightOfficeNote}</p>
            <p className="pt-2 text-ink-soft">{page.policy}</p>
            <p className="font-mono-tech text-[10px] text-ink-faint">
              Counter-notice wait: {page.counterWaitDays} business days. Repeat-infringer threshold: {page.repeatInfringerThreshold} upheld strikes.
            </p>
          </div>
        )}

        {notice ? (
          <div className="mt-10 space-y-4">
            <p className="text-sm text-ink-soft">
              Notice {notice.id.slice(-8)} · {notice.status.replaceAll('_', ' ')}. Photograph: {notice.photoTitle ?? 'named in the notice'}.
            </p>
            {notice.counter ? (
              <p className="text-sm text-ink-soft">
                A counter-notice is stored. Restore happens only after the statutory wait <em>and</em> a staff action. This is not automatic.
              </p>
            ) : (
              <form
                className="space-y-3 rounded-2xl border border-sand-soft bg-white p-5"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  try {
                    const data = await api.fileDmcaCounter(notice.id, {
                      senderName: counter.senderName,
                      senderEmail: counter.senderEmail,
                      senderAddress: counter.senderAddress,
                      statement: counter.statement,
                      consentToJurisdiction: true,
                      perjury: true,
                      signature: counter.signature,
                    })
                    setNotice(data.notice)
                    toast.success('Counter-notice stored')
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not store the counter-notice')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <p className="font-serif-display text-2xl font-light">Counter-notice</p>
                <p className="text-sm text-ink-soft">
                  Stored only. Staff restore licensing after the wait. Do not treat this as a re-trial of the claim.
                </p>
                <input required value={counter.senderName} onChange={(e) => setCounter((c) => ({ ...c, senderName: e.target.value }))} placeholder="Your name" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
                <input required type="email" value={counter.senderEmail} onChange={(e) => setCounter((c) => ({ ...c, senderEmail: e.target.value }))} placeholder="Email" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
                <textarea required minLength={8} value={counter.senderAddress} onChange={(e) => setCounter((c) => ({ ...c, senderAddress: e.target.value }))} placeholder="Address" rows={2} className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
                <textarea required minLength={20} value={counter.statement} onChange={(e) => setCounter((c) => ({ ...c, statement: e.target.value }))} placeholder="Why the material was misidentified" rows={4} className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" required checked={counter.consentToJurisdiction} onChange={(e) => setCounter((c) => ({ ...c, consentToJurisdiction: e.target.checked }))} className="mt-0.5 accent-[#bc773f]" />
                  I consent to the jurisdiction of the U.S. federal district court for the district where my address is located.
                </label>
                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" required checked={counter.perjury} onChange={(e) => setCounter((c) => ({ ...c, perjury: e.target.checked }))} className="mt-0.5 accent-[#bc773f]" />
                  I attest under penalty of perjury that the takedown was a mistake or misidentification.
                </label>
                <input required value={counter.signature} onChange={(e) => setCounter((c) => ({ ...c, signature: e.target.value }))} placeholder="Typed signature" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
                <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
                  Store counter-notice
                </button>
              </form>
            )}
          </div>
        ) : (
          <form
            className="mt-10 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                const payload: CreateDmcaNoticeInput = {
                  photoId: form.photoId || undefined,
                  photoUrl: form.photoUrl || undefined,
                  claimantName: form.claimantName,
                  claimantEmail: form.claimantEmail,
                  claimantAddress: form.claimantAddress,
                  claimantPhone: form.claimantPhone || undefined,
                  workDescription: form.workDescription,
                  originalLocation: form.originalLocation,
                  infringingLocation: form.infringingLocation || form.photoUrl || `/photo/${form.photoId}`,
                  goodFaith: true,
                  perjury: true,
                  signature: form.signature,
                }
                const data = await api.fileDmcaNotice(payload)
                setNotice(data.notice)
                toast.success('Notice filed. Staff will read it.')
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not file the notice')
              } finally {
                setBusy(false)
              }
            }}
          >
            <input value={form.photoId} onChange={(e) => setForm((f) => ({ ...f, photoId: e.target.value }))} placeholder="Photograph id (for example afr-017)" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <input value={form.photoUrl} onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))} placeholder="Or photograph URL" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <input required value={form.claimantName} onChange={(e) => setForm((f) => ({ ...f, claimantName: e.target.value }))} placeholder="Your name" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <input required type="email" value={form.claimantEmail} onChange={(e) => setForm((f) => ({ ...f, claimantEmail: e.target.value }))} placeholder="Email" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <textarea required minLength={8} value={form.claimantAddress} onChange={(e) => setForm((f) => ({ ...f, claimantAddress: e.target.value }))} placeholder="Postal address" rows={2} className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <input value={form.claimantPhone} onChange={(e) => setForm((f) => ({ ...f, claimantPhone: e.target.value }))} placeholder="Phone (optional)" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <textarea required minLength={20} value={form.workDescription} onChange={(e) => setForm((f) => ({ ...f, workDescription: e.target.value }))} placeholder="Describe the copyrighted work" rows={3} className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <input required value={form.originalLocation} onChange={(e) => setForm((f) => ({ ...f, originalLocation: e.target.value }))} placeholder="Where the original work lives" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <input value={form.infringingLocation} onChange={(e) => setForm((f) => ({ ...f, infringingLocation: e.target.value }))} placeholder="Location of the material on VueKumi" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" required checked={form.goodFaith} onChange={(e) => setForm((f) => ({ ...f, goodFaith: e.target.checked }))} className="mt-0.5 accent-[#bc773f]" />
              I have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law.
            </label>
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" required checked={form.perjury} onChange={(e) => setForm((f) => ({ ...f, perjury: e.target.checked }))} className="mt-0.5 accent-[#bc773f]" />
              The information is accurate, and I am authorized to act, under penalty of perjury.
            </label>
            <input required value={form.signature} onChange={(e) => setForm((f) => ({ ...f, signature: e.target.value }))} placeholder="Typed signature" className="w-full rounded-2xl border border-sand-soft px-4 py-3 text-sm outline-none focus:border-terra" />
            <p className="font-mono-tech text-[10px] text-ink-faint">A typed name is not identity verification.</p>
            <button disabled={busy} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
              File copyright notice
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
