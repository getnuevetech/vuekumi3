import { config } from '../config.js'
import { getSetting } from './settings.js'
import { prisma } from './prisma.js'

export type CheckoutProvider = 'stripe' | 'flutterwave' | 'dev'

const FLUTTERWAVE_CURRENCIES = new Set([
  'NGN', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'USD', 'EUR', 'GBP', 'XOF', 'XAF',
])

export async function getContributorShare() {
  const raw = (await getSetting('payments.contributor_share')) ?? '0.5'
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.5
  return n
}

export async function paymentSecrets() {
  return {
    stripeSecret: (await getSetting('payments.stripe.secret_key')) ?? '',
    stripeWebhook: (await getSetting('payments.stripe.webhook_secret')) ?? '',
    flutterwaveSecret: (await getSetting('payments.flutterwave.secret_key')) ?? '',
    flutterwavePublic: (await getSetting('payments.flutterwave.public_key')) ?? '',
    flutterwaveHash: (await getSetting('payments.flutterwave.secret_hash')) ?? '',
  }
}

export async function listCheckoutMethods(countryCode?: string | null) {
  const secrets = await paymentSecrets()
  const stripe = Boolean(secrets.stripeSecret)
  const flutterwave = Boolean(secrets.flutterwaveSecret)
  let region: string | null = null
  if (countryCode) {
    const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } })
    region = country?.region ?? null
  }
  const preferred = chooseProvider({
    requested: undefined,
    stripe,
    flutterwave,
    africanBuyer: region === 'africa',
    allowDev: config.isDev,
  })
  return {
    stripe,
    flutterwave,
    dev: preferred === 'dev',
    defaultProvider: preferred,
    contributorShare: await getContributorShare(),
  }
}

export function chooseProvider(input: {
  requested?: 'stripe' | 'flutterwave'
  stripe: boolean
  flutterwave: boolean
  africanBuyer: boolean
  allowDev: boolean
}): CheckoutProvider {
  if (input.requested === 'stripe' && input.stripe) return 'stripe'
  if (input.requested === 'flutterwave' && input.flutterwave) return 'flutterwave'
  if (input.requested && ((input.requested === 'stripe' && !input.stripe) || (input.requested === 'flutterwave' && !input.flutterwave))) {
    throw Object.assign(new Error(`${input.requested} is not configured in Admin Settings`), { statusCode: 400 })
  }
  if (input.africanBuyer && input.flutterwave) return 'flutterwave'
  if (input.stripe) return 'stripe'
  if (input.flutterwave) return 'flutterwave'
  if (input.allowDev) return 'dev'
  throw Object.assign(
    new Error('Payments are not configured. Add Stripe or Flutterwave keys in Admin Settings.'),
    { statusCode: 503 },
  )
}

export function flutterwaveCurrency(preferred: string) {
  const code = preferred.toUpperCase()
  return FLUTTERWAVE_CURRENCIES.has(code) ? code : 'USD'
}
