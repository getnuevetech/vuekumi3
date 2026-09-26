import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SITE_CONTENT, STATIC_PANELS, type SiteContent, type SiteFacts, type SitePanelPublic, type StaticPanelKey } from '@vuekumi/shared'
import { api } from '../api/client'

const DEFAULT_FACTS: SiteFacts = { photographerPct: 50, payoutMinimumUsd: 10 }

function isDirectImageRef(ref: string) {
  return ref.startsWith('/') || /^https?:\/\//i.test(ref)
}

function fallbackPanels(): Record<StaticPanelKey, SitePanelPublic> {
  const panels = {} as Record<StaticPanelKey, SitePanelPublic>
  for (const panel of STATIC_PANELS) {
    const source = DEFAULT_SITE_CONTENT.panels[panel.key]
    panels[panel.key] = {
      intervalSec: source.intervalSec,
      slides: source.slides.map((slide) => ({
        src: isDirectImageRef(slide.imageRef) ? slide.imageRef : null,
        quote: slide.quote,
        credit: slide.credit,
      })),
    }
  }
  return panels
}

type SiteState = {
  content: SiteContent
  logoUrl: string | null
  facts: SiteFacts
  panels: Record<StaticPanelKey, SitePanelPublic>
  ready: boolean
}

const SiteContentContext = createContext<SiteState>({
  content: DEFAULT_SITE_CONTENT,
  logoUrl: null,
  facts: DEFAULT_FACTS,
  panels: fallbackPanels(),
  ready: false,
})

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteState>({
    content: DEFAULT_SITE_CONTENT,
    logoUrl: null,
    facts: DEFAULT_FACTS,
    panels: fallbackPanels(),
    ready: false,
  })

  useEffect(() => {
    api.site()
      .then((page) => setState({
        content: page.content,
        logoUrl: page.logoUrl,
        facts: page.facts,
        panels: page.panels,
        ready: true,
      }))
      .catch(() => setState((current) => ({ ...current, ready: true })))
  }, [])

  return <SiteContentContext.Provider value={state}>{children}</SiteContentContext.Provider>
}

export function useSiteContent() {
  return useContext(SiteContentContext)
}
