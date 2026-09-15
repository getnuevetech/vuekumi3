export const QUOTE_QUEUE_STATUSES = ['pending', 'quoted', 'accepted', 'declined'] as const
export type QuoteQueueStatus = (typeof QUOTE_QUEUE_STATUSES)[number]

const RANK: Record<string, number> = { pending: 0, quoted: 1, declined: 2, accepted: 3 }

export function parseQuoteStatus(value: unknown): QuoteQueueStatus | undefined {
  if (typeof value !== 'string') return undefined
  return (QUOTE_QUEUE_STATUSES as readonly string[]).includes(value) ? (value as QuoteQueueStatus) : undefined
}

export function sortQuotesForQueue<T extends { status: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.createdAt.localeCompare(a.createdAt),
  )
}
