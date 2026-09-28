import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DEFAULT_CATEGORY_BANNER_FRAME,
  DEFAULT_PEOPLE_FRAME,
  HOME_BUILTIN_SECTIONS,
  HOME_FEATURED_SLOT_KEYS,
  HOME_PEOPLE_ACCOUNT,
  HOME_PEOPLE_SLOTS,
  HOME_PEOPLE_SLOT_LABEL,
  PHOTO_CATEGORIES,
  homeSectionLabel,
  type CategoryBannerPin,
  type HomeContributorPick,
  type HomeEditorialMode,
  type HomeFeaturedAdminDto,
  type HomeFeaturedSlotKey,
  type HomeUploadSlotKey,
  isHomeUploadSlot,
  type HomePeopleMode,
  type HomePeopleSlot,
  type HomeStaticBannerDto,
  type PhotoDto,
} from '@vuekumi/shared'
import { api, ApiError } from '../api/client'
import { invalidatePublicHome } from '../lib/query-keys'
import { AdminShell } from './Admin'

function emptyPins(page: HomeFeaturedAdminDto): HomeFeaturedAdminDto['pins'] {
  return { ...page.pins }
}

const SLOT_NOTE: Partial<Record<HomeFeaturedSlotKey, string>> = {
  hero: 'Upload an image for a slide, or pin a live photograph. An empty slide picks a random photograph from the whole library.',
  edge: 'Featured images are edited only on Featured images, and from the switch on each photograph in Content. Empty frames pick a random photograph from the whole library.',
  editorial: 'Upload an image, pin photographs that change on a timer, or choose a category. An upload fills that slide. Empty slides pick a random photograph from the whole library, or from the chosen category.',
  pricing: 'Upload an image or pin a photograph for a pricing card that does not have its own plan image. Plan names, prices, and the lines on the cards are edited under Buyer plans. An empty card picks a random photograph from the whole library.',
  stats_background: 'Upload a background image, or pin a live photograph. An empty background picks a random photograph from the whole library.',
}

function emptyUploads(page: HomeFeaturedAdminDto): Record<HomeUploadSlotKey, (string | null)[]> {
  return {
    hero: page.slots.hero.map((row) => row.imageSrc),
    editorial: page.slots.editorial.map((row) => row.imageSrc),
    pricing: page.slots.pricing.map((row) => row.imageSrc),
    stats_background: page.slots.stats_background.map((row) => row.imageSrc),
  }
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result ?? '')
      const marker = value.indexOf(',')
      resolve(marker >= 0 ? value.slice(marker + 1) : value)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

type PinTarget =
  | { kind: 'slot'; slot: HomeFeaturedSlotKey; position: number }
  | { kind: 'banner'; position: number }

export default function AdminHomepage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState<HomeFeaturedAdminDto | null>(null)
  const [pins, setPins] = useState<HomeFeaturedAdminDto['pins'] | null>(null)
  const [uploads, setUploads] = useState<Record<HomeUploadSlotKey, (string | null)[]> | null>(null)
  const [banners, setBanners] = useState<CategoryBannerPin[] | null>(null)
  const [editorialMode, setEditorialMode] = useState<HomeEditorialMode>('pins')
  const [editorialCategory, setEditorialCategory] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PhotoDto[]>([])
  const [target, setTarget] = useState<PinTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [bannerWidth, setBannerWidth] = useState(String(DEFAULT_CATEGORY_BANNER_FRAME.widthVw))
  const [bannerHeight, setBannerHeight] = useState(String(DEFAULT_CATEGORY_BANNER_FRAME.heightVw))

  const load = () => {
    api.adminHomepage()
      .then((next) => {
        setPage(next)
        setPins(emptyPins(next))
        setUploads(emptyUploads(next))
        setBanners(next.categoryBanners.map((row) => ({ photoId: row.photoId, category: row.category, imageSrc: row.imageSrc })))
        setEditorialMode(next.editorialMode)
        setEditorialCategory(next.editorialCategory ?? '')
        setBannerWidth(String(next.categoryBannerFrame.widthVw))
        setBannerHeight(String(next.categoryBannerFrame.heightVw))
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load homepage'))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    const handle = window.setTimeout(() => {
      api.adminContent({ q: term })
        .then((d) => setHits(d.items.slice(0, 8)))
        .catch(() => setHits([]))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [q])

  const setPin = (slot: HomeFeaturedSlotKey, position: number, photoId: string | null) => {
    setPins((current) => {
      if (!current) return current
      const next = [...(current[slot] ?? [])]
      next[position] = photoId
      return { ...current, [slot]: next }
    })
  }

  const setBanner = (position: number, patch: Partial<CategoryBannerPin>) => {
    setBanners((current) => {
      if (!current) return current
      const next = current.map((row) => ({ ...row }))
      next[position] = { ...next[position], ...patch }
      return next
    })
  }

  const setUpload = (slot: HomeUploadSlotKey, position: number, imageSrc: string | null) => {
    setUploads((current) => {
      if (!current) return current
      const next = [...current[slot]]
      next[position] = imageSrc
      return { ...current, [slot]: next }
    })
    if (imageSrc) setPin(slot, position, null)
  }

  const uploadSlotImage = async (slot: HomeUploadSlotKey, position: number, file: File) => {
    setBusy(true)
    try {
      const dataBase64 = await fileToBase64(file)
      const saved = await api.uploadSiteImage({ kind: 'banners', contentType: file.type || 'image/jpeg', dataBase64 })
      setUpload(slot, position, saved.src)
      toast.success('Image ready. Save featured slots to keep it.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the image')
    } finally {
      setBusy(false)
    }
  }

  const uploadBanner = async (position: number, file: File) => {
    setBusy(true)
    try {
      const dataBase64 = await fileToBase64(file)
      const saved = await api.uploadSiteImage({ kind: 'banners', contentType: file.type || 'image/jpeg', dataBase64 })
      setBanner(position, { imageSrc: saved.src, photoId: null })
      toast.success('Banner image ready. Save featured slots to keep it.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the banner')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!pins || !banners || !uploads) return
    const widthVw = Number(bannerWidth)
    const heightVw = Number(bannerHeight)
    if (!Number.isFinite(widthVw) || !Number.isFinite(heightVw)) {
      toast.error('Enter a width and a height for the category banners.')
      return
    }
    setBusy(true)
    try {
      const next = await api.saveHomepage({
        pins: {
          hero: pins.hero,
          editorial: pins.editorial,
          pricing: pins.pricing,
          stats_background: pins.stats_background,
        },
        categoryBanners: banners,
        editorial: { mode: editorialMode, category: editorialCategory || null },
        categoryBannerFrame: { widthVw, heightVw },
        uploads,
      })
      setPage(next)
      setPins(emptyPins(next))
      setUploads(emptyUploads(next))
      setBanners(next.categoryBanners.map((row) => ({ photoId: row.photoId, category: row.category, imageSrc: row.imageSrc })))
      setEditorialMode(next.editorialMode)
      setEditorialCategory(next.editorialCategory ?? '')
      setBannerWidth(String(next.categoryBannerFrame.widthVw))
      setBannerHeight(String(next.categoryBannerFrame.heightVw))
      await invalidatePublicHome(queryClient)
      toast.success('Homepage featured slots saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell subtitle="Section order, people rows, category banners, and static banners.">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">Homepage</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">Homepage layout.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        The public menu is edited under <Link to="/admin/menu" className="text-terra">Menu</Link>. Other words and the logo are under <Link to="/admin/site" className="text-terra">Site content</Link>. Featuring a photograph is curation, not a licence and not AI-training consent.
        Private, portfolio, and agency-protected inventory cannot appear on the public homepage.
        The homepage featured strip is edited only on <Link to="/admin/featured" className="text-terra">Featured images</Link>, including the switch on each photograph in Content.
        Category banners sit below the three messages. Upload a banner image here, or choose a live photograph. Empty positions pick a random photograph from the whole library so the page stays moving.
      </p>

      <SectionArrangement page={page} onSaved={load} />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Find a live photograph</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, id, country…"
            className="mt-1 w-72 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
          />
        </label>
        <button
          type="button"
          disabled={busy || !pins}
          onClick={() => void save()}
          className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50"
        >
          Save featured slots
        </button>
      </div>

      {hits.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {hits.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => {
                if (!target) {
                  toast.message(`Select a slot, then pin ${photo.id}`)
                  return
                }
                if (target.kind === 'banner') setBanner(target.position, { photoId: photo.id, imageSrc: null })
                else {
                  setPin(target.slot, target.position, photo.id)
                  if (isHomeUploadSlot(target.slot)) setUpload(target.slot, target.position, null)
                }
              }}
              className="flex items-center gap-3 rounded-2xl border border-sand-soft bg-white p-2 text-left hover:border-terra"
            >
              <img src={photo.src} alt="" className="h-12 w-16 rounded-lg object-cover" />
              <span>
                <span className="block text-sm font-medium">{photo.title}</span>
                <span className="font-mono-tech text-[10px] text-ink-faint">{photo.id}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 space-y-10">
        {HOME_FEATURED_SLOT_KEYS.filter((slot) => slot !== 'edge').map((slot) => (
          <section key={slot}>
            <h2 className="font-serif-display text-2xl font-light">{page?.labels[slot] ?? slot}</h2>
            <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {page?.capacities[slot] ?? 0} positions
            </p>
            {SLOT_NOTE[slot] && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{SLOT_NOTE[slot]}</p>}
            {slot === 'editorial' && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Slides</span>
                  <select
                    value={editorialMode}
                    onChange={(e) => setEditorialMode(e.target.value as HomeEditorialMode)}
                    className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
                  >
                    <option value="pins">Pinned photographs</option>
                    <option value="category">Category</option>
                  </select>
                </label>
                {editorialMode === 'category' && (
                  <label className="block">
                    <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Category</span>
                    <select
                      value={editorialCategory}
                      onChange={(e) => setEditorialCategory(e.target.value)}
                      className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra"
                    >
                      <option value="">Choose a category</option>
                      {PHOTO_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(page?.slots[slot] ?? []).map((row) => {
                const pinnedId = pins?.[slot]?.[row.position] ?? null
                const uploaded = isHomeUploadSlot(slot) ? (uploads?.[slot]?.[row.position] ?? null) : null
                const selected = target?.kind === 'slot' && target.slot === slot && target.position === row.position
                return (
                  <article
                    key={`${slot}-${row.position}`}
                    className={`rounded-2xl border bg-white p-3 ${selected ? 'border-terra' : 'border-sand-soft'}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => setTarget({ kind: 'slot', slot, position: row.position })}>
                      {uploaded || row.photo ? (
                        <img src={uploaded || row.photo?.src} alt="" className="h-28 w-full rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-xl bg-cream text-sm text-ink-faint">Empty — auto fill</div>
                      )}
                      <p className="mt-2 text-sm font-medium">{uploaded ? 'Uploaded image' : (row.photo?.title ?? 'No photograph yet')}</p>
                      <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        #{row.position + 1} · {uploaded ? 'upload' : row.source}{row.ineligibleReason ? ` · ${row.ineligibleReason}` : ''}
                      </p>
                    </button>
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          value={uploaded ? '' : (pinnedId ?? '')}
                          onFocus={() => setTarget({ kind: 'slot', slot, position: row.position })}
                          onChange={(e) => {
                            const photoId = e.target.value.trim() || null
                            setPin(slot, row.position, photoId)
                            if (isHomeUploadSlot(slot)) setUpload(slot, row.position, null)
                          }}
                          placeholder="Photo id or leave blank"
                          className="min-w-0 flex-1 rounded-full border border-sand-soft px-3 py-1.5 font-mono-tech text-[11px] outline-none focus:border-terra"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPin(slot, row.position, null)
                            if (isHomeUploadSlot(slot)) setUpload(slot, row.position, null)
                          }}
                          className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                        >
                          Auto
                        </button>
                      </div>
                      {isHomeUploadSlot(slot) && (
                        <label className="block font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                          Upload image
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-label={`Upload ${page?.labels[slot] ?? slot} ${row.position + 1}`}
                            className="mt-1 block w-full text-sm"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              e.target.value = ''
                              if (!file) return
                              void uploadSlotImage(slot, row.position, file)
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
        {HOME_PEOPLE_SLOTS.map((slot) => (
          <PeopleEditor key={slot} slot={slot} page={page} busy={busy} onSaved={load} />
        ))}
        <section className="mt-10">
                <h2 className="font-serif-display text-2xl font-light">Category banners</h2>
                <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {page?.categoryBannerCapacity ?? banners?.length ?? 0} positions
                </p>
                <p className="mt-2 max-w-2xl text-sm text-ink-soft">
                  These banners scroll sideways with the mouse wheel.
                  Upload an image for a category, or choose a live photograph. Leave a banner blank to use a live image from that category.
                  Width and height are a percent of the screen width. The starting size is {DEFAULT_CATEGORY_BANNER_FRAME.widthVw} wide and {DEFAULT_CATEGORY_BANNER_FRAME.heightVw} tall.
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Banner width</span>
                    <input type="number" min={8} max={90} step={0.01} value={bannerWidth} aria-label="Category banner width" onChange={(e) => setBannerWidth(e.target.value)} className="mt-1 w-32 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                  </label>
                  <label className="block">
                    <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Banner height</span>
                    <input type="number" min={8} max={120} step={0.01} value={bannerHeight} aria-label="Category banner height" onChange={(e) => setBannerHeight(e.target.value)} className="mt-1 w-32 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(page?.categoryBanners ?? []).map((row) => {
                    const draft = banners?.[row.position]
                    const selected = target?.kind === 'banner' && target.position === row.position
                    return (
                      <article
                        key={`banner-${row.position}`}
                        className={`rounded-2xl border bg-white p-3 ${selected ? 'border-terra' : 'border-sand-soft'}`}
                      >
                        <button type="button" className="w-full text-left" onClick={() => setTarget({ kind: 'banner', position: row.position })}>
                          {(draft?.imageSrc || row.photo) ? (
                            <img src={draft?.imageSrc || row.photo?.src} alt="" className="h-28 w-full rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-28 items-center justify-center rounded-xl bg-cream text-sm text-ink-faint">Empty — auto fill</div>
                          )}
                          <p className="mt-2 text-sm font-medium">{draft?.imageSrc ? 'Uploaded banner' : (row.photo?.title ?? 'No photograph yet')}</p>
                          <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                            #{row.position + 1} · {draft?.category || 'no category'} · {row.source}
                          </p>
                        </button>
                        <div className="mt-3 flex flex-col gap-2">
                          <select
                            value={draft?.category ?? ''}
                            onFocus={() => setTarget({ kind: 'banner', position: row.position })}
                            onChange={(e) => setBanner(row.position, { category: e.target.value || null })}
                            className="rounded-full border border-sand-soft bg-white px-3 py-1.5 text-sm outline-none focus:border-terra"
                          >
                            <option value="">Category</option>
                            {PHOTO_CATEGORIES.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input
                              value={draft?.photoId ?? ''}
                              onFocus={() => setTarget({ kind: 'banner', position: row.position })}
                              onChange={(e) => setBanner(row.position, { photoId: e.target.value.trim() || null, imageSrc: null })}
                              placeholder="Photo id or leave blank"
                              className="min-w-0 flex-1 rounded-full border border-sand-soft px-3 py-1.5 font-mono-tech text-[11px] outline-none focus:border-terra"
                            />
                            <button
                              type="button"
                              onClick={() => setBanner(row.position, { photoId: null, category: null, imageSrc: null })}
                              className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                            >
                              Auto
                            </button>
                          </div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                            Upload banner
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              aria-label={`Upload banner ${row.position + 1}`}
                              className="mt-1 block w-full text-sm"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                e.target.value = ''
                                if (!file) return
                                void uploadBanner(row.position, file)
                              }}
                            />
                          </label>
                        </div>
                      </article>
                    )
                  })}
                </div>
        </section>
        <StaticBanners page={page} busy={busy} onSaved={load} />
      </div>
    </AdminShell>
  )
}

function moveItem(list: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item!)
  return next
}

function SectionArrangement({ page, onSaved }: { page: HomeFeaturedAdminDto | null; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const [order, setOrder] = useState<string[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const [addKey, setAddKey] = useState('')
  const [saving, setSaving] = useState(false)
  const banners = page?.staticBanners ?? []

  useEffect(() => {
    setOrder(page?.layoutOrder ?? [])
    setHidden(page?.layoutHidden ?? [])
    setAddKey('')
  }, [page])

  const available = HOME_BUILTIN_SECTIONS.filter((key) => !order.includes(key))

  const saveOrder = async (nextOrder: string[], nextHidden: string[], extraBanners?: HomeStaticBannerDto[]) => {
    setSaving(true)
    try {
      await api.saveHomepage({
        pins: {},
        layoutOrder: nextOrder,
        layoutHidden: nextHidden.filter((key) => nextOrder.includes(key)),
        ...(extraBanners ? {
          staticBanners: extraBanners.map((banner) => ({
            ...(banner.id.startsWith('new-') ? {} : { id: banner.id }),
            title: banner.title,
            columns: banner.columns,
            rows: banner.rows,
            frame: { widthVw: banner.widthVw, heightVw: banner.heightVw },
            images: banner.images,
          })),
        } : {}),
      })
      await invalidatePublicHome(queryClient)
      toast.success('Homepage sections saved')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the homepage sections')
    } finally {
      setSaving(false)
    }
  }

  const removeSection = (key: string) => {
    const nextOrder = order.filter((item) => item !== key)
    const nextHidden = hidden.filter((item) => item !== key)
    if (key.startsWith('banner:')) {
      const id = key.slice('banner:'.length)
      void saveOrder(nextOrder, nextHidden, banners.filter((banner) => banner.id !== id))
      return
    }
    setOrder(nextOrder)
    setHidden(nextHidden)
  }

  return (
    <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
      <h2 className="font-serif-display text-2xl font-light">Section arrangement</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        This list is the public homepage. Photographers and photo influencers are separate rows. Hide a row to keep it here and leave it off the page. Remove a row to take it out of the list. Add a row to put it back, or add an image section. The header, footer, and back-to-top stay in place.
      </p>
      <ol className="mt-4 space-y-2">
        {order.map((key, index) => {
          const label = homeSectionLabel(key, banners)
          const off = hidden.includes(key)
          return (
            <li key={key} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${off ? 'border-sand-soft bg-cream/60' : 'border-sand-soft'}`}>
              <p className="text-sm">
                {index + 1}. {label}
                <span className="ml-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">{off ? 'Hidden' : 'On the homepage'}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => setOrder((rows) => moveItem(rows, index, -1))} className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">Up</button>
                <button type="button" aria-label={`Move ${label} down`} disabled={index === order.length - 1} onClick={() => setOrder((rows) => moveItem(rows, index, 1))} className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">Down</button>
                <button
                  type="button"
                  aria-label={off ? `Show ${label}` : `Hide ${label}`}
                  onClick={() => setHidden((rows) => off ? rows.filter((item) => item !== key) : [...rows, key])}
                  className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em]"
                >
                  {off ? 'Show' : 'Hide'}
                </button>
                <button type="button" aria-label={`Remove ${label}`} onClick={() => removeSection(key)} className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em]">Remove</button>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {available.length > 0 && (
          <label className="block">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Add a section</span>
            <select aria-label="Add a homepage section" value={addKey} onChange={(e) => setAddKey(e.target.value)} className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra">
              <option value="">Choose a section</option>
              {available.map((key) => (
                <option key={key} value={key}>{homeSectionLabel(key, banners)}</option>
              ))}
            </select>
          </label>
        )}
        {available.length > 0 && (
          <button
            type="button"
            disabled={!addKey}
            onClick={() => {
              if (!addKey) return
              setOrder((rows) => rows.includes(addKey) ? rows : [...rows, addKey])
              setAddKey('')
            }}
            className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            Add section
          </button>
        )}
        <button
          type="button"
          disabled={saving || banners.length >= 12}
          onClick={() => void saveOrder(order, hidden, [
            ...banners,
            {
              id: `new-${Date.now()}`,
              title: 'New section',
              columns: 2,
              rows: 1,
              widthVw: 28,
              heightVw: 18,
              images: [],
            },
          ])}
          className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
        >
          Add image section
        </button>
      </div>
      <button type="button" disabled={saving} onClick={() => void saveOrder(order, hidden)} className="mt-4 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
        Save sections
      </button>
    </section>
  )
}

function PeopleEditor({ slot, page, busy, onSaved }: { slot: HomePeopleSlot; page: HomeFeaturedAdminDto | null; busy: boolean; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const saved = page?.people[slot]
  const [mode, setMode] = useState<HomePeopleMode>('downloads')
  const [people, setPeople] = useState<HomeContributorPick[]>([])
  const [randomize, setRandomize] = useState(false)
  const [width, setWidth] = useState(String(DEFAULT_PEOPLE_FRAME.widthVw))
  const [height, setHeight] = useState(String(DEFAULT_PEOPLE_FRAME.heightVw))
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<HomeContributorPick[]>([])
  const [saving, setSaving] = useState(false)
  const label = HOME_PEOPLE_SLOT_LABEL[slot]
  const accountType = HOME_PEOPLE_ACCOUNT[slot]

  useEffect(() => {
    if (!saved) return
    setMode(saved.mode)
    setPeople(saved.people)
    setRandomize(saved.randomize)
    setWidth(String(saved.frame.widthVw))
    setHeight(String(saved.frame.heightVw))
  }, [saved])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || mode === 'downloads') {
      setHits([])
      return
    }
    const handle = window.setTimeout(() => {
      api.homepageContributors(term, accountType)
        .then((data) => setHits(data.items))
        .catch(() => setHits([]))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [query, accountType, mode])

  const save = async () => {
    const widthVw = Number(width)
    const heightVw = Number(height)
    if (!Number.isFinite(widthVw) || !Number.isFinite(heightVw)) {
      toast.error(`Enter a width and a height for ${label.toLowerCase()}.`)
      return
    }
    setSaving(true)
    try {
      await api.saveHomepage({
        pins: {},
        people: { [slot]: { mode, ids: people.map((person) => person.id), randomize, frame: { widthVw, heightVw } } },
      })
      await invalidatePublicHome(queryClient)
      toast.success(`${label} saved`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Could not save ${label.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-10 rounded-3xl border border-sand-soft bg-white p-5">
      <h2 className="font-serif-display text-2xl font-light">{label}</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Show chosen profiles, rank by number of downloads, or show chosen profiles first and fill the rest by downloads.
        Width and height are a percent of the screen width. The starting card is {DEFAULT_PEOPLE_FRAME.widthVw} wide and {DEFAULT_PEOPLE_FRAME.heightVw} tall.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Who appears</span>
          <select aria-label={`${label} on the homepage`} value={mode} onChange={(e) => setMode(e.target.value as HomePeopleMode)} className="mt-1 rounded-full border border-sand-soft bg-white px-4 py-2 text-sm outline-none focus:border-terra">
            <option value="downloads">Number of downloads</option>
            <option value="profiles">Chosen profiles</option>
            <option value="both">Chosen profiles, then downloads</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Width</span>
          <input type="number" min={8} max={90} step={0.1} value={width} aria-label={`${label} width`} onChange={(e) => setWidth(e.target.value)} className="mt-1 w-28 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
        </label>
        <label className="block">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Height</span>
          <input type="number" min={8} max={120} step={0.1} value={height} aria-label={`${label} height`} onChange={(e) => setHeight(e.target.value)} className="mt-1 w-28 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
        </label>
      </div>
      {mode !== 'downloads' && (
        <>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} />
            Shuffle the chosen profiles on each visit
          </label>
          <div className="mt-4 space-y-2">
            {people.map((person, index) => (
              <div key={person.id} className="flex items-center justify-between gap-3 rounded-2xl border border-sand-soft px-3 py-2">
                <p className="text-sm">{index + 1}. {person.name} <span className="text-ink-faint">@{person.handle}</span></p>
                <button type="button" onClick={() => setPeople((rows) => rows.filter((row) => row.id !== person.id))} className="rounded-full border border-sand px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.12em]">Remove</button>
              </div>
            ))}
            {people.length === 0 && <p className="text-sm text-ink-soft">No profiles chosen yet.</p>}
          </div>
          <label className="mt-4 block max-w-sm">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Find a profile</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or handle" aria-label={`Find a ${accountType === 'photo_influencer' ? 'photo influencer' : accountType}`} className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
          </label>
          {hits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hits.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  disabled={people.some((row) => row.id === person.id) || people.length >= 24}
                  onClick={() => setPeople((rows) => rows.some((row) => row.id === person.id) ? rows : [...rows, person])}
                  className="rounded-full border border-sand px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {person.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button type="button" disabled={busy || saving} onClick={() => void save()} className="mt-4 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
        Save {label.toLowerCase()}
      </button>
    </section>
  )
}

type BannerDraft = {
  key: string
  id?: string
  title: string
  columns: number
  rows: number
  widthVw: string
  heightVw: string
  images: string[]
}

function draftsFrom(banners: HomeStaticBannerDto[]): BannerDraft[] {
  return banners.map((banner) => ({
    key: banner.id,
    id: banner.id,
    title: banner.title,
    columns: banner.columns,
    rows: banner.rows,
    widthVw: String(banner.widthVw),
    heightVw: String(banner.heightVw),
    images: banner.images,
  }))
}

function StaticBanners({ page, busy, onSaved }: { page: HomeFeaturedAdminDto | null; busy: boolean; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const [banners, setBanners] = useState<BannerDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setBanners(draftsFrom(page?.staticBanners ?? []))
  }, [page])

  const update = (key: string, patch: Partial<BannerDraft>) => {
    setBanners((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row))
  }

  const upload = async (key: string, file: File) => {
    const banner = banners.find((row) => row.key === key)
    if (!banner) return
    if (banner.images.length >= banner.rows * banner.columns) {
      toast.error(`This section holds ${banner.rows * banner.columns} images.`)
      return
    }
    try {
      const dataBase64 = await fileToBase64(file)
      const saved = await api.uploadSiteImage({ kind: 'banners', contentType: file.type || 'image/jpeg', dataBase64 })
      update(key, { images: [...banner.images, saved.src] })
      toast.success('Image ready. Save the banner section to keep it.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the image')
    }
  }

  const save = async () => {
    const payload = []
    for (const banner of banners) {
      const widthVw = Number(banner.widthVw)
      const heightVw = Number(banner.heightVw)
      if (!banner.title.trim()) {
        toast.error('Give each banner section a title.')
        return
      }
      if (!Number.isFinite(widthVw) || !Number.isFinite(heightVw)) {
        toast.error(`Enter a width and a height for ${banner.title}.`)
        return
      }
      payload.push({
        id: banner.id,
        title: banner.title.trim(),
        columns: banner.columns,
        rows: banner.rows,
        frame: { widthVw, heightVw },
        images: banner.images,
      })
    }
    setSaving(true)
    try {
      await api.saveHomepage({ pins: {}, staticBanners: payload })
      await invalidatePublicHome(queryClient)
      toast.success('Static banner sections saved')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save banner sections')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-10 rounded-3xl border border-sand-soft bg-white p-5">
      <h2 className="font-serif-display text-2xl font-light">Static banner sections</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Add a grid of uploaded images. Set the rows, columns, and the size of each image. The section joins the arrangement list so you can move it.
      </p>
      <div className="mt-4 space-y-4">
        {banners.map((banner, index) => {
          const cap = banner.rows * banner.columns
          return (
            <article key={banner.key} className="rounded-2xl border border-sand-soft p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block min-w-48 flex-1">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Title</span>
                  <input value={banner.title} aria-label={`Banner section ${index + 1} title`} onChange={(e) => update(banner.key, { title: e.target.value })} className="mt-1 w-full rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                </label>
                <label className="block">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Columns</span>
                  <input type="number" min={1} max={6} value={banner.columns} aria-label={`Banner section ${index + 1} columns`} onChange={(e) => update(banner.key, { columns: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })} className="mt-1 w-24 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                </label>
                <label className="block">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Rows</span>
                  <input type="number" min={1} max={6} value={banner.rows} aria-label={`Banner section ${index + 1} rows`} onChange={(e) => update(banner.key, { rows: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })} className="mt-1 w-24 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                </label>
                <label className="block">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Image width</span>
                  <input type="number" min={8} max={90} step={0.1} value={banner.widthVw} aria-label={`Banner section ${index + 1} width`} onChange={(e) => update(banner.key, { widthVw: e.target.value })} className="mt-1 w-28 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                </label>
                <label className="block">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">Image height</span>
                  <input type="number" min={8} max={120} step={0.1} value={banner.heightVw} aria-label={`Banner section ${index + 1} height`} onChange={(e) => update(banner.key, { heightVw: e.target.value })} className="mt-1 w-28 rounded-full border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra" />
                </label>
              </div>
              <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">{banner.images.length} of {cap} images</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {banner.images.map((src, imageIndex) => (
                  <button key={`${src}-${imageIndex}`} type="button" onClick={() => update(banner.key, { images: banner.images.filter((_, i) => i !== imageIndex) })} className="relative">
                    <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-noir/70 text-center font-mono-tech text-[8px] uppercase tracking-[0.12em] text-paper">Remove</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="block font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  Upload image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={`Upload banner section ${index + 1}`}
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      void upload(banner.key, file)
                    }}
                  />
                </label>
                <button type="button" onClick={() => setBanners((rows) => rows.filter((row) => row.key !== banner.key))} className="rounded-full border border-sand px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.12em]">Remove section</button>
              </div>
            </article>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBanners((rows) => [...rows, { key: `new-${Date.now()}`, title: 'Banner', columns: 3, rows: 1, widthVw: '24', heightVw: '16', images: [] }])}
          className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]"
        >
          Add a banner section
        </button>
        <button type="button" disabled={busy || saving} onClick={() => void save()} className="rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
          Save banner sections
        </button>
      </div>
    </section>
  )
}

