import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encryptSecret } from '../src/lib/settings.js'
import {
  orderPayoutPartners,
  parseFlutterwaveRate,
  parseStripeUsdRate,
  pickPayoutRate,
  syncPayoutRates,
  type PayoutGatewayRef,
} from '../src/lib/payout-fx.js'
import { prisma } from '../src/lib/prisma.js'

const flutterwave: PayoutGatewayRef = {
  id: 'gw_flutterwave',
  name: 'Flutterwave',
  slug: 'flutterwave',
  kind: 'both',
  countries: ['NG', 'GH', 'KE'],
  currencies: ['NGN', 'GHS', 'KES'],
  enabled: true,
}
const paystack: PayoutGatewayRef = {
  id: 'gw_paystack',
  name: 'Paystack',
  slug: 'paystack',
  kind: 'both',
  countries: ['NG', 'GH'],
  currencies: ['NGN', 'GHS'],
  enabled: true,
}
const mpesa: PayoutGatewayRef = {
  id: 'gw_mpesa',
  name: 'M-Pesa',
  slug: 'mpesa',
  kind: 'payout',
  countries: ['KE'],
  currencies: ['KES'],
  enabled: true,
}
const stripe: PayoutGatewayRef = {
  id: 'gw_stripe',
  name: 'Stripe',
  slug: 'stripe',
  kind: 'checkout',
  countries: [],
  currencies: ['USD'],
  enabled: true,
}

test('flutterwave rate is destination amount per 1 USD', () => {
  assert.equal(parseFlutterwaveRate({
    status: 'success',
    data: {
      rate: 1600,
      source: { currency: 'USD', amount: 1 },
      destination: { currency: 'NGN', amount: 1600 },
    },
  }), 1600)
  assert.equal(parseFlutterwaveRate({
    status: 'success',
    data: {
      source: { amount: 2 },
      destination: { amount: 3200 },
    },
  }), 1600)
  assert.equal(parseFlutterwaveRate({ status: 'error', data: { rate: 10 } }), null)
})

test('stripe rate is units of the home currency for 1 USD', () => {
  assert.equal(parseStripeUsdRate({ rates: { ngn: 1550.5, eur: 0.92 } }, 'NGN'), 1550.5)
  assert.equal(parseStripeUsdRate({ rates: { eur: 0 } }, 'EUR'), null)
  assert.equal(parseStripeUsdRate({}, 'NGN'), null)
})

test('an unassigned country prefers the payout partner that can quote a rate', () => {
  const airtel: PayoutGatewayRef = {
    id: 'gw_airtel',
    name: 'Airtel Money',
    slug: 'airtel-money',
    kind: 'payout',
    countries: ['NG', 'KE'],
    currencies: ['NGN', 'KES'],
    enabled: true,
  }
  const ordered = orderPayoutPartners({
    countryCode: 'NG',
    regionCountryCodes: ['NG', 'GH', 'KE'],
    currency: 'NGN',
    primaryId: null,
    gateways: [airtel, paystack, stripe, flutterwave],
  })
  assert.equal(ordered[0]?.slug, 'flutterwave')
})

test('nigeria uses the assigned payout partner, then another partner, and skips checkout', () => {
  const ordered = orderPayoutPartners({
    countryCode: 'NG',
    regionCountryCodes: ['NG', 'GH', 'KE'],
    currency: 'NGN',
    primaryId: 'gw_flutterwave',
    gateways: [paystack, stripe, mpesa, flutterwave],
  })
  assert.deepEqual(ordered.map((gateway) => gateway.slug), ['flutterwave', 'paystack'])
})

test('a missing primary rate can come from another partner in the region', () => {
  const regional: PayoutGatewayRef = {
    id: 'gw_regional',
    name: 'Flutterwave Ghana',
    slug: 'flutterwave-gh',
    kind: 'payout',
    countries: ['GH'],
    currencies: ['NGN', 'GHS'],
    enabled: true,
  }
  const ordered = orderPayoutPartners({
    countryCode: 'NG',
    regionCountryCodes: ['NG', 'GH'],
    currency: 'NGN',
    primaryId: 'gw_flutterwave',
    gateways: [flutterwave, regional],
  })
  assert.deepEqual(ordered.map((gateway) => gateway.id), ['gw_flutterwave', 'gw_regional'])
  const picked = pickPayoutRate([
    { gateway: ordered[0]!, role: 'primary', rateToUsd: null },
    { gateway: ordered[1]!, role: 'alternate', rateToUsd: 1490 },
  ])
  assert.equal(picked?.source, 'alternate')
  assert.equal(picked?.rateToUsd, 1490)
  assert.equal(pickPayoutRate([
    { gateway: ordered[0]!, role: 'primary', rateToUsd: null },
    { gateway: ordered[1]!, role: 'alternate', rateToUsd: null },
  ]), null)
})

test('sync stores the flutterwave rate and falls back inside the region', async () => {
  const stamp = Date.now().toString(36)
  const primary = await prisma.paymentGateway.create({
    data: {
      name: 'Flutterwave Test',
      slug: `flutterwave-test-${stamp}`,
      kind: 'payout',
      countries: ['NG'],
      currencies: ['NGN'],
      configEnc: encryptSecret('flw-test-secret'),
      enabled: true,
    },
  })
  const alternate = await prisma.paymentGateway.create({
    data: {
      name: 'Flutterwave Region Test',
      slug: `flutterwave-region-${stamp}`,
      kind: 'payout',
      countries: ['GH'],
      currencies: ['NGN'],
      configEnc: encryptSecret('flw-region-secret'),
      enabled: true,
    },
  })
  await prisma.countryPayoutConfig.upsert({
    where: { countryCode: 'NG' },
    create: { countryCode: 'NG', gatewayId: primary.id },
    update: { gatewayId: primary.id },
  })

  const fetchImpl: typeof fetch = async (_input, init) => {
    const auth = new Headers(init?.headers).get('authorization') ?? ''
    if (auth.includes('flw-test-secret')) {
      return new Response(JSON.stringify({ status: 'error' }), { status: 400 })
    }
    if (auth.includes('flw-region-secret')) {
      return new Response(JSON.stringify({
        status: 'success',
        data: { source: { amount: 1 }, destination: { amount: 1575 } },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response('no', { status: 404 })
  }

  try {
    const first = await syncPayoutRates({ countryCodes: ['NG'], fetchImpl })
    assert.equal(first.updated, 1)
    const stored = await prisma.payoutFxRate.findUnique({ where: { countryCode: 'NG' } })
    assert.equal(stored?.rateToUsd, 1575)
    assert.equal(stored?.source, 'alternate')
    assert.equal(stored?.gatewayId, alternate.id)
    assert.equal(stored?.currency, 'NGN')

    const again = await syncPayoutRates({
      countryCodes: ['NG'],
      fetchImpl: async () => new Response('no', { status: 404 }),
    })
    assert.equal(again.updated, 0)
    const kept = await prisma.payoutFxRate.findUnique({ where: { countryCode: 'NG' } })
    assert.equal(kept?.rateToUsd, 1575)
  } finally {
    await prisma.payoutFxRate.deleteMany({ where: { countryCode: 'NG' } })
    await prisma.countryPayoutConfig.deleteMany({ where: { countryCode: 'NG' } })
    await prisma.paymentGateway.deleteMany({ where: { id: { in: [primary.id, alternate.id] } } })
  }
})
