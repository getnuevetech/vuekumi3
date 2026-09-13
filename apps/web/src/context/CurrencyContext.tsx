import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, type PricingQuote } from '../api/client'
import { useAuth } from './AuthContext'

interface CurrencyContextValue {
  quote: PricingQuote
  format: (usdAmount: number) => string
  setCountry: (code: string) => void
}

const defaultQuote: PricingQuote = {
  countryCode: null,
  countryName: null,
  currency: 'USD',
  currencyName: 'US Dollar',
  rateToUsd: 1,
  source: 'default',
  fetchedAt: null,
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [quote, setQuote] = useState<PricingQuote>(defaultQuote)

  const load = useCallback(async (country?: string) => {
    try {
      const next = await api.pricing(country)
      setQuote(next)
    } catch {
      setQuote(defaultQuote)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('vuekumi.country') ?? undefined
    load(user?.country ?? stored)
  }, [load, user?.country])

  const setCountry = useCallback((code: string) => {
    localStorage.setItem('vuekumi.country', code)
    void load(code)
  }, [load])

  const format = useCallback((usdAmount: number) => {
    const local = usdAmount * (quote.rateToUsd || 1)
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: quote.currency,
        maximumFractionDigits: quote.currency === 'USD' || quote.currency === 'EUR' || quote.currency === 'GBP' ? 2 : local >= 100 ? 0 : 2,
      }).format(local)
    } catch {
      return `${quote.currency} ${local.toFixed(2)}`
    }
  }, [quote])

  const value = useMemo(() => ({ quote, format, setCountry }), [quote, format, setCountry])
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
