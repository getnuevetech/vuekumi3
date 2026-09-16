import { useState } from 'react'
import { toast } from 'sonner'
import {
  MODEL_APPEARANCE_LABEL,
  MODEL_USAGE_LABEL,
  type ModelUsagePreference,
  type PhotoAppearanceDto,
  type PhotoDto,
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
  const [busy, setBusy] = useState(false)
  const people = photo.appearances ?? []
  const alreadySelf = people.some(
    (row) => row.selfShot || (user && row.inviteEmail && row.inviteEmail.toLowerCase() === user.email.toLowerCase()),
  )

  const reload = async () => {
    const { photo: next } = await api.contributorPhoto(photo.id)
    onChange(next)
  }

  return (
    <div className="rounded-xl border border-sand-soft p-4">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">People in this photograph</p>
      <p className="mt-1 text-sm text-ink-soft">
        A typed name is not identity. If you are in the photograph, identify yourself on this account — do not invite a fake second email. Invite other depicted people to confirm likeness and approve usage. Commercial licences stay locked until every person approves commercial use. Models do not earn.
      </p>
      <ul className="mt-3 space-y-2">
        {people.length === 0 && (
          <li className="text-sm text-ink-soft">No one identified yet.</li>
        )}
        {people.map((row) => (
          <AppearanceRow key={row.id} photoId={photo.id} row={row} onChanged={() => void reload()} />
        ))}
      </ul>
      {!alreadySelf && user?.accountType === 'contributor' && (
        <SelfShotForm photoId={photo.id} defaultName={user.name} onDone={() => void reload()} />
      )}
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api.identifyAppearance(photo.id, { displayName, email })
            setDisplayName('')
            setEmail('')
            await reload()
            toast.success('Invite sent')
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
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </form>
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
  const [busy, setBusy] = useState(false)

  const submit = async (status: 'approved' | 'rejected') => {
    setBusy(true)
    try {
      await api.selfShotAppearance(photoId, {
        displayName,
        confirmedLikeness: likeness,
        status,
        usage: status === 'approved' ? usage : 'none',
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
          {row.inviteEmail ?? 'email hidden'}
          {row.modelHandle ? ` · @${row.modelHandle}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {row.selfShot && <StatusPill status="Self-shot" />}
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
