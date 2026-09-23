import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { PhotoDto } from '@vuekumi/shared'
import { CREATION_CLAIM_LABEL, COPYRIGHT_STATUS_LABEL } from '@vuekumi/shared'
import { PortalShell, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { modelPortalLinks } from './Model'

export function ModelPhotoEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [photo, setPhoto] = useState<PhotoDto | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [busy, setBusy] = useState(false)
  const [personName, setPersonName] = useState('')
  const [personEmail, setPersonEmail] = useState('')
  const [personMobile, setPersonMobile] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    api.modelPhoto(id)
      .then((d) => setPhoto(d.photo))
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load photograph')
        navigate('/model')
      })
  }, [id, navigate])

  if (!photo || !id) {
    return (
      <PortalShell title="Model portal" subtitle="Rights on photographs you uploaded." links={modelPortalLinks()}>
        <p className="text-sm text-ink-soft">Loading photograph…</p>
      </PortalShell>
    )
  }

  const authz = photo.copyrightAuthorizations?.[0]

  return (
    <PortalShell
      title="Model portal"
      subtitle="Not the photographer commercial editor. Display is not commercial licensing."
      links={modelPortalLinks(Boolean(user && user.accountType !== 'model' && user.hasModelProfile))}
    >
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Your upload</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif-display text-4xl font-light tracking-tight">{photo.title}</h1>
        <Link to="/model" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">← Portal</Link>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4 rounded-2xl border border-sand-soft bg-white p-6">
          <img src={photo.thumbSrc ?? photo.src} alt="" className="h-48 w-full rounded-xl object-cover" />
          <div className="flex flex-wrap gap-2">
            <StatusPill status={photo.status} />
            <StatusPill status={photo.permissionState ?? 'portfolio'} />
            {photo.rights?.creationClaim && <StatusPill status={photo.rights.creationClaim} />}
            {photo.rights?.copyrightStatus && <StatusPill status={photo.rights.copyrightStatus} />}
          </div>
          <p className="text-sm text-ink-soft">
            Creation claim: {photo.rights?.creationClaim ? CREATION_CLAIM_LABEL[photo.rights.creationClaim] : '—'}.
            Copyright: {photo.rights?.copyrightStatus ? COPYRIGHT_STATUS_LABEL[photo.rights.copyrightStatus] : '—'}.
            Commercial eligible: {photo.rights?.commercialEligible ? 'yes' : 'no'}.
          </p>
          {authz && (
            <p className="text-sm text-ink-soft">
              Photographer contact: {authz.displayName} · {authz.status}
              {authz.commercialSublicensing ? ' · commercial sublicensing granted' : ' · display only or pending'}
            </p>
          )}
          {photo.hasRecognizablePeople && (
            <form
              className="space-y-3 rounded-xl border border-sand-soft p-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                try {
                  await api.identifyModelAppearance(id, {
                    displayName: personName,
                    email: personEmail,
                    mobile: personMobile,
                  })
                  toast.success('VueKumi will contact them for likeness authorization')
                  setPersonName('')
                  setPersonEmail('')
                  setPersonMobile('')
                  const next = await api.modelPhoto(id)
                  setPhoto(next.photo)
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Could not send likeness request')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Likeness authorization</p>
              <p className="text-sm text-ink-soft">
                {photo.rights?.screeningKind === 'uncertain_human_detection'
                  ? 'Person detection did not finish, so this photograph cannot be cleared from the upload alone. '
                  : 'A person appears in this photograph. '}
                Add anyone else who is recognizable. VueKumi contacts them for likeness authorization. That is not copyright, and models do not earn from licences.
              </p>
              {(photo.appearances ?? []).length > 0 && (
                <ul className="space-y-1 text-sm text-ink-soft">
                  {(photo.appearances ?? []).map((row) => (
                    <li key={row.id}>{row.displayName} · {row.consentStatus ?? row.status}</li>
                  ))}
                </ul>
              )}
              <input required value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Person's name" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm" />
              <input required type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm" />
              <input required value={personMobile} onChange={(e) => setPersonMobile(e.target.value)} placeholder="Mobile" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm" />
              <button disabled={busy} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper disabled:opacity-50">
                Send likeness request
              </button>
            </form>
          )}
          {photo.rights?.thirdPartyCopyright && !authz && (
            <form
              className="space-y-3 rounded-xl bg-cream p-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                try {
                  const result = await api.identifyCopyrightHolder(id, { displayName: name, email, mobile })
                  toast.success('VueKumi will contact the photographer')
                  setPhoto((cur) => cur
                    ? { ...cur, copyrightAuthorizations: [result.authorization, ...(cur.copyrightAuthorizations ?? [])] }
                    : cur)
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Could not send notice')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <p className="text-sm font-medium">Contact the photographer</p>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm" />
              <input required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile" className="w-full rounded-xl border border-sand-soft px-3 py-2 text-sm" />
              <button disabled={busy} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper disabled:opacity-50">Send rights-clearance notice</button>
            </form>
          )}
          {photo.hasRecognizablePeople && photo.rights?.modelConsentStatus !== 'approved' && (
            <div className="space-y-3 rounded-xl bg-cream p-4">
              <p className="text-sm font-medium">Likeness clearance on hold</p>
              <p className="text-sm text-ink-soft">
                Vuekumi's automated review couldn't confirm this photograph shows only you. Your own consent
                doesn't cover anyone else who may appear. Commercial licensing stays on hold until this is
                resolved.
              </p>
              {(photo.appearances ?? []).filter((a) => !a.selfShot).map((a) => (
                <p key={a.id} className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {a.displayName} · {a.consentStatus}
                </p>
              ))}
              <button
                disabled={confirmBusy}
                onClick={async () => {
                  setConfirmBusy(true)
                  try {
                    const result = await api.confirmModelPhotoSelfOnly(id)
                    setPhoto(result.photo)
                    toast.success('Confirmed — only you are in this photograph')
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not confirm')
                  } finally {
                    setConfirmBusy(false)
                  }
                }}
                className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper disabled:opacity-50"
              >
                It's only me in this photo
              </button>
              <p className="text-sm text-ink-soft">
                If someone else is in this photo, use the likeness authorization form above to invite them.
              </p>
            </div>
          )}
        </div>
        <aside className="h-fit rounded-2xl bg-cream p-6 text-sm text-ink-soft">
          <p>A declaration never unlocks commercial licensing when another person may own the copyright. Documents stay documented, never verified, until the photographer confirms on the rights page.</p>
        </aside>
      </div>
    </PortalShell>
  )
}
