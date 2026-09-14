import { useState } from 'react'
import type { AiSuggestionDto, PhotoDto } from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { toast } from 'sonner'

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'country', label: 'Country' },
  { key: 'tags', label: 'Tags' },
  { key: 'hasRecognizablePeople', label: 'Recognisable people' },
] as const

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const comma = text.indexOf(',')
      resolve(comma >= 0 ? text.slice(comma + 1) : text)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function AiSuggestPanel({
  photoId,
  file,
  context,
  onFill,
  onApplied,
}: {
  photoId?: string
  file?: File | null
  context?: { title?: string; country?: string; category?: string }
  onFill?: (suggestion: AiSuggestionDto) => void
  onApplied?: (photo: PhotoDto) => void
}) {
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState<AiSuggestionDto | null>(null)
  const [selected, setSelected] = useState<string[]>(FIELDS.map((f) => f.key))

  async function suggest() {
    setBusy(true)
    try {
      if (photoId) {
        const data = await api.suggestPhoto(photoId)
        setSuggestion(data.suggestion)
      } else if (file) {
        const imageBase64 = await fileToBase64(file)
        const data = await api.suggestFile({
          imageBase64,
          mimeType: file.type || 'image/jpeg',
          filename: file.name,
          title: context?.title,
          country: context?.country,
          category: context?.category,
        })
        setSuggestion(data.suggestion)
      } else {
        toast.error('Choose a photograph first')
        return
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Suggestion failed')
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!suggestion) return
    if (photoId && suggestion.id) {
      setBusy(true)
      try {
        const data = await api.applySuggestion(photoId, suggestion.id, selected)
        toast.success('Applied selected fields — review them before they go live')
        onApplied?.(data.photo)
        setSuggestion({ ...suggestion, status: 'applied' })
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not apply')
      } finally {
        setBusy(false)
      }
      return
    }
    onFill?.(suggestion)
    toast.success('Filled the form with suggestions. Review before submitting.')
  }

  return (
    <div className="rounded-2xl border border-sand-soft bg-cream/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-terra">Manual AI</p>
          <p className="mt-1 text-sm text-ink-soft">Suggestions only run when you ask. Nothing is applied until you review it.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void suggest()}
          className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-paper hover:bg-terra disabled:opacity-40"
        >
          {busy ? 'Suggesting…' : 'Suggest metadata'}
        </button>
      </div>

      {suggestion && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {suggestion.provider === 'dev' ? 'Test suggestion' : 'OpenAI suggestion'}
            {suggestion.status ? ` · ${suggestion.status}` : ''}
          </p>
          {FIELDS.map((f) => {
            const value = f.key === 'tags'
              ? suggestion.tags.join(', ')
              : f.key === 'hasRecognizablePeople'
                ? suggestion.hasRecognizablePeople == null ? '—' : suggestion.hasRecognizablePeople ? 'Yes' : 'No'
                : suggestion[f.key] ?? '—'
            return (
              <label key={f.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(f.key)}
                  onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, f.key] : cur.filter((k) => k !== f.key))}
                  className="mt-1 accent-[#bc773f]"
                />
                <span>
                  <span className="text-ink-soft">{f.label}</span>
                  <span className="mt-0.5 block">{value}</span>
                </span>
              </label>
            )
          })}
          {suggestion.notes && <p className="text-ink-soft">{suggestion.notes}</p>}
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void apply()}
            className="rounded-full border border-sand px-4 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.15em] hover:border-terra disabled:opacity-40"
          >
            {photoId ? 'Apply selected' : 'Use in form'}
          </button>
        </div>
      )}
    </div>
  )
}
