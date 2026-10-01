import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DEFAULT_SITE_CONTENT, STATIC_PANELS, siteFontFamily, type SiteContent, type SiteFacts, type SitePanelPublic, type StaticPanelKey } from '@vuekumi/shared'
import { api } from '../api/client'
import { publicQueryKeys } from '../lib/query-keys'

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
        credit: isDirectImageRef(slide.imageRef) ? slide.credit : '',
        title: '',
        country: '',
        contributorName: '',
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

const FALLBACK: SiteState = {
  content: DEFAULT_SITE_CONTENT,
  logoUrl: null,
  facts: DEFAULT_FACTS,
  panels: fallbackPanels(),
  ready: false,
}

const SiteContentContext = createContext<SiteState>(FALLBACK)

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: publicQueryKeys.site,
    queryFn: () => api.site(),
  })

  const state = useMemo<SiteState>(() => {
    if (query.data) {
      return {
        content: query.data.content,
        logoUrl: query.data.logoUrl,
        facts: query.data.facts,
        panels: query.data.panels,
        ready: true,
      }
    }
    return {
      ...FALLBACK,
      panels: fallbackPanels(),
      ready: query.isFetched || query.isError,
    }
  }, [query.data, query.isFetched, query.isError])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--font-display', siteFontFamily(state.content.typography.heading))
    root.style.setProperty('--font-body', siteFontFamily(state.content.typography.body))
  }, [state.content.typography.heading, state.content.typography.body])

  return <SiteContentContext.Provider value={state}>{children}</SiteContentContext.Provider>
}

export function useSiteContent() {
  return useContext(SiteContentContext)
}
