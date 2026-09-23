import { config } from '../config.js'
import { PaymentError } from './payment-error.js'
import { decryptSecret, getSetting } from './settings.js'
import { prisma } from './prisma.js'

export type CheckoutProvider = 'stripe' | 'flutterwave' | 'dev'

export const STRIPE_NOT_CONFIGURED =
  'Stripe is not configured. In Admin → Gateways, open Stripe and paste the secret key (sk_… or rk_…). A publishable key cannot start checkout.'

export const PAYMENTS_NOT_CONFIGURED =
  'Payments are not configured. In Admin → Gateways, open Stripe and paste the secret key (sk_… or rk_…). A publishable key cannot start checkout.'

const FLUTTERWAVE_CURRENCIES = new Set([
  'NGN', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'USD', 'EUR', 'GBP', 'XOF', 'XAF',
])

export async function getContributorShare() {
  const raw = (await getSetting('payments.contributor_share')) ?? '0.5'
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.5
  return n
}

/** Trim, drop wrapping quotes, and remove line breaks pasted in from a dashboard. */
export function normalizeSecret(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^['"]+|['"]+$/g, '').replace(/\s+/g, '')
}

/** Publishable keys and webhook secrets are not checkout credentials. */
export function usableStripeSecret(value: string | null | undefined): string {
  const secret = normalizeSecret(value)
  if (!secret || secret.startsWith('pk_') || secret.startsWith('whsec_')) return ''
  return secret
}

export function stripeSecretProblem(value: string | null | undefined): string | null {
  const secret = normalizeSecret(value)
  if (!secret) return null
  if (secret.startsWith('pk_')) {
    return 'That is a Stripe publishable key (pk_…). Paste the secret key (sk_… or rk_…) into the Stripe secret key on Admin → Gateways.'
  }
  if (secret.startsWith('whsec_')) {
    return 'That is a Stripe webhook secret (whsec_…). Paste it into the Stripe webhook field, and put the secret key (sk_… or rk_…) into the secret key field.'
  }
  return null
}

function gatewayMatches(row: { slug: string; name: string }, provider: 'stripe' | 'flutterwave'): boolean {
  const slug = row.slug.toLowerCase()
  const name = row.name.toLowerCase()
  if (provider === 'stripe') return slug === 'stripe' || slug.startsWith('stripe-') || name === 'stripe'
  return slug === 'flutterwave' || slug.startsWith('flutterwave-') || name === 'flutterwave'
}

function readEncrypted(stored: string | null | undefined): string {
  if (!stored) return ''
  try {
    return normalizeSecret(decryptSecret(stored))
  } catch {
    return ''
  }
}

async function checkoutGateway(provider: 'stripe' | 'flutterwave') {
  const rows = await prisma.paymentGateway.findMany({
    where: { enabled: true, kind: { in: ['checkout', 'both'] } },
  })
  return rows
    .filter((row) => gatewayMatches(row, provider))
    .sort((a, b) => Number(b.slug.toLowerCase() === provider) - Number(a.slug.toLowerCase() === provider))[0] ?? null
}

export async function paymentSecrets() {
  const stripeGateway = await checkoutGateway('stripe')
  const flutterwaveGateway = await checkoutGateway('flutterwave')
  const gatewayStripe = readEncrypted(stripeGateway?.configEnc)
  const settingsStripe = normalizeSecret(await getSetting('payments.stripe.secret_key'))
  const gatewayFlutterwave = readEncrypted(flutterwaveGateway?.configEnc)
  const settingsFlutterwave = normalizeSecret(await getSetting('payments.flutterwave.secret_key'))
  return {
    stripeSecret: usableStripeSecret(gatewayStripe) || settingsStripe,
    stripeWebhook: readEncrypted(stripeGateway?.webhookSecretEnc)
      || normalizeSecret(await getSetting('payments.stripe.webhook_secret')),
    flutterwaveSecret: gatewayFlutterwave || settingsFlutterwave,
    flutterwavePublic: normalizeSecret(flutterwaveGateway?.publicKey)
      || normalizeSecret(await getSetting('payments.flutterwave.public_key')),
    flutterwaveHash: readEncrypted(flutterwaveGateway?.webhookSecretEnc)
      || normalizeSecret(await getSetting('payments.flutterwave.secret_hash')),
  }
}

/** Explain a saved-but-unusable Stripe key before falling through to "not configured". */
export function assertStripeSecretUsable(
  secrets: { stripeSecret: string; flutterwaveSecret: string },
  requested?: 'stripe' | 'flutterwave',
) {
  const problem = stripeSecretProblem(secrets.stripeSecret)
  const flutterwave = Boolean(normalizeSecret(secrets.flutterwaveSecret))
  if (problem && (requested === 'stripe' || (!requested && !flutterwave))) {
    throw new PaymentError(problem, 400)
  }
}

export async function listCheckoutMethods(countryCode?: string | null) {
  const secrets = await paymentSecrets()
  const stripe = Boolean(usableStripeSecret(secrets.stripeSecret))
  const flutterwave = Boolean(normalizeSecret(secrets.flutterwaveSecret))
  let region: string | null = null
  if (countryCode) {
    const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } })
    region = country?.region ?? null
  }
  let preferred: CheckoutProvider | null = null
  try {
    preferred = chooseProvider({
      requested: undefined,
      stripe,
      flutterwave,
      africanBuyer: region === 'africa',
      allowDev: config.isDev,
    })
  } catch (err) {
    if (!(err instanceof PaymentError)) throw err
  }
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
  if (input.requested === 'stripe' && !input.stripe) throw new PaymentError(STRIPE_NOT_CONFIGURED, 400)
  if (input.requested === 'flutterwave' && !input.flutterwave) {
    throw new PaymentError('Flutterwave is not configured. Open Flutterwave on Admin → Gateways and paste the secret key.', 400)
  }
  if (input.africanBuyer && input.flutterwave) return 'flutterwave'
  if (input.stripe) return 'stripe'
  if (input.flutterwave) return 'flutterwave'
  if (input.allowDev) return 'dev'
  throw new PaymentError(PAYMENTS_NOT_CONFIGURED, 400)
}

export function flutterwaveCurrency(preferred: string) {
  const code = preferred.toUpperCase()
  return FLUTTERWAVE_CURRENCIES.has(code) ? code : 'USD'
}
