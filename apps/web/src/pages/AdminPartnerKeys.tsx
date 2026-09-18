import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { PartnerKeyDto } from '@vuekumi/shared'
import { SectionHead, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'
import { AdminShell } from './Admin'

export default function AdminPartnerKeys() {
  const [items, setItems] = useState<PartnerKeyDto[]>([])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api.adminPartnerKeys()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load partner keys'))
  }
  useEffect(() => { load() }, [])

  return (
    <AdminShell subtitle="Partner distribution API. Authenticated, licensed, rate-limited — cleared inventory only.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Distribution</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Partner API keys.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Partners read the cleared catalog at <code className="font-mono-tech text-[12px]">/api/partner/v1/photos</code> with
        a bearer key (120 requests/minute). Private, portfolio-only, and agency-protected inventory is
        never exposed, licence flags carry the same guards as checkout, licences are granted on
        VueKumi only, and AI training is not permitted through this API even when a photograph has a
        separate AI-training opt-in. Dataset pricing is undecided; VueKumi does not sell training access.
      </p>

      <form
        className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl border border-sand-soft bg-white p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy('create')
          try {
            const result = await api.createPartnerKey({ name, note: note || undefined })
            setFreshKey(result.key)
            setName('')
            setNote('')
            toast.success('Key issued — copy it now, it is shown once')
            load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not issue the key')
          } finally {
            setBusy(null)
          }
        }}
      >
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Partner name (e.g. Acme CMS)"
          className="min-w-0 flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-0 flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
        />
        <button
          type="submit"
          disabled={busy === 'create'}
          className="bg-ink px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
        >
          Issue key
        </button>
      </form>

      {freshKey && (
        <div className="mt-4 rounded-2xl border border-terra bg-terra/5 p-5">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra">
            New key — shown once, only a hash is stored
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all font-mono-tech text-[12px]">{freshKey}</code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(freshKey)
                toast.success('Copied')
              }}
              className="border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:border-ink"
            >
              Copy
            </button>
            <button
              onClick={() => setFreshKey(null)}
              className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mt-10">
        <SectionHead kicker="Keys" title={`Issued (${items.length})`} />
        {items.length === 0 && <p className="mt-3 text-sm text-ink-soft">No partner keys yet.</p>}
        <div className="mt-3 space-y-3">
          {items.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sand-soft bg-white p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {k.name}
                  <code className="ml-2 font-mono-tech text-[11px] text-ink-faint">{k.keyPrefix}…</code>
                </p>
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {k.requestCount.toLocaleString()} requests
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : ' · never used'}
                  {' · issued '}{new Date(k.createdAt).toLocaleDateString()}
                </p>
                {k.note && <p className="mt-1 text-[13px] text-ink-soft">{k.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={k.status} />
                {k.status === 'active' && (
                  <button
                    disabled={busy === k.id}
                    onClick={async () => {
                      setBusy(k.id)
                      try {
                        await api.revokePartnerKey(k.id)
                        toast.success('Key revoked')
                        load()
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not revoke')
                      } finally {
                        setBusy(null)
                      }
                    }}
                    className="border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:border-ink hover:text-[#b3382e] disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
