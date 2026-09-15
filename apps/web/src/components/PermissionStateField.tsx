import type { PermissionState } from '@vuekumi/shared'
import {
  CONTRIBUTOR_PERMISSION_STATES,
  PERMISSION_STATE_HELP,
  PERMISSION_STATE_LABEL,
  PERMISSION_STATES,
} from '@vuekumi/shared'

export function PermissionStateField({
  value,
  onChange,
  notes,
  onNotes,
  actor = 'contributor',
  disabled,
}: {
  value: PermissionState
  onChange: (state: PermissionState) => void
  notes?: string
  onNotes?: (notes: string) => void
  actor?: 'contributor' | 'admin'
  disabled?: boolean
}) {
  const options = actor === 'admin' ? PERMISSION_STATES : CONTRIBUTOR_PERMISSION_STATES
  return (
    <div className="space-y-2">
      <label className="block text-sm text-ink-soft">
        Permission state
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as PermissionState)}
          className="mt-1 w-full rounded-xl border border-sand-soft bg-white px-4 py-2.5 text-sm outline-none focus:border-terra disabled:opacity-50"
        >
          {options.map((state) => (
            <option key={state} value={state}>
              {PERMISSION_STATE_LABEL[state]}
            </option>
          ))}
        </select>
      </label>
      <p className="font-mono-tech text-[10px] text-ink-faint">{PERMISSION_STATE_HELP[value]}</p>
      {value === 'restricted' && onNotes && (
        <textarea
          rows={2}
          value={notes ?? ''}
          disabled={disabled}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Restriction notes (channels, territories, parties)"
          className="w-full rounded-xl border border-sand-soft px-4 py-2.5 text-sm outline-none focus:border-terra"
        />
      )}
    </div>
  )
}
