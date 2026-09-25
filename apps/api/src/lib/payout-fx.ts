import type { EarningsPayoutQuote } from '@vuekumi/shared'
import { convertFromUsd } from './fx.js'
import { normalizeSecret, paymentSecrets, usableStripeSecret } from './payments-config.js'
import { prisma } from './prisma.js'
import { decryptSecret } from './settings.js'

export type PayoutRateSource = 'primary' | 'alternate'

export interface PayoutGatewayRef {
  id: string
  name: string
  slug: string
  kind: string
  countries: string[]
  currencies: string[]
  enabled: boolean
  configEnc?: string | null
}

export interface PayoutRateAttempt {
  gateway: PayoutGatewayRef
  role: PayoutRateSource
  rateToUsd: number | null
}

const PAYOUT_KINDS = new Set(['payout', 'both'])

export function isPayoutGateway(kind: string): boolean {
  return PAYOUT_KINDS.has(kind)
}

export function partnerAdapter(slug: string, name: string): 'flutterwave' | 'stripe' | null {
  const key = `${slug} ${name}`.toLowerCase()
  if (key.includes('flutterwave')) return 'flutterwave'
  if (key.includes('stripe')) return 'stripe'
  return null
}

function coversCurrency(gateway: PayoutGatewayRef, currency: string): boolean {
  if (gateway.currencies.length === 0) return true
  return gateway.currencies.some((code) => code.toUpperCase() === currency)
}

function countryCodes(gateway: PayoutGatewayRef): string[] {
  return gateway.countries.map((code) => code.toUpperCase())
}

/**
 * Primary partner first, then other payout partners that cover this country,
 * then payout partners elsewhere in the same region that quote this currency.
 * Checkout-only gateways are not payout partners.
 */
export function orderPayoutPartners(input: {
  countryCode: string
  regionCountryCodes: string[]
  currency: string
  primaryId: string | null
  gateways: PayoutGatewayRef[]
}): PayoutGatewayRef[] {
  const code = input.countryCode.toUpperCase()
  const currency = input.currency.toUpperCase()
  const region = new Set(input.regionCountryCodes.map((item) => item.toUpperCase()))
  const payoutGateways = input.gateways.filter((gateway) => gateway.enabled && isPayoutGateway(gateway.kind))
  const assigned = input.primaryId
    ? payoutGateways.find((gateway) => gateway.id === input.primaryId)
    : undefined
  const preferQuotable = (a: PayoutGatewayRef, b: PayoutGatewayRef) => {
    const rank = Number(partnerAdapter(a.slug, a.name) == null) - Number(partnerAdapter(b.slug, b.name) == null)
    return rank || a.name.localeCompare(b.name)
  }
  const sameCountry = payoutGateways
    .filter((gateway) => countryCodes(gateway).includes(code) && coversCurrency(gateway, currency))
    .sort(preferQuotable)
  const regional = payoutGateways
    .filter((gateway) => {
      const codes = countryCodes(gateway)
      if (codes.length === 0 || codes.includes(code)) return false
      return codes.some((item) => region.has(item)) && coversCurrency(gateway, currency)
    })
    .sort(preferQuotable)
  const ordered: PayoutGatewayRef[] = []
  const seen = new Set<string>()
  for (const gateway of [assigned, ...sameCountry, ...regional]) {
    if (!gateway || seen.has(gateway.id)) continue
    seen.add(gateway.id)
    ordered.push(gateway)
  }
  return ordered
}

/** Local units of `currency` for 1 USD. Flutterwave returns destination amount for the requested source amount. */
export function parseFlutterwaveRate(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const data = (body as { status?: string; data?: unknown }).data
  if ((body as { status?: string }).status && (body as { status?: string }).status !== 'success') return null
  if (!data || typeof data !== 'object') return null
  const row = data as {
    rate?: unknown
    source?: { amount?: unknown }
    destination?: { amount?: unknown }
  }
  const sourceAmount = typeof row.source?.amount === 'number' ? row.source.amount : null
  const destinationAmount = typeof row.destination?.amount === 'number' ? row.destination.amount : null
  if (sourceAmount && sourceAmount > 0 && destinationAmount && destinationAmount > 0) {
    return destinationAmount / sourceAmount
  }
  if (typeof row.rate === 'number' && row.rate > 0) return row.rate
  return null
}

/** Stripe exchange_rates: units of the named currency for 1 USD. */
export function parseStripeUsdRate(body: unknown, currency: string): number | null {
  if (!body || typeof body !== 'object') return null
  const rates = (body as { rates?: unknown }).rates
  if (!rates || typeof rates !== 'object') return null
  const value = (rates as Record<string, unknown>)[currency.toLowerCase()]
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function pickPayoutRate(attempts: PayoutRateAttempt[]): {
  gateway: PayoutGatewayRef
  source: PayoutRateSource
  rateToUsd: number
} | null {
  const hit = attempts.find((attempt) => attempt.rateToUsd != null && attempt.rateToUsd > 0)
  if (!hit || hit.rateToUsd == null) return null
  return { gateway: hit.gateway, source: hit.role, rateToUsd: hit.rateToUsd }
}

type FetchLike = typeof fetch

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchPartnerRate(input: {
  gateway: PayoutGatewayRef
  currency: string
  secret: string
  fetchImpl?: FetchLike
}): Promise<number | null> {
  const adapter = partnerAdapter(input.gateway.slug, input.gateway.name)
  const secret = normalizeSecret(input.secret)
  if (!adapter || !secret) return null
  const currency = input.currency.toUpperCase()
  if (currency === 'USD') return 1
  const fetchImpl = input.fetchImpl ?? fetch
  try {
    if (adapter === 'flutterwave') {
      const url = new URL('https://api.flutterwave.com/v3/transfers/rates')
      url.searchParams.set('amount', '1')
      url.searchParams.set('destination_currency', currency)
      url.searchParams.set('source_currency', 'USD')
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) return null
      return parseFlutterwaveRate(await readJson(res))
    }
    const res = await fetchImpl('https://api.stripe.com/v1/exchange_rates/usd', {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    return parseStripeUsdRate(await readJson(res), currency)
  } catch {
    return null
  }
}

function gatewaySecret(gateway: PayoutGatewayRef, secrets: { flutterwaveSecret: string; stripeSecret: string }): string {
  if (gateway.configEnc) {
    try {
      const own = normalizeSecret(decryptSecret(gateway.configEnc))
      if (own) return own
    } catch {
      // A stored key that cannot be read falls through to the matching settings key.
    }
  }
  const adapter = partnerAdapter(gateway.slug, gateway.name)
  if (adapter === 'flutterwave') return secrets.flutterwaveSecret
  if (adapter === 'stripe') return usableStripeSecret(secrets.stripeSecret)
  return ''
}

function unavailableQuote(input: {
  countryCode: string | null
  countryName: string | null
  currency: string
  currencyName: string
}): EarningsPayoutQuote {
  return {
    countryCode: input.countryCode,
    countryName: input.countryName,
    currency: input.currency,
    currencyName: input.currencyName,
    rateToUsd: null,
    partnerName: null,
    partnerSlug: null,
    source: 'unavailable',
    fetchedAt: null,
  }
}

function usdQuote(countryCode: string | null, countryName: string | null): EarningsPayoutQuote {
  return {
    countryCode,
    countryName,
    currency: 'USD',
    currencyName: 'US Dollar',
    rateToUsd: 1,
    partnerName: null,
    partnerSlug: null,
    source: 'usd',
    fetchedAt: null,
  }
}

export async function syncPayoutRates(options?: {
  countryCodes?: string[]
  fetchImpl?: FetchLike
}): Promise<{ updated: number; unchanged: number }> {
  const countries = await prisma.country.findMany({
    where: {
      enabled: true,
      ...(options?.countryCodes?.length
        ? { code: { in: options.countryCodes.map((code) => code.toUpperCase()) } }
        : {}),
    },
    include: { payoutConfig: true },
    orderBy: { code: 'asc' },
  })
  const gateways = await prisma.paymentGateway.findMany({ orderBy: { createdAt: 'asc' } })
  const secrets = await paymentSecrets()
  const byRegion = new Map<string, string[]>()
  for (const country of countries) {
    const list = byRegion.get(country.region) ?? []
    list.push(country.code)
    byRegion.set(country.region, list)
  }
  // Regional fallbacks need every country in the region, including ones outside this sync.
  if (options?.countryCodes?.length) {
    const regions = [...new Set(countries.map((country) => country.region))]
    const siblings = await prisma.country.findMany({
      where: { region: { in: regions } },
      select: { code: true, region: true },
    })
    for (const sibling of siblings) {
      const list = byRegion.get(sibling.region) ?? []
      if (!list.includes(sibling.code)) list.push(sibling.code)
      byRegion.set(sibling.region, list)
    }
  }

  const rateCache = new Map<string, number | null>()
  let updated = 0
  let unchanged = 0

  for (const country of countries) {
    if (country.currency.toUpperCase() === 'USD') {
      unchanged += 1
      continue
    }
    const ordered = orderPayoutPartners({
      countryCode: country.code,
      regionCountryCodes: byRegion.get(country.region) ?? [country.code],
      currency: country.currency,
      primaryId: country.payoutConfig?.gatewayId ?? null,
      gateways,
    })
    const attempts: PayoutRateAttempt[] = []
    for (const [index, gateway] of ordered.entries()) {
      const adapter = partnerAdapter(gateway.slug, gateway.name)
      const secret = gatewaySecret(gateway, secrets)
      const cacheKey = `${gateway.id}:${country.currency.toUpperCase()}`
      let rate: number | null
      if (rateCache.has(cacheKey)) {
        rate = rateCache.get(cacheKey) ?? null
      } else if (!adapter || !secret) {
        rate = null
        rateCache.set(cacheKey, null)
      } else {
        rate = await fetchPartnerRate({
          gateway,
          currency: country.currency,
          secret,
          fetchImpl: options?.fetchImpl,
        })
        rateCache.set(cacheKey, rate)
      }
      attempts.push({ gateway, role: index === 0 ? 'primary' : 'alternate', rateToUsd: rate })
    }
    const picked = pickPayoutRate(attempts)
    if (!picked) {
      unchanged += 1
      continue
    }
    const rateToUsd = Math.round(picked.rateToUsd * 1_000_000) / 1_000_000
    await prisma.payoutFxRate.upsert({
      where: { countryCode: country.code },
      create: {
        countryCode: country.code,
        currency: country.currency.toUpperCase(),
        rateToUsd,
        gatewayId: picked.gateway.id,
        partnerName: picked.gateway.name,
        partnerSlug: picked.gateway.slug,
        source: picked.source,
        fetchedAt: new Date(),
      },
      update: {
        currency: country.currency.toUpperCase(),
        rateToUsd,
        gatewayId: picked.gateway.id,
        partnerName: picked.gateway.name,
        partnerSlug: picked.gateway.slug,
        source: picked.source,
        fetchedAt: new Date(),
      },
    })
    updated += 1
  }

  return { updated, unchanged }
}

export async function payoutQuoteForCountry(countryCode: string | null | undefined): Promise<EarningsPayoutQuote> {
  const code = countryCode?.trim().toUpperCase()
  if (!code) {
    return unavailableQuote({
      countryCode: null,
      countryName: null,
      currency: 'USD',
      currencyName: 'US Dollar',
    })
  }
  const country = await prisma.country.findUnique({
    where: { code },
    include: { payoutRate: true },
  })
  if (!country) {
    return unavailableQuote({
      countryCode: code,
      countryName: null,
      currency: 'USD',
      currencyName: 'US Dollar',
    })
  }
  if (country.currency.toUpperCase() === 'USD') return usdQuote(country.code, country.name)
  const rate = country.payoutRate
  if (!rate || rate.rateToUsd <= 0 || rate.currency.toUpperCase() !== country.currency.toUpperCase()) {
    const [config, gateways, siblings] = await Promise.all([
      prisma.countryPayoutConfig.findUnique({ where: { countryCode: country.code } }),
      prisma.paymentGateway.findMany({ where: { enabled: true }, orderBy: { createdAt: 'asc' } }),
      prisma.country.findMany({ where: { region: country.region }, select: { code: true } }),
    ])
    const partner = orderPayoutPartners({
      countryCode: country.code,
      regionCountryCodes: siblings.map((row) => row.code),
      currency: country.currency,
      primaryId: config?.gatewayId ?? null,
      gateways,
    })[0]
    return {
      ...unavailableQuote({
        countryCode: country.code,
        countryName: country.name,
        currency: country.currency.toUpperCase(),
        currencyName: country.currencyName,
      }),
      partnerName: partner?.name ?? null,
      partnerSlug: partner?.slug ?? null,
    }
  }
  const source: EarningsPayoutQuote['source'] = rate.source === 'alternate' ? 'alternate' : 'primary'
  return {
    countryCode: country.code,
    countryName: country.name,
    currency: rate.currency.toUpperCase(),
    currencyName: country.currencyName,
    rateToUsd: rate.rateToUsd,
    partnerName: rate.partnerName,
    partnerSlug: rate.partnerSlug,
    source,
    fetchedAt: rate.fetchedAt.toISOString(),
  }
}

export async function payoutQuoteForContributor(userId: string): Promise<EarningsPayoutQuote> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true },
  })
  let code = user?.country?.trim().toUpperCase() || null
  if (!code) {
    const method = await prisma.payoutMethod.findFirst({
      where: { userId, isDefault: true },
      select: { country: true },
    })
    code = method?.country?.trim().toUpperCase() || null
  }
  return payoutQuoteForCountry(code)
}

export function convertEarnings(usd: number, quote: EarningsPayoutQuote): number | null {
  if (quote.rateToUsd == null || quote.source === 'unavailable') return null
  if (quote.currency === 'USD') return usd
  return convertFromUsd(usd, quote.rateToUsd)
}
