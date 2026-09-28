import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { BrandProjectDto, CampaignDto, CollectionDto } from '@vuekumi/shared'
import { toast } from 'sonner'
import { SiteHeader, StatusPill } from '../components/shared'
import { api, ApiError } from '../api/client'

const STUDIO_NOTE =
  'Brand Studio groups a creative brief, optional campaign, and reference lightboxes. '
  + 'Production fees and licence grants are not settled here — attach collections, write the brief, '
  + 'then continue to campaigns or checkout as usual (Dec-Fee still open).'

export default function BrandStudio() {
  const [items, setItems] = useState<BrandProjectDto[]>([])
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([])
  const [collections, setCollections] = useState<CollectionDto[]>([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [attachCollectionId, setAttachCollectionId] = useState('')

  const load = () => {
    api.brandProjects()
      .then((d) => setItems(d.items))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load projects'))
    api.campaigns()
      .then((d) => setCampaigns(d.items.filter((c) => c.mine)))
      .catch(() => setCampaigns([]))
    api.collections()
      .then((d) => setCollections(d.items))
      .catch(() => setCollections([]))
  }

  useEffect(() => { load() }, [])

  const selected = items.find((p) => p.id === selectedId) ?? items[0] ?? null

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id)
  }, [items, selectedId])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 md:px-8">
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Brand Studio</p>
        <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Creative workspace.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{STUDIO_NOTE}</p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/campaigns" className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra hover:text-ink">
            Campaigns →
          </Link>
          <Link to="/collections" className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-terra hover:text-ink">
            Collections →
          </Link>
        </div>

        <form
          className="mt-8 space-y-3 rounded-2xl border border-sand-soft bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              const { project } = await api.createBrandProject({
                title,
                notes: notes || undefined,
                campaignId: campaignId || undefined,
              })
              setItems((prev) => [project, ...prev])
              setSelectedId(project.id)
              setTitle('')
              setNotes('')
              setCampaignId('')
              toast.success('Project created')
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Could not create project')
            } finally {
              setBusy(false)
            }
          }}
        >
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-faint">New project</p>
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title (e.g. West Africa launch board)"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Creative notes / direction (optional)"
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full border border-sand px-4 py-2.5 text-sm outline-none focus:border-terra"
          >
            <option value="">No linked campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="bg-ink px-6 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-paper hover:bg-terra disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </form>

        <div className="mt-10 grid gap-6 lg:grid-cols-[240px_1fr]">
          <ul className="space-y-1">
            {items.length === 0 && (
              <li className="text-sm text-ink-soft">No projects yet.</li>
            )}
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                    selected?.id === p.id ? 'bg-ink text-paper' : 'hover:bg-sand-soft'
                  }`}
                >
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className={`font-mono-tech text-[9px] uppercase tracking-[0.14em] ${
                    selected?.id === p.id ? 'text-paper/70' : 'text-ink-faint'
                  }`}>{p.status}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="rounded-2xl border border-sand-soft bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif-display text-2xl font-light">{selected.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={selected.status} />
                    {selected.campaignTitle && (
                      <Link to="/campaigns" className="text-sm text-terra hover:text-ink">
                        Campaign: {selected.campaignTitle}
                      </Link>
                    )}
                  </div>
                </div>
                {selected.status === 'open' && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { project } = await api.closeBrandProject(selected.id)
                        setItems((prev) => prev.map((p) => (p.id === project.id ? project : p)))
                        toast.success('Project closed')
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not close')
                      }
                    }}
                    className="rounded-full border border-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] hover:bg-ink hover:text-paper"
                  >
                    Close
                  </button>
                )}
              </div>

              {selected.notes ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{selected.notes}</p>
              ) : (
                <p className="mt-4 text-sm text-ink-faint">No creative notes yet.</p>
              )}

              <div className="mt-8">
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-ink-faint">Reference lightboxes</p>
                <ul className="mt-3 divide-y divide-sand-soft border border-sand-soft">
                  {selected.collections.length === 0 && (
                    <li className="px-4 py-3 text-sm text-ink-soft">No collections attached.</li>
                  )}
                  {selected.collections.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div>
                        <Link to={`/c/${c.id}`} className="text-sm font-medium hover:text-terra">{c.name}</Link>
                        <p className="font-mono-tech text-[10px] text-ink-faint">{c.photoCount} photos</p>
                      </div>
                      {selected.status === 'open' && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { project } = await api.detachBrandCollection(selected.id, c.id)
                              setItems((prev) => prev.map((p) => (p.id === project.id ? project : p)))
                            } catch (err) {
                              toast.error(err instanceof ApiError ? err.message : 'Could not detach')
                            }
                          }}
                          className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-terra"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {selected.status === 'open' && collections.length > 0 && (
                  <form
                    className="mt-3 flex flex-wrap gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!attachCollectionId) return
                      try {
                        const { project } = await api.attachBrandCollection(selected.id, attachCollectionId)
                        setItems((prev) => prev.map((p) => (p.id === project.id ? project : p)))
                        setAttachCollectionId('')
                        toast.success('Lightbox attached')
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Could not attach')
                      }
                    }}
                  >
                    <select
                      value={attachCollectionId}
                      onChange={(e) => setAttachCollectionId(e.target.value)}
                      className="min-w-[200px] flex-1 border border-sand px-3 py-2 text-sm outline-none focus:border-terra"
                    >
                      <option value="">Attach a collection…</option>
                      {collections
                        .filter((c) => !selected.collections.some((x) => x.id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra"
                    >
                      Attach
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
