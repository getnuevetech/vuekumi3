import { resolveProvider } from './ai.js'

export type CatalogEngagement = {
  views: number
  favorites: number
  licences: number
  topCategory: string | null
  moderationOlderThan7Days?: number
}

/**
 * Phase 63 — local sentences from counts already stored on photographs.
 * Photo comments are not a stored record, so they are not invented here.
 * The registry purpose is resolved so a row can be saved; catalog rows are
 * not sent to that provider.
 */
export function narrateCatalogEngagement(input: CatalogEngagement): string[] {
  const lines = [
    `${input.views} views, ${input.favorites} favorites, and ${input.licences} licences.`,
  ]
  if (input.topCategory) {
    lines.push(`The busiest category by views is ${input.topCategory}.`)
  } else {
    lines.push('No category has recorded views yet.')
  }
  if (input.moderationOlderThan7Days != null) {
    lines.push(`${input.moderationOlderThan7Days} moderation items have been pending for more than 7 days.`)
  }
  lines.push('This summary is read-only. It does not change an account, a photograph, or a licence.')
  return lines
}

export async function reportingProviderKind(): Promise<'openai' | 'dev'> {
  try {
    const resolved = await resolveProvider('analytics_reporting')
    return resolved.kind === 'openai' ? 'openai' : 'dev'
  } catch {
    return 'dev'
  }
}
