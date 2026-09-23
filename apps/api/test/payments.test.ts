import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { paymentErrorFromStripe } from '../src/lib/checkout.js'
import {
  chooseProvider,
  flutterwaveCurrency,
  paymentSecrets,
  stripeSecretProblem,
  usableStripeSecret,
} from '../src/lib/payments-config.js'
import { handleFlutterwaveWebhook, PaymentError } from '../src/lib/payments.js'
import { prisma } from '../src/lib/prisma.js'
import { encryptSecret, prepareSettingValue } from '../src/lib/settings.js'

async function setFlutterwaveHash(value: string | null) {
  if (value === null) {
    await prisma.platformSetting.deleteMany({ where: { key: 'payments.flutterwave.secret_hash' } })
    return
  }
  await prisma.platformSetting.upsert({
    where: { key: 'payments.flutterwave.secret_hash' },
    create: {
      key: 'payments.flutterwave.secret_hash',
      value,
      secret: true,
      label: 'Flutterwave webhook hash',
      group: 'Payments — Flutterwave',
    },
    update: { value },
  })
}

test('African buyers prefer Flutterwave when both gateways exist', () => {
  assert.equal(
    chooseProvider({ requested: undefined, stripe: true, flutterwave: true, africanBuyer: true, allowDev: false }),
    'flutterwave',
  )
  assert.equal(
    chooseProvider({ requested: undefined, stripe: true, flutterwave: true, africanBuyer: false, allowDev: false }),
    'stripe',
  )
})

test('explicit provider wins when configured', () => {
  assert.equal(
    chooseProvider({ requested: 'stripe', stripe: true, flutterwave: true, africanBuyer: true, allowDev: false }),
    'stripe',
  )
  assert.throws(
    () => chooseProvider({ requested: 'stripe', stripe: false, flutterwave: true, africanBuyer: true, allowDev: false }),
    (err: unknown) => err instanceof PaymentError && err.statusCode === 400 && /secret key/.test(err.message),
  )
})

test('dev fallback only in development when no keys', () => {
  assert.equal(
    chooseProvider({ requested: undefined, stripe: false, flutterwave: false, africanBuyer: true, allowDev: true }),
    'dev',
  )
  assert.throws(
    () => chooseProvider({ requested: undefined, stripe: false, flutterwave: false, africanBuyer: false, allowDev: false }),
    (err: unknown) => err instanceof PaymentError && err.statusCode === 400 && /not configured/i.test(err.message) && err.statusCode < 500,
  )
})

test('Flutterwave uses supported local currency or USD', () => {
  assert.equal(flutterwaveCurrency('NGN'), 'NGN')
  assert.equal(flutterwaveCurrency('TZS'), 'TZS')
  assert.equal(flutterwaveCurrency('JPY'), 'USD')
})

test('50% contributor share rounding', () => {
  const share = 0.5
  assert.equal(Math.round(12 * share * 100) / 100, 6)
  assert.equal(Math.round(12.5 * share * 100) / 100, 6.25)
})

test('Flutterwave webhook rejects when no secret hash is configured', async () => {
  await setFlutterwaveHash(null)
  await assert.rejects(
    () => handleFlutterwaveWebhook({ event: 'charge.completed', data: { status: 'successful', tx_ref: 'anything' } }),
    (err: unknown) => err instanceof PaymentError && err.statusCode === 503,
  )
})

test('Flutterwave webhook rejects a forged/missing signature', async () => {
  await setFlutterwaveHash('correct-hash')
  try {
    await assert.rejects(
      () =>
        handleFlutterwaveWebhook(
          { event: 'charge.completed', data: { status: 'successful', tx_ref: 'anything' } },
          undefined,
        ),
      (err: unknown) => err instanceof PaymentError && err.statusCode === 401,
    )
    await assert.rejects(
      () =>
        handleFlutterwaveWebhook(
          { event: 'charge.completed', data: { status: 'successful', tx_ref: 'anything' } },
          'forged-hash',
        ),
      (err: unknown) => err instanceof PaymentError && err.statusCode === 401,
    )
  } finally {
    await setFlutterwaveHash(null)
  }
})

test('publishable and webhook values are not treated as a Stripe secret', () => {
  assert.equal(usableStripeSecret('  pk_test_abc  '), '')
  assert.equal(usableStripeSecret('"whsec_abc"'), '')
  assert.equal(usableStripeSecret('sk_test_abc\n'), 'sk_test_abc')
  assert.match(stripeSecretProblem('pk_live_abc') ?? '', /publishable/)
  assert.match(stripeSecretProblem('whsec_abc') ?? '', /webhook/)
  assert.equal(stripeSecretProblem('sk_live_abc'), null)
})

test('Stripe authentication failures stay a client error and do not echo the key', () => {
  const err = paymentErrorFromStripe(
    Object.assign(new Error('Invalid API Key provided: sk_test_51secretvalue'), {
      type: 'StripeAuthenticationError',
      statusCode: 401,
    }),
  )
  assert.equal(err.statusCode, 400)
  assert.equal(err.message.includes('sk_test_51secretvalue'), false)
  assert.match(err.message, /secret key/)
})

test('Stripe secret field rejects a publishable key and keeps a pasted secret', () => {
  assert.throws(
    () => prepareSettingValue('payments.stripe.secret_key', 'pk_test_abc'),
    (err: unknown) => err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 400,
  )
  assert.equal(
    prepareSettingValue('payments.stripe.secret_key', '  "sk_test_51abc"\n'),
    'sk_test_51abc',
  )
})

test('checkout uses a Stripe secret saved on the gateway when Admin Settings is empty', async () => {
  const envKey = 'STRIPE_SECRET_KEY'
  const settingKey = 'payments.stripe.secret_key'
  const previousEnv = process.env[envKey]
  delete process.env[envKey]
  const existingSetting = await prisma.platformSetting.findUnique({ where: { key: settingKey } })
  const existingGateway = await prisma.paymentGateway.findUnique({ where: { slug: 'stripe' } })
  await prisma.platformSetting.deleteMany({ where: { key: settingKey } })
  await prisma.paymentGateway.upsert({
    where: { slug: 'stripe' },
    create: {
      name: 'Stripe',
      slug: 'stripe',
      kind: 'checkout',
      countries: [],
      currencies: ['USD'],
      enabled: true,
      configEnc: encryptSecret('sk_test_gatewayfallbackkey'),
    },
    update: { kind: 'checkout', enabled: true, configEnc: encryptSecret('sk_test_gatewayfallbackkey') },
  })
  try {
    const secrets = await paymentSecrets()
    assert.equal(secrets.stripeSecret, 'sk_test_gatewayfallbackkey')
  } finally {
    if (previousEnv === undefined) delete process.env[envKey]
    else process.env[envKey] = previousEnv
    if (existingSetting) {
      await prisma.platformSetting.create({
        data: {
          key: existingSetting.key,
          value: existingSetting.value,
          secret: existingSetting.secret,
          label: existingSetting.label,
          group: existingSetting.group,
        },
      })
    }
    if (existingGateway) {
      await prisma.paymentGateway.update({
        where: { slug: 'stripe' },
        data: { configEnc: existingGateway.configEnc, kind: existingGateway.kind, enabled: existingGateway.enabled },
      })
    } else {
      await prisma.paymentGateway.deleteMany({ where: { slug: 'stripe' } })
    }
  }
})

function cookies(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie']
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).split(';')[0]).join('; ')
}

test('plan checkout explains a publishable key instead of an internal server error', async () => {
  const stripeKey = 'payments.stripe.secret_key'
  const flutterwaveKey = 'payments.flutterwave.secret_key'
  const previousStripeEnv = process.env.STRIPE_SECRET_KEY
  const previousFlutterwaveEnv = process.env.FLUTTERWAVE_SECRET_KEY
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.FLUTTERWAVE_SECRET_KEY
  const previousStripe = await prisma.platformSetting.findUnique({ where: { key: stripeKey } })
  const previousFlutterwave = await prisma.platformSetting.findUnique({ where: { key: flutterwaveKey } })
  const gateways = await prisma.paymentGateway.findMany({ where: { configEnc: { not: null } } })
  await prisma.platformSetting.deleteMany({ where: { key: { in: [stripeKey, flutterwaveKey] } } })
  if (gateways.length) {
    await prisma.paymentGateway.updateMany({
      where: { id: { in: gateways.map((g) => g.id) } },
      data: { configEnc: null },
    })
  }
  await prisma.platformSetting.create({
    data: {
      key: stripeKey,
      value: 'pk_test_saved_as_secret',
      secret: true,
      label: 'Stripe secret key',
      group: 'Payments — Stripe',
    },
  })
  let app: Awaited<ReturnType<typeof buildApp>> | undefined
  try {
    app = await buildApp()
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `checkout-${Date.now()}@vuekumi.demo`,
        password: 'User12345!',
        name: 'Checkout Probe',
        accountType: 'user',
        country: 'US',
      },
    })
    assert.equal(registered.statusCode, 200, registered.body)
    const started = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { cookie: cookies(registered) },
      payload: {},
    })
    assert.equal(started.statusCode, 400, started.body)
    const body = started.json() as { error?: string }
    assert.match(body.error ?? '', /publishable key/)
  } finally {
    await app?.close()
    if (previousStripeEnv === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = previousStripeEnv
    if (previousFlutterwaveEnv === undefined) delete process.env.FLUTTERWAVE_SECRET_KEY
    else process.env.FLUTTERWAVE_SECRET_KEY = previousFlutterwaveEnv
    await prisma.platformSetting.deleteMany({ where: { key: { in: [stripeKey, flutterwaveKey] } } })
    if (previousStripe) {
      await prisma.platformSetting.create({ data: { key: previousStripe.key, value: previousStripe.value, secret: previousStripe.secret, label: previousStripe.label, group: previousStripe.group } })
    }
    if (previousFlutterwave) {
      await prisma.platformSetting.create({ data: { key: previousFlutterwave.key, value: previousFlutterwave.value, secret: previousFlutterwave.secret, label: previousFlutterwave.label, group: previousFlutterwave.group } })
    }
    for (const gateway of gateways) {
      await prisma.paymentGateway.update({ where: { id: gateway.id }, data: { configEnc: gateway.configEnc } })
    }
  }
})
