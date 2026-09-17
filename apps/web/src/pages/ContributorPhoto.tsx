import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PHOTO_CATEGORIES, SCREENING_KIND_LABEL, creatorPortalLabel, isCommunityContributor, type PermissionState, type PhotoDto, type UpdatePhotoInput } from '@vuekumi/shared'
import { PortalShell, StatusPill } from '../components/shared'
import { PermissionStateField } from '../components/PermissionStateField'
import { api, ApiError, type GeoCountry } from '../api/client'
import { money } from '../lib/format'
import { contributorPortalLinks } from './Contributor'
import { AiSuggestPanel } from '../components/AiSuggestPanel'
import { PeopleIdentifier } from '../components/PeopleIdentifier'
import { useAuth } from '../context/AuthContext'

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const community = isCommunityContributor(user?.accountType)
  return (
    <PortalShell
      title={`${creatorPortalLabel(user?.accountType)} portal`}
      subtitle={community
        ? 'Portfolio and editorial sharing. Commercial stock is reserved for professional photographers.'
        : 'Upload, rights, and 50% of every paid licence.'}
      links={contributorPortalLinks(user?.hasModelProfile)}
    >
      {children}
    </PortalShell>
  )
}

export function ContributorPhotoEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const community = isCommunityContributor(user?.accountType)
  const [photo, setPhoto] = useState<PhotoDto | null>(null)
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Landscape')
  const [country, setCountry] = useState('')
  const [tags, setTags] = useState('')
  const [licenseType, setLicenseType] = useState<'free' | 'premium'>('free')
  const [price, setPrice] = useState('12')
  const [people, setPeople] = useState(false)
  const [permissionState, setPermissionState] = useState<PermissionState>('commercial')
  const [restrictionNotes, setRestrictionNotes] = useState('')
  const [copyrightHolder, setCopyrightHolder] = useState('')
  const [releaseName, setReleaseName] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (row: PhotoDto) => {
    setPhoto(row)
    setTitle(row.title)
    setDescription(row.description ?? '')
    setCategory(row.category)
    setCountry(row.country)
    setTags(row.tags.join(', '))
    setLicenseType(row.license)
    setPrice(String(row.price > 0 ? row.price : 12))
    setPeople(Boolean(row.hasRecognizablePeople || row.rights?.modelReleaseRequired))
    setPermissionState(row.permissionState ?? (row.exclusiveAvailable ? 'exclusive' : 'commercial'))
    setRestrictionNotes(row.restrictionNotes ?? '')
    setCopyrightHolder(row.rights?.copyrightHolder ?? '')
  }

  useEffect(() => {
    if (!id) return
    api.contributorPhoto(id)
      .then((d) => load(d.photo))
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load photograph')
        navigate('/contributor/portfolio')
      })
    api.countries(true).then((d) => setCountries(d.countries)).catch(() => setCountries([]))
  }, [id, navigate])

  if (!photo || !id) {
    return (
      <Shell>
        <p className="text-sm text-ink-soft">Loading photograph…</p>
      </Shell>
    )
  }

  const sold = Boolean(photo.exclusiveSold)
  const peopleLocked = Boolean(photo.hasRecognizablePeople || photo.rights?.modelReleaseRequired)
  const canUnpublish = !sold && (photo.status === 'active' || photo.status === 'pending')
  const canResubmit = !sold && (photo.status === 'delisted' || photo.status === 'rejected' || photo.status === 'draft')

  const body = (): UpdatePhotoInput => ({
    title,
    description,
    category,
    country,
    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    licenseType,
    price: licenseType === 'premium' ? Number(price) || 12 : 0,
    exclusiveAvailable: permissionState === 'exclusive',
    permissionState,
    restrictionNotes: permissionState === 'restricted' ? restrictionNotes : restrictionNotes || null,
    copyrightHolder: copyrightHolder || undefined,
    hasRecognizablePeople: people || undefined,
    modelReleaseFileName: people && releaseName ? releaseName : undefined,
    modelReleaseNotes: people && releaseNotes ? releaseNotes : undefined,
  })

  const save = async (extra?: UpdatePhotoInput) => {
    setBusy(true)
    try {
      const { photo: next } = await api.updatePhoto(id, { ...body(), ...extra })
      load(next)
      toast.success(extra?.status === 'delisted' ? 'Unpublished from the catalog' : extra?.status === 'pending' ? 'Resubmitted for review' : 'Saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Edit photograph</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl font-light tracking-tight">{photo.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            You keep copyright. Vuekumi licenses usage. Live listings still need moderation and required rights.
          </p>
        </div>
        <Link to="/contributor/portfolio" className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra hover:text-ink">
          ← Portfolio
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form
          className="space-y-4 rounded-2xl border border-sand-soft bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <img src={photo.thumbSrc ?? photo.src} alt="" className="h-48 w-full rounded-xl object-cover" />
          <div className="flex flex-wrap gap-2">
            <StatusPill status={photo.status} />
            <StatusPill status={photo.permissionState ?? 'commercial'} />
            <StatusPill status={photo.license} />
            <StatusPill
              status={
                !photo.hasRecognizablePeople
                  ? 'not_required'
                  : photo.rights?.twoPartyCleared
                    ? 'cleared'
                    : 'waiting'
              }
            />
          </div>
          {photo.rights?.screeningKind && (
            <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink-soft">
              AI person detection: <strong>{SCREENING_KIND_LABEL[photo.rights.screeningKind]}</strong>
              {photo.rights.possibleMinor ? ' · Possible minor — additional verification required' : ''}
              . Screening does not decide whether consent exists, and does not identify anyone.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-sand-soft bg-white px-4 py-2.5 text-sm outline-none focus:border-terra">
              {!PHOTO_CATEGORIES.includes(category as (typeof PHOTO_CATEGORIES)[number]) && (
                <option>{category}</option>
              )}
              {PHOTO_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              required
              list="photo-countries"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country depicted"
              className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
            />
            <datalist id="photo-countries">
              {countries.map((c) => (
                <option key={c.code} value={c.name} />
              ))}
            </datalist>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra sm:col-span-2" />
          </div>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description — what's the story of this image?"
            className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input
            value={copyrightHolder}
            onChange={(e) => setCopyrightHolder(e.target.value)}
            placeholder="Copyright holder (your name or studio)"
            className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <fieldset className="grid gap-2 sm:grid-cols-2">
            {[
              { v: 'free' as const, t: 'Free collection', d: 'Royalty-free grant at $0' },
              { v: 'premium' as const, t: 'Premium collection', d: `Commercial licence, 50% to you` },
            ].map((o) => (
              <label key={o.v} className="flex cursor-pointer gap-3 rounded-xl border border-sand-soft p-4 transition-colors has-[:checked]:border-terra has-[:checked]:bg-terra/5">
                <input type="radio" name="license" checked={licenseType === o.v} onChange={() => setLicenseType(o.v)} className="mt-1 accent-[#bc773f]" />
                <span>
                  <span className="block text-sm font-medium">{o.t}</span>
                  <span className="mt-0.5 block font-mono-tech text-[10px] text-ink-faint">{o.d}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {licenseType === 'premium' && (
            <label className="block text-sm text-ink-soft">
              Suggested USD price
              <input
                type="number"
                min={1}
                max={10000}
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
            </label>
          )}
          <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={people}
              disabled={peopleLocked}
              onChange={(e) => setPeople(e.target.checked)}
              className="mt-0.5 accent-[#bc773f]"
            />
            This photograph shows a recognisable person. Commercial licences need their approval — a PDF is not enough.
          </label>
          {peopleLocked && (
            <p className="font-mono-tech text-[10px] text-ink-faint">
              Clearing a people flag is an admin action. Invite the depicted person below — a PDF filename is supporting evidence only.
            </p>
          )}
          {people && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={releaseName} onChange={(e) => setReleaseName(e.target.value)} placeholder="Model release file name" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
              <input value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="Release notes" className="rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra" />
            </div>
          )}
          {people && <PeopleIdentifier photo={photo} onChange={load} />}
          <PermissionStateField
            value={permissionState}
            onChange={setPermissionState}
            notes={restrictionNotes}
            onNotes={setRestrictionNotes}
            actor={community ? 'community' : 'contributor'}
            disabled={sold}
          />
          {sold && (
            <p className="font-mono-tech text-[10px] text-[#b3382e]">An exclusive licence has already been sold. The listing stays exclusive and delisted from further sale.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={busy} className="rounded-full bg-ink px-8 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-terra disabled:opacity-50">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <Link to={`/photo/${photo.id}`} className="rounded-full border border-sand px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:border-ink hover:text-ink">
              View public page
            </Link>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl bg-cream p-6">
            <h3 className="font-serif-display text-lg font-light">Listing</h3>
            <p className="mt-2 text-sm text-ink-soft">
              {photo.status === 'active'
                ? permissionState === 'private'
                  ? 'Approved but private. Only you and staff can see it.'
                  : permissionState === 'portfolio'
                    ? 'On your profile. Not offered as stock until you change the permission state.'
                    : 'Live in the catalog according to its permission state. Unpublish to hide the file from buyers without deleting it.'
                : photo.status === 'pending'
                  ? 'Waiting on moderation. You can still edit metadata or withdraw it.'
                  : photo.status === 'delisted'
                    ? 'Not for sale. Resubmit to send it back to the review queue.'
                    : 'Not live. Edit and resubmit after a rejection.'}
            </p>
            {(photo.commercialLocked || photo.rights?.commercialLocked) && (
              <p className="mt-3 text-sm text-[#b3382e]">
                Staff paused new licensing on this photograph after a rights report. It stays visible until you unpublish it or they restore licensing.
              </p>
            )}
            <p className="mt-3 font-mono-tech text-[10px] text-ink-faint">
              {photo.downloads} downloads · {money(photo.price)} list
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {canUnpublish && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ status: 'delisted' })}
                  className="rounded-full border border-sand px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-[#b3382e] hover:border-[#b3382e]"
                >
                  Unpublish
                </button>
              )}
              {canResubmit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ status: 'pending' })}
                  className="rounded-full bg-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra"
                >
                  Resubmit for review
                </button>
              )}
            </div>
          </div>
          <AiSuggestPanel
            photoId={photo.id}
            onApplied={(next) => load(next)}
          />
        </aside>
      </div>
    </Shell>
  )
}
