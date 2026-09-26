import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { MenuFont, SiteMenuAudience } from '@vuekumi/shared'
import { toast } from 'sonner'
import {
  HOME_ICON_KEYS,
  MENU_FONTS,
  PHOTO_CATEGORIES,
  SITE_MENU_AUDIENCES,
  STATIC_PANELS,
  sortMenuLinks,
  type HomeIconKey,
  type SiteContent,
  type StaticPanelKey,
} from '@vuekumi/shared'
import { api, ApiError, type AdminContentRow } from '../api/client'
import { menuPathChoices, menuPathLabel } from '../lib/menu-paths'
import { AdminShell } from './Admin'

const field = 'mt-1 w-full rounded-2xl border border-sand-soft px-4 py-2 text-sm outline-none focus:border-terra'
const label = 'font-mono-tech text-[10px] uppercase tracking-[0.14em] text-ink-faint'

const MENU_AUDIENCE_LABEL: Record<SiteMenuAudience, string> = {
  always: 'Everyone',
  signed_out: 'Signed out',
  signed_in: 'Signed in',
  buyer: 'Buyers',
  creator: 'Photographers and contributors',
  model: 'Models',
  agency: 'Agencies',
  admin: 'Admins',
}

function readSort(value: string, fallback: number) {
  const raw = Number(value)
  return Number.isFinite(raw) ? Math.max(0, Math.min(999, Math.round(raw))) : fallback
}

function MenuPathField({ value, ariaLabel, onChange }: { value: string; ariaLabel: string; onChange: (value: string) => void }) {
  return (
    <select value={value} aria-label={ariaLabel} className={field} onChange={(e) => onChange(e.target.value)}>
      {menuPathChoices(value).map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.path} value={option.path}>{menuPathLabel(option)}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function readInterval(value: string, fallback: number) {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return fallback
  return Math.max(3, Math.min(30, Math.round(raw)))
}

function previewSrc(ref: string, previews: Record<string, string>) {
  if (previews[ref]) return previews[ref]
  if (ref.startsWith('/') || /^https?:\/\//i.test(ref)) return ref
  return null
}

function PageImagesEditor({
  content,
  setContent,
  previews,
  setPreviews,
}: {
  content: SiteContent
  setContent: (next: SiteContent) => void
  previews: Record<string, string>
  setPreviews: (next: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
}) {
  const [active, setActive] = useState<StaticPanelKey>(STATIC_PANELS[0].key)
  const [selected, setSelected] = useState(0)
  const [category, setCategory] = useState<string>(PHOTO_CATEGORIES[0])
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalog, setCatalog] = useState<AdminContentRow[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.adminContent({ category, status: 'active', page: catalogPage })
      .then((data) => {
        if (cancelled) return
        setCatalog(data.items)
        setCatalogTotal(data.total)
        setPreviews((current) => {
          const next = { ...current }
          for (const photo of data.items) next[photo.id] = photo.src
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Failed to load photographs')
      })
    return () => { cancelled = true }
  }, [category, catalogPage, setPreviews])

  const panel = content.panels[active]
  const panelLabel = STATIC_PANELS.find((item) => item.key === active)?.label ?? 'Page'

  const writePanel = (nextSlides: SiteContent['panels'][StaticPanelKey]['slides'], intervalSec = panel.intervalSec) => {
    setContent({
      ...content,
      panels: {
        ...content.panels,
        [active]: { intervalSec, slides: nextSlides },
      },
    })
  }

  const usePhoto = (photo: AdminContentRow, mode: 'replace' | 'add') => {
    setPreviews((current) => ({ ...current, [photo.id]: photo.src }))
    if (mode === 'add') {
      if (panel.slides.length >= 8) return
      const slides = [...panel.slides, { imageRef: photo.id, quote: '', credit: '' }]
      writePanel(slides)
      setSelected(slides.length - 1)
      return
    }
    const index = Math.min(selected, panel.slides.length - 1)
    writePanel(panel.slides.map((slide, i) => i === index ? { ...slide, imageRef: photo.id } : slide))
  }

  return (
    <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
      <h2 className="font-serif-display text-2xl font-light">Page images</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Decorative photographs on static pages. Each page can show several images, changing on the interval you set. Choose a live photograph, then save site content.
      </p>
      <div className="mt-4 space-y-8">
        {STATIC_PANELS.map((item) => {
          const source = content.panels[item.key]
          const isActive = item.key === active
          return (
            <div key={item.key}>
              <h3 className="font-serif-display text-xl font-light">{item.label}</h3>
              <label className="mt-3 block max-w-xs">
                <span className={label}>Change every (seconds)</span>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={source.intervalSec}
                  aria-label={`${item.label} interval`}
                  onChange={(e) => {
                    const intervalSec = readInterval(e.target.value, source.intervalSec)
                    setContent({
                      ...content,
                      panels: { ...content.panels, [item.key]: { ...source, intervalSec } },
                    })
                  }}
                  className={field}
                />
              </label>
              <div className="mt-4 space-y-3">
                {source.slides.map((slide, index) => {
                  const src = previewSrc(slide.imageRef, previews)
                  const chosen = isActive && index === Math.min(selected, source.slides.length - 1)
                  return (
                    <div
                      key={`${item.key}-slide-${index}`}
                      className={`grid gap-3 rounded-2xl border p-3 md:grid-cols-[5rem_1fr_1fr_auto] ${chosen ? 'border-terra' : 'border-sand-soft'}`}
                    >
                      <button
                        type="button"
                        onClick={() => { setActive(item.key); setSelected(index) }}
                        className="text-left"
                        aria-label={`${item.label} image ${index + 1}`}
                      >
                        {src ? (
                          <img src={src} alt="" className="h-20 w-16 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-20 w-16 items-center justify-center rounded-lg bg-cream text-[10px] text-ink-faint">Photo</span>
                        )}
                      </button>
                      <label className="block">
                        <span className={label}>Quote</span>
                        <textarea
                          value={slide.quote}
                          rows={2}
                          maxLength={240}
                          aria-label={`${item.label} quote ${index + 1}`}
                          onChange={(e) => {
                            const quote = e.target.value
                            const slides = source.slides.map((row, i) => i === index ? { ...row, quote } : row)
                            setContent({ ...content, panels: { ...content.panels, [item.key]: { ...source, slides } } })
                          }}
                          className={field}
                        />
                      </label>
                      <label className="block">
                        <span className={label}>Credit</span>
                        <input
                          value={slide.credit}
                          maxLength={80}
                          aria-label={`${item.label} credit ${index + 1}`}
                          onChange={(e) => {
                            const credit = e.target.value
                            const slides = source.slides.map((row, i) => i === index ? { ...row, credit } : row)
                            setContent({ ...content, panels: { ...content.panels, [item.key]: { ...source, slides } } })
                          }}
                          className={field}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={source.slides.length <= 1}
                        onClick={() => {
                          const slides = source.slides.filter((_, i) => i !== index)
                          setContent({ ...content, panels: { ...content.panels, [item.key]: { ...source, slides } } })
                          if (item.key === active) setSelected((value) => Math.max(0, Math.min(value, slides.length - 1)))
                        }}
                        className="self-start rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <h3 className="font-serif-display text-xl font-light">Choose a photograph</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Use on selected replaces image {Math.min(selected, panel.slides.length - 1) + 1} on {panelLabel}. Add image keeps the quote blank.
        </p>
        <label className="mt-4 block max-w-xs">
          <span className={label}>Category</span>
          <select
            value={category}
            aria-label="Page image category"
            onChange={(e) => {
              setCategory(e.target.value)
              setCatalogPage(1)
            }}
            className={field}
          >
            {PHOTO_CATEGORIES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-sm text-ink-soft">{catalogTotal} live photographs in {category}.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((photo) => (
            <article key={photo.id} className="rounded-2xl border border-sand-soft p-3">
              <img src={photo.src} alt="" className="h-36 w-full rounded-xl object-cover" />
              <p className="mt-2 text-sm font-medium">{photo.title}</p>
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {photo.photographerName ?? photo.photographer} · {photo.country}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => usePhoto(photo, 'replace')}
                  className="rounded-full bg-ink px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-paper hover:bg-terra"
                >
                  Use on selected
                </button>
                <button
                  type="button"
                  disabled={panel.slides.length >= 8}
                  onClick={() => usePhoto(photo, 'add')}
                  className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                >
                  Add image
                </button>
              </div>
            </article>
          ))}
        </div>
        {catalog.length === 0 && <p className="mt-4 text-sm text-ink-soft">No live photographs in this category.</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={catalogPage <= 1} onClick={() => setCatalogPage((n) => Math.max(1, n - 1))} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40">Previous</button>
          <button type="button" disabled={catalogPage * 25 >= catalogTotal} onClick={() => setCatalogPage((n) => n + 1)} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  )
}

function TextField({ title, value, onChange, area = false }: { title: string; value: string; onChange: (value: string) => void; area?: boolean }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {area ? (
        <textarea value={value} rows={3} onChange={(e) => onChange(e.target.value)} className={field} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={field} />
      )}
    </label>
  )
}

export default function AdminSite({ menuOnly = false }: { menuOnly?: boolean }) {
  const [content, setContent] = useState<SiteContent | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.adminSite()
      .then((page) => {
        setContent(page.content)
        const next: Record<string, string> = {}
        for (const panel of STATIC_PANELS) {
          page.content.panels[panel.key].slides.forEach((slide, index) => {
            const src = page.panels?.[panel.key]?.slides[index]?.src
            if (slide.imageRef && src) next[slide.imageRef] = src
          })
        }
        setPreviews(next)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load site content'))
  }, [])

  const save = async () => {
    if (!content) return
    setBusy(true)
    try {
      const next = await api.saveSite(content)
      setContent(next.content)
      toast.success('Site content saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (!content) {
    return (
      <AdminShell subtitle={menuOnly ? 'Links in the public header and footer.' : 'Menu, logo, and the words on the public site.'}>
        <p className="text-sm text-ink-soft">Loading site content…</p>
      </AdminShell>
    )
  }

  const set = (next: SiteContent) => setContent(next)
  const home = content.home
  const pages = content.pages

  return (
    <AdminShell subtitle={menuOnly ? 'Links in the public header and footer.' : 'Menu, logo, and the words on the public site.'}>
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-terra">{menuOnly ? 'Menu' : 'Site'}</p>
      <h1 className="font-serif-display mt-2 text-4xl font-light tracking-tight">{menuOnly ? 'Menu.' : 'Homepage & pages.'}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        {menuOnly ? (
          <>
            These are the links in the public header, the account icon menu, and the footer. Who sees it controls whether a link is shown to everyone, or only to buyers, creators, models, agencies, or admins.
            The other homepage words are on <Link to="/admin/site" className="text-terra">Site content</Link>.
          </>
        ) : (
          <>
            These words, the menu, the logo, and the photographs on static pages are what visitors see. Photographs in the homepage strips stay on <Link to="/admin/homepage" className="text-terra">Homepage</Link>.
            Plan prices stay on <Link to="/admin/plans" className="text-terra">Plans</Link>.
            The header links themselves are also on <Link to="/admin/menu" className="text-terra">Menu</Link>.
            Use {'{share}'}, {'{minimum}'}, {'{photos}'}, and {'{countries}'} where a live number should appear.
          </>
        )}
      </p>
      <button type="button" disabled={busy} onClick={() => void save()} className="mt-6 rounded-full bg-ink px-5 py-2 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-terra disabled:opacity-50">
        {menuOnly ? 'Save menu' : 'Save site content'}
      </button>

      <section id="menu" className="mt-10 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Header menu</h2>
        <p className="mt-1 text-sm text-ink-soft">Type the label, then choose the page from the list. Each choice names the page and shows its path, including every photograph category. Lower numbers appear first. The same number keeps the current order. Font and size apply to the top menu.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={label}>Menu font</span>
            <select
              value={content.menuStyle.font}
              onChange={(e) => set({ ...content, menuStyle: { ...content.menuStyle, font: e.target.value as MenuFont } })}
              className={field}
              aria-label="Menu font"
            >
              {MENU_FONTS.map((font) => (
                <option key={font} value={font}>{font === 'condensed' ? 'Condensed' : font === 'serif' ? 'Serif' : 'Mono'}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Menu size (px)</span>
            <input
              type="number"
              min={8}
              max={18}
              value={content.menuStyle.sizePx}
              onChange={(e) => set({ ...content, menuStyle: { ...content.menuStyle, sizePx: Number(e.target.value) } })}
              className={field}
              aria-label="Menu size"
            />
          </label>
        </div>
        <div className="mt-4 space-y-3">
          {content.menu.map((link, index) => (
            <div key={`menu-row-${index}`} className="grid gap-2 md:grid-cols-[5rem_1fr_1fr_16rem_auto]">
              <input
                type="number"
                min={0}
                max={999}
                value={link.sort ?? index + 1}
                onChange={(e) => {
                  const sort = readSort(e.target.value, index + 1)
                  setContent((current) => {
                    if (!current) return current
                    const menu = current.menu.map((row, i) => i === index ? { ...row, sort } : row)
                    return { ...current, menu }
                  })
                }}
                onBlur={(e) => {
                  const sort = readSort(e.currentTarget.value, index + 1)
                  setContent((current) => {
                    if (!current) return current
                    const menu = current.menu.map((row, i) => i === index ? { ...row, sort } : row)
                    return { ...current, menu: sortMenuLinks(menu) }
                  })
                }}
                className={field}
                aria-label={`Menu sort ${index + 1}`}
              />
              <input value={link.label} onChange={(e) => {
                const value = e.target.value
                setContent((current) => {
                  if (!current) return current
                  return { ...current, menu: current.menu.map((row, i) => i === index ? { ...row, label: value } : row) }
                })
              }} className={field} aria-label={`Menu label ${index + 1}`} autoComplete="off" />
              <MenuPathField
                value={link.to}
                ariaLabel={`Menu path ${index + 1}`}
                onChange={(value) => {
                  setContent((current) => {
                    if (!current) return current
                    return { ...current, menu: current.menu.map((row, i) => i === index ? { ...row, to: value } : row) }
                  })
                }}
              />
              <select value={link.audience} onChange={(e) => {
                const menu = content.menu.map((row, i) => i === index ? { ...row, audience: e.target.value as SiteMenuAudience } : row)
                set({ ...content, menu })
              }} className={field} aria-label={`Menu audience ${index + 1}`}>
                {SITE_MENU_AUDIENCES.map((audience) => <option key={audience} value={audience}>{MENU_AUDIENCE_LABEL[audience]}</option>)}
              </select>
              <button type="button" onClick={() => set({ ...content, menu: content.menu.filter((_, i) => i !== index) })} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => {
            const sort = content.menu.reduce((max, link) => Math.max(max, link.sort ?? 0), 0) + 1
            set({ ...content, menu: sortMenuLinks([...content.menu, { label: 'New link', to: '/search', audience: 'always', sort }]) })
          }} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Add menu link</button>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Account menu</h2>
        <p className="mt-1 text-sm text-ink-soft">These items appear when a signed-in visitor hovers the account icon. Choose Log out to sign them out. Lower numbers appear first. Signed-out visitors see the Log in label instead of this menu.</p>
        <div className="mt-4 space-y-3">
          {content.accountMenu.map((link, index) => (
            <div key={`account-row-${index}`} className="grid gap-2 md:grid-cols-[5rem_1fr_1fr_16rem_auto]">
              <input
                type="number"
                min={0}
                max={999}
                value={link.sort ?? index + 1}
                onChange={(e) => {
                  const sort = readSort(e.target.value, index + 1)
                  setContent((current) => {
                    if (!current) return current
                    const accountMenu = current.accountMenu.map((row, i) => i === index ? { ...row, sort } : row)
                    return { ...current, accountMenu }
                  })
                }}
                onBlur={(e) => {
                  const sort = readSort(e.currentTarget.value, index + 1)
                  setContent((current) => {
                    if (!current) return current
                    const accountMenu = current.accountMenu.map((row, i) => i === index ? { ...row, sort } : row)
                    return { ...current, accountMenu: sortMenuLinks(accountMenu) }
                  })
                }}
                className={field}
                aria-label={`Account menu sort ${index + 1}`}
              />
              <input value={link.label} onChange={(e) => {
                const value = e.target.value
                setContent((current) => {
                  if (!current) return current
                  return { ...current, accountMenu: current.accountMenu.map((row, i) => i === index ? { ...row, label: value } : row) }
                })
              }} className={field} aria-label={`Account menu label ${index + 1}`} autoComplete="off" />
              <MenuPathField
                value={link.to}
                ariaLabel={`Account menu path ${index + 1}`}
                onChange={(value) => {
                  setContent((current) => {
                    if (!current) return current
                    return { ...current, accountMenu: current.accountMenu.map((row, i) => i === index ? { ...row, to: value } : row) }
                  })
                }}
              />
              <select value={link.audience} onChange={(e) => {
                const accountMenu = content.accountMenu.map((row, i) => i === index ? { ...row, audience: e.target.value as SiteMenuAudience } : row)
                set({ ...content, accountMenu })
              }} className={field} aria-label={`Account menu audience ${index + 1}`}>
                {SITE_MENU_AUDIENCES.map((audience) => <option key={audience} value={audience}>{MENU_AUDIENCE_LABEL[audience]}</option>)}
              </select>
              <button type="button" disabled={content.accountMenu.length <= 1} onClick={() => set({ ...content, accountMenu: content.accountMenu.filter((_, i) => i !== index) })} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40">Remove</button>
            </div>
          ))}
          <button type="button" disabled={content.accountMenu.length >= 16} onClick={() => {
            const sort = content.accountMenu.reduce((max, link) => Math.max(max, link.sort ?? 0), 0) + 1
            set({ ...content, accountMenu: sortMenuLinks([...content.accountMenu, { label: 'New link', to: '/account', audience: 'signed_in', sort }]) })
          }} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em] disabled:opacity-40">Add account link</button>
        </div>
      </section>

      {!menuOnly && <>
      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Logo</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <TextField title="Name" value={content.brand.name} onChange={(name) => set({ ...content, brand: { ...content.brand, name } })} />
          <TextField title="Accent letters" value={content.brand.accent} onChange={(accent) => set({ ...content, brand: { ...content.brand, accent } })} />
          <TextField title="Logo image URL or photo id" value={content.brand.logoRef ?? ''} onChange={(logoRef) => set({ ...content, brand: { ...content.brand, logoRef: logoRef.trim() || null } })} />
        </div>
        <p className="mt-2 text-sm text-ink-soft">Leave the image blank to keep the aperture mark. A photo id must be a live photograph.</p>
      </section>

      <PageImagesEditor content={content} setContent={set} previews={previews} setPreviews={setPreviews} />

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Header</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField title="Search placeholder" value={content.searchPlaceholder} onChange={(searchPlaceholder) => set({ ...content, searchPlaceholder })} />
          <TextField title="Log in" value={content.actions.login} onChange={(login) => set({ ...content, actions: { ...content.actions, login } })} />
          <TextField title="Log out" value={content.actions.logout} onChange={(logout) => set({ ...content, actions: { ...content.actions, logout } })} />
          <TextField title="Sell button" value={content.actions.sell} onChange={(sell) => set({ ...content, actions: { ...content.actions, sell } })} />
        </div>
      </section>
      </>}

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">{menuOnly ? 'Footer menu' : 'Footer'}</h2>
        {!menuOnly && (
          <div className="mt-4 grid gap-3">
            <TextField title="Blurb" value={content.footer.blurb} area onChange={(blurb) => set({ ...content, footer: { ...content.footer, blurb } })} />
            <TextField title="Copyright line" value={content.footer.copyright} onChange={(copyright) => set({ ...content, footer: { ...content.footer, copyright } })} />
          </div>
        )}
        <div className="mt-4 space-y-3">
          {content.footer.links.map((link, index) => (
            <div key={`footer-row-${index}`} className="grid gap-2 md:grid-cols-[5rem_1fr_1fr_auto]">
              <input
                type="number"
                min={0}
                max={999}
                value={link.sort ?? index + 1}
                aria-label={`Footer sort ${index + 1}`}
                onChange={(e) => {
                  const sort = readSort(e.target.value, index + 1)
                  setContent((current) => {
                    if (!current) return current
                    const links = current.footer.links.map((row, i) => i === index ? { ...row, sort } : row)
                    return { ...current, footer: { ...current.footer, links } }
                  })
                }}
                onBlur={(e) => {
                  const sort = readSort(e.currentTarget.value, index + 1)
                  setContent((current) => {
                    if (!current) return current
                    const links = current.footer.links.map((row, i) => i === index ? { ...row, sort } : row)
                    return { ...current, footer: { ...current.footer, links: sortMenuLinks(links) } }
                  })
                }}
                className={field}
              />
              <input value={link.label} aria-label={`Footer label ${index + 1}`} autoComplete="off" onChange={(e) => {
                const value = e.target.value
                setContent((current) => {
                  if (!current) return current
                  const links = current.footer.links.map((row, i) => i === index ? { ...row, label: value } : row)
                  return { ...current, footer: { ...current.footer, links } }
                })
              }} className={field} />
              <MenuPathField
                value={link.to}
                ariaLabel={`Footer path ${index + 1}`}
                onChange={(value) => {
                  setContent((current) => {
                    if (!current) return current
                    const links = current.footer.links.map((row, i) => i === index ? { ...row, to: value } : row)
                    return { ...current, footer: { ...current.footer, links } }
                  })
                }}
              />
              <button type="button" onClick={() => set({ ...content, footer: { ...content.footer, links: content.footer.links.filter((_, i) => i !== index) } })} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => {
            const sort = content.footer.links.reduce((max, link) => Math.max(max, link.sort ?? 0), 0) + 1
            set({ ...content, footer: { ...content.footer, links: sortMenuLinks([...content.footer.links, { label: 'New link', to: '/search', sort }]) } })
          }} className="rounded-full border border-sand px-4 py-2 font-mono-tech text-[10px] uppercase tracking-[0.14em]">Add footer link</button>
        </div>
      </section>

      {!menuOnly && <>
      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Hero words</h2>
        <div className="mt-4 space-y-4">
          {home.hero.slides.map((slide, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-3">
              <TextField title={`Slide ${index + 1} script`} value={slide.script} onChange={(script) => {
                const slides = home.hero.slides.map((row, i) => i === index ? { ...row, script } : row)
                set({ ...content, home: { ...home, hero: { ...home.hero, slides } } })
              }} />
              <TextField title="Title" value={slide.title} onChange={(title) => {
                const slides = home.hero.slides.map((row, i) => i === index ? { ...row, title } : row)
                set({ ...content, home: { ...home, hero: { ...home.hero, slides } } })
              }} />
              <TextField title="Line" value={slide.sub} area onChange={(sub) => {
                const slides = home.hero.slides.map((row, i) => i === index ? { ...row, sub } : row)
                set({ ...content, home: { ...home, hero: { ...home.hero, slides } } })
              }} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField title="Primary button" value={home.hero.primaryLabel} onChange={(primaryLabel) => set({ ...content, home: { ...home, hero: { ...home.hero, primaryLabel } } })} />
          <TextField title="Primary link" value={home.hero.primaryTo} onChange={(primaryTo) => set({ ...content, home: { ...home, hero: { ...home.hero, primaryTo } } })} />
          <TextField title="Secondary button" value={home.hero.secondaryLabel} onChange={(secondaryLabel) => set({ ...content, home: { ...home, hero: { ...home.hero, secondaryLabel } } })} />
          <TextField title="Secondary link" value={home.hero.secondaryTo} onChange={(secondaryTo) => set({ ...content, home: { ...home, hero: { ...home.hero, secondaryTo } } })} />
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Messages and icons</h2>
        <div className="mt-4 space-y-4">
          {home.messages.map((message, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-[160px_1fr]">
              <label className="block">
                <span className={label}>Icon</span>
                <select value={message.icon} onChange={(e) => {
                  const messages = home.messages.map((row, i) => i === index ? { ...row, icon: e.target.value as HomeIconKey } : row)
                  set({ ...content, home: { ...home, messages } })
                }} className={field}>
                  {HOME_ICON_KEYS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                </select>
              </label>
              <div className="grid gap-3">
                <TextField title="Title" value={message.title} onChange={(title) => {
                  const messages = home.messages.map((row, i) => i === index ? { ...row, title } : row)
                  set({ ...content, home: { ...home, messages } })
                }} />
                <TextField title="Text" value={message.text} area onChange={(text) => {
                  const messages = home.messages.map((row, i) => i === index ? { ...row, text } : row)
                  set({ ...content, home: { ...home, messages } })
                }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Homepage sections</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField title="Categories small line" value={home.categories.kicker} onChange={(kicker) => set({ ...content, home: { ...home, categories: { ...home.categories, kicker } } })} />
          <TextField title="Categories heading" value={home.categories.title} onChange={(title) => set({ ...content, home: { ...home, categories: { ...home.categories, title } } })} />
          <TextField title="Contributor band" value={home.cta.text} onChange={(text) => set({ ...content, home: { ...home, cta: { ...home.cta, text } } })} />
          <TextField title="Contributor band emphasis" value={home.cta.emphasis} onChange={(emphasis) => set({ ...content, home: { ...home, cta: { ...home.cta, emphasis } } })} />
          <TextField title="Library small line" value={home.feed.kicker} onChange={(kicker) => set({ ...content, home: { ...home, feed: { ...home.feed, kicker } } })} />
          <TextField title="Library heading" value={home.feed.title} onChange={(title) => set({ ...content, home: { ...home, feed: { ...home.feed, title } } })} />
          <TextField title="Library heading accent" value={home.feed.titleAccent} onChange={(titleAccent) => set({ ...content, home: { ...home, feed: { ...home.feed, titleAccent } } })} />
          <TextField title="Library browse line" value={home.feed.browseLabel} onChange={(browseLabel) => set({ ...content, home: { ...home, feed: { ...home.feed, browseLabel } } })} />
          <TextField title="Editorial side text" value={home.editorial.side} onChange={(side) => set({ ...content, home: { ...home, editorial: { ...home.editorial, side } } })} />
          <TextField title="Editorial small line" value={home.editorial.kicker} onChange={(kicker) => set({ ...content, home: { ...home, editorial: { ...home.editorial, kicker } } })} />
          <TextField title="Editorial heading" value={home.editorial.title} onChange={(title) => set({ ...content, home: { ...home, editorial: { ...home.editorial, title } } })} />
          <TextField title="Editorial button" value={home.editorial.cta} onChange={(cta) => set({ ...content, home: { ...home, editorial: { ...home.editorial, cta } } })} />
          <TextField title="Royalty label" value={home.editorial.royaltyLabel} onChange={(royaltyLabel) => set({ ...content, home: { ...home, editorial: { ...home.editorial, royaltyLabel } } })} />
          <TextField title="Photographs label" value={home.editorial.photosLabel} onChange={(photosLabel) => set({ ...content, home: { ...home, editorial: { ...home.editorial, photosLabel } } })} />
          <TextField title="Countries label" value={home.editorial.countriesLabel} onChange={(countriesLabel) => set({ ...content, home: { ...home, editorial: { ...home.editorial, countriesLabel } } })} />
          <TextField title="Stats caption" value={home.statsCaption} onChange={(statsCaption) => set({ ...content, home: { ...home, statsCaption } })} />
          <TextField title="Makers small line" value={home.contributors.kicker} onChange={(kicker) => set({ ...content, home: { ...home, contributors: { ...home.contributors, kicker } } })} />
          <TextField title="Makers heading" value={home.contributors.title} onChange={(title) => set({ ...content, home: { ...home, contributors: { ...home.contributors, title } } })} />
          <TextField title="People small line" value={home.models.kicker} onChange={(kicker) => set({ ...content, home: { ...home, models: { ...home.models, kicker } } })} />
          <TextField title="People heading" value={home.models.title} onChange={(title) => set({ ...content, home: { ...home, models: { ...home.models, title } } })} />
          <TextField title="People note" value={home.models.note} onChange={(note) => set({ ...content, home: { ...home, models: { ...home.models, note } } })} />
          <TextField title="Pricing card button" value={home.pricingCta} onChange={(pricingCta) => set({ ...content, home: { ...home, pricingCta } })} />
        </div>
        <div className="mt-4">
          <TextField title="Editorial paragraph" value={home.editorial.body} area onChange={(body) => set({ ...content, home: { ...home, editorial: { ...home.editorial, body } } })} />
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-sand-soft bg-white p-5">
        <h2 className="font-serif-display text-2xl font-light">Other public pages</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField title="Pricing small line" value={pages.pricing.kicker} onChange={(kicker) => set({ ...content, pages: { ...pages, pricing: { ...pages.pricing, kicker } } })} />
          <TextField title="Pricing heading" value={pages.pricing.title} onChange={(title) => set({ ...content, pages: { ...pages, pricing: { ...pages.pricing, title } } })} />
          <TextField title="Pricing emphasis" value={pages.pricing.titleEmphasis} onChange={(titleEmphasis) => set({ ...content, pages: { ...pages, pricing: { ...pages.pricing, titleEmphasis } } })} />
          <TextField title="Creators heading" value={pages.creators.title} onChange={(title) => set({ ...content, pages: { ...pages, creators: { ...pages.creators, title } } })} />
          <TextField title="Models heading" value={pages.models.title} onChange={(title) => set({ ...content, pages: { ...pages, models: { ...pages.models, title } } })} />
          <TextField title="Library page heading" value={pages.search.title} onChange={(title) => set({ ...content, pages: { ...pages, search: { ...pages.search, title } } })} />
          <TextField title="Legal heading" value={pages.legal.title} onChange={(title) => set({ ...content, pages: { ...pages, legal: { ...pages.legal, title } } })} />
          <TextField title="Rights heading" value={pages.rights.title} onChange={(title) => set({ ...content, pages: { ...pages, rights: { ...pages.rights, title } } })} />
          <TextField title="DMCA heading" value={pages.dmca.title} onChange={(title) => set({ ...content, pages: { ...pages, dmca: { ...pages.dmca, title } } })} />
          <TextField title="Report heading" value={pages.report.title} onChange={(title) => set({ ...content, pages: { ...pages, report: { ...pages.report, title } } })} />
        </div>
        <div className="mt-4 grid gap-3">
          <TextField title="Pricing introduction" value={pages.pricing.intro} area onChange={(intro) => set({ ...content, pages: { ...pages, pricing: { ...pages.pricing, intro } } })} />
          <TextField title="Creators introduction" value={pages.creators.intro} area onChange={(intro) => set({ ...content, pages: { ...pages, creators: { ...pages.creators, intro } } })} />
          <TextField title="Models introduction" value={pages.models.intro} area onChange={(intro) => set({ ...content, pages: { ...pages, models: { ...pages.models, intro } } })} />
        </div>
      </section>
      </>}
    </AdminShell>
  )
}
