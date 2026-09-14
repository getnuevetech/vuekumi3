import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseProvider, flutterwaveCurrency } from '../src/lib/payments-config.js'

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
