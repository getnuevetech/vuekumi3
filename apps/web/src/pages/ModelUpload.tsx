import { useEffect, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CREATION_CLAIM_LABEL, PHOTO_CATEGORIES, type CreationClaim } from '@vuekumi/shared'
import { CountrySelect, PortalShell, countryNameFromSuggestion } from '../components/shared'
import { api, ApiError, type GeoCountry } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { modelPortalLinks } from './Model'

const CLAIMS: { id: CreationClaim; note: string }[] = [
  { id: 'self_created', note: 'I took this photograph myself' },
  { id: 'photographer_took', note: 'A photographer took it' },
  { id: 'assigned', note: 'A photographer took it and transferred copyright to me' },
  { id: 'licensed', note: 'A photographer took it and licensed it to me' },
  { id: 'unknown', note: "I don't know who took it" },
]

export function ModelUpload() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Model')
  const [country, setCountry] = useState(user?.country ?? '')
  const [tags, setTags] = useState('')
  const [copyrightHolder, setCopyrightHolder] = useState(user?.name ?? '')
  const [claim, setClaim] = useState<CreationClaim>('photographer_took')
  const [inPhoto, setInPhoto] = useState(true)
  const [ownLikeness, setOwnLikeness] = useState(false)
  const [ownUsage, setOwnUsage] = useState<'editorial' | 'commercial'>('editorial')
  const [photographerName, setPhotographerName] = useState('')
  const [photographerEmail, setPhotographerEmail] = useState('')
  const [photographerMobile, setPhotographerMobile] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [attested, setAttested] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [africa, setAfrica] = useState('')
  const [acceptPhotographer, setAcceptPhotographer] = useState(false)
  const [countries, setCountries] = useState<GeoCountry[]>([])

  const needsPhotographer = claim === 'photographer_took' || claim === 'assigned' || claim === 'licensed'
  const dualRole = Boolean(user?.hasPhotographerAgreement)

  useEffect(() => {
    api.countries().then((d) => {
      setCountries(d.countries)
      setCountry((prev) => (prev ? countryNameFromSuggestion(prev, d.countries) ?? '' : prev))
    }).catch(() => setCountries([]))
  }, [])

  return (
    <PortalShell
      title="Model portal"
      subtitle="Upload photographs you appear in. VueKumi contacts the photographer when you did not take the picture."
      links={modelPortalLinks(Boolean(user && user.accountType !== 'model' && user.hasModelProfile))}
    >
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Upload</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Model upload.</h1>
      <p className="mt-1 text-sm text-ink-soft">
        This is not the photographer commercial editor. Permission defaults to portfolio. Commercial licensing waits until both rights tracks are VueKumi-verified.
        Models do not earn from likeness.
      </p>

      {claim === 'self_created' && !dualRole && (
        <div className="mt-6 rounded-2xl border border-sand-soft bg-cream p-5">
          <p className="text-sm text-ink-soft">
            Self-shot commercial stock requires the photographer licensing agreement and an African Union country on this same email. Your account type stays model.
          </p>
          <select
            value={africa}
            onChange={(e) => setAfrica(e.target.value)}
            className="mt-3 w-full rounded-xl border border-sand-soft bg-white px-4 py-2.5 text-sm"
          >
            <option value="">African country (required for commercial)</option>
            {countries.filter((c) => c.contributorEligible).map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={acceptPhotographer} onChange={(e) => setAcceptPhotographer(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            I accept the VueKumi photographer licensing agreement on this email.
          </label>
          <button
            type="button"
            disabled={busy || !africa || !acceptPhotographer}
            onClick={async () => {
              setBusy(true)
              try {
                const { user: next } = await api.acceptPhotographerAgreement({ country: africa, acceptAgreement: true })
                await refresh()
                toast.success(`Photographer agreement accepted. Account type stays ${next.accountType}.`)
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not accept photographer agreement')
              } finally {
                setBusy(false)
              }
            }}
            className="mt-3 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
          >
            Accept photographer agreement
          </button>
        </div>
      )}

      <form
        className="mt-8 space-y-4 rounded-2xl border border-sand-soft bg-white p-6"
        onDragOver={(e: DragEvent) => e.preventDefault()}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')))
        }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!files.length) {
            toast.error('Choose an image')
            return
          }
          setBusy(true)
          try {
            const file = files[0]
            setProgress('Uploading')
            const signed = await api.presignModelUpload(file.name, file.type || 'image/jpeg')
            await api.putUpload(signed.uploadUrl, file, signed.headers)
            setProgress('Submitting')
            const submitted = await api.submitModelPhoto({
              title: title || file.name.replace(/\.[^.]+$/, ''),
              description: description || undefined,
              category,
              country: country || 'Unknown',
              tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
              hasRecognizablePeople: inPhoto,
              copyrightHolder,
              copyrightAttested: true,
              creationClaim: claim,
              inPhotograph: inPhoto,
              ownLikenessConfirmed: inPhoto ? ownLikeness : undefined,
              ownUsage: inPhoto ? ownUsage : undefined,
              photographerName: needsPhotographer ? photographerName : undefined,
              photographerEmail: needsPhotographer ? photographerEmail : undefined,
              photographerMobile: needsPhotographer ? photographerMobile : undefined,
              assignmentDocumentName: claim === 'assigned' || claim === 'licensed' ? (documentName || undefined) : undefined,
              originalKey: signed.key,
            })
            const detected = Boolean(submitted.photo.hasRecognizablePeople)
            const undeclared = detected && !inPhoto
            if (undeclared) {
              toast.warning(
                "Vuekumi's automated review detected a person you did not mark. Add their contact details — likeness authorization is required, and models do not earn from licences.",
                { duration: 10000 },
              )
            } else if (submitted.photo.rights?.screeningKind === 'uncertain_human_detection') {
              toast.warning(
                'Person detection did not finish. This photograph stays locked until everyone who appears is identified. Models do not earn from licences.',
                { duration: 10000 },
              )
            } else {
              toast.success('Submitted for review')
            }
            navigate(`/model/photos/${submitted.photo.id}`)
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Submit failed')
          } finally {
            setBusy(false)
            setProgress('')
          }
        }}
      >
        <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-sand-soft px-4 py-8 text-sm text-ink-soft">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length ? files[0].name : 'Drop an image or click to choose'}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-sand-soft bg-white px-4 py-2.5 text-sm">
            {PHOTO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <CountrySelect
            by="name"
            countries={countries}
            value={country}
            onChange={setCountry}
            placeholder="Country depicted"
            className="rounded-xl border border-sand-soft bg-white px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
        </div>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
        <input required value={copyrightHolder} onChange={(e) => setCopyrightHolder(e.target.value)} placeholder="Named copyright holder" className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Who took this photograph?</legend>
          {CLAIMS.map((c) => (
            <label key={c.id} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft p-3 text-sm has-[:checked]:border-terra">
              <input type="radio" name="claim" checked={claim === c.id} onChange={() => setClaim(c.id)} />
              <span>
                <span className="block font-medium">{c.note}</span>
                <span className="font-mono-tech text-[10px] text-ink-faint">{CREATION_CLAIM_LABEL[c.id]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {needsPhotographer && (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">
              Only provide this contact for rights clearance. VueKumi will name you as the supplier. This is not a marketing list.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
            <input required value={photographerName} onChange={(e) => setPhotographerName(e.target.value)} placeholder="Photographer name" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            <input required type="email" value={photographerEmail} onChange={(e) => setPhotographerEmail(e.target.value)} placeholder="Photographer email" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            <input required value={photographerMobile} onChange={(e) => setPhotographerMobile(e.target.value)} placeholder="Photographer mobile" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            </div>
          </div>
        )}
        {(claim === 'assigned' || claim === 'licensed') && (
          <input value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Supporting document file name (optional — stays documented, never verified)" className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
        )}

        <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
          <input type="checkbox" checked={inPhoto} onChange={(e) => setInPhoto(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
          I appear in this photograph.
        </label>
        {inPhoto && (
          <>
            <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
              <input type="checkbox" checked={ownLikeness} onChange={(e) => setOwnLikeness(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
              I confirm this is my likeness.
            </label>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              {([
                { v: 'editorial' as const, t: 'Editorial / display' },
                { v: 'commercial' as const, t: 'Commercial (still needs copyright verified)' },
              ]).map((o) => (
                <label key={o.v} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft p-3 text-sm has-[:checked]:border-terra">
                  <input type="radio" checked={ownUsage === o.v} onChange={() => setOwnUsage(o.v)} />
                  {o.t}
                </label>
              ))}
            </fieldset>
          </>
        )}

        <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
          <input type="checkbox" required checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
          I confirm I have the right to upload this image for the usage I selected. A claim is not verification. VueKumi may contact the named photographer for rights clearance only.
        </label>
        <button disabled={busy} className="rounded-full bg-ink px-8 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50">
          {busy ? (progress || 'Submitting…') : 'Submit for review'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-soft">
        <Link to="/model" className="text-terra">← Appearances</Link>
      </p>
    </PortalShell>
  )
}
