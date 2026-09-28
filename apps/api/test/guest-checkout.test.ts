import assert from 'node:assert/strict'
import { test } from 'node:test'
import { purchaseLicenseSchema } from '@vuekumi/shared'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { ensureGuestBuyer, GuestBuyerError } from '../src/lib/guest-buyers.js'

test('purchaseLicenseSchema accepts guestEmail for paid guest checkout', () => {
  const parsed = purchaseLicenseSchema.safeParse({
    type: 'commercial',
    guestEmail: 'buyer@example.com',
    guestName: 'Ada Buyer',
  })
  assert.equal(parsed.success, true)
})

test('ensureGuestBuyer creates passwordless user and refuses password accounts', async () => {
  const email = `guest-buyer-${Date.now()}@vuekumi.demo`
  const created = await ensureGuestBuyer({ email, name: 'Guest Buyer' })
  assert.equal(created.email, email)
  assert.equal(created.passwordHash, null)
  assert.equal(created.accountType, 'user')

  const again = await ensureGuestBuyer({ email, name: 'Guest Buyer' })
  assert.equal(again.id, created.id)

  await prisma.user.update({
    where: { id: created.id },
    data: { passwordHash: 'not-a-real-hash-but-present' },
  })
  await assert.rejects(
    () => ensureGuestBuyer({ email }),
    (err: unknown) => err instanceof GuestBuyerError && err.statusCode === 409,
  )

  await prisma.userProfile.deleteMany({ where: { userId: created.id } })
  await prisma.user.delete({ where: { id: created.id } })
})

test('guest can start paid license checkout without prior login', async () => {
  const app = await buildApp()
  const email = `guest-checkout-${Date.now()}@vuekumi.demo`
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/api/photos/afr-020/licenses',
      payload: {
        type: 'commercial',
        guestEmail: email,
        guestName: 'Guest Checkout',
      },
    })
    // Dev may return checkout or a payment-config error — never 401 for paid guest path.
    assert.notEqual(res.statusCode, 401, res.body)
    if (res.statusCode === 200) {
      const body = res.json() as {
        checkout?: { id?: string; paymentId?: string; url?: string }
        guestCheckout?: boolean
      }
      assert.equal(body.guestCheckout, true)
      assert.ok(body.checkout?.paymentId || body.checkout?.id)
      assert.ok(body.checkout?.url)
      const raw = res.headers['set-cookie']
      const jar = Array.isArray(raw) ? raw.join(';') : String(raw ?? '')
      assert.match(jar, /access_token/)
    } else {
      // Missing Stripe/Flutterwave secrets in some envs still proves auth path.
      assert.match((res.json() as { error?: string }).error ?? '', /payment|stripe|flutterwave|provider|secret/i)
    }

    const free = await app.inject({
      method: 'POST',
      url: '/api/photos/afr-005/licenses',
      payload: { type: 'royalty_free', guestEmail: email },
    })
    assert.equal(free.statusCode, 401)
  } finally {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } })
      await prisma.payment.deleteMany({ where: { buyerId: user.id } })
      await prisma.userProfile.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
    await app.close()
  }
})
