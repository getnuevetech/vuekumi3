import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SITE_CONTENT, type SiteContent, type SiteFacts } from '@vuekumi/shared'
import { api } from '../api/client'

const DEFAULT_FACTS: SiteFacts = { photographerPct: 50, payoutMinimumUsd: 10 }

type SiteState = {
  content: SiteContent
  logoUrl: string | null
  facts: SiteFacts
  ready: boolean
}

const SiteContentContext = createContext<SiteState>({
  content: DEFAULT_SITE_CONTENT,
  logoUrl: null,
  facts: DEFAULT_FACTS,
  ready: false,
})

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteState>({
    content: DEFAULT_SITE_CONTENT,
    logoUrl: null,
    facts: DEFAULT_FACTS,
    ready: false,
  })

  useEffect(() => {
    api.site()
      .then((page) => setState({ content: page.content, logoUrl: page.logoUrl, facts: page.facts, ready: true }))
      .catch(() => setState((current) => ({ ...current, ready: true })))
  }, [])

  return <SiteContentContext.Provider value={state}>{children}</SiteContentContext.Provider>
}

export function useSiteContent() {
  return useContext(SiteContentContext)
}
