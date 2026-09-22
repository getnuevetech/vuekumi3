import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseProvider, flutterwaveCurrency } from '../src/lib/payments-config.js'
import { handleFlutterwaveWebhook, PaymentError } from '../src/lib/payments.js'
import { prisma } from '../src/lib/prisma.js'

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
  assert.throws(() =>
    chooseProvider({ requested: 'stripe', stripe: false, flutterwave: true, africanBuyer: true, allowDev: false }),
  )
})

test('dev fallback only in development when no keys', () => {
  assert.equal(
    chooseProvider({ requested: undefined, stripe: false, flutterwave: false, africanBuyer: true, allowDev: true }),
    'dev',
  )
  assert.throws(() =>
    chooseProvider({ requested: undefined, stripe: false, flutterwave: false, africanBuyer: false, allowDev: false }),
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
