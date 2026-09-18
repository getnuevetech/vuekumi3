import { useState } from 'react'
import { toast } from 'sonner'
import {
  MODEL_APPEARANCE_LABEL,
  MODEL_CONSENT_STATUS_LABEL,
  MODEL_USAGE_LABEL,
  AI_TRAINING_OPT_IN_COPY,
  type ModelConsentStatus,
  type ModelUsagePreference,
  type PhotoAppearanceDto,
  type PhotoDto,
  isCreatorWorkspaceAccount,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { StatusPill } from './shared'

export function PeopleIdentifier({
  photo,
  onChange,
}: {
  photo: PhotoDto
  onChange: (next: PhotoDto) => void
}) {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [busy, setBusy] = useState(false)
  const [route, setRoute] = useState<'invite' | 'release'>('invite')
  const [releaseFile, setReleaseFile] = useState('')
  const [attested, setAttested] = useState(false)
  const [isMinor, setIsMinor] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianMobile, setGuardianMobile] = useState('')
  const [shootTitle, setShootTitle] = useState('')
  const people = photo.appearances ?? []
  const outstanding = photo.rights?.outstandingConsents ?? people.filter((row) => row.consentStatus !== 'approved' && row.consentStatus !== 'not_required').length
  const alreadySelf = people.some(
    (row) => row.selfShot || (user && row.inviteEmail && row.inviteEmail.toLowerCase() === user.email.toLowerCase()),
  )

  const reload = async () => {
    const { photo: next } = await api.contributorPhoto(photo.id)
    onChange(next)
  }

  return (
    <div className="rounded-xl border border-sand-soft p-4">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Likeness / model release rights</p>
      <p className="mt-1 text-sm text-ink-soft">
        Photo copyright stays with the photographer. A depicted person grants consent to use their likeness — not copyright in the photograph.
        VueKumi contacts the model; their phone and email stay private. AI person detection is screening only. It does not decide whether consent exists.
        {photo.rights?.possibleMinor ? ' Possible minor — additional verification required. Do not rely on a child’s consent alone.' : ''}
      </p>
      {outstanding > 0 && (
        <p className="mt-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#b3382e]">
          LOCKED — {outstanding} required consent{outstanding === 1 ? '' : 's'} outstanding
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {people.length === 0 && (
          <li className="text-sm text-ink-soft">No one identified yet.</li>
        )}
        {people.map((row) => (
          <AppearanceRow key={row.id} photoId={photo.id} row={row} onChanged={() => void reload()} />
        ))}
      </ul>
      {!alreadySelf && user && isCreatorWorkspaceAccount(user.accountType) && (
        <SelfShotForm photoId={photo.id} defaultName={user.name} onDone={() => void reload()} />
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setRoute('invite')} className={`rounded-full px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] ${route === 'invite' ? 'bg-ink text-paper' : 'border border-sand'}`}>
          VueKumi contacts model
        </button>
        <button type="button" onClick={() => setRoute('release')} className={`rounded-full px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] ${route === 'release' ? 'bg-ink text-paper' : 'border border-sand'}`}>
          Upload signed release
        </button>
      </div>
      {route === 'invite' ? (
      <>
      <p className="mt-3 text-sm text-ink-soft">
        Only provide this contact for rights clearance. VueKumi will name you as the supplier. This is not a marketing list.
      </p>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api.identifyAppearance(photo.id, {
              displayName,
              email,
              mobile,
              ageClass: isMinor ? 'minor' : photo.rights?.possibleMinor ? 'unknown' : 'adult',
              isMinor,
              guardianName: isMinor ? guardianName : undefined,
              guardianEmail: isMinor ? guardianEmail : undefined,
              guardianMobile: isMinor ? guardianMobile : undefined,
              shootTitle: shootTitle || undefined,
            })
            setDisplayName('')
            setEmail('')
            setMobile('')
            setGuardianName('')
            setGuardianEmail('')
            setGuardianMobile('')
            setIsMinor(false)
            await reload()
            toast.success('VueKumi will contact the model')
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not invite')
          } finally {
            setBusy(false)
          }
        }}
      >
        <input
          required
          minLength={2}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name as you know them"
          className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email to invite"
          className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <input
          required
          type="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="Mobile (private)"
          className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          {busy ? 'Inviting…' : 'Contact model'}
        </button>
        <input
          value={shootTitle}
          onChange={(e) => setShootTitle(e.target.value)}
          placeholder="Shoot title (optional, e.g. Lagos Fashion Shoot)"
          className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra sm:col-span-3"
        />
        <label className="flex items-start gap-2 text-sm text-ink-soft sm:col-span-4">
          <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
          This person is a minor. VueKumi needs parent or legal-guardian authorization — not the child’s consent alone.
        </label>
        {isMinor && (
          <div className="grid gap-2 sm:col-span-4 sm:grid-cols-3">
            <input required minLength={2} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian full name" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
            <input required type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="Guardian email" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
            <input required type="tel" value={guardianMobile} onChange={(e) => setGuardianMobile(e.target.value)} placeholder="Guardian mobile" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
          </div>
        )}
      </form>
      </>
      ) : (
        <form
          className="mt-4 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!attested) {
              toast.error('Attest that the release is genuine and applies to this image')
              return
            }
            setBusy(true)
            try {
              await api.uploadSignedRelease(photo.id, {
                displayName,
                modelIdentity: displayName,
                fileName: releaseFile,
                attestedGenuine: true,
                applicableToThisImage: true,
                email: email || undefined,
                mobile: mobile || undefined,
                confirmWithModel: Boolean(email),
              })
              setDisplayName('')
              setEmail('')
              setMobile('')
              setReleaseFile('')
              setAttested(false)
              await reload()
              toast.success('Photographer-provided release stored. Not VueKumi-verified until the model confirms.')
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not store release')
            } finally {
              setBusy(false)
            }
          }}
        >
          <p className="text-sm text-ink-soft">A PDF is photographer-provided evidence, not permanently verified consent.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input required minLength={2} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Model identity / full name" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
            <input required value={releaseFile} onChange={(e) => setReleaseFile(e.target.value)} placeholder="Signed release file name" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email to confirm (optional)" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile (private, optional)" className="rounded-xl border border-sand-soft px-3 py-2 text-sm outline-none focus:border-terra" />
          </div>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 accent-[#bc773f]" />
            I attest this signed release is genuine and applies to this photograph or shoot.
          </label>
          <button type="submit" disabled={busy} className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
            {busy ? 'Saving…' : 'Store photographer-provided release'}
          </button>
        </form>
      )}
    </div>
  )
}

function SelfShotForm({
  photoId,
  defaultName,
  onDone,
}: {
  photoId: string
  defaultName: string
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(defaultName)
  const [likeness, setLikeness] = useState(false)
  const [usage, setUsage] = useState<ModelUsagePreference>('commercial')
  const [aiTraining, setAiTraining] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (status: 'approved' | 'rejected') => {
    setBusy(true)
    try {
      await api.selfShotAppearance(photoId, {
        displayName,
        confirmedLikeness: likeness,
        status,
        usage: status === 'approved' ? usage : 'none',
        aiTraining: status === 'approved' ? aiTraining : false,
      })
      toast.success(status === 'approved' ? 'You approved your likeness' : 'You rejected usage of your likeness')
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] hover:bg-ink hover:text-paper"
      >
        I am in this photograph
      </button>
    )
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-cream p-4">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-terra">Self-shot</p>
      <p className="text-sm text-ink-soft">
        Confirm this is your likeness, then choose usage. A checkbox is not consent. You keep this photographer account — models do not earn.
      </p>
      <input
        required
        minLength={2}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Name as you appear"
        className="w-full rounded-xl border border-sand-soft bg-white px-3 py-2 text-sm outline-none focus:border-terra"
      />
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={likeness}
          onChange={(e) => setLikeness(e.target.checked)}
          className="mt-0.5 accent-[#bc773f]"
        />
        I confirm this is my likeness
      </label>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        {([
          { v: 'editorial' as const, t: 'Editorial only' },
          { v: 'commercial' as const, t: 'Editorial and commercial' },
        ]).map((o) => (
          <label key={o.v} className="flex cursor-pointer gap-2 rounded-xl border border-sand-soft bg-white p-3 text-sm has-[:checked]:border-terra">
            <input
              type="radio"
              name="self-shot-usage"
              checked={usage === o.v}
              onChange={() => setUsage(o.v)}
            />
            {o.t}
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={aiTraining}
          onChange={(e) => setAiTraining(e.target.checked)}
          className="mt-0.5 accent-[#bc773f]"
        />
        {AI_TRAINING_OPT_IN_COPY}
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('approved')}
          className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Approve usage'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('rejected')}
          className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#b3382e] disabled:opacity-50"
        >
          Reject usage
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-ink-soft"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function AppearanceRow({
  photoId,
  row,
  onChanged,
}: {
  photoId: string
  row: PhotoAppearanceDto
  onChanged: () => void
}) {
  const unclaimed = row.status === 'identified' || row.status === 'invited'
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{row.displayName}</p>
        <p className="font-mono-tech text-[10px] text-ink-faint">
          {row.inviteEmail ?? 'contact private'}
          {row.inviteMobile ? ' · mobile on file' : ''}
          {row.modelHandle ? ` · @${row.modelHandle}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {row.selfShot && <StatusPill status="Self-shot" />}
        {row.isMinor && <StatusPill status="Minor — guardian required" />}
        <StatusPill status={MODEL_CONSENT_STATUS_LABEL[(row.consentStatus ?? 'required') as ModelConsentStatus]} />
        <StatusPill status={MODEL_APPEARANCE_LABEL[row.status]} />
        {row.status === 'approved' && <StatusPill status={MODEL_USAGE_LABEL[row.usage]} />}
        {unclaimed && (
          <>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.resendAppearanceInvite(photoId, row.id)
                  toast.success('Invite resent')
                  onChanged()
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Could not resend')
                }
              }}
              className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-terra"
            >
              Resend
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.removeAppearance(photoId, row.id)
                  toast.success('Removed')
                  onChanged()
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Could not remove')
                }
              }}
              className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-[#b3382e]"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </li>
  )
}
