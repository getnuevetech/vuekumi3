import { useState } from 'react'
import { toast } from 'sonner'
import {
  MODEL_APPEARANCE_LABEL,
  MODEL_USAGE_LABEL,
  type PhotoAppearanceDto,
  type PhotoDto,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { StatusPill } from './shared'

export function PeopleIdentifier({
  photo,
  onChange,
}: {
  photo: PhotoDto
  onChange: (next: PhotoDto) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const people = photo.appearances ?? []

  const reload = async () => {
    const { photo: next } = await api.contributorPhoto(photo.id)
    onChange(next)
  }

  return (
    <div className="rounded-xl border border-sand-soft p-4">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">People in this photograph</p>
      <p className="mt-1 text-sm text-ink-soft">
        A typed name is not identity. Vuekumi invites the person to claim a model account, confirm likeness, and approve or reject usage. Models do not earn in this phase.
      </p>
      <ul className="mt-3 space-y-2">
        {people.length === 0 && (
          <li className="text-sm text-ink-soft">No one identified yet.</li>
        )}
        {people.map((row) => (
          <AppearanceRow key={row.id} photoId={photo.id} row={row} onChanged={() => void reload()} />
        ))}
      </ul>
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
