import { prisma } from './prisma.js'

const CURRENCY_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
const CURRENCY_API_FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json'

export interface PricingQuote {
  countryCode: string | null
  countryName: string | null
  currency: string
  currencyName: string
  rateToUsd: number
  source: 'auto' | 'override' | 'default'
  fetchedAt: string | null
}

export function effectiveRate(row: { rateToUsd: number; overrideRate: number | null; source: string }): {
  rate: number
  source: 'auto' | 'override'
} {
  if (row.overrideRate != null && row.overrideRate > 0) {
    return { rate: row.overrideRate, source: 'override' }
  }
  return { rate: row.rateToUsd, source: 'auto' }
}

export function convertFromUsd(usdAmount: number, rateToUsd: number): number {
  return Math.round(usdAmount * rateToUsd * 100) / 100
}

async function fetchUsdRates(): Promise<Record<string, number>> {
  for (const url of [CURRENCY_API, CURRENCY_API_FALLBACK]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
      if (!res.ok) continue
      const json = (await res.json()) as { usd?: Record<string, number> }
      if (json.usd && typeof json.usd === 'object') return json.usd
    } catch {
      // try next source
    }
  }
  throw new Error('Unable to fetch live exchange rates')
}

export async function syncExchangeRates(): Promise<{ updated: number; currencies: string[] }> {
  const live = await fetchUsdRates()
  const countries = await prisma.country.findMany({ where: { enabled: true } })
  const needed = new Set(countries.map((c) => c.currency.toLowerCase()))
  needed.add('usd')

  const now = new Date()
  const currencies: string[] = []

  for (const code of needed) {
    const upper = code.toUpperCase()
    const liveRate = code === 'usd' ? 1 : live[code]
    if (liveRate == null || liveRate <= 0) continue

    const existing = await prisma.exchangeRate.findUnique({ where: { currency: upper } })
    await prisma.exchangeRate.upsert({
      where: { currency: upper },
      create: {
        currency: upper,
        rateToUsd: liveRate,
        source: 'auto',
        fetchedAt: now,
      },
      update: {
        rateToUsd: liveRate,
        fetchedAt: now,
        source: existing?.overrideRate ? existing.source : 'auto',
      },
    })
    currencies.push(upper)
  }

  return { updated: currencies.length, currencies }
}

export async function pricingForCountry(countryCode?: string | null): Promise<PricingQuote> {
  const code = countryCode?.toUpperCase()
  const country = code
    ? await prisma.country.findUnique({ where: { code } })
    : null

  const currency = country?.enabled ? country.currency : 'USD'
  const rateRow = await prisma.exchangeRate.findUnique({ where: { currency } })

  if (!rateRow) {
    return {
      countryCode: country?.code ?? null,
      countryName: country?.name ?? null,
      currency: 'USD',
      currencyName: 'US Dollar',
      rateToUsd: 1,
      source: 'default',
      fetchedAt: null,
    }
  }

  const { rate, source } = effectiveRate(rateRow)
  return {
    countryCode: country?.code ?? null,
    countryName: country?.name ?? null,
    currency,
    currencyName: country?.currencyName ?? currency,
    rateToUsd: rate,
    source,
    fetchedAt: rateRow.fetchedAt?.toISOString() ?? null,
  }
}
