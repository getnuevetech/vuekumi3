export function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

export function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Contributor balances. Sales stay in USD. A payout-partner rate shows the home currency. */
export function formatPayoutMoney(
  usd: number,
  quote?: { currency: string; rateToUsd: number | null; source: string } | null,
) {
  if (!quote || quote.rateToUsd == null || quote.currency === 'USD' || quote.source === 'usd' || quote.source === 'unavailable') {
    return money(usd)
  }
  const local = Math.round(usd * quote.rateToUsd * 100) / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: quote.currency,
      maximumFractionDigits: local >= 100 ? 0 : 2,
    }).format(local)
  } catch {
    return `${quote.currency} ${local.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

/** A number that is already in the payout quote currency. */
export function formatQuotedAmount(
  amount: number,
  quote?: { currency: string; rateToUsd: number | null; source: string } | null,
) {
  if (!quote || quote.rateToUsd == null || quote.currency === 'USD' || quote.source === 'usd' || quote.source === 'unavailable') {
    return money(amount)
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: quote.currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${quote.currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }
}

export function payoutQuoteLine(quote?: {
  countryName: string | null
  currency: string
  currencyName: string
  rateToUsd: number | null
  partnerName: string | null
  source: string
} | null) {
  if (!quote) return 'Earnings stay on the USD ledger until your country is known.'
  if (quote.source === 'usd') return 'These totals are in US dollars, the currency sales are booked in.'
  if (quote.source === 'unavailable' || quote.rateToUsd == null) {
    if (!quote.partnerName) {
      return `These totals stay in US dollars until a payout partner returns a ${quote.currencyName} rate.`
    }
    const where = quote.countryName ? ` for ${quote.countryName}` : ''
    return `${quote.partnerName} is the payout partner${where}. These totals stay in US dollars until ${quote.partnerName} returns a ${quote.currencyName} rate.`
  }
  const rate = quote.rateToUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })
  const place = quote.countryName ?? quote.currency
  if (quote.source === 'alternate') {
    return `These totals are in ${quote.currencyName}. ${quote.partnerName ?? 'A regional payout partner'} supplied the rate for ${place}. 1 USD equals ${rate} ${quote.currency}.`
  }
  return `These totals are in ${quote.currencyName}. ${quote.partnerName ?? 'The payout partner'} is the payout partner for ${place}. 1 USD equals ${rate} ${quote.currency}.`
}

export function formatAxisUsd(n: number) {
  if (n >= 10_000) return `$${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function relativeAge(iso: string, now = new Date()) {
  const from = new Date(iso)
  const ms = Math.max(0, now.getTime() - from.getTime())
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
